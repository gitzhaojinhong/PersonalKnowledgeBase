

## 1.1 优化思路

签到功能的核心问题是**数据量膨胀**：每个用户每次签到产生一条数据库记录，按 100 万用户、每人每年签到 100 次计算，一年就是 **1 亿条记录**，数据库存储和查询压力持续增长。

有没有办法大幅减少数据量？

回忆一下小时候补习班的签到卡——一张小卡片就能记录一整月的签到情况：来了就打个勾，没来就空着。

用程序模拟这张签到卡：每天的签到状态只有两种——签了或没签，正好对应二进制的 **0 和 1**。一个月最多 31 天，只需要 **31 个 bit**（不到 4 字节）就能存储一个用户一整月的签到记录。而用数据库存储相同数据需要数百字节，是 BitMap 方案的 **上百倍**。

这种将二进制位与业务数据一一映射（本例中是每一位对应月份中的一天），用 0/1 表示业务状态的思路，称为 **位图（BitMap）**。

BitMap 不仅极其节省空间，查询效率也很高。因此签到功能无需通过数据库操作，直接使用 Redis 的 BitMap 即可。

## 1.2 方案设计

### 1.2.1 BitMap 原理

Redis 中 BitMap 是基于 **String** 结构实现的——Redis 的 String 底层是 SDS（Simple Dynamic String），内部维护一个字节数组，Redis 提供了若干按位操作命令来实现 BitMap 效果。

String 类型最大 512MB，即 2³¹ 个 bit，能保存的数据量级十分恐怖。

**核心命令：**

```bash
# 修改第 offset 个 bit 位（0 或 1）
SETBIT key offset value

# 读取 bit 位数据（组合命令，支持 GET / SET 等多种操作）
BITFIELD key GET encoding offset
#   GET：查询
#   encoding：u2 表示读 2 位转为无符号整数；i2 表示有符号整数
#   offset：从第几个 bit 位开始读
```

### 1.2.2 Redis Key 设计

每月为每个用户生成独立的 Key，Key 中包含用户 id 和年月信息：

```
sign:uid:{userId}:{yyyyMM}   →   BitMap（每一位对应一天）
```

**设计好处：** 同一用户同月的签到数据集中在同一个 Key 中，按月自动隔离；过期时间统一管理，新月份自动产生新 Key。

**示例：** 用户 1001 在 2024 年 1 月的第 1、2、3、6、7、8 天签到了：

```
SETBIT sign:uid:1001:202401 0 1   # 第1天
SETBIT sign:uid:1001:202401 1 1   # 第2天
SETBIT sign:uid:1001:202401 2 1   # 第3天
SETBIT sign:uid:1001:202401 5 1   # 第6天
SETBIT sign:uid:1001:202401 6 1   # 第7天
SETBIT sign:uid:1001:202401 7 1   # 第8天
```

BitMap 中的存储效果（offset 从 0 开始）：

```
位:  0  1  2  3  4  5  6  7  ... 30
值:  1  1  1  0  0  1  1  1  ... 0
```

### 1.2.3 签到业务流程

```
用户点击签到
    ↓
SETBIT key offset 1（写入 BitMap）
    ↓
判断 setBit 返回值：
  - 返回 1 → 该位之前已经是 1，说明重复签到，拒绝
  - 返回 0 → 签到成功，继续
    ↓
BITFIELD 读取本月 1~今天的签到记录
    ↓
从最后一位向前遍历，统计连续签到的天数
    ↓
判断是否触发连续签到奖励（7/14/28 天）
    ↓
发送 MQ 消息，异步保存积分明细
    ↓
返回签到结果（连续天数 + 获得积分）
```

### 1.2.4 连续签到统计

如何统计连续签到天数？核心逻辑是**从今天向前遍历 bit 位，遇到第一个 0 就停止**。

关键操作：

- **获取最后一个 bit 位**：任何数与 1 做与运算（`& 1`），结果就是最后一位的值
- **移除最后一个 bit 位**：无符号右移一位（`>>> 1`），最后一位被丢弃，倒数第二位成为新的最后一位

```
签到记录: 11100111（十进制 231）
第1轮: 231 & 1 = 1 → count=1，右移 → 01110011（115）
第2轮: 115 & 1 = 1 → count=2，右移 → 00111001（57）
第3轮:  57 & 1 = 1 → count=3，右移 → 00011100（28）
第4轮:  28 & 1 = 0 → 停止
连续签到天数 = 3
```

