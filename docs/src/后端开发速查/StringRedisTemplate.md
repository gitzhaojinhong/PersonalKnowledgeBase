## 1. String 值操作（opsForValue）

`opsForValue()` 返回 `ValueOperations<String, String>` 接口，提供 String 类型数据的读写操作。

### 1.1 基本读写操作

#### 1.1.1 set 写入数据

```java
// 简单写入
stringRedisTemplate.opsForValue().set("key", "value");

// 带过期时间写入
stringRedisTemplate.opsForValue().set("key", "value", 30, TimeUnit.MINUTES);

// 带过期时间写入（使用 Duration）
stringRedisTemplate.opsForValue().set("key", "value", Duration.ofMinutes(30));

// 仅当键不存在时写入（NX）
stringRedisTemplate.opsForValue().setIfAbsent("key", "value");

// 仅当键存在时写入（XX）
stringRedisTemplate.opsForValue().setIfPresent("key", "value");

// 带过期时间的 NX 操作
stringRedisTemplate.opsForValue().setIfAbsent("key", "value", 30, TimeUnit.MINUTES);
```

#### 1.1.2 get 读取数据

```java
// 读取数据
String value = stringRedisTemplate.opsForValue().get("key");

// 读取并删除（GETDEL）
String value = stringRedisTemplate.opsForValue().getAndDelete("key");

// 读取并设置新值（GETSET）
String oldValue = stringRedisTemplate.opsForValue().getAndSet("key", "newValue");

// 读取并增加（GETDEL + INCR）
stringRedisTemplate.opsForValue().getAndIncrement("key");

// 读取并减少
stringRedisTemplate.opsForValue().getAndDecrement("key");

// 读取并增加指定值
stringRedisTemplate.opsForValue().getAndIncrement("key", 10L);

// 读取并减少指定值
stringRedisTemplate.opsForValue().getAndDecrement("key", 5L);
```

#### 1.1.3 multiGet 批量读取

```java
// 批量读取
List<String> keys = Arrays.asList("key1", "key2", "key3");
List<String> values = stringRedisTemplate.opsForValue().multiGet(keys);
// 返回结果与 keys 顺序对应，若 key 不存在则对应位置为 null
```

#### 1.1.4 multiSet/multiSetIfAbsent 批量写入

```java
// 批量写入
Map<String, String> map = new HashMap<>();
map.put("key1", "value1");
map.put("key2", "value2");
map.put("key3", "value3");
stringRedisTemplate.opsForValue().multiSet(map);

// 批量写入（仅当所有键都不存在）
stringRedisTemplate.opsForValue().multiSetIfAbsent(map);

// 批量写入单个映射
stringRedisTemplate.opsForValue().set("key", "value");
```

### 1.2 数值操作

#### 1.2.1 increment 递增

```java
// 自增 1（值必须是数字字符串）
Long result = stringRedisTemplate.opsForValue().increment("counter");
// 返回自增后的值

// 自增指定数值
Long result = stringRedisTemplate.opsForValue().increment("counter", 10L);

// 自增浮点数
Double result = stringRedisTemplate.opsForValue().increment("score", 5.5);
```

#### 1.2.2 decrement 递减

```java
// 自减 1
Long result = stringRedisTemplate.opsForValue().decrement("counter");

// 自减指定数值
Long result = stringRedisTemplate.opsForValue().decrement("counter", 10L);
```

**应用场景：** 计数器、库存扣减、限流计数

```java
// 示例：接口限流（每分钟限制 100 次请求）
public boolean isRateLimited(String userId) {
    String key = "rate:limit:" + userId + ":" + LocalDateTime.now().getMinute();
    Long count = stringRedisTemplate.opsForValue().increment(key);
    if (count == 1) {
        stringRedisTemplate.expire(key, 1, TimeUnit.MINUTES);
    }
    return count > 100;
}
```

### 1.3 字符串操作

#### 1.3.1 append 追加

```java
// 在现有值末尾追加内容
Integer newLength = stringRedisTemplate.opsForValue().append("key", "suffix");
// 返回追加后的字符串长度
```

#### 1.3.2 size 获取长度

```java
// 获取字符串长度
Long length = stringRedisTemplate.opsForValue().size("key");
```

#### 1.3.3 getRange 截取字符串

```java
// 截取子字符串 [start, end]，索引从 0 开始
String subStr = stringRedisTemplate.opsForValue().getRange("key", 0, 4);
```

#### 1.3.4 setRange 覆盖字符串

```java
// 从指定偏移量开始覆盖字符串
stringRedisTemplate.opsForValue().set("key", "hello world", 6); // "hello Redis"
```

### 1.4 位图操作

#### 1.4.1 setBit 设置位

```java
// 设置指定偏移量的位值
stringRedisTemplate.opsForValue().setBit("bitmap", 100L, true);
```

#### 1.4.2 getBit 获取位

```java
// 获取指定偏移量的位值
Boolean bit = stringRedisTemplate.opsForValue().getBit("bitmap", 100L);
```

#### 1.4.3 bitCount 统计位数

```java
// 统计位值为 1 的数量
Long count = stringRedisTemplate.opsForValue().bitCount("bitmap");

// 统计指定范围的位数
Long count = stringRedisTemplate.opsForValue().bitCount("bitmap", 0, 10);
```

---

## 2. Hash 操作（opsForHash）

`opsForHash()` 返回 `HashOperations<String, Object, Object>` 接口，提供 Hash 类型数据的操作。

### 2.1 基本写入操作

#### 2.1.1 put 单条写入

```java
// 写入单个字段
stringRedisTemplate.opsForHash().put("user:1000", "name", "Alice");
stringRedisTemplate.opsForHash().put("user:1000", "age", "25");
```

#### 2.1.2 putAll 批量写入

```java
// 批量写入字段
Map<String, String> userMap = new HashMap<>();
userMap.put("name", "Alice");
userMap.put("age", "25");
userMap.put("city", "Beijing");
stringRedisTemplate.opsForHash().putAll("user:1000", userMap);
```

#### 2.1.3 putIfAbsent 条件写入

```java
// 仅当字段不存在时写入
stringRedisTemplate.opsForHash().putIfAbsent("user:1000", "name", "Alice");
```

### 2.2 基本读取操作

#### 2.2.1 get 单字段读取

```java
// 读取单个字段
Object name = stringRedisTemplate.opsForHash().get("user:1000", "name");
```

#### 2.2.2 multiGet 批量读取

```java
// 批量读取字段
List<Object> keys = Arrays.asList("name", "age", "city");
List<Object> values = stringRedisTemplate.opsForHash().multiGet("user:1000", keys);
```

#### 2.2.3 entries 获取所有字段

```java
// 获取所有字段和值
Map<Object, Object> user = stringRedisTemplate.opsForHash().entries("user:1000");
```

#### 2.2.4 keys 获取所有字段名

```java
// 获取 Hash 的所有字段名
Set<Object> fields = stringRedisTemplate.opsForHash().keys("user:1000");
```

#### 2.2.5 values 获取所有值

```java
// 获取 Hash 的所有值
List<Object> values = stringRedisTemplate.opsForHash().values("user:1000");
```

#### 2.2.6 size 获取字段数量

```java
// 获取 Hash 的字段数量
Long size = stringRedisTemplate.opsForHash().size("user:1000");
```

### 2.3 数值操作

#### 2.3.1 increment 递增

```java
// 字段值递增 1
Long newValue = stringRedisTemplate.opsForHash().increment("user:1000", "age", 1);

// 字段值递增指定数值
Long newValue = stringRedisTemplate.opsForHash().increment("user:1000", "age", 10L);

// 浮点数递增
Double newValue = stringRedisTemplate.opsForHash().increment("user:1000", "score", 5.5);
```

#### 2.3.2 decrement 递减

```java
// 字段值递减
Long newValue = stringRedisTemplate.opsForHash().increment("user:1000", "age", -1);
```

### 2.4 删除操作

#### 2.4.1 delete 删除字段

```java
// 删除单个字段
stringRedisTemplate.opsForHash().delete("user:1000", "city");

// 批量删除字段
stringRedisTemplate.opsForHash().delete("user:1000", "city", "country");
```

#### 2.4.2 hasKey 判断字段是否存在

```java
// 判断字段是否存在
Boolean exists = stringRedisTemplate.opsForHash().hasKey("user:1000", "name");
```

---

## 3. List 操作（opsForList）

`opsForList()` 返回 `ListOperations<String, String>` 接口，提供 List 类型数据的操作。

### 3.1 写入操作

#### 3.1.1 leftPush 左侧插入

```java
// 从左侧插入单个元素
stringRedisTemplate.opsForList().leftPush("list:key", "one");

// 从左侧批量插入
stringRedisTemplate.opsForList().leftPushAll("list:key", "one", "two", "three");

// 从左侧批量插入（Collection）
List<String> values = Arrays.asList("a", "b", "c");
stringRedisTemplate.opsForList().leftPushAll("list:key", values);

// 仅当列表存在时才插入
stringRedisTemplate.opsForList().leftPushIfPresent("list:key", "value");
```

#### 3.1.2 rightPush 右侧插入

```java
// 从右侧插入单个元素
stringRedisTemplate.opsForList().rightPush("list:key", "one");

// 从右侧批量插入
stringRedisTemplate.opsForList().rightPushAll("list:key", "one", "two", "three");
```

#### 3.1.3 set 按索引设置

```java
// 设置指定索引位置的值
stringRedisTemplate.opsForList().set("list:key", 0, "newFirst");
stringRedisTemplate.opsForList().set("list:key", 2, "newThird");
```

### 3.2 读取操作

#### 3.2.1 leftPop 左侧弹出

```java
// 从左侧弹出元素（会删除）
String value = stringRedisTemplate.opsForList().leftPop("list:key");

// 带超时时间的弹出（队列阻塞）
String value = stringRedisTemplate.opsForList().leftPop("list:key", 10, TimeUnit.SECONDS);
```

#### 3.2.2 rightPop 右侧弹出

```java
// 从右侧弹出元素
String value = stringRedisTemplate.opsForList().rightPop("list:key");

// 带超时时间的弹出
String value = stringRedisTemplate.opsForList().rightPop("list:key", 10, TimeUnit.SECONDS);
```

#### 3.2.3 index 按索引获取

```java
// 获取指定索引的元素
String value = stringRedisTemplate.opsForList().index("list:key", 0);  // 第一个
String value = stringRedisTemplate.opsForList().index("list:key", -1); // 最后一个
```

#### 3.2.4 range 范围查询

```java
// 获取指定范围的元素 [start, end]
List<String> values = stringRedisTemplate.opsForList().range("list:key", 0, -1); // 获取全部
List<String> values = stringRedisTemplate.opsForList().range("list:key", 0, 9);  // 获取前 10 个
```

#### 3.2.5 size 获取长度

```java
// 获取列表长度
Long size = stringRedisTemplate.opsForList().size("list:key");
```

### 3.3 删除操作

#### 3.3.1 remove 移除元素

```java
// 移除列表中指定值的元素
// count > 0：从头到尾移除 count 个
// count < 0：从尾到头移除 count 个
// count = 0：移除所有匹配的值
Long removed = stringRedisTemplate.opsForList().remove("list:key", 1, "value"); // 移除 1 个
Long removed = stringRedisTemplate.opsForList().remove("list:key", 0, "value"); // 移除所有
```

#### 3.3.2 trim 裁剪列表

```java
// 裁剪列表，保留指定范围的元素
stringRedisTemplate.opsForList().trim("list:key", 0, 9); // 只保留前 10 个元素
```

---

## 4. Set 操作（opsForSet）

`opsForSet()` 返回 `SetOperations<String, String>` 接口，提供 Set 类型数据的操作。

### 4.1 写入操作

#### 4.1.1 add 添加元素

```java
// 添加单个或多个元素
stringRedisTemplate.opsForSet().add("set:key", "one", "two", "three");

// 添加 Collection
Set<String> values = new HashSet<>(Arrays.asList("a", "b", "c"));
stringRedisTemplate.opsForSet().add("set:key", values.toArray(new String[0]));
```

### 4.2 读取操作

#### 4.2.1 members 获取所有元素

```java
// 获取集合的所有成员
Set<String> members = stringRedisTemplate.opsForSet().members("set:key");
```

#### 4.2.2 isMember 判断成员

```java
// 判断元素是否为集合成员
Boolean isMember = stringRedisTemplate.opsForSet().isMember("set:key", "one");
```

#### 4.2.3 randomMember 随机获取

```java
// 随机获取一个成员
String member = stringRedisTemplate.opsForSet().randomMember("set:key");

// 随机获取多个成员（可能重复）
List<String> members = stringRedisTemplate.opsForSet().randomMembers("set:key", 3);

// 随机获取多个不重复的成员
Set<String> members = stringRedisTemplate.opsForSet().distinctRandomMembers("set:key", 3);
```

#### 4.2.4 size 获取集合大小

```java
Long size = stringRedisTemplate.opsForSet().size("set:key");
```

### 4.3 集合运算

#### 4.3.1 union 并集

```java
// 计算并集
Set<String> union = stringRedisTemplate.opsForSet().union("set1", "set2");
Set<String> union = stringRedisTemplate.opsForSet().union("set1", Arrays.asList("set2", "set3"));

// 存储并集结果
stringRedisTemplate.opsForSet().unionAndStore("set1", "set2", "resultKey");
```

#### 4.3.2 intersect 交集

```java
// 计算交集
Set<String> intersect = stringRedisTemplate.opsForSet().intersect("set1", "set2");

// 存储交集结果
stringRedisTemplate.opsForSet().intersectAndStore("set1", "set2", "resultKey");
```

#### 4.3.3 difference 差集

```java
// 计算差集（set1 中有而 set2 中没有的）
Set<String> diff = stringRedisTemplate.opsForSet().difference("set1", "set2");

// 存储差集结果
stringRedisTemplate.opsForSet().differenceAndStore("set1", "set2", "resultKey");
```

### 4.4 删除操作

#### 4.4.1 remove 移除元素

```java
// 移除一个或多个元素
Long removed = stringRedisTemplate.opsForSet().remove("set:key", "one", "two");
```

---

## 5. ZSet 操作（opsForZSet）

`opsForZSet()` 返回 `ZSetOperations<String, String>` 接口，提供 Sorted Set（有序集合）类型数据的操作。

### 5.1 写入操作

#### 5.1.1 add 添加元素

```java
// 添加单个元素（带分数）
stringRedisTemplate.opsForZSet().add("zset:key", "one", 1.0);
stringRedisTemplate.opsForZSet().add("zset:key", "two", 2.0);

// 批量添加
Set<ZSetOperations.TypedTuple<String>> tuples = new HashSet<>();
tuples.add(ZSetOperations.TypedTuple.of("member1", 1.0));
tuples.add(ZSetOperations.TypedTuple.of("member2", 2.0));
stringRedisTemplate.opsForZSet().add("zset:key", tuples);
```

### 5.2 读取操作

#### 5.2.1 range 按索引范围查询

```java
// 按分数升序获取 [start, end]
Set<String> members = stringRedisTemplate.opsForZSet().range("zset:key", 0, -1);

// 带分数获取
Set<ZSetOperations.TypedTuple<String>> tuples = stringRedisTemplate.opsForZSet().rangeWithScores("zset:key", 0, -1);
```

#### 5.2.2 reverseRange 逆序查询

```java
// 按分数降序获取
Set<String> members = stringRedisTemplate.opsForZSet().reverseRange("zset:key", 0, -1);

// 带分数逆序获取
Set<ZSetOperations.TypedTuple<String>> tuples = stringRedisTemplate.opsForZSet().reverseRangeWithScores("zset:key", 0, -1);
```

#### 5.2.3 rangeByScore 按分数范围查询

```java
// 按分数范围查询
Set<String> members = stringRedisTemplate.opsForZSet().rangeByScore("zset:key", 1.0, 10.0);

// 带分数查询
Set<ZSetOperations.TypedTuple<String>> tuples = stringRedisTemplate.opsForZSet().rangeByScoreWithScores("zset:key", 1.0, 10.0);
```

#### 5.2.4 rank/zrevrank 获取排名

```java
// 获取升序排名（从 0 开始）
Long rank = stringRedisTemplate.opsForZSet().rank("zset:key", "member");

// 获取降序排名
Long revRank = stringRedisTemplate.opsForZSet().reverseRank("zset:key", "member");
```

#### 5.2.5 score 获取分数

```java
// 获取成员分数
Double score = stringRedisTemplate.opsForZSet().score("zset:key", "member");
```

#### 5.2.6 count/size 统计

```java
// 统计指定分数范围内的成员数量
Long count = stringRedisTemplate.opsForZSet().count("zset:key", 1.0, 10.0);

// 获取集合大小
Long size = stringRedisTemplate.opsForZSet().size("zset:key");
```

### 5.3 更新操作

#### 5.3.1 incrementScore 增加分数

```java
// 增加成员的分数
Double newScore = stringRedisTemplate.opsForZSet().incrementScore("zset:key", "member", 5.0);
```

### 5.4 删除操作

#### 5.4.1 remove 移除元素

```java
// 移除一个或多个成员
Long removed = stringRedisTemplate.opsForZSet().remove("zset:key", "member1", "member2");
```

#### 5.4.2 removeRangeByRank 按排名删除

```java
// 删除排名 [start, end] 的成员
stringRedisTemplate.opsForZSet().removeRange("zset:key", 0, 9); // 删除前 10 名
```

#### 5.4.3 removeRangeByScore 按分数删除

```java
// 删除分数范围内的成员
stringRedisTemplate.opsForZSet().removeRangeByScore("zset:key", 0.0, 10.0);
```

---

## 6. 键操作（Key Operations）

### 6.1 键存在性判断

```java
// 判断键是否存在
Boolean exists = stringRedisTemplate.hasKey("key");

// 批量判断键是否存在
List<String> keys = Arrays.asList("key1", "key2", "key3");
List<Boolean> results = stringRedisTemplate.hasKey(keys);
```

### 6.2 键删除

```java
// 删除单个键
Boolean deleted = stringRedisTemplate.delete("key");

// 批量删除键
Long deletedCount = stringRedisTemplate.delete(Arrays.asList("key1", "key2", "key3"));

// 非阻塞删除（异步，推荐大数据量场景）
stringRedisTemplate.unlink("key");
stringRedisTemplate.unlink(Arrays.asList("key1", "key2"));
```

**说明：** `delete` 是同步阻塞删除，`unlink` 是异步非阻塞删除，Redis 4.0+ 推荐使用 `unlink`。

### 6.3 键重命名

```java
// 重命名键
stringRedisTemplate.rename("oldKey", "newKey");

// 仅当新键不存在时重命名
Boolean renamed = stringRedisTemplate.renameIfAbsent("oldKey", "newKey");
```

### 6.4 键类型查询

```java
// 获取键对应的值类型
DataType type = stringRedisTemplate.type("key");
// 返回值：STRING, LIST, SET, ZSET, HASH, STREAM, NONE
```

