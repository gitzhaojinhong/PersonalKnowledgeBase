
## 1.1 优化思路

分布式系统中，多个服务实例同时操作共享资源时，JVM 内置的 `synchronized` 和 `ReentrantLock` 只能保证单 JVM 内的线程安全，无法跨进程协调。一旦服务水平扩展，就必须引入**分布式锁**来保证数据一致性。

常见方案的对比：

| 方案 | 原理 | 优点 | 缺点 |
|------|------|------|------|
| 数据库乐观锁 | version 字段 CAS | 无外部依赖 | 高并发重试风暴，性能差 |
| 数据库悲观锁 | SELECT FOR UPDATE | 简单易用 | 锁行级别，高并发性能低 |
| Redis SETNX | 手动 SET NX EX | 轻量高效 | 需自行处理锁续期、可重入等边界问题 |
| **Redisson** | 基于 Redis 的完整分布式锁方案 | 支持可重入、WatchDog、多种锁类型 | 依赖 Redis |

**选择 Redisson 的核心理由：**

- 内置 WatchDog 自动续期，防止业务未执行完锁就过期
- 支持可重入锁、公平锁、读写锁等多种类型
- `tryLock` API 支持 waitTime / leaseTime，灵活控制等待与超时策略

然而，直接使用 Redisson API 会给业务代码带来大量非业务侵入：获取锁对象、try-finally 释放锁等逻辑每处都要重复编写。

**核心诉求：**

> 将分布式锁的获取、释放逻辑从业务代码中剥离，做成零侵入的通用组件，让业务方只需一个注解即可完成加锁。

## 1.2 方案设计

### 1.2.1 整体架构

基于 **注解 + AOP 环绕增强** 的思路实现：

```
业务方法调用
    ↓
AOP 切面拦截（@Around）
    ↓
解析注解参数（锁名、锁类型、锁策略）
    ↓
SPEL 解析动态锁名
    ↓
LockType 枚举获取对应锁对象
    ↓
LockStrategy 枚举执行加锁逻辑
    ↓
执行业务方法
    ↓
finally 中自动释放锁
```

非业务代码（加锁、释放锁）全部收口在切面，业务代码保持纯净。

### 1.2.2 组件结构

```
redisson/
├── RedissonConfig.java          # 自动配置类，适配单机/集群/哨兵
├── annotations/
│   └── Lock.java                # 分布式锁注解，携带所有锁参数
├── aspect/
│   └── LockAspect.java          # AOP 切面，环绕增强，含 SPEL 解析
└── enums/
    ├── LockType.java            # 锁类型枚举（可重入/公平/读/写）
    └── LockStrategy.java        # 锁失败策略枚举（5 种）
```

### 1.2.3 锁类型设计

Redisson 提供多种锁类型，通过 `LockType` 枚举封装，用户通过注解参数自由选择：

| 枚举值 | 锁类型 | 适用场景 |
|--------|--------|----------|
| `DEFAULT` | 可重入锁（ReentrantLock） | 通用场景，同一线程可重复获取 |
| `FAIR_LOCK` | 公平锁 | 需要严格按请求顺序排队的场景 |
| `READ_LOCK` | 读锁 | 多读少写，读操作之间不互斥 |
| `WRITE_LOCK` | 写锁 | 写操作与任何操作互斥 |

### 1.2.4 锁失败策略设计

**策略模式**

多线程竞争锁时，大部分请求会获取失败。失败后的处理策略从两个维度组合：

**维度一：是否重试**

- 不重试：`waitTime = 0`，失败立即返回
- 有限重试：`waitTime > 0`，在超时时间内不断重试
- 无限重试：调用 `lock.lock()`，一直阻塞到获取成功

**维度二：失败后如何处理**

- 直接结束：返回 `false`，调用方跳过业务
- 抛出异常：向上层抛出 `RuntimeException`，触发错误响应

两个维度组合出 5 种策略：

