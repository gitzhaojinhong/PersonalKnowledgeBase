
> 本章节通过真实业务场景，讲解 Redis 在 Java Web 项目中的典型应用。

## 4.1 短信登录

### 4.1.1 需求分析

实现短信验证码登录功能，流程如下：

1. 用户提交手机号，发送验证码
2. 验证码存入 Redis，设置5分钟有效期
3. 用户输入验证码登录，系统校验
4. 登录成功后生成 Token（Token即SessionID），返回给客户端

### 4.1.2 核心实现

**发送验证码接口**：

```java
@RequestMapping("/user")
@RestController
public class UserController {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    private static final String SMS_CODE_PREFIX = "phone:code:";
    private static final long CODE_TTL = 5L; // 5分钟

    /**
     * 发送验证码
     */
    @PostMapping("/code")
    public Result sendCode(@RequestParam("phone") String phone) {
        // 1. 生成6位验证码
        String code = RandomUtil.randomNumbers(6);

        // 2. 存入Redis，key = "phone:code:手机号"，有效期5分钟
        stringRedisTemplate.opsForValue().set(
            SMS_CODE_PREFIX + phone,  // key
            code,                     // value
            CODE_TTL,                 // 过期时间
            TimeUnit.MINUTES          // 时间单位
        );

        // 3. TODO: 调用第三方短信服务发送验证码（生产环境）
        // smsService.send(phone, code);

        System.out.println("验证码：" + code); // 开发时打印，生产环境删除
        return Result.ok("验证码已发送");
    }
}
```

**用户登录接口**：

```java
@Autowired
private IUserService userService;

private static final String LOGIN_TOKEN_PREFIX = "user:token:";

/**
 * 登录
 */
@PostMapping("/login")
public Result login(@RequestBody LoginForm form) {
    // 1. 校验手机号格式
    if (!RegexUtils.isPhoneInvalid(form.getPhone())) {
        return Result.fail("手机号格式错误");
    }

    // 2. 校验验证码
    String cacheCode = stringRedisTemplate.opsForValue().get(SMS_CODE_PREFIX + form.getPhone());
    if (cacheCode == null || !cacheCode.equals(form.getCode())) {
        return Result.fail("验证码错误");
    }

    // 3. 根据手机号查询用户
    User user = userService.query().eq("phone", form.getPhone()).one();

    // 4. 如果用户不存在，则创建新用户
    if (user == null) {
        user = CreateUser(form.getPhone());
    }

    // 5. 生成Token，存入Redis，设置30分钟有效期
    String token = UUID.randomUUID().toString(true);
    stringRedisTemplate.opsForValue().set(
        LOGIN_TOKEN_PREFIX + token,
        JsonUtil.toStr(user),
        30L, TimeUnit.MINUTES
    );

    return Result.ok(token);
}
```

### 4.1.3 用户登录状态校验拦截器

使用拦截器从请求头获取 Token，查询 Redis 验证登录状态：

```java
@Component
public class LoginInterceptor implements HandlerInterceptor {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    private static final String TOKEN_HEADER = "Authorization";
    private static final String TOKEN_PREFIX = "user:token:";

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 1. 获取Token
        String token = request.getHeader(TOKEN_HEADER);
        if (StrUtil.isBlank(token)) {
            response.setStatus(401);
            return false;
        }

        // 2. 查询Redis
        String userJson = stringRedisTemplate.opsForValue().get(TOKEN_PREFIX + token);
        if (userJson == null) {
            response.setStatus(401);
            return false;
        }

        // 3. 存入ThreadLocal，供后续Controller使用
        UserHolder.saveUser(JsonUtil.toBean(userJson, UserDTO.class));

        // 4. 刷新Token有效期（可选）
        stringRedisTemplate.expire(TOKEN_PREFIX + token, 30L, TimeUnit.MINUTES);

        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        UserHolder.removeUser();
    }
}
```

## 4.2 商户缓存

### 4.2.1 需求分析

商户查询是高频操作，每次都查数据库压力大。使用 Redis 作为缓存，流程如下：

- 先查 Redis，命中则直接返回
- 未命中则查数据库，然后写入 Redis，并设置过期时间
- 更新商户时删除 Redis 缓存（Cache Aside 模式）

### 4.2.2 核心实现

```java
@Service
public class ShopServiceImpl extends ServiceImpl<ShopMapper, Shop> implements IShopService {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    private static final String SHOP_CACHE_KEY = "cache:shop:";
    private static final long CACHE_TTL = 30L; // 缓存30分钟

    @Override
    public Result queryById(Long id) {
        // 1. 查询缓存
        String cacheKey = SHOP_CACHE_KEY + id;
        String cache = stringRedisTemplate.opsForValue().get(cacheKey);

        if (StrUtil.isNotBlank(cache)) {
            // 2. 命中缓存，直接返回
            return Result.ok(JsonUtil.toBean(cache, Shop.class));
        }

        // 3. 未命中，查询数据库
        Shop shop = getById(id);
        if (shop == null) {
            return Result.fail("商户不存在");
        }

        // 4. 写入缓存
        stringRedisTemplate.opsForValue().set(cacheKey, JsonUtil.toStr(shop), CACHE_TTL, TimeUnit.MINUTES);

        return Result.ok(shop);
    }

    @Override
    public Result update(Shop shop) {
        Long id = shop.getId();
        if (id == null) {
            return Result.fail("商户ID不能为空");
        }

        // 1. 更新数据库
        updateById(shop);

        // 2. 删除缓存
        stringRedisTemplate.delete(SHOP_CACHE_KEY + id);

        return Result.ok();
    }
}
```

> **缓存更新策略**：采用 **Cache Aside（旁路缓存）** 模式，即读的时候先读缓存，没有则读数据库并写入缓存；写的时候先更新数据库，再删除缓存。**注意这里是删除缓存而非更新缓存**，因为更新缓存可能产生并发安全问题。

### 4.2.3 缓存穿透

**问题**：查询一个数据库和缓存都不存在的数据，每次都打到数据库。

**解决方案**：缓存空值。当数据库查不到时，在 Redis 中缓存一个空值（`null` 或空字符串`""`），并设置短过期时间（防止正常数据更新后无法更新）：

```java
@Override
public Result queryById(Long id) {
    String cacheKey = SHOP_CACHE_KEY + id;
    String cache = stringRedisTemplate.opsForValue().get(cacheKey);

    if (StrUtil.isNotBlank(cache)) {
        return Result.ok(JsonUtil.toBean(cache, Shop.class));
    }

    // 注意：空字符串也是 isNotBlank 的情况，所以要在上面提前返回
    // 如果 cache == ""，说明是缓存的空值
    if ("".equals(cache)) {
        return Result.fail("商户不存在"); // 快速失败，不查数据库
    }

    Shop shop = getById(id);
    if (shop == null) {
        // 缓存空值，TTL短一些，比如1分钟
        stringRedisTemplate.opsForValue().set(cacheKey, "", 1L, TimeUnit.MINUTES);
        return Result.fail("商户不存在");
    }

    stringRedisTemplate.opsForValue().set(cacheKey, JsonUtil.toStr(shop), CACHE_TTL, TimeUnit.MINUTES);
    return Result.ok(shop);
}
```

### 4.2.4 缓存雪崩

**问题**：大量缓存同时过期，导致大量请求同时打到数据库。

**解决方案**：
1. 给每个 key 的过期时间加上随机值（`TTL + Random(0, 5分钟)`）
2. 使用逻辑过期（不设置真实过期时间，另起线程异步更新缓存）
3. 使用多级缓存架构

### 4.2.5 缓存击穿

**问题**：同一个热点 key 突然过期，导致大量并发同时查数据库。

