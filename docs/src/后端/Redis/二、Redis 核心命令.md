
> **学习建议**：命令不需要死记，学会查文档即可。  
> 官网命令查询：https://redis.io/commands  
> 在 redis-cli 中可以用 `help <命令名>` 查看命令帮助。

## 2.1 通用命令

通用命令是部分数据类型都可以使用的指令，常见的有：

- `KEYS pattern`：查看符合模板的所有 key
- `DEL key [key ...]`：删除一个或多个 key
- `EXISTS key`：判断 key 是否存在
- `EXPIRE key seconds`：给一个 key 设置有效期（秒），到期自动删除
- `TTL key`：查看一个 key 的剩余有效期（秒）

```bash
# 查看所有 key（生产环境不推荐使用，key 过多时效率不高）
127.0.0.1:6379> KEYS *
1) "name"
2) "age"

# 查看以 a 开头的 key
127.0.0.1:6379> KEYS a*
1) "age"

# 删除 key
127.0.0.1:6379> DEL name
(integer) 1

# 判断 key 是否存在
127.0.0.1:6379> EXISTS age
(integer) 1

127.0.0.1:6379> EXISTS name
(integer) 0

# 设置过期时间（10秒后过期）
127.0.0.1:6379> EXPIRE age 10
(integer) 1

# 查看剩余有效期
127.0.0.1:6379> TTL age
(integer) 8

# 永久 key 返回 -1，已过期的 key 返回 -2
127.0.0.1:6379> SET age 10
OK
127.0.0.1:6379> TTL age
(integer) -1
```

> **贴心提示**：内存非常宝贵，对于数据可以设置过期时间，过期后自动删除。生产环境下不推荐使用 `KEYS` 命令，因为该命令会遍历所有 key，在 key 数量较多时效率很低。

## 2.2 String 类型

String 类型是最简单的存储类型，其 value 是字符串。根据字符串格式不同，又可以分为三类：

- `string`：普通字符串
- `int`：整数类型，可以做自增、自减操作
- `float`：浮点类型，可以做自增、自减操作

> **注意**：不管是哪种格式，底层都是字节数组形式存储，最大空间不能超过 512MB。

### 2.2.1 String 常用命令

| 命令 | 说明 |
|---|---|
| `SET key value` | 添加或修改一个 String 类型的键值对 |
| `GET key` | 根据 key 获取 String 类型的 value |
| `MSET key value [key value ...]` | 批量添加多个 String 类型的键值对 |
| `MGET key [key ...]` | 根据多个 key 批量获取 value |
| `INCR key` | 让一个整型的 key 自增 1 |
| `INCRBY key increment` | 让一个整型的 key 自增并指定步长 |
| `INCRBYFLOAT key increment` | 让一个浮点类型的数字自增并指定步长 |
| `SETNX key value` | key 不存在时才添加，否则不执行 |
| `SETEX key seconds value` | 添加 String 键值对，并指定有效期 |

```bash
# 添加/修改
127.0.0.1:6379> SET name Rose
OK
127.0.0.1:6379> GET name
"Rose"

# 批量操作
127.0.0.1:6379> MSET k1 v1 k2 v2 k3 v3
OK
127.0.0.1:6379> MGET name age k1 k2 k3
1) "Rose"
2) "10"
3) "v1"
4) "v2"
5) "v3"

# 自增操作
127.0.0.1:6379> INCR age
(integer) 11
127.0.0.1:6379> INCRBY age 2
(integer) 13
127.0.0.1:6379> INCRBY age -1
(integer) 12

# SETNX（key 不存在才设置）
127.0.0.1:6379> SETNX name lisi
(integer) 0    # 0 表示未设置成功（key 已存在）
127.0.0.1:6379> SETNX name2 lisi
(integer) 1    # 1 表示设置成功

# SETEX（设置的同时指定过期时间）
127.0.0.1:6379> SETEX name 10 Jack
OK
127.0.0.1:6379> TTL name
(integer) 8
```

> **贴心提示**：以上命令除了 `INCRBYFLOAT` 以外都是常用命令。

### 2.2.2 String 的底层编码规则

Redis 的 String 在底层会根据 value 的类型和大小，自动选择最合适的编码方式，无需手动指定。

**三种编码方式**：

| 编码 | 说明 | 触发条件 |
|---|---|---|
| `int` | 直接把数字存入 RedisObject 的 ptr 指针位置（8字节），不额外分配 SDS | value 是整数，且在 LONG_MAX 范围内 |
| `embstr` | RedisObject 与 SDS 分配在**同一块连续内存**，只需一次内存分配 | value 是字符串，且长度 **≤ 44 字节** |
| `raw` | RedisObject 与 SDS 分开分配，需要两次内存分配 | value 是字符串，且长度 **> 44 字节** |

> **为什么是 44 字节**？  
> RedisObject 占 16 字节，embstr 编码中 SDS 头部占 3 字节，加上末尾 `\0` 占 1 字节，剩余空间为 `64 - 16 - 3 - 1 = 44` 字节。超过这个大小就无法放在一块连续内存中了。

**查看编码方式**：

```bash
127.0.0.1:6379> SET num 100
OK
127.0.0.1:6379> OBJECT ENCODING num
"int"

127.0.0.1:6379> SET short "hello"
OK
127.0.0.1:6379> OBJECT ENCODING short
"embstr"

127.0.0.1:6379> SET long "这是一个超过44个字节的字符串测试数据，用来验证raw编码的触发条件"
OK
127.0.0.1:6379> OBJECT ENCODING long
"raw"
```

> **贴心提示**：对 `int` 编码的 String 执行 `INCR` 等操作可以直接进行数值运算；如果对 `int` 编码执行了 `APPEND` 等字符串操作，编码会自动转为 `raw`。

## 2.3 Hash 类型

Hash 类型也叫散列，其 value 是一个无序字典，类似于 Java 中的 HashMap 结构。

**为什么需要 Hash 类型**？  
String 结构将对象序列化为 JSON 字符串后存储，当需要修改对象某个字段时很不方便（需要反序列化整个对象）。Hash 结构可以将对象中的每个字段独立存储，可以针对单个字段做 CRUD。

### 2.3.1 Hash 常用命令

| 命令 | 说明 |
|---|---|
| `HSET key field value` | 添加或修改 hash 类型 key 的 field 值 |
| `HGET key field` | 获取一个 hash 类型 key 的 field 值 |
| `HMSET key field value [field value ...]` | 批量添加多个 field |
| `HMGET key field [field ...]` | 批量获取多个 field 值 |
| `HGETALL key` | 获取一个 hash 类型 key 中所有的 field 和 value |
| `HKEYS key` | 获取一个 hash 类型 key 中所有的 field |
| `HVALS key` | 获取一个 hash 类型 key 中所有的 value |
| `HINCRBY key field increment` | 让 field 值自增并指定步长 |
| `HSETNX key field value` | field 不存在时才添加 |

```bash
# 添加单个字段
127.0.0.1:6379> HSET heima:user:3 name Lucy
(integer) 1
127.0.0.1:6379> HSET heima:user:3 age 21
(integer) 1

# 批量添加
127.0.0.1:6379> HMSET heima:user:4 name LiLei age 20 sex man
OK

# 获取所有字段和值
127.0.0.1:6379> HGETALL heima:user:4
1) "name"
2) "LiLei"
3) "age"
4) "20"
5) "sex"
6) "man"

# 自增
127.0.0.1:6379> HINCRBY heima:user:4 age 2
(integer) 22
```

### 2.3.2 Hash 的底层编码规则

Hash 的底层编码会根据数据量**自动切换**，无需手动指定。

**两种编码方式**：