| 策略枚举 | 是否重试 | 失败处理 | 对应 API |
|----------|----------|----------|----------|
| `SKIP_FAST` | 不重试 | 直接结束 | `tryLock(0, leaseTime, unit)` |
| `FAIL_FAST` | 不重试 | 抛出异常 | `tryLock(0, leaseTime, unit)` |
| `SKIP_AFTER_RETRY_TIMEOUT` | 有限重试 | 直接结束 | `tryLock(waitTime, leaseTime, unit)` |
| `FAIL_AFTER_RETRY_TIMEOUT` | 有限重试 | 抛出异常 | `tryLock(waitTime, leaseTime, unit)` |
| `KEEP_RETRY` | 无限重试 | —— | `lock.lock(leaseTime, unit)` |

> 默认策略为 `FAIL_AFTER_RETRY_TIMEOUT`：在 waitTime 时间内不断重试，超时后抛出异常。

### 1.2.5 动态锁名（SPEL）

**工厂模式**

锁名称不应硬编码，而需要根据方法参数动态生成。例如，以当前用户 id 作为锁名的一部分，保证不同用户互不干扰。

采用 **Spring Expression Language（SPEL）** 解析锁名中的动态部分，语法为 `#{表达式}`：

```java
// 从方法参数中取 userId
@Lock(name = "coupon:#{userId}")
public void receiveCoupon(Long userId) { ... }

// 从 UserContext 静态方法获取当前用户
@Lock(name = "like:#{T(com.tianji.common.utils.UserContext).getUser()}")
public void addLike(Long bizId) { ... }
```

### 1.2.6 自动配置机制

`RedissonConfig` 添加了 `@ConditionalOnClass({RedissonClient.class, Redisson.class})` 条件注解：

- **引入了 Redisson 依赖** → 自动配置生效，创建 `RedissonClient` 和 `LockAspect`
- **未引入 Redisson 依赖** → 配置完全不生效，不影响其他服务

无需业务方手动配置 Redis 地址，直接复用 SpringBoot 的 `spring.redis.*` 配置，且同时支持**单机、集群、哨兵**三种部署模式。

## 1.3 代码实现

### 1.3.1 `@Lock` 注解

注解承担两个核心职责：**标记 AOP 切入点** + **传递锁参数**。

```java
/**
 * 分布式锁注解
 */
@Retention(RetentionPolicy.RUNTIME)   // 运行时保留，AOP 才能读到
@Target(ElementType.METHOD)           // 只能标注在方法上
public @interface Lock {

    /** 锁名称，支持 SPEL 表达式，格式：#{表达式} */
    String name();

    /** 获取锁的最大等待时间，默认 1 秒 */
    long waitTime() default 1;

    /** 锁自动释放时长，默认 -1（启用 WatchDog 模式，30 秒自动续期）*/
    long leaseTime() default -1;

    /** 时间单位，默认秒 */
    TimeUnit timeUnit() default TimeUnit.SECONDS;

    /**
     * 是否在方法结束后自动释放锁，默认 true。
     * 设为 false 时，锁会在 leaseTime 到期后自动释放（此时必须指定 leaseTime > 0）。
     */
    boolean autoUnlock() default true;

    /** 锁类型，默认可重入锁 */
    LockType lockType() default LockType.DEFAULT;

    /** 锁失败策略，默认：有限重试后抛出异常 */
    LockStrategy lockStrategy() default LockStrategy.FAIL_AFTER_RETRY_TIMEOUT;
}
```

**参数说明：**

- `name`：锁的 Redis Key，支持 SPEL 动态解析
- `waitTime`：等待获取锁的最长时间，超时后触发失败策略
- `leaseTime = -1`：触发 WatchDog 模式（每 10 秒自动续期为 30 秒），手动指定则 WatchDog 失效
- `autoUnlock = false`：适用于"发布后不立即解锁"的特殊场景，此时必须同时设置 `leaseTime > 0`

### 1.3.2 `LockType` 锁类型枚举

枚举内部实现了工厂方法模式，每个枚举项持有对应的锁创建逻辑，彻底替代 `if-else` 判断：