### 6.5 键模糊查询

#### 6.5.1 keys 全量匹配（生产环境慎用）

```java
// 使用通配符匹配所有键
// * 匹配任意字符
// ? 匹配单个字符
// [] 匹配括号内任意一个字符
Set<String> keys = stringRedisTemplate.keys("user:*");
Set<String> keys = stringRedisTemplate.keys("user:?:*");
```

**⚠️ 警告：** `keys` 命令会阻塞 Redis，生产环境数据量大时慎用。

#### 6.5.2 scan 增量匹配（推荐）

```java
// 使用 SCAN 命令迭代遍历键
public Set<String> scanKeys(String pattern) {
    Set<String> result = new HashSet<>();
    ScanOptions options = ScanOptions.scanOptions()
            .match(pattern)
            .count(1000)  // 每次遍历的元素数量
            .build();
    
    Cursor<byte[]> cursor = stringRedisTemplate.execute((RedisConnection connection) ->
            connection.scan(options));
    
    while (cursor.hasNext()) {
        result.add(new String(cursor.next()));
    }
    return result;
}

// 分页获取键
public List<String> scanKeysForPage(String pattern, int pageNum, int pageSize) {
    List<String> result = new ArrayList<>();
    ScanOptions options = ScanOptions.scanOptions()
            .match(pattern)
            .count(1000)
            .build();
    
    Cursor<byte[]> cursor = stringRedisTemplate.execute((RedisConnection connection) ->
            connection.scan(options));
    
    int index = 0;
    int start = (pageNum - 1) * pageSize;
    int end = pageNum * pageSize;
    
    while (cursor.hasNext()) {
        if (index >= start && index < end) {
            result.add(new String(cursor.next()));
        } else {
            cursor.next();
        }
        index++;
        if (index >= end) break;
    }
    return result;
}
```

### 6.6 键排序

```java
// 对列表、集合、有序集合进行排序
List<String> sorted = stringRedisTemplate.sort("list:key");

// 带参数排序
SortQuery<String> query = SortQueryBuilder.sort("list:key")
        .alpha(true)           // 按字母排序
        .order(Sort.Direction.DESC)  // 降序
        .limit(0, 10)         // 分页
        .get("pattern:*")      // 获取外部键
        .build();
List<String> sorted = stringRedisTemplate.sort(query);
```

---

## 7. 过期时间操作

### 7.1 设置过期时间

```java
// 设置过期时间（秒）
stringRedisTemplate.expire("key", 30, TimeUnit.SECONDS);

// 设置过期时间（分钟）
stringRedisTemplate.expire("key", 5, TimeUnit.MINUTES);

// 使用 Duration 设置
stringRedisTemplate.expire("key", Duration.ofHours(1));

// 设置过期时间点
stringRedisTemplate.expireAt("key", new Date(System.currentTimeMillis() + 3600000));
stringRedisTemplate.expireAt("key", Instant.now().plusSeconds(3600));
```

### 7.2 查询过期时间

```java
// 获取剩余过期时间（秒）
Long seconds = stringRedisTemplate.getExpire("key");

// 获取剩余过期时间（指定单位）
Long seconds = stringRedisTemplate.getExpire("key", TimeUnit.SECONDS);
Long milliseconds = stringRedisTemplate.getExpire("key", TimeUnit.MILLISECONDS);

// 获取过期时间（Duration 格式）
Duration duration = stringRedisTemplate.getExpire("key", TimeUnit.SECONDS) != -1
    ? Duration.ofSeconds(stringRedisTemplate.getExpire("key", TimeUnit.SECONDS))
    : null;
```

**返回值说明：**
- `-1`：键存在但没有设置过期时间（永久有效）
- `-2`：键不存在

### 7.3 移除过期时间

```java
// 移除过期时间，使键永久有效
Boolean persisted = stringRedisTemplate.persist("key");
```

---

## 8. 绑定操作（Bound Operations）

绑定操作先绑定键，后续操作无需再指定键，适合对同一个键进行连续操作的场景。

### 8.1 BoundValueOperations 字符串绑定

```java
// 绑定键到特定操作对象
BoundValueOperations<String, String> boundOps = stringRedisTemplate.boundValueOps("user:1000");

// 后续操作无需再指定键
boundOps.set("Alice");
boundOps.append(" Wang");
String value = boundOps.get();
Long length = boundOps.size();
boundOps.increment();
boundOps.expire(30, TimeUnit.MINUTES);
```

### 8.2 BoundHashOperations Hash 绑定

```java
BoundHashOperations<String, Object, Object> boundHash = stringRedisTemplate.boundHashOps("user:1000");

boundHash.put("name", "Alice");
boundHash.put("age", 25);
Map<Object, Object> entries = boundHash.entries();
boundHash.increment("age", 1);
```

### 8.3 BoundListOperations List 绑定

```java
BoundListOperations<String, String> boundList = stringRedisTemplate.boundListOps("queue:tasks");

boundList.leftPush("task1");
boundList.rightPush("task2");
String first = boundList.leftPop();
String last = boundList.rightPop();
Long size = boundList.size();
List<String> range = boundList.range(0, 9);
```

### 8.4 BoundSetOperations Set 绑定

```java
BoundSetOperations<String, String> boundSet = stringRedisTemplate.boundSetOps("tags:redis");

boundSet.add("java", "spring", "redis");
Set<String> members = boundSet.members();
Boolean isMember = boundSet.isMember("java");
Long size = boundSet.size();
```

### 8.5 BoundZSetOperations ZSet 绑定

```java
BoundZSetOperations<String, String> boundZSet = stringRedisTemplate.boundZSetOps("leaderboard");

boundZSet.add("player1", 1000.0);
boundZSet.add("player2", 2000.0);
Set<String> top10 = boundZSet.reverseRange(0, 9);
Double score = boundZSet.score("player1");
```

---

## 9. 回调（Callback）

### 9.1 RedisCallback

**基本使用：**

```java
String result = stringRedisTemplate.execute(new RedisCallback<String>() {
    @Override
    public String doInRedis(RedisConnection connection) throws DataAccessException {
        connection.stringCommands().set("name".getBytes(), "张三".getBytes());
        byte[] value = connection.stringCommands().get("name".getBytes());
        return value != null ? new String(value) : null;
    }
});
```

**其他用法：**

| 用法                       | 说明                             | 关键代码                                                     |
| -------------------------- | -------------------------------- | ------------------------------------------------------------ |
| Lambda 简化                | 省略匿名内部类模板代码           | `execute(connection -> { ... })`                             |
| StringRedisConnection 简化 | 强转后直接操作 String，免 byte[] | `(StringRedisConnection) connection` → `stringConn.set("k","v")` |
| SCAN 扫描                  | 遍历匹配模式的 Key               | `connection.scan(ScanOptions.scanOptions().match(pattern).build())` |
| exposeConnection=true      | 暴露原生连接                     | `execute(action, true)`                                      |
| pipeline=true              | 开启管道模式                     | `execute(action, true, true)`                                |

### 9.2 SessionCallback

**基本使用：**

```java
stringRedisTemplate.execute(new SessionCallback<Void>() {
    @Override
    public Void execute(RedisOperations operations) throws DataAccessException {
        operations.opsForValue().set("key1", "value1");
        operations.opsForValue().set("key2", "value2");
        return null;
    }
});
```

**其他用法：**

| 用法             | 说明                                                    |
| ---------------- | ------------------------------------------------------- |
| 同连接多类型操作 | 同一 Session 内混用 opsForValue/opsForList/opsForSet 等 |

### 9.3 RedisScript — Lua 脚本

**获取分布式锁：**

```java
String script =
    "if redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2]) then " +
    "  return 1 " +
    "else " +
    "  return -1 " +
    "end";

DefaultRedisScript<Long> redisScript = new DefaultRedisScript<>(script, Long.class);
Long result = stringRedisTemplate.execute(
    redisScript,
    Collections.singletonList("lock:order:123"),
    "thread-1", "30"
);
```

**其他用法：**

| 用法           | 说明                                                         |
| -------------- | ------------------------------------------------------------ |
| 释放锁         | `if GET KEYS[1] == ARGV[1] then DEL KEYS[1]`                 |
| 自定义序列化器 | `execute(script, argsSerializer, resultSerializer, keys, args)` |

### 9.4 使用对比

| 对比维度     | RedisCallback               | SessionCallback             | RedisScript         |
| ------------ | --------------------------- | --------------------------- | ------------------- |
| **操作对象** | RedisConnection（底层连接） | RedisOperations（高层会话） | Lua 脚本            |
| **序列化**   | 需手动处理 byte[]           | 自动处理                    | 可自定义 Serializer |
| **连接管理** | 每次获取新连接              | 同一 Session 共享连接       | 脚本在服务端执行    |
| **原子性**   | 单命令原子                  | 多命令非原子                | **整个脚本原子**    |
| **适用场景** | 底层操作、SCAN              | 事务、Pipeline、批量操作    | 原子性复合操作      |
| **推荐程度** | 特殊场景                    | **日常首选**                | 原子操作首选        |

---

## 10. 管道（Pipeline）

### 10.1 RedisCallback 方式

**批量写入：**

```java
List<Object> results = stringRedisTemplate.executePipelined(
    new RedisCallback<Void>() {
        @Override
        public Void doInRedis(RedisConnection connection) throws DataAccessException {
            StringRedisConnection stringConn = (StringRedisConnection) connection;
            for (int i = 0; i < 10000; i++) {
                stringConn.set("user:" + i, "userData:" + i);
            }
            return null;  // ⚠️ 必须返回 null
        }
    }
);
```

**其他用法：**

| 用法        | 说明                                                       |
| ----------- | ---------------------------------------------------------- |
| Lambda 简化 | `(RedisCallback<Void>) connection -> { ... return null; }` |
| 批量弹出    | `stringConn.rPop(queueKey)` 循环调用                       |
| 复合操作    | 同一 Pipeline 内混用 lPush / zRem 等                       |

### 10.2 SessionCallback 方式

**批量写入：**

```java
List<Object> results = stringRedisTemplate.executePipelined(
    new SessionCallback<Void>() {
        @Override
        public Void execute(RedisOperations operations) throws DataAccessException {
            for (int i = 0; i < 10000; i++) {
                operations.opsForValue().set("user:" + i, "userData:" + i);
            }
            return null;
        }
    }
);
```

**其他用法：**

| 用法        | 说明                                                         |
| ----------- | ------------------------------------------------------------ |
| 批量 GET    | `opsForValue().get(key)` 循环，结果由 executePipelined 统一收集 |
| 批量 DELETE | `operations.delete(key)` 循环                                |
| 批量 Hash   | `opsForHash().put(key, field, value)` / `opsForHash().get(key, field)` |
| 带 TTL 写入 | `opsForValue().set(key, value, timeout, unit)`               |
| 工具类封装  | 封装 `executePipeline(Consumer<RedisOperations>)` + 分批执行 |

### 10.3 使用对比

| 对比维度         | execute            | executePipelined                       |
| ---------------- | ------------------ | -------------------------------------- |
| **用途**         | 执行单个命令或事务 | 批量执行多个命令（管道）               |
| **返回值**       | 回调自定义返回     | List\<Object\>（自动收集所有命令结果） |
| **网络通信**     | 每个命令一次通信   | 配置 flush 策略后所有命令一次通信      |
| **原子性**       | 配合事务可保证     | **不保证**                             |
| **性能**         | 一般               | **高**（减少 RTT）                     |
| **回调返回要求** | 可返回自定义值     | **必须返回 null**                      |

**原理：普通模式 vs Pipeline：**

```
普通模式（N 次 RTT）：
Client → CMD1 → Server → Client → CMD2 → Server → ... → Client → CMDn → Server

Pipeline 模式（1 次 RTT）：
Client → [CMD1, CMD2, ..., CMDn] → Server → [R1, R2, ..., Rn] → Client
```

Pipeline 本质是**队列**，先进先出，**不保证原子性**。

**默认"伪 Pipeline"问题：**

Spring Data Redis + Lettuce 默认使用 `FlushEachCommand` 策略，每条命令执行时立即 flush 发送：

```
executePipelined() 默认行为：
1. openPipeline() → 设置 autoFlushCommands=false ✅
2. 命令1 → 写入 buffer → FlushEachCommand.onCommand() → 立即 flushCommands() → 发送！
3. 命令2 → 写入 buffer → FlushEachCommand.onCommand() → 立即 flushCommands() → 发送！
4. ...每条命令都是单独发送，等于没有攒批！
5. closePipeline() → 收集所有响应返回
```

- 响应虽然被批量收集返回了，但**命令还是逐条发送的**，RTT 没有减少
- 性能对比：默认"伪 Pipeline" 比原生 Lettuce Pipeline 慢 3~5 倍
- 2.3 对比表中"配置 flush 策略后所有命令一次通信"即指此

