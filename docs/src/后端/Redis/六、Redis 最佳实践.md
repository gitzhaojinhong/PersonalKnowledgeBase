
## 6.1 键值设计

### 6.1.1 key 命名规范

```
业务名:业务数据ID:数据标识
```

示例：
- `shop:1` - ID为1的商户
- `user:100:followers` - ID为100的用户粉丝列表
- `order:20240101:count` - 2024年1月1日的订单数

> **禁止**：禁止使用过长的 key（消耗内存）、禁止使用冒号和通配符以外的特殊字符。

### 6.1.2 value 设计原则

**优先使用 String 存 JSON**

```json
# 推荐：一个key对应一个对象
shop:1 = {"id":1,"name":"好再来餐厅","type":1,"score":4.5}
```

**大对象拆分为多个小 key**

```json
# 不推荐：大value，一次性读取网络开销大
user:100 = {"orders":[...大量订单...]}

# 推荐：按时间或类型拆分
user:100:orders:2024 = [...]
user:100:orders:2025 = [...]
```

**Hash vs String 对比**

| 场景 | 推荐类型 | 原因 |
|---|---|---|
| 对象需要整体读写 | String (JSON) | 一次操作完成，避免并发覆盖问题 |
| 对象需要按字段读写 | Hash | 单字段操作原子，避免读到脏数据 |
| 对象字段多且不常全部读取 | Hash | 按需读取，节省带宽 |

## 6.2 批处理优化

### 6.2.1 Pipeline（管道）

默认情况下，每执行一条 Redis 命令都需要一次网络往返（RTT）。使用 Pipeline 可以将多条命令打包，一次发送、一次往返完成。

**Java 实现**：

```java
@Test
void testPipeline() {
    List<Object> results = stringRedisTemplate.executePipelined(new RedisCallback<Object>() {
        @Override
        public Object doInRedis(RedisConnection connection) throws DataAccessException {
            for (int i = 0; i < 100; i++) {
                byte[] key = ("key:pipeline:" + i).getBytes();
                byte[] val = ("value" + i).getBytes();
                connection.stringCommands().setEx(key, val, 3600);
            }
            return null;
        }
    });
    System.out.println("批量写入100条，耗时大大降低");
}
```

**效率对比**（单次 set vs Pipeline 批量 set）：

| 方式 | 100次操作耗时 |
|---|---|
| 逐条执行 | ~500ms（RTT×100） |
| Pipeline | ~50ms（1次RTT） |

> **注意**：Pipeline 中不要混合不同数据类型的命令，或者提前按数据类型分组，执行多个 Pipeline。

### 6.2.2 集群下的 Slot 计算

Redis Cluster 将整个数据空间划分为 16384 个槽（slot），每个节点负责一部分槽。

**槽计算公式**：`slot = CRC16(key) % 16384`

**跨slot操作**：以下命令会触发跨slot问题（MOVED 错误）：
- `MGET`、`MSET` 对多个 key 操作
- 在 Lua 脚本中使用多个 key

**解决方案**：确保参与操作的 key 属于同一个 slot。可以使用 `{tag}` 语法强制相同 slot：

```bash
# user:100:info 和 user:200:info 有相同的 tag "user"，会被分配到同一个 slot
MSET user:{100}:info xxx user:{200}:info yyy
```

## 6.3 服务端优化

### 6.3.1 慢查询日志

Redis 会记录执行时间超过 `slowlog-log-slower-than`（默认 10000μs = 10ms）的命令。

**配置**：

```bash
# 慢查询阈值（微秒），-1 表示禁用
slowlog-log-slower-than 10000

# 最多保留多少条慢查询记录
slowlog-max-len 128
```

**查看慢查询**：

```bash
# 查看所有慢查询
SLOWLOG GET

# 查看最近5条
SLOWLOG GET 5
```

**慢查询原因排查**：
1. O(N) 命令操作了太多数据（如 `KEYS *`、`HGETALL`）
2. 一次获取了过大的 value
3. 存在大量过期 key 同时到期
4. 内存达到上限，触发了内存淘汰

### 6.3.2 内存优化建议

**关闭透明大页（THP）**

Linux 的透明大页机制会导致 Redis 内存碎片化增加：

```bash
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo never > /sys/kernel/mm/transparent_hugepage/defrag
```

**合理设置过期时间**

- 如果对过期时间敏感，使用 `EXPIREAT` 指定具体时间点
- 如果 key 数量巨大，过期 key 集中在同一时刻删除，可以给 TTL 加上随机偏移量

**内存碎片率监控**

```bash
INFO memory | grep mem_fragmentation_ratio
# ratio = used_memory_rss / used_memory
# ratio > 1.5 说明碎片严重，可以执行 MEMORY PURGE 整理
```

---