### 1.2.5 积分规则与 MQ 解耦

签到产生积分的规则：

| 场景 | 积分 |
|------|------|
| 每次签到 | +1 分 |
| 连续签到 7 天 | 奖励 10 分 |
| 连续签到 14 天 | 奖励 20 分 |
| 连续签到 28 天 | 奖励 40 分 |

积分保存不直接写数据库，而是通过 **MQ 异步解耦**：

```
签到成功 → 发送 MQ（消息体：userId + 积分值）
                ↓
积分服务监听 MQ → 查询今日该类型已得积分 → 判断是否超上限 → 保存积分明细
```

好处是签到业务与积分业务完全解耦，后续新增积分类型只需增加 RoutingKey 和监听器即可。

## 1.3 代码实现

### 1.3.1 签到接口

```java
@PostMapping
@ApiOperation("签到功能接口")
public SignResultVO addSignRecords() {
    return recordService.addSignRecords();
}
```

**返回值 VO：**

```java
@Data
public class SignResultVO {
    private Integer signDays;      // 连续签到天数
    private Integer signPoints = 1; // 签到基础积分
    private Integer rewardPoints;   // 连续签到奖励积分

    @JsonIgnore
    public int totalPoints() {
        return signPoints + rewardPoints;
    }
}
```

### 1.3.2 签到核心逻辑

```java
@Override
public SignResultVO addSignRecords() {
    // 1.签到
    Long userId = UserContext.getUser();
    LocalDate now = LocalDate.now();
    String key = RedisConstants.SIGN_RECORD_KEY_PREFIX
            + userId + now.format(DateUtils.SIGN_DATE_SUFFIX_FORMATTER);
    int offset = now.getDayOfMonth() - 1;
    // 1.5.保存签到信息（返回 true 说明之前已签到）
    Boolean exists = redisTemplate.opsForValue().setBit(key, offset, true);
    if (BooleanUtils.isTrue(exists)) {
        throw new BizIllegalException("不允许重复签到！");
    }
    // 2.计算连续签到天数
    int signDays = countSignDays(key, now.getDayOfMonth());
    // 3.计算签到得分
    int rewardPoints = 0;
    switch (signDays) {
        case 7:  rewardPoints = 10; break;
        case 14: rewardPoints = 20; break;
        case 28: rewardPoints = 40; break;
    }
    // 4.发送 MQ 异步保存积分明细
    mqHelper.send(
            MqConstants.Exchange.LEARNING_EXCHANGE,
            MqConstants.Key.SIGN_IN,
            SignInMessage.of(userId, rewardPoints + 1));
    // 5.封装返回
    SignResultVO vo = new SignResultVO();
    vo.setSignDays(signDays);
    vo.setRewardPoints(rewardPoints);
    return vo;
}
```

**关键点：** `setBit` 返回的是修改**前**该位的旧值。如果返回 `true`，说明该位本来就是 1，即用户已经签到过了，直接拒绝。

### 1.3.3 连续签到天数统计

```java
private int countSignDays(String key, int len) {
    // 1.获取本月第1天到今天的所有签到记录（无符号整数）
    List<Long> result = redisTemplate.opsForValue()
            .bitField(key, BitFieldSubCommands.create()
                    .get(BitFieldSubCommands.BitFieldType.unsigned(len))
                    .valueAt(0));
    if (CollUtils.isEmpty(result)) {
        return 0;
    }
    int num = result.get(0).intValue();
    // 2.从最后一位向前遍历，遇到 0 就停止
    int count = 0;
    while ((num & 1) == 1) {
        count++;
        num >>>= 1; // 无符号右移，丢弃最后一位
    }
    return count;
}
```

**流程：** `BITFIELD key GET u{len} 0` 一次读取本月到今天为止的所有 bit 位，转为一个无符号整数。然后通过 `& 1` + `>>> 1` 逐位判断，直到遇到第一个 0 停止。

### 1.3.4 MQ 消息体与监听器

**签到消息体**（签到积分不固定，需要由业务方传递）：

```java
@Data
@NoArgsConstructor
@AllArgsConstructor(staticName = "of")
public class SignInMessage {
    private Long userId;
    private Integer points;
}
```

**消息监听器：**