| 编码 | 说明 | 触发条件（满足全部） |
|---|---|---|
| `ziplist` | 紧凑型连续内存，省内存，查找效率一般 | ① 元素数量 ≤ `hash-max-ziplist-entries`（默认 **512**）<br>② 每个 value 字节数 ≤ `hash-max-ziplist-value`（默认 **64**） |
| `hashtable`（Dict） | 哈希表，查找 O(1) | 任意一个条件不满足时，**自动转码**为 hashtable |

> **贴心提示**：ZipList 中相邻的两个 entry 分别存储 field 和 value，按写入顺序排列。数据量较大时查找需要遍历，因此 Redis 会在超过阈值后自动转为 Dict。

**查看编码方式**：

```bash
127.0.0.1:6379> HMSET test:hash f1 v1 f2 v2
OK
127.0.0.1:6379> OBJECT ENCODING test:hash
"ziplist"

# 插入一个大 value 超过 64 字节后，编码会自动切换
127.0.0.1:6379> HSET test:hash f3 "这是一个超过64字节的字符串测试数据验证hashtable编码自动切换xxxxxx"
(integer) 1
127.0.0.1:6379> OBJECT ENCODING test:hash
"hashtable"
```

## 2.4 List 类型

Redis 中的 List 类型与 Java 中的 LinkedList 类似，可以看做是一个双向链表结构，支持正向和反向检索。

**特征**：
- 有序
- 元素可以重复
- 插入和删除快
- 查询速度一般

常用来存储有序数据，例如：朋友圈点赞列表、评论列表等。

### 2.4.1 List 常用命令

| 命令 | 说明 |
|---|---|
| `LPUSH key element [...]` | 向列表左侧插入一个或多个元素 |
| `RPUSH key element [...]` | 向列表右侧插入一个或多个元素 |
| `LPOP key` | 移除并返回列表左侧第一个元素，没有则返回 nil |
| `RPOP key` | 移除并返回列表右侧第一个元素 |
| `LRANGE key start stop` | 返回指定范围内的所有元素 |
| `BLPOP key [key ...] timeout` | 与 LPOP 类似，无元素时等待指定时间 |
| `BRPOP key [key ...] timeout` | 与 RPOP 类似，无元素时等待指定时间 |

```bash
127.0.0.1:6379> LPUSH users 1 2 3
(integer) 3
127.0.0.1:6379> RPUSH users 4 5 6
(integer) 6

127.0.0.1:6379> LPOP users
"3"
127.0.0.1:6379> RPOP users
"6"

127.0.0.1:6379> LRANGE users 1 2
1) "1"
2) "4"
```

### 2.4.2 List 的底层编码规则

Redis 3.2 版本之后，List 的底层统一采用 **QuickList**，不再使用 ZipList + LinkedList 组合。

**QuickList 结构**：
```
head (ZipList) <-> ZipList <-> ZipList <-> ... <-> tail (ZipList)
```
每个节点是一个 ZipList，默认每个 ZipList 最大占用 **8KB**（由 `list-max-ziplist-size -2` 控制）。

| 编码 | 说明 | 版本 |
|---|---|---|
| `ziplist` + `linkedlist`（旧） | 数据量少时用 ZipList，超阈值转 LinkedList | Redis < 3.2 |
| `quicklist`（推荐） | 双向链表，每个节点是 ZipList，兼顾内存效率和操作性能 | Redis ≥ 3.2 |

**查看编码方式**：

```bash
127.0.0.1:6379> LPUSH mylist a b c
(integer) 3
127.0.0.1:6379> OBJECT ENCODING mylist
"quicklist"
```

## 2.5 Set 类型

Redis 的 Set 结构与 Java 中的 HashSet 类似，可以看做是一个 value 为 null 的 HashMap。具备以下特征：

- 无序
- 元素不可重复
- 查找快
- 支持交集、并集、差集

### 2.5.1 Set 常用命令

