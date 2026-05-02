
## A.1 常用配置项

```properties
# 基础配置
bind 0.0.0.0                # 绑定地址
port 6379                   # 端口
daemonize yes               # 后台运行
requirepass 123321          # 密码
databases 16                # 数据库数量

# 内存管理
maxmemory 512mb             # 最大内存
maxmemory-policy allkeys-lru # 内存淘汰策略

# RDB持久化
save 900 1                  # 条件触发
save 300 10
save 60 10000

# AOF持久化
appendonly yes
appendfsync everysec
aof-use-rdb-preamble yes    # 混合持久化

# 慢查询
slowlog-log-slower-than 10000
slowlog-max-len 128

# 客户端连接
maxclients 10000            # 最大客户端数
timeout 300                 # 客户端空闲超时（秒），0表示禁用
```

## A.2 Redis 命令速查

**通用**：`KEYS *` / `DEL key` / `EXISTS key` / `EXPIRE key sec` / `TTL key`

**String**：`SET` / `GET` / `MSET` / `MGET` / `INCR` / `INCRBY` / `SETNX` / `SETEX`

**Hash**：`HSET` / `HGET` / `HMSET` / `HMGET` / `HGETALL` / `HKEYS` / `HVALS` / `HINCRBY`

**List**：`LPUSH` / `RPUSH` / `LPOP` / `RPOP` / `LRANGE` / `BLPOP`

**Set**：`SADD` / `SREM` / `SCARD` / `SISMEMBER` / `SMEMBERS` / `SINTER` / `SDIFF` / `SUNION`

**SortedSet**：`ZADD` / `ZREM` / `ZSCORE` / `ZRANK` / `ZREVRANK` / `ZRANGE` / `ZREVRANGE` / `ZCOUNT`

**集群**：`CLUSTER NODES` / `CLUSTER INFO` / `SLOT迁移` / `DBSIZE` / `INFO`

---

> **笔记结束**，祝学习愉快！