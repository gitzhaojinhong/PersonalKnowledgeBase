
## 8.1 多级缓存概述

传统缓存架构（应用层 → Redis → MySQL）存在的问题：
- Redis 部署在应用服务器外部，网络开销仍然存在
- Redis 挂了，整个缓存层就没了
- Redis 命中率低时，大量请求直接打穿到数据库

**多级缓存架构**：应用层本地缓存（JVM堆内/JVM堆外）→ 接入层本地缓存（Nginx/OpenResty）→ Redis → MySQL

```
请求 → Nginx本地缓存 → OpenResty + Lua → Redis → MySQL
                   ↓命中                    ↓命中
               直接响应                    返回数据
```

## 8.2 JVM 缓存

### 8.2.1 Caffeine

Caffeine 是 Java 最快的本地缓存库，Spring Boot 2.x 默认使用。

**依赖**：

```xml
<dependency>
    <groupId>com.github.ben-manes.caffeine</groupId>
    <artifactId>caffeine</artifactId>
</dependency>
```

**配置**：

```yaml
spring:
  cache:
    type: caffeine
  caffeine:
    spec: maximumSize=10000,expireAfterWrite=60s
```

**使用**：

```java
@Service
public class CaffeineService {

    @Autowired
    private Cache<String, Object> caffeineCache;

    public Shop getShop(Long id) {
        Shop shop = caffeineCache.get(id, shopId -> {
            // 缓存不存在时执行，从数据库加载
            return shopMapper.selectById(shopId);
        });
        return shop;
    }
}
```

### 8.2.2 多级缓存整合

```java
@Service
public class CacheService {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;
    private final Cache<Long, Shop> localCache = Caffeine.newBuilder()
            .maximumSize(10000)
            .expireAfterWrite(30, TimeUnit.SECONDS)
            .build();

    public Shop getShop(Long id) {
        // 1. 先查本地缓存
        Shop shop = localCache.getIfPresent(id);
        if (shop != null) {
            return shop;
        }

        // 2. 再查Redis
        String json = stringRedisTemplate.opsForValue().get("cache:shop:" + id);
        if (json != null) {
            shop = JsonUtil.toBean(json, Shop.class);
            localCache.put(id, shop); // 回填本地缓存
            return shop;
        }

        // 3. 最后查数据库
        shop = shopMapper.selectById(id);
        if (shop == null) {
            return null;
        }

        // 回填Redis和本地缓存
        localCache.put(id, shop);
        stringRedisTemplate.opsForValue().set(
            "cache:shop:" + id,
            JsonUtil.toStr(shop),
            30L, TimeUnit.MINUTES
        );

        return shop;
    }
}
```

## 8.3 OpenResty + Lua 缓存

### 8.3.1 OpenResty 概述

OpenResty 是基于 Nginx 的高性能 Web 平台，封装了 Nginx 和 LuaJIT，可以通过 Lua 脚本扩展 Nginx 功能。适合做高性能接入层和 API 网关。

### 8.3.2 OpenResty 缓存架构

```
用户请求 → OpenResty (Nginx + Lua)
              ↓
        Lua 脚本：查 Nginx 本地缓存（lua_shared_dict）
              ↓命中 / 未命中
        未命中：查 Redis
              ↓命中 / 未命中
        未命中：回源到 Tomcat（应用服务器）
```

### 8.3.3 Lua 脚本示例

**nginx.conf 配置**：

```nginx
http {
    # 声明一个共享内存字典，作为 Nginx 本地缓存
    lua_shared_dict my_cache 100m;

    server {
        listen 8080;

        location /shop/{
            default_type application/json;
            
            # 设置变量（隐式）
            set $id "";

            content_by_lua_file lua/shop.lua;
        }
    }
}
```

**lua/shop.lua**：