| 命令 | 说明 |
|---|---|
| `SADD key member [...]` | 向 set 中添加一个或多个元素 |
| `SREM key member [...]` | 移除 set 中的指定元素 |
| `SCARD key` | 返回 set 中元素的个数 |
| `SISMEMBER key member` | 判断一个元素是否存在于 set 中 |
| `SMEMBERS key` | 获取 set 中的所有元素 |
| `SINTER key1 key2 [...]` | 求 key1 与 key2 的交集 |
| `SDIFF key1 key2 [...]` | 求 key1 与 key2 的差集（key1 有而 key2 无） |
| `SUNION key1 key2 [...]` | 求 key1 与 key2 的并集 |



**实战练习**：用 Set 实现好友关系查询

场景：张三的好友有｛李四、王五、赵六｝；李四的好友有｛王五、麻子、二狗｝。

```bash
127.0.0.1:6379> SADD zs lisi wangwu zhaoliu
(integer) 3
127.0.0.1:6379> SADD ls wangwu mazi ergou
(integer) 3

# 张三的好友有几人
127.0.0.1:6379> SCARD zs
(integer) 3

# 张三和李四的共同好友
127.0.0.1:6379> SINTER zs ls
1) "wangwu"

# 哪些人是张三的好友却不是李四的好友
127.0.0.1:6379> SDIFF zs ls
1) "lisi"
2) "zhaoliu"

# 张三和李四的好友总共有哪些人
127.0.0.1:6379> SUNION zs ls
1) "wangwu"
2) "zhaoliu"
3) "lisi"
4) "mazi"
5) "ergou"

# 判断李四是否是张三的好友
127.0.0.1:6379> SISMEMBER zs lisi
(integer) 1    # 1 表示存在

# 将李四从张三的好友列表中移除
127.0.0.1:6379> SREM zs lisi
(integer) 1
```

### 2.5.2 Set 的底层编码规则

Set 的底层编码会根据元素类型**自动切换**。

**两种编码方式**：

| 编码 | 说明 | 触发条件（满足全部） |
|---|---|---|
| `intset` | 整数数组，有序存储，二分查找 O(log n) | ① 所有元素都是整数<br>② 元素数量 ≤ `set-max-intset-entries`（默认 **512**） |
| `hashtable`（Dict） | 哈希表，key 存元素，value 统一为 null，查找 O(1) | 任意一个条件不满足时，**自动转码**为 hashtable |

> **贴心提示**：IntSet 支持**自动升级**（int16 → int32 → int64），但不支持降级。升级时所有元素重新分配内存，耗时 O(n)，但升级后查询效率更高。

**查看编码方式**：

```bash
127.0.0.1:6379> SADD test:set 1 2 3
(integer) 3
127.0.0.1:6379> OBJECT ENCODING test:set
"intset"

# 插入一个非整数，编码自动切换
127.0.0.1:6379> SADD test:set hello
(integer) 1
127.0.0.1:6379> OBJECT ENCODING test:set
"hashtable"
```

## 2.6 SortedSet 类型

Redis 的 SortedSet 是一个可排序的 set 集合，与 Java 中的 TreeSet 有些类似，但底层数据结构差别很大。SortedSet 中每一个元素都带有一个 score 属性，可以基于 score 对元素排序，底层实现是一个**跳表（SkipList）加 hash 表**。

**特征**：
- 可排序
- 元素不重复
- 查询速度快

因为 SortedSet 的可排序特性，经常被用来实现**排行榜**功能。

### 2.6.1 SortedSet 常用命令