**解决方案**：
1. **互斥锁**：用 SETNX 实现锁，同一时间只有一个线程查数据库
2. **逻辑过期**：不给 key 设置真实过期时间，value 中存入数据+过期时间戳，业务代码判断是否过期

**互斥锁实现**：

```java
private static final String LOCK_KEY_PREFIX = "lock:shop:";

private boolean tryLock(String key) {
    Boolean flag = stringRedisTemplate.opsForValue().setIfAbsent(LOCK_KEY_PREFIX + key, "1", 10L, TimeUnit.SECONDS);
    return BooleanUtil.isTrue(flag);
}

public Result queryById(Long id) {
    String cacheKey = SHOP_CACHE_KEY + id;
    String cache = stringRedisTemplate.opsForValue().get(cacheKey);

    if (StrUtil.isNotBlank(cache)) {
        return Result.ok(JsonUtil.toBean(cache, Shop.class));
    }

    // 尝试获取锁
    String lockKey = LOCK_KEY_PREFIX + id;
    Shop shop = null;
    try {
        if (!tryLock(lockKey)) {
            // 没拿到锁，短暂等待后重试
            Thread.sleep(50);
            return queryById(id); // 递归重试
        }

        // 拿到锁了，再查一次缓存（可能其他线程刚写入）
        cache = stringRedisTemplate.opsForValue().get(cacheKey);
        if (StrUtil.isNotBlank(cache)) {
            return Result.ok(JsonUtil.toBean(cache, Shop.class));
        }

        // 查数据库
        shop = getById(id);
        Thread.sleep(200); // 模拟查询数据库的耗时

        if (shop == null) {
            return Result.fail("商户不存在");
        }

        // 写入缓存
        stringRedisTemplate.opsForValue().set(cacheKey, JsonUtil.toStr(shop), CACHE_TTL, TimeUnit.MINUTES);
    } catch (InterruptedException e) {
        throw new RuntimeException(e);
    } finally {
        // 释放锁
        stringRedisTemplate.delete(lockKey);
    }

    return Result.ok(shop);
}
```

## 4.3 优惠券秒杀

### 4.3.1 全局唯一ID

优惠券订单 ID 不能用数据库自增：用 MySQL 自增ID容易被他人推算订单量；分库分表后不同表ID可能冲突。

**解决方案**：使用 Redis ID 生成器。ID格式为 `时间戳(32位) + 序列号(32位)`，保证全局唯一且趋势递增。

```java
@Component
public class RedisIdWorker {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    // 2024年1月1日0点的毫秒数
    private static final long BEGIN_TIMESTAMP = 1704067200L;

    /**
     * 生成全局唯一ID
     * @param keyPrefix ID业务标识，如 "order"
     */
    public long nextId(String keyPrefix) {
        // 1. 当前时间戳 - 起始时间戳
        long currentTime = (System.currentTimeMillis() / 1000) - BEGIN_TIMESTAMP;

        // 2. 拼接时间戳和序列号
        String dateTime = String.valueOf(currentTime);
        String serial = stringRedisTemplate.opsForValue().increment("icr:" + keyPrefix).toString();

        // 序列号补齐，保证固定长度
        serial = serial.length() < 6 ? String.format("%06d", Long.parseLong(serial)) : serial;

        return Long.parseLong(dateTime + serial);
    }
}
```

### 4.3.2 超卖问题

**问题**：多个线程同时查询库存 > 0，然后同时扣减库存，导致超卖。

**解决方案**：使用 Redis 的 DECR 原子操作扣减库存 + Lua 脚本保证原子性。

**Lua 脚本（扣减库存）**：

```lua
-- 1. 判断库存是否充足
local stock = redis.call('get', KEYS[1])
if tonumber(stock) < tonumber(ARGV[1]) then
    return -1  -- 库存不足
end

-- 2. 扣减库存
redis.call('decrby', KEYS[1], ARGV[1])

-- 3. 返回扣减后的库存
return redis.call('get', KEYS[1])
```