**真正的 Pipeline 需要 PipeliningFlushPolicy：**

```
executePipelined() + flushOnClose() 行为：
1. openPipeline() → 设置 autoFlushCommands=false ✅
2. 命令1 → 写入 buffer → FlushOnClose.onCommand() → 不 flush，继续攒！
3. 命令2 → 写入 buffer → FlushOnClose.onCommand() → 不 flush，继续攒！
4. ...所有命令都在 buffer 里等着
5. closePipeline() → FlushOnClose.onClose() → flushCommands() → 一次性全发！
```

### 10.4 Lettuce 刷新策略（可选性能优化）

| 策略                           | 行为                        | 适用场景                  |
| ------------------------------ | --------------------------- | ------------------------- |
| **flushEachCommand()**（默认） | 每条命令立即 flush 发送     | "伪 Pipeline"，RTT 未减少 |
| **flushOnClose()** ⭐推荐       | Pipeline 关闭时一次性 flush | 绝大多数场景              |
| **buffered(int n)**            | 每攒 n 条命令 flush 一次    | 需控制发送频率的场景      |

配置 PipeliningFlushPolicy 即可启用，Spring Boot 自动装配的 StringRedisTemplate 无需重定义：

```java
@Configuration
public class RedisPipelineConfig {
    @Bean
    public BeanPostProcessor lettuceConnectionFactoryBeanProcessor() {
        return new BeanPostProcessor() {
            @Override
            public Object postProcessAfterInitialization(Object bean, String beanName)
                    throws BeansException {
                if (bean instanceof LettuceConnectionFactory) {
                    LettuceConnectionFactory factory = (LettuceConnectionFactory) bean;
                    factory.setPipeliningFlushPolicy(
                        LettuceConnection.PipeliningFlushPolicy.flushOnClose()
                    );
                }
                return bean;
            }
        };
    }
}
```

> ⚠️ PipeliningFlushPolicy **只作用于 Pipeline 获取的专用连接，不修改共享连接**。`executePipelined()` 内部已自动使用专用连接，因此**不需要** `setShareNativeConnection(false)`，关了反而降低非 Pipeline 操作的性能。

### 10.5 注意事项

| #    | 注意事项                      | 说明                                                         |
| ---- | ----------------------------- | ------------------------------------------------------------ |
| 1    | **回调必须返回 null**         | 否则抛出 `InvalidDataAccessApiUsageException`                |
| 2    | **不保证原子性**              | 如需原子性请用事务或 Lua                                     |
| 3    | **get() 即时返回 null**       | 结果由 `executePipelined` 统一收集                           |
| 4    | **回调中必须使用 connection** | 在 RedisCallback 中用 redisTemplate 则 Pipeline 不生效       |
| 5    | **Pipeline 与事务不要混用**   | 两者机制冲突，分开使用                                       |
| 6    | **单批 ≤ 500 条**             | 避免阻塞 Redis，合理分批                                     |
| 7    | **默认是"伪 Pipeline"**       | 需配置 PipeliningFlushPolicy 才能真正攒批发送                |
| 8    | **Cluster 兼容性**            | Standalone 完全支持；Lettuce Cluster 同槽键支持、跨槽键受限；Jedis Cluster 不支持 |

---

## 11. 事务（Transaction）

### 11.1 SessionCallback 事务

**基本操作：**

```java
List<Object> results = stringRedisTemplate.execute(new SessionCallback<List<Object>>() {
    @Override
    public List<Object> execute(RedisOperations operations) throws DataAccessException {
        operations.multi();
        operations.opsForValue().set("account:A", "1000");
        operations.opsForValue().set("account:B", "2000");
        try {
            return operations.exec();
        } catch (RuntimeException e) {
            operations.discard(); // ⚠️ 必须调用，防止连接卡在事务状态
            throw e;
        }
    }
});
```

**MULTI/EXEC 执行流程：**

```
1. 客户端A：MULTI
   → 开启事务，接下来命令开始入队，不执行

2. 客户端A：set key1 value1
   → 命令入队，不执行

3. 客户端A：set key2 value2
   → 命令入队，不执行

4. 客户端A：increment counter
   → 命令入队，不执行

5. ⚠️ 此时客户端B修改了 key1、key2、counter 任意一个
   → Redis 完全不管！不做任何标记！

6. 客户端A：EXEC
   → Redis 直接执行队列里的所有命令
   → 不管键有没有被改过，全部执行！
   → 返回每条命令的执行结果，永远不会返回 null！
```

**Redis 事务 ACID：**

| 特性   | 支持       | 说明                                                     |
| ------ | ---------- | -------------------------------------------------------- |
| 原子性 | ❌          | 运行时错误不影响其他命令，无回滚机制                     |
| 一致性 | ✅          | Redis 无复杂约束，每条命令结果合法则整体合法             |
| 隔离性 | ⚠️          | EXEC 执行期间有隔离；MULTI~EXEC 期间其他客户端可自由修改 |
| 持久性 | 取决于配置 | 依赖 RDB/AOF 持久化策略                                  |

**其他用法：**

| 用法             | 说明                                                  |
| ---------------- | ----------------------------------------------------- |
| DISCARD 放弃事务 | 条件判断后调用 `operations.discard()`，所有命令不执行 |

### 11.2 @Transactional 事务

**配置与使用：**

```java
// 配置
@Configuration
@EnableTransactionManagement
public class RedisTransactionConfig {
    @Bean
    public StringRedisTemplate stringRedisTemplate(RedisConnectionFactory factory) {
        StringRedisTemplate template = new StringRedisTemplate(factory);
        template.setEnableTransactionSupport(true); // ⚠️ 必须显式启用
        template.afterPropertiesSet();
        return template;
    }

    @Bean
    public PlatformTransactionManager transactionManager(DataSource dataSource) {
        return new DataSourceTransactionManager(dataSource);
    }
}

// 使用
@Transactional(rollbackFor = Exception.class)
public void createOrder(String orderId, String orderInfo) {
    stringRedisTemplate.opsForValue().set("order:" + orderId, orderInfo);
    stringRedisTemplate.opsForValue().set("order:status:" + orderId, "CREATED");
}
```

**配置三要素**：① @EnableTransactionManagement ② setEnableTransactionSupport(true) ③ PlatformTransactionManager

**@Transactional 机制：**