| 命令 | 说明 |
|---|---|
| `ZADD key score member [...]` | 添加元素，已存在则更新 score |
| `ZREM key member` | 删除指定元素 |
| `ZSCORE key member` | 获取指定元素的 score 值 |
| `ZRANK key member` | 获取元素的排名（升序） |
| `ZREVRANK key member` | 获取元素的排名（降序） |
| `ZCARD key` | 获取元素个数 |
| `ZCOUNT key min max` | 统计 score 在给定范围内的元素个数 |
| `ZINCRBY key increment member` | 让指定元素自增，步长为 increment |
| `ZRANGE key min max [WITHSCORES]` | 按照排名范围获取元素（升序） |
| `ZREVRANGE key min max [WITHSCORES]` | 按照排名范围获取元素（降序） |
| `ZRANGEBYSCORE key min max` | 按照 score 范围获取元素 |
| `ZDIFF numkeys key [...]` | 求差集 |
| `ZINTER numkeys key [...]` | 求交集 |
| `ZUNION numkeys key [...]` | 求并集 |

> **注意**：所有排名默认都是升序，如果要降序则在命令的 `Z` 后面添加 `REV`，例如 `ZREVRANK`。

**实战练习**：用 SortedSet 实现学生成绩排行榜

场景：将学生成绩存入 SortedSet，Jack=85, Lucy=89, Rose=82, Tom=95, Jerry=78, Amy=92, Miles=76。

```bash
127.0.0.1:6379> ZADD stuscore 85 Jack 89 Lucy 82 Rose 95 Tom 78 Jerry 92 Amy 76 Miles
(integer) 7

# 删除 Tom
127.0.0.1:6379> ZREM stuscore Tom
(integer) 1

# 获取 Amy 的分数
127.0.0.1:6379> ZSCORE stuscore Amy
"92"

# 获取 Amy 的排名（升序，第1名是0）
127.0.0.1:6379> ZRANK stuscore Amy
(integer) 2

# 获取 Tom 的排名（降序）
127.0.0.1:6379> ZREVRANK stuscore Tom
(nil)    # Tom 已被删除

# 获取前3名（升序）
127.0.0.1:6379> ZRANGE stuscore 0 2 WITHSCORES
1) "Miles"
2) "76"
3) "Jerry"
4) "78"
5) "Rose"
6) "82"

# 获取第2名到第4名（升序）
127.0.0.1:6379> ZRANGE stuscore 1 3 WITHSCORES
1) "Jerry"
2) "78"
3) "Rose"
4) "82"
5) "Jack"
6) "85"

# 获取分数在 80~90 之间的学生人数
127.0.0.1:6379> ZCOUNT stuscore 80 90
(integer) 3    # Rose(82), Jack(85), Lucy(89)

# 给 Lucy 加5分
127.0.0.1:6379> ZINCRBY stuscore 5 Lucy
"94"
```

### 2.6.2 SortedSet 的底层编码规则

SortedSet 需要同时支持**按 score 排序**和**按 member 查 score**，因此底层是 **SkipList + Dict** 的组合结构。在数据量较小时，会优先使用 ZipList 以节省内存。

**两种编码方式**：

| 编码 | 说明 | 触发条件（全部满足） |
|---|---|---|
| `ziplist` | 连续内存，相邻 entry 分别存 member 和 score，按 score 升序排列 | ① 元素数量 ≤ `zset-max-ziplist-entries`（默认 **128**）<br>② 每个 member 字节数 ≤ `zset-max-ziplist-value`（默认 **64**） |
| `skiplist` | SkipList + Dict，支持高效范围查询和单点查询 | 任意一个条件不满足时，**自动转码**为 skiplist |

> **贴心提示**：ZipList 本身不具备排序功能，Redis 通过编码约定实现有序——member 和 score 作为相邻两个 entry 存储，score 越小越接近队首。

**查看编码方式**：

```bash
127.0.0.1:6379> ZADD test:zset 10 a 20 b
(integer) 2
127.0.0.1:6379> OBJECT ENCODING test:zset
"ziplist"

# 插入一个超过 64 字节的 member 后，编码自动切换
127.0.0.1:6379> ZADD test:zset 30 "this_is_a_very_long_member_string_that_exceeds_64_bytes_limit_test"
(integer) 1
127.0.0.1:6379> OBJECT ENCODING test:zset
"skiplist"
```

---