```java
@RabbitListener(bindings = @QueueBinding(
        value = @Queue(name = "sign.points.queue", durable = "true"),
        exchange = @Exchange(name = MqConstants.Exchange.LEARNING_EXCHANGE, type = ExchangeTypes.TOPIC),
        key = MqConstants.Key.SIGN_IN
))
public void listenSignInMessage(SignInMessage message) {
    recordService.addPointsRecord(message.getUserId(), message.getPoints(), PointsRecordType.SIGN);
}
```

### 1.3.5 积分上限判断与保存

```java
@Override
public void addPointsRecord(Long userId, int points, PointsRecordType type) {
    int maxPoints = type.getMaxPoints();
    int realPoints = points;
    if (maxPoints > 0) {
        // 查询今日该类型已得积分
        int currentPoints = queryUserPointsByTypeAndDate(
                userId, type, DateUtils.getDayStartTime(now), DateUtils.getDayEndTime(now));
        if (currentPoints >= maxPoints) return; // 已达上限
        if (currentPoints + points > maxPoints) {
            realPoints = maxPoints - currentPoints; // 只给剩余额度
        }
    }
    // 保存积分明细
    PointsRecord p = new PointsRecord();
    p.setPoints(realPoints);
    p.setUserId(userId);
    p.setType(type);
    save(p);
}
```

## 2.4 面试要点

---

**面试官：你项目中使用过 Redis 的哪些数据结构？**

答：用过 String、Hash、Set、SortedSet、BitMap 等。比如缓存用的 String，点赞用的 Set 和 SortedSet，签到用的 BitMap。

签到场景很适合用 BitMap，因为数据量非常大——100 万用户每人每年签到约 100 次，一年就是 1 亿条记录。而 BitMap 用 bit 位表示签到状态，一个月最多 31 天，只需 31 个 bit（不到 4 字节），比数据库方案节省上百倍空间，查询效率也更高。

*（停顿，等待面试官追问）*

---

**面试官追问：BitMap 具体是怎么用的？连续签到天数怎么统计？**

答：签到用的是 `SETBIT` 命令，把当月第几天的 offset 位设为 1。`SETBIT` 会返回修改前的旧值，如果返回 1 说明已经签到过了，直接拒绝，天然防重复。

查询签到记录用 `BITFIELD key GET u{len} 0`，一次读取本月 1 号到今天的所有 bit 位，返回一个无符号整数。

统计连续签到天数的核心是**位运算**：

- **取末位**：`num & 1`，结果为 1 说明今天签了，计数 +1
- **右移丢弃末位**：`num >>>= 1`，无符号右移一位，倒数第二位变成新的末位
- 重复以上步骤，直到 `& 1` 的结果为 0，说明遇到第一个未签到日期，停止计数

```
示例：签到记录 11100111（第 231）
第1轮：231 & 1 = 1 → count=1，右移 → 115
第2轮：115 & 1 = 1 → count=2，右移 → 57
第3轮： 57 & 1 = 1 → count=3，右移 → 28
第4轮： 28 & 1 = 0 → 停止，连续签到 3 天
```

时间复杂度只与连续签到天数有关，不与当月天数相关，非常高效。

---

**面试官追问：用 Redis 存签到数据，Redis 宕机了怎么办？**

答：对于 Redis 的数据安全，有多个层级的方案：

1. **持久化**：开启 AOF（Append Only File），Redis 会把每条写命令追加到日志文件中，宕机后最多丢失 1 秒的数据（`appendfsync everysec` 模式），对签到场景完全可以接受
2. **高可用集群**：搭建 Redis 主从 + 哨兵（Sentinel），主节点持续同步数据给从节点，宕机后哨兵自动选主，基本不用担心数据丢失
3. **兜底方案**：如果公司对数据安全性要求极高，可以用数据库做持久化。但为解决数据量膨胀问题，需要做分表（按年/月拆分）或定期归档历史数据

实际上，签到数据的重要性不算特别高（非交易数据），用 BitMap + AOF 持久化的方案，在空间和安全性之间是一个很好的平衡。

---

**面试官追问：Redis 的 BitMap 底层是怎么实现的？**

答：BitMap 并不是 Redis 的独立数据类型，它底层是基于 **String（SDS）** 实现的。Redis 的 String 内部维护一个字节数组，BitMap 就是通过 `SETBIT`、`GETBIT`、`BITFIELD` 等命令对这个字节数组进行**按位操作**来实现的。

String 类型最大 512MB，也就是 2³¹ ≈ 21 亿个 bit 位，数据量级非常恐怖。这也是 BitMap 能高效存储大量布尔状态数据的根本原因。