**Java 代码**：

```java
@Autowired
private StringRedisTemplate stringRedisTemplate;

private static final DefaultRedisScript<Long> SECKILL_SCRIPT;

static {
    SECKILL_SCRIPT = new DefaultRedisScript<>();
    SECKILL_SCRIPT.setScriptText(
        "local stock = redis.call('get', KEYS[1]) " +
        "if tonumber(stock) < tonumber(ARGV[1]) then " +
        "    return -1 " +
        "end " +
        "redis.call('decrby', KEYS[1], ARGV[1]) " +
        "return redis.call('get', KEYS[1])"
    );
    SECKILL_SCRIPT.setResultType(Long.class);
}

public Result seckill(Long voucherId, Long userId) {
    String stockKey = "seckill:stock:" + voucherId;

    // 执行Lua脚本原子扣减库存
    Long stock = stringRedisTemplate.execute(
        SECKILL_SCRIPT,
        Collections.singletonList(stockKey),
        "1"  // 扣减1份
    );

    if (stock == -1) {
        return Result.fail("库存不足");
    }

    // TODO: 创建订单...
    return Result.ok("秒杀成功");
}
```

### 4.3.3 一人一单

**问题**：同一用户购买多张优惠券。

**解决方案**：在扣库存之前，先判断该用户是否已经购买过。

```lua
-- Lua脚本：扣库存+判断一人一单
local voucherId = ARGV[1]
local userId = ARGV[2]
local stockKey = 'seckill:stock:' .. voucherId
local orderKey = 'seckill:order:' .. voucherId

-- 1. 检查库存
local stock = redis.call('get', stockKey)
if tonumber(stock) < 1 then
    return -1
end

-- 2. 检查用户是否已下单（userId 存在则返回1）
local exist = redis.call('sismember', orderKey, userId)
if tonumber(exist) == 1 then
    return -2  -- 已购买
end

-- 3. 扣减库存
redis.call('decrby', stockKey, 1)

-- 4. 记录用户到Set
redis.call('sadd', orderKey, userId)

return 1
```

## 4.4 UV 统计（海量数据去重）

### 4.4.1 需求分析

统计页面的日访问量（UV）：
- **PV（Page View）**：页面访问量，同一用户访问多次算多次
- **UV（Unique Visitor）**：独立访客数，需要去重

**方案**：使用 Redis 的 HyperLogLog 或 Set。HyperLogLog 精度略低但内存极省（每个 Key 仅占 12KB），适合亿级UV统计；Set 精度100%但内存消耗大，适合百万级UV统计。

### 4.4.2 HyperLogLog 实现

```java
private static final String UV_KEY_PREFIX = "uv:";
private static final String UV_DATE_SUFFIX = ":";
private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyyMMdd");

@Autowired
private StringRedisTemplate stringRedisTemplate;

/**
 * 记录访问
 */
public void recordUv(String userId) {
    String key = UV_KEY_PREFIX + DATE_FORMAT.format(new Date());
    stringRedisTemplate.opsForHyperLogLog().add(key, userId);
}

/**
 * 统计UV
 */
public long uvCount(Date date) {
    String key = UV_KEY_PREFIX + DATE_FORMAT.format(date);
    Long size = stringRedisTemplate.opsForHyperLogLog().size(key);
    return size == null ? 0 : size;
}
```

### 4.4.3 聚合统计（多天UV之和）

```java
/**
 * 统计一段时间范围内的UV（去重合并）
 */
public long uvCountWithRange(Date start, Date end) {
    String[] keys = new String[days]; // 拼接每天的key
    for (int i = 0; i < days; i++) {
        keys[i] = UV_KEY_PREFIX + DATE_FORMAT.format(startDate);
        // startDate = startDate + 1天
    }

    Long size = stringRedisTemplate.opsForHyperLogLog().size(keys);
    return size == null ? 0 : size;
}
```

---