```lua
-- 获取请求参数 id
local id = ngx.var.arg_id
if not id then
    ngx.say('{"msg":"id is required"}')
    return
end

-- 引入 Redis 连接池
local redis = require("resty.redis")
local cache = ngx.shared.my_cache

-- ========== 1. 查询 Nginx 本地缓存 ==========
local function get_from_local(id)
    local value = cache:get("shop:" .. id)
    if value then
        ngx.log(ngx.INFO, "hit local cache, id=", id)
        return value
    end
    return nil
end

-- ========== 2. 查询 Redis ==========
local function get_from_redis(id)
    local red = redis:new()
    red:set_timeout(1000)
    local ok, err = red:connect("192.168.150.101", 6379)
    if not ok then
        ngx.log(ngx.ERR, "redis connect error: ", err)
        return nil
    end

    -- 认证（如果有密码）
    -- red:auth("123321")

    local value, err = red:get("cache:shop:" .. id)
    red:close()

    if value and value ~= ngx.null then
        ngx.log(ngx.INFO, "hit redis cache, id=", id)
        -- 回填 Nginx 本地缓存
        cache:set("shop:" .. id, value, 300)  -- 300秒TTL
        return value
    end
    return nil
end

-- ========== 3. 回源到 Tomcat ==========
local function get_from_tomcat(id)
    local http = require("socket.http")
    local resp_body = {}
    local ltn12 = require("ltn12")
    
    local res, code = http.request(
        "http://192.168.150.1:8080/shop/" .. id
    )
    
    if code == 200 then
        ngx.log(ngx.INFO, "hit tomcat, id=", id)
        cache:set("shop:" .. id, res, 300)
        return res
    end
    return nil
end

-- ========== 主流程 ==========
local value = get_from_local(id)
if value then
    ngx.say(value)
    return
end

value = get_from_redis(id)
if value then
    ngx.say(value)
    return
end

value = get_from_tomcat(id)
if value then
    ngx.say(value)
else
    ngx.say('{"msg":"not found"}')
end
```

### 8.3.4 Nginx 缓存过期同步

当 Tomcat 更新数据后，需要通知 Nginx 清除本地缓存。使用 HTTP 头通知：

```nginx
location /clear-cache {
    content_by_lua '
        local cache = ngx.shared.my_cache
        local id = ngx.var.arg_id
        cache:delete("shop:" .. id)
        ngx.say("ok")
    ';
}
```

应用更新数据后，调用这个接口清除 Nginx 缓存。

## 8.4 Canal 同步 MySQL 变更到 Redis

### 8.4.1 概念

Canal 是阿里巴巴开源的 MySQL binlog 增量订阅&消费组件。模拟 MySQL slave 的复制行为，解析 binlog 日志，将数据变更同步到 Redis、ES 等其他系统。

**原理**：
```
MySQL → binlog → Canal Server → 业务应用 → Redis
```

### 8.4.2 Canal + Redis 实现缓存同步

**场景**：数据库中的商户数据更新后，自动同步到 Redis，无需手动清理缓存。

**实现思路**：
1. Canal 订阅 MySQL binlog
2. 当 tb_shop 表发生 INSERT/UPDATE/DELETE 时，Canal 推送变更事件
3. 应用消费变更事件，将对应 key 从 Redis 中删除
4. 下次请求进来，缓存未命中，从数据库重新加载最新数据

**Canal 事件消费示例**（伪代码）：

```java
public class CanalListener {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    /**
     * 监听 tb_shop 表的变更
     */
    @CanalTableEventListener(table = "tb_shop", eventType = EventType.UPDATE)
    public void onShopUpdate(CanalRowData rowData) {
        if (rowData == null || rowData.getColumns().isEmpty()) {
            return;
        }

        // 获取变更行的主键 ID
        Long shopId = (Long) rowData.getColumnValue("id");
        if (shopId != null) {
            // 删除 Redis 缓存
            stringRedisTemplate.delete("cache:shop:" + shopId);
            System.out.println("Canal: 删除了商户缓存，id=" + shopId);
        }
    }

    @CanalTableEventListener(table = "tb_shop", eventType = EventType.DELETE)
    public void onShopDelete(CanalRowData rowData) {
        if (rowData == null || rowData.getColumns().isEmpty()) {
            return;
        }
        Long shopId = (Long) rowData.getColumnValue("id");
        if (shopId != null) {
            stringRedisTemplate.delete("cache:shop:" + shopId);
        }
    }
}
```

> **注意**：Canal 同步是异步的，存在短暂的数据不一致窗口。对于强一致性要求的场景（如金额），需要结合业务逻辑权衡是否适合使用 Canal。

---