```java
public enum LockType {

    /** 可重入锁（默认），同一线程可重复加锁 */
    DEFAULT() {
        @Override
        public RLock getLock(RedissonClient redissonClient, String name) {
            return redissonClient.getLock(name);
        }
    },

    /** 公平锁，严格按 FIFO 顺序分配锁 */
    FAIR_LOCK() {
        @Override
        public RLock getLock(RedissonClient redissonClient, String name) {
            return redissonClient.getFairLock(name);
        }
    },

    /** 读锁，多个读操作可同时持有 */
    READ_LOCK() {
        @Override
        public RLock getLock(RedissonClient redissonClient, String name) {
            return redissonClient.getReadWriteLock(name).readLock();
        }
    },

    /** 写锁，与任何操作互斥 */
    WRITE_LOCK() {
        @Override
        public RLock getLock(RedissonClient redissonClient, String name) {
            return redissonClient.getReadWriteLock(name).writeLock();
        }
    };

    /** 根据锁名称获取对应的 RLock 对象 */
    public abstract RLock getLock(RedissonClient redissonClient, String name);
}
```

> 注意：每次调用都会创建新的锁对象。锁对象必须是多例的，不同业务用不同锁对象；同一业务用相同 key 的锁对象。

### 1.3.3 `LockStrategy` 锁失败策略枚举

策略枚举直接持有策略实现，省去策略接口 + 实现类 + 工厂的三层结构：

```java
public enum LockStrategy {

    /** 不重试，获取失败直接返回 false，调用方跳过业务 */
    SKIP_FAST() {
        @Override
        public boolean tryLock(RLock lock, Lock properties) throws InterruptedException {
            return lock.tryLock(0, properties.leaseTime(), properties.timeUnit());
        }
    },

    /** 不重试，获取失败立即抛出异常 */
    FAIL_FAST() {
        @Override
        public boolean tryLock(RLock lock, Lock properties) throws InterruptedException {
            boolean success = lock.tryLock(0, properties.leaseTime(), properties.timeUnit());
            if (!success) {
                throw new RuntimeException("请求太频繁");
            }
            return true;
        }
    },

    /** 在 waitTime 内不断重试，超时后返回 false，调用方跳过业务 */
    SKIP_AFTER_RETRY_TIMEOUT() {
        @Override
        public boolean tryLock(RLock lock, Lock properties) throws InterruptedException {
            return lock.tryLock(properties.waitTime(), properties.leaseTime(), properties.timeUnit());
        }
    },

    /** 在 waitTime 内不断重试，超时后抛出异常（默认策略） */
    FAIL_AFTER_RETRY_TIMEOUT() {
        @Override
        public boolean tryLock(RLock lock, Lock properties) throws InterruptedException {
            boolean success = lock.tryLock(properties.waitTime(), properties.leaseTime(), properties.timeUnit());
            if (!success) {
                throw new RuntimeException("请求超时");
            }
            return true;
        }
    },

    /** 无限重试，直到获取锁成功为止（慎用，可能导致请求长时间阻塞） */
    KEEP_RETRY() {
        @Override
        public boolean tryLock(RLock lock, Lock properties) throws InterruptedException {
            lock.lock(properties.leaseTime(), properties.timeUnit());
            return true;
        }
    };

    public abstract boolean tryLock(RLock lock, Lock properties) throws InterruptedException;
}
```

### 1.3.4 `LockAspect` 切面

切面是整个组件的核心，负责拦截标注了 `@Lock` 的方法并完成加锁 → 执行 → 释放的全流程：