setEnableTransactionSupport(true) 作用：让 Redis 命令**和数据库事务绑定在一起**：

- 数据库提交 → Redis 才执行
- 数据库回滚 → Redis 也不执行

```
1. 方法进入 @Transactional 事务

2. 调用 redis.set("key", "value")
   → Redis 不立刻执行，而是把命令暂存起来

3. 继续执行数据库操作

4. 如果一切正常 → 事务提交
   → Redis 才真正执行刚才暂存的命令

5. 如果报错/回滚
   → Redis 丢弃所有命令，一条都不执行
```

**使用约束：**

| 约束                                 | 说明                                                         |
| ------------------------------------ | ------------------------------------------------------------ |
| 事务内写操作                         | ✅ 在线程绑定的连接上执行                                     |
| 事务内读操作                         | ⚠️ get() 返回 null，事务内写入的值提交前不可见                |
| 事务外读操作                         | ✅ 在独立连接上运行（如 keys）                                |
| setEnableTransactionSupport 影响全局 | 开启后所有操作在同一 Connection，建议仅事务场景用 SessionCallback 代替 |

### 11.3 WATCH 乐观锁

**余额转账：**

```java
public boolean transferWithWatch(String fromAccount, String toAccount, int amount) {
    return Boolean.TRUE.equals(stringRedisTemplate.execute(new SessionCallback<Boolean>() {
        @Override
        public Boolean execute(RedisOperations operations) throws DataAccessException {
            operations.watch(fromAccount);                    // 1. WATCH
            String fromBalance = (String) operations.opsForValue().get(fromAccount);

            if (fromBalance == null || Integer.parseInt(fromBalance) < amount) {
                operations.unwatch();
                return false;
            }

            operations.multi();                               // 2. MULTI
            try {
                operations.opsForValue().set(fromAccount,
                    String.valueOf(Integer.parseInt(fromBalance) - amount));
                String toBalance = (String) operations.opsForValue().get(toAccount);
                operations.opsForValue().set(toAccount,
                    String.valueOf((toBalance == null ? 0 : Integer.parseInt(toBalance)) + amount));
                List<Object> results = operations.exec();     // 3. EXEC
                return results != null && !results.isEmpty(); // null=冲突
            } catch (Exception e) {
                operations.discard();
                return false;
            }
        }
    }));
}
```

**WATCH 执行流程：**

```
1. 客户端A：WATCH balance version
   → Redis 记住：这两个键现在是【干净】的

2. 客户端A：MULTI
   → 接下来命令开始入队，不执行

3. 客户端A：命令入队...
   → 只是排队，不执行

4. ⚠️ 关键：此时客户端B修改了 balance 或 version
   → Redis 立刻标记：键被改动过！

5. 客户端A：EXEC
   → Redis 检查：被监视的键是否被修改？
   → 是 → 放弃执行所有命令，返回 null
```

**与无 WATCH 事务的对比：**

| 场景                       | 无 WATCH             | 有 WATCH                              |
| -------------------------- | -------------------- | ------------------------------------- |
| 其他客户端修改了事务中的键 | Redis 不管，照常执行 | Redis 检测到冲突，放弃执行            |
| EXEC 返回值                | 永远不会返回 null    | 键被修改时返回 null                   |
| 命令顺序                   | MULTI → 命令 → EXEC  | **WATCH → GET → MULTI → 命令 → EXEC** |

> ⚠️ WATCH 必须在 MULTI 之前，之后调用无效。EXEC/DISCARD 后自动 UNWATCH。

**其他用法：**

| 用法         | 说明                                         |
| ------------ | -------------------------------------------- |
| 带重试       | 循环调用，exec() 返回 null 时重试，间隔 50ms |
| UNWATCH      | 主动取消监视（如余额不足时）                 |
| 自动 UNWATCH | EXEC/DISCARD 后自动触发                      |

### 11.4 使用对比

| 对比维度       | SessionCallback 方式       | @Transactional 方式                        |
| -------------- | -------------------------- | ------------------------------------------ |
| **配置要求**   | 无需额外配置               | 需设置 `setEnableTransactionSupport(true)` |
| **连接保证**   | SessionCallback 内自动保证 | 通过 ThreadLocal 绑定连接                  |
| **代码侵入性** | 需手动写 multi/exec        | 注解声明式，代码简洁                       |
| **异常处理**   | 需手动 catch + discard     | Spring 自动处理                            |
| **适用场景**   | 纯 Redis 事务              | Redis + 数据库混合事务                     |
| **推荐程度**   | ⭐ **纯 Redis 场景首选**    | 混合事务场景使用                           |

### 11.5 注意事项

| #    | 注意事项                      | 说明                                   |
| ---- | ----------------------------- | -------------------------------------- |
| 1    | **事务异常必须 discard()**    | 防止连接卡在事务状态                   |
| 2    | **事务内读不可见**            | 事务中写入的值，提交前 get() 返回 null |
| 3    | **WATCH 必须在 MULTI 之前**   | WATCH 在 MULTI 之后调用无效            |
| 4    | **exec() 返回 null 表示冲突** | WATCH 的键被修改时事务被放弃           |

## 12. 发布订阅（Pub/Sub）

### 12.1 配置消息监听容器

```java
@Configuration
public class RedisPubSubConfig {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    @Bean
    public RedisMessageListenerContainer redisMessageListenerContainer() {
        RedisMessageListenerContainer container = new RedisMessageListenerContainer();
        container.setConnectionFactory(stringRedisTemplate.getConnectionFactory());
        return container;
    }
}
```

### 12.2 订阅者实现

#### 12.2.1 实现 MessageListener 接口

```java
@Component
public class MyMessageListener implements MessageListener {

    @Override
    public void onMessage(Message message, byte[] pattern) {
        String body = new String(message.getBody());
        String channel = new String(message.getChannel());
        System.out.println("收到消息 - 频道: " + channel + ", 内容: " + body);
    }
}
```

#### 12.2.2 使用 @RedisListener 注解（推荐）

```java
@Component
public class RedisSubscriber {

    @RedisListener(channels = "chat:room:001")
    public void handleMessage(String message) {
        System.out.println("收到消息: " + message);
    }

    @RedisListener(channels = {"channel:1", "channel:2"})
    public void handleMultipleChannels(String message) {
        System.out.println("收到消息: " + message);
    }
}
```

### 12.3 发布消息