```java
@Order(Integer.MAX_VALUE-1)//保证在事务切面之后执行，避免锁住的业务方法内开启事务导致死锁
@Aspect
public class LockAspect {

    private final RedissonClient redissonClient;

    public LockAspect(RedissonClient redissonClient) {
        this.redissonClient = redissonClient;
    }

    @Around("@annotation(properties)")
    public Object handleLock(ProceedingJoinPoint pjp, Lock properties) throws Throwable {
        // 参数校验：autoUnlock=false 时必须指定 leaseTime
        if (!properties.autoUnlock() && properties.leaseTime() <= 0) {
            throw new BizIllegalException("leaseTime 不能为空");
        }
        // 1. SPEL 解析动态锁名
        String name = getLockName(properties.name(), pjp);
        // 2. 根据 LockType 枚举获取锁对象
        RLock rLock = properties.lockType().getLock(redissonClient, name);
        // 3. 根据 LockStrategy 枚举执行加锁
        boolean success = properties.lockStrategy().tryLock(rLock, properties);
        if (!success) {
            return null;  // SKIP 策略：直接跳过业务
        }
        try {
            // 4. 执行业务方法
            return pjp.proceed();
        } finally {
            // 5. 释放锁（autoUnlock=false 时不释放，依赖 leaseTime 自动过期）
            if (properties.autoUnlock()) {
                rLock.unlock();
            }
        }
    }

    // ========== SPEL 解析相关 ==========

    /** SPEL 表达式的正则匹配规则，匹配 #{...} 格式 */
    private static final Pattern SPEL_PATTERN = Pattern.compile("\\#\\{([^\\}]*)\\}");

    /** 方法参数名解析器 */
    private static final ParameterNameDiscoverer PARAM_DISCOVERER =
            new DefaultParameterNameDiscoverer();

    /**
     * 解析锁名称：如果包含 #{} 格式的 SPEL 表达式，则动态解析替换
     */
    private String getLockName(String name, ProceedingJoinPoint pjp) {
        if (StringUtils.isBlank(name) || !name.contains("#")) {
            return name;  // 不含 SPEL，直接返回
        }
        // 构建 SPEL 上下文（以切入点的方法参数列表作为上下文）
        EvaluationContext context = new MethodBasedEvaluationContext(
                TypedValue.NULL,
                resolveMethod(pjp),
                pjp.getArgs(),
                PARAM_DISCOVERER
        );
        ExpressionParser parser = new SpelExpressionParser();
        Matcher matcher = SPEL_PATTERN.matcher(name);
        while (matcher.find()) {
            // 2.1.获取表达式
            String tmp = matcher.group();
            // 2.2.尝试解析
            Expression expression = parser.parseExpression("#" + matcher.group(1));
            Object value = expression.getValue(context);
            name = name.replace(tmp, ObjectUtils.nullSafeToString(value));
        }
        return name;
    }

    /** 获取切入点对应的 Method 对象（支持从父类查找） */
    private Method resolveMethod(ProceedingJoinPoint pjp) {
        MethodSignature signature = (MethodSignature) pjp.getSignature();
        Class<?> clazz = pjp.getTarget().getClass();
        return tryGetDeclaredMethod(clazz, signature.getName(),
                signature.getMethod().getParameterTypes());
    }

    private Method tryGetDeclaredMethod(Class<?> clazz, String name, Class<?>... parameterTypes) {
        try {
            return clazz.getDeclaredMethod(name, parameterTypes);
        } catch (NoSuchMethodException e) {
            Class<?> superClass = clazz.getSuperclass();
            if (superClass != null) {
                return tryGetDeclaredMethod(superClass, name, parameterTypes);
            }
        }
        return null;
    }
}
```

### 1.3.5 `RedissonConfig` 自动配置类

自动配置类负责创建 `RedissonClient` 和 `LockAspect` 两个 Bean，并根据 SpringBoot 的 Redis 配置自动适配部署模式：

```java
@Slf4j
@ConditionalOnClass({RedissonClient.class, Redisson.class})  // 按需加载：引入 Redisson 依赖才生效
@Configuration
@EnableConfigurationProperties(RedisProperties.class)
public class RedissonConfig {

    private static final String REDIS_PROTOCOL_PREFIX = "redis://";
    private static final String REDISS_PROTOCOL_PREFIX = "rediss://";

    @Bean
    @ConditionalOnMissingBean
    public LockAspect lockAspect(RedissonClient redissonClient) {
        return new LockAspect(redissonClient);
    }

    @Bean
    @ConditionalOnMissingBean
    public RedissonClient redissonClient(RedisProperties properties) {
        log.debug("尝试初始化 RedissonClient");
        RedisProperties.Cluster cluster = properties.getCluster();
        RedisProperties.Sentinel sentinel = properties.getSentinel();
        String password = properties.getPassword();
        int timeout = 3000;
        Duration d = properties.getTimeout();
        if (d != null) {
            timeout = (int) d.toMillis();
        }
        Config config = new Config();
        if (cluster != null && !CollectionUtil.isEmpty(cluster.getNodes())) {
            // 集群模式
            config.useClusterServers()
                    .addNodeAddress(convert(cluster.getNodes()))
                    .setConnectTimeout(timeout)
                    .setPassword(password);
        } else if (sentinel != null && !StrUtil.isEmpty(sentinel.getMaster())) {
            // 哨兵模式
            config.useSentinelServers()
                    .setMasterName(sentinel.getMaster())
                    .addSentinelAddress(convert(sentinel.getNodes()))
                    .setConnectTimeout(timeout)
                    .setDatabase(0)
                    .setPassword(password);
        } else {
            // 单机模式
            config.useSingleServer()
                    .setAddress(String.format("redis://%s:%d",
                            properties.getHost(), properties.getPort()))
                    .setConnectTimeout(timeout)
                    .setDatabase(0)
                    .setPassword(password);
        }
        return Redisson.create(config);
    }

    private String[] convert(List<String> nodesObject) {
        List<String> nodes = new ArrayList<>(nodesObject.size());
        for (String node : nodesObject) {
            if (!node.startsWith(REDIS_PROTOCOL_PREFIX)
                    && !node.startsWith(REDISS_PROTOCOL_PREFIX)) {
                nodes.add(REDIS_PROTOCOL_PREFIX + node);
            } else {
                nodes.add(node);
            }
        }
        return nodes.toArray(new String[0]);
    }
}
```

**核心设计要点：**

- `@ConditionalOnClass`：只有引入 `redisson` 依赖才生效，实现按需加载
- `@ConditionalOnMissingBean`：允许业务方覆盖默认 Bean，扩展性强
- 无需额外配置 Redis 地址，直接读取 `spring.redis.*`

### 1.3.6 业务方使用示例

引入依赖后，仅需一行注解即可完成分布式加锁：

```java
// 1. 最简用法：可重入锁 + 默认失败策略（重试超时后抛异常）
@Lock(name = "coupon:receive:#{userId}")
public void receiveCoupon(Long userId) {
    // 纯粹的业务逻辑
}

// 2. 写锁 + 快速失败（不重试）
@Lock(
    name      = "item:stock:#{itemId}",
    lockType  = LockType.WRITE_LOCK,
    lockStrategy = LockStrategy.FAIL_FAST
)
public void deductStock(Long itemId) { ... }

// 3. 读锁 + 无限重试（适合读多写少场景）
@Lock(
    name      = "item:stock:#{itemId}",
    lockType  = LockType.READ_LOCK,
    lockStrategy = LockStrategy.KEEP_RETRY
)
public StockVO queryStock(Long itemId) { ... }

// 4. 通过静态方法动态获取锁名（无方法参数时）
@Lock(name = "like:#{T(com.tianji.common.utils.UserContext).getUser()}")
public void addLike(Long bizId) { ... }

// 5. autoUnlock=false：方法执行后不立即解锁，等待 leaseTime 自动过期
@Lock(name = "task:#{taskId}", leaseTime = 30, autoUnlock = false)
public void executeTask(Long taskId) { ... }
```

## 1.4 注意事项

**WatchDog 与手动指定 leaseTime 互斥**

`leaseTime` 默认为 `-1`，此时 Redisson 启动 WatchDog 机制，每隔 10 秒自动将锁续期为 30 秒，直到业务结束主动释放。一旦手动指定 `leaseTime > 0`，WatchDog 自动失效，锁会在指定时间后到期，可能导致锁提前释放。

```
leaseTime = -1  →  WatchDog 自动续期（推荐）
leaseTime > 0   →  固定时长过期，WatchDog 不生效（慎用，需评估业务最大耗时）
```

**`autoUnlock = false` 必须配合 `leaseTime > 0`**

`autoUnlock = false` 时，切面的 `finally` 块不会主动调用 `unlock()`，锁只能靠超时自动释放。如果此时 `leaseTime = -1`（WatchDog 模式），锁永远不会释放，造成死锁。切面内部做了参数校验，违规时会抛出 `BizIllegalException`。

**AOP 切面与 Spring 事务的执行顺序**