```java
@Service
public class MessagePublisher {

    @Autowired
    private StringRedisTemplate stringRedisTemplate;

    public void publish(String channel, String message) {
        stringRedisTemplate.convertAndSend(channel, message);
    }

    // 示例：发送订单消息
    public void publishOrderCreated(String orderId) {
        String message = "订单创建: " + orderId;
        stringRedisTemplate.convertAndSend("order:created", message);
    }
}
```

---

## 13. 集群操作

### 13.1 集群模式配置

```yaml
spring:
  redis:
    cluster:
      nodes:
        - 127.0.0.1:6379
        - 127.0.0.1:6380
        - 127.0.0.1:6381
      max-redirects: 3
```

### 13.2 集群操作接口

```java
// 获取集群操作接口
ClusterOperations<String, String> clusterOps = stringRedisTemplate.opsForCluster();

// 在指定节点执行操作
clusterOps.randomKey();

// 获取集群节点信息
clusterOps.clusterNodes();

// 获取集群槽信息
clusterOps.clusterSlots();
```

---

## 14. 常见问题与解决方案

### 14.1 序列化问题

**问题：** 存入的数据在 Redis 中显示为乱码或二进制格式。

**原因：** 同时使用了 `RedisTemplate` 和 `StringRedisTemplate`，序列化方式不一致。

**解决方案：** 统一使用 `StringRedisTemplate`，或确保所有模板使用相同的序列化器。

### 14.2 连接池耗尽

**问题：** `Could not get a resource since the pool is exhausted`。

**原因：** 连接未正确释放或连接池配置过小。

**解决方案：**
- 使用 `try-with-resources` 确保连接释放
- 增大连接池配置

```yaml
spring:
  redis:
    lettuce:
      pool:
        max-active: 50
        max-idle: 20
        min-idle: 5
```

### 14.3 过期时间未生效

**问题：** 设置了过期时间但数据未自动删除。

**原因：**
- 使用了 `multi()` 事务，`expire` 命令未被执行
- 序列化后的键与预期不符

**解决方案：**
- 检查事务是否正确 `exec()`
- 确保键名正确

### 14.4 集群模式下 keys 命令不可用

**问题：** 在 Redis 集群模式下 `keys` 命令不可用。

**解决方案：** 使用 `scan` 命令替代 `keys`

```java
public Set<String> scanKeys(RedisClusterConnection connection, String pattern) {
    Set<String> result = new HashSet<>();
    for (RedisClusterNode node : connection.clusterGetNodes()) {
        if (node.getFlags().contains(RedisClusterNode.NodeFlag.UPSTREAM)) {
            ScanOptions options = ScanOptions.scanOptions()
                    .match(pattern)
                    .count(1000)
                    .build();
            Cursor<byte[]> cursor = connection.scan(options, node);
            while (cursor.hasNext()) {
                result.add(new String(cursor.next()));
            }
        }
    }
    return result;
}
```

---

## 15. API 速查表

### 15.1 ValueOperations 核心方法

| 方法 | 说明 |
|------|------|
| `set(key, value)` | 设置值 |
| `set(key, value, timeout)` | 设置值并指定过期时间 |
| `setIfAbsent(key, value)` | 仅键不存在时设置 |
| `setIfPresent(key, value)` | 仅键存在时设置 |
| `get(key)` | 获取值 |
| `getAndSet(key, value)` | 获取旧值并设置新值 |
| `increment(key)` | 数值 +1 |
| `increment(key, delta)` | 数值 +delta |
| `decrement(key)` | 数值 -1 |
| `decrement(key, delta)` | 数值 -delta |
| `append(key, value)` | 追加字符串 |
| `size(key)` | 获取字符串长度 |
| `multiGet(keys)` | 批量获取 |

### 15.2 HashOperations 核心方法

| 方法 | 说明 |
|------|------|
| `put(key, hashKey, value)` | 设置单个字段 |
| `putAll(key, map)` | 批量设置字段 |
| `putIfAbsent(key, hashKey, value)` | 仅字段不存在时设置 |
| `get(key, hashKey)` | 获取单个字段 |
| `multiGet(key, hashKeys)` | 批量获取字段 |
| `entries(key)` | 获取所有字段和值 |
| `keys(key)` | 获取所有字段名 |
| `values(key)` | 获取所有值 |
| `hasKey(key, hashKey)` | 判断字段是否存在 |
| `delete(key, hashKeys)` | 删除字段 |
| `size(key)` | 获取字段数量 |
| `increment(key, hashKey, delta)` | 字段值递增 |

### 15.3 ListOperations 核心方法

| 方法 | 说明 |
|------|------|
| `leftPush(key, value)` | 从左侧插入 |
| `rightPush(key, value)` | 从右侧插入 |
| `leftPop(key)` | 从左侧弹出 |
| `rightPop(key)` | 从右侧弹出 |
| `index(key, index)` | 按索引获取 |
| `range(key, start, end)` | 获取范围元素 |
| `size(key)` | 获取列表长度 |
| `set(key, index, value)` | 按索引设置 |
| `remove(key, count, value)` | 移除元素 |
| `trim(key, start, end)` | 裁剪列表 |

### 15.4 SetOperations 核心方法

| 方法 | 说明 |
|------|------|
| `add(key, values...)` | 添加元素 |
| `members(key)` | 获取所有成员 |
| `isMember(key, value)` | 判断是否为成员 |
| `randomMember(key)` | 随机获取成员 |
| `size(key)` | 获取集合大小 |
| `remove(key, values...)` | 移除元素 |
| `union(key, otherKeys...)` | 并集 |
| `intersect(key, otherKeys...)` | 交集 |
| `difference(key, otherKeys...)` | 差集 |

### 15.5 ZSetOperations 核心方法

| 方法 | 说明 |
|------|------|
| `add(key, value, score)` | 添加元素及分数 |
| `range(key, start, end)` | 按分数升序获取 |
| `reverseRange(key, start, end)` | 按分数降序获取 |
| `rangeByScore(key, min, max)` | 按分数范围查询 |
| `rank(key, value)` | 获取升序排名 |
| `reverseRank(key, value)` | 获取降序排名 |
| `score(key, value)` | 获取分数 |
| `incrementScore(key, value, delta)` | 增加分数 |
| `remove(key, values...)` | 移除元素 |
| `removeRangeByRank(key, start, end)` | 按排名删除 |
| `removeRangeByScore(key, min, max)` | 按分数删除 |
| `count(key, min, max)` | 统计分数范围内成员数 |
| `size(key)` | 获取集合大小 |

---