Spring 事务切面的 Order 值为 `Integer.MAX_VALUE-1`（自定义优先级，事务之前执行）。分布式锁切面由 `RedissonConfig` 直接注册，未指定 Order默认`Integer.MAX_VALUE`，比事务切面先执行。这保证了**先加锁，再开事务**的正确顺序。

如果项目中有其他自定义切面需要调整顺序，可在 `LockAspect` 上添加 `@Order` 注解，指定合适的值（小于 `Integer.MAX_VALUE` 即可先于事务执行）。

**KEEP_RETRY 慎用**

`KEEP_RETRY` 策略调用 `lock.lock()`，会无限阻塞直到获取锁。在高并发场景下，大量请求可能长时间阻塞，耗尽线程池，导致服务雪崩。建议仅在极少量后台任务中使用，Web 接口禁止使用此策略。

**锁粒度应尽量细**

锁名称建议包含业务维度，如用户 id、资源 id，避免大范围加锁：

```java
// 不推荐：所有用户共享一把锁，串行化严重
@Lock(name = "coupon:receive")

// 推荐：每个用户独立一把锁，互不干扰
@Lock(name = "coupon:receive:#{userId}")
```

**读写锁 key 必须一致**

读锁和写锁必须使用同一个 `name`，Redisson 才能感知到它们是同一组读写锁。如果 key 不一致，读锁和写锁之间不会互斥。

## 1.5 面试要点

**答题框架：先说问题背景，再说组件设计思路，最后结合实际代码说关键实现细节。**

---

**面试官：你们是怎么实现分布式锁的？**

我们项目中基于 Redisson 封装了一个通用分布式锁组件，核心思路是**注解 + AOP 环绕增强**，让业务方零侵入地使用分布式锁。

直接用 Redisson API 的话，每处加锁都要写获取锁对象、try-finally 释放锁，与业务代码耦合严重。我们把这些非业务逻辑抽离到切面，业务方只需在方法上标一个 `@Lock` 注解，传入锁名、锁类型、失败策略这几个参数即可。

---

**面试官追问：锁的种类怎么管理的？**

用**枚举内嵌工厂方法**的设计。定义了 `LockType` 枚举，包含可重入锁、公平锁、读锁、写锁四种类型，每个枚举项内部实现了 `getLock()` 抽象方法，直接调用 Redisson 对应的 API 创建锁对象。切面通过 `lockType.getLock(redissonClient, name)` 一行代码完成锁对象的创建，完全不需要 `if-else`。

---

**面试官追问：获取锁失败后怎么处理的？**

用了**基于枚举的策略模式**。定义了 `LockStrategy` 枚举，从"是否重试"和"失败处理"两个维度组合出 5 种策略：`SKIP_FAST`（不重试直接跳过）、`FAIL_FAST`（不重试抛异常）、`SKIP_AFTER_RETRY_TIMEOUT`（重试超时后跳过）、`FAIL_AFTER_RETRY_TIMEOUT`（重试超时后抛异常，默认策略）、`KEEP_RETRY`（无限重试）。

每个枚举项直接持有 `tryLock()` 的实现，切面调用 `lockStrategy.tryLock(rLock, properties)` 即可，策略切换只需改注解参数，不改业务代码。

---

**面试官追问：锁名称怎么做到动态的？**

用了 **SPEL（Spring 表达式语言）**。`@Lock` 的 `name` 参数支持 `#{表达式}` 语法，切面在解析锁名时，先用正则匹配出所有 `#{}` 占位符，再基于 `MethodBasedEvaluationContext` 将切入点的方法参数列表作为 SPEL 上下文，逐个解析表达式并替换回锁名称字符串。这样就能做到"每个用户 id 对应一把锁"，而不是所有用户共享一把大锁。

---

**面试官追问：分布式锁和事务的顺序有什么要注意的？**

一定要保证**先加锁，再开事务**。如果先开事务再加锁，会出现一种场景：线程 A 执行完业务、提交事务之前，锁就释放了，线程 B 拿到锁进来，读到的还是事务未提交的旧数据，出现脏读。

我们的切面没有指定 Order，会早于 Spring 事务切面（Order = `Integer.MAX_VALUE`）执行，天然保证了正确顺序。
