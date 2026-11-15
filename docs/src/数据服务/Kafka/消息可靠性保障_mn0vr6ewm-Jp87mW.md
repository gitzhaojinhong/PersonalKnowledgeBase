# 消息可靠性保障

## 生产者端可靠性保障

### ACK确认机制

生产者通过acks参数控制消息确认级别:

* `acks = 0`：风险配置，不等待任何确认。消息发送后立即返回，网络故障或 Broker 宕机会丢消息。
* `acks = 1`：平衡配置，等待 Leader 确认。Leader 写入成功即返回，若 Leader 未同步给 Follower 就宕机会丢消息。
* `acks = -1`（等价 `all`）：可靠配置，等待 ISR 全部确认。Leader 和所有 ISR 副本都写入成功才返回，最大程度保证不丢失消息。

```yaml
spring:
  kafka:
    producer:
      # 不写 acks，底层是 acks=1
      acks: all
```

### 失败重试策略

* `retries`：发送失败最大重试次数
* `retry.backoff.ms`：每次重试的间隔时间
* `max.in.flight.requests.per.connection = 1`：限制同一连接上未确认请求数量，保证消息顺序（开启重试后如果需要保序，必须配置）

```yaml
spring:
  kafka:
    producer:
      acks: all
      retries: 3    # 默认值为0
      properties:
        # 原生参数：重试间隔，默认100ms
        retry.backoff.ms: 300
        # 原生参数：单连接最大未确认请求，retries>0时设为1，保证消息分区内顺序，默认5
        max.in.flight.requests.per.connection: 1

```

可以生产者发送消息的 异步回调 获取是否发送成功

```java
kafkaTemplate.send(topic, key, payload)
        .whenComplete((res, err) -> {
            if(err != null){
                log.error("发送失败", err);
            }
        });

```

> 使用 **producer.send(record)** 异步发送时,方法立即返回不代表发送成功!
>
> 必须通过回调或同步等待 \*\*producer.send(record).get() \*\*来确认结果。

## 消费者端可靠性保证

### 位移提交策略

**自动提交的风险：**

自动提交可能导致消息丢失

1. 消费者拉取一批消息
2. Kafka自动提交位移(标记已消费)
3. 消费者处理消息时发生异常
4. 消费者重启后从新位移开始,之前失败的消息永久丢失

**手动提交：**

`enable.auto.commit` 在 Spring Kafka 建议强制设为 false。并且默认值就是false

```yaml
spring:
  kafka:
    consumer:
      enable-auto-commit: false   # 默认false，手动提交
```

配置手动提交后，需要配合配置 `spring.kafka.listener.ack-mode` 来定义提交策略。

如果不配置，Spring Boot 默认使用 BATCH 模式。

**7种**<code>**AckMode**</code>**：**

| **AckMode** | **提交时机** | **使用场景** |
| --- | --- | --- |
| <code>**RECORD**</code> | 每条消息处理完立即提交 | 最严格，每条消息都不能丢，但性能最差 |
| <code>**BATCH**</code> | 每次 `poll()`返回的一批消息全部处理完才提交 | 默认模式，性能和可靠性平衡 |
| <code>**TIME**</code> | 类似 BATCH，但额外要求距离上次提交超过 `ackTime` | 控制提交频率上限 |
| <code>**COUNT**</code> | 类似 BATCH，但额外要求距离上次提交积累了 `ackCount`条 | 控制提交数量上限 |
| <code>**COUNT_TIME**</code> | TIME 和 COUNT 任一条件满足就提交 | 更灵活的时间+数量控制 |
| <code>**MANUAL**</code> | 由业务代码调 `acknowledge()`触发，提交的是直到调用时的一整批 | 需要手动控制提交时机 |
| <code>**MANUAL_IMMEDIATE**</code> | 业务代码调 `acknowledge()`后立即提交 | 最细粒度的手动控制 |

**全局配置：**

```yaml
spring:
  kafka:
    listener:
      ack-mode: MANUAL
```

**局部配置：**

```java
//定义容器工厂
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> manualAckFactory(
                                        ConsumerFactory<String, String> consumerFactory) {
    ConcurrentKafkaListenerContainerFactory<String, String> factory =
            new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory);
    // 设置AckMode
    factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
    return factory;
}

//========================消费者端指定容器工厂使用AckMode配置==================================
// containerFactory参数指定容器工厂
@KafkaListener(id = "manualConsumer", topics = "payments",
               containerFactory = "manualAckFactory")
public void listenManual(String message, Acknowledgment ack) {
    try {
        processPayment(message);
        // 业务代码手动提交
        ack.acknowledge();
    } catch (Exception e) {
        // 手动处理，不提交偏移量
    }
}

```

### 批量消费可靠性保证

> `batchFactory` 对应的 AckMode 必须是 `MANUAL` / `MANUAL_IMMEDIATE`，否则 `ack` 不生效。

```java
@KafkaListener(topics = "payment-topic", containerFactory = "batchFactory")
public void batchConsume(List<ConsumerRecord<String, String>> records,
                         Acknowledgment ack) {
    CompletionService<Boolean> completionService =
            new ExecutorCompletionService<>(executor);
    List<Future<Boolean>> futures = new ArrayList<>();

    // 1. 并发处理所有消息
    records.forEach(record -> {
        Callable<Boolean> task = () -> {
            try {
                processPayment(record.value());  // 业务处理
                return true;
            } catch (Exception e) {
                log.error("支付处理失败: {}", record.value(), e);
                return false;
            }
        };
        futures.add(completionService.submit(task));
    });

    // 2. 检查所有任务是否成功
    boolean allSuccess = true;
    try {
        for (int i = 0; i < records.size(); i++) {
            Future<Boolean> future = completionService.take();
            if (!future.get()) {
                allSuccess = false;
                break;  // 发现失败立即终止检查
            }
        }
    } catch (Exception e) {
        allSuccess = false;
    }

    // 3. 全部成功才提交位移
    if (allSuccess) {
        ack.acknowledge();
    } else {
        // 失败消息会重新投递,需要业务保证幂等性
        // 不调用 ack：位移不提交，下次 poll 依旧拉取这一整批消息；
        log.warn("批次中有消息处理失败,等待重新投递");
    }
}

```

## 最佳配置推荐

### 生产者配置

```yaml
spring:
  kafka:
    producer:
      # acks=-1 等价 acks=all，ISR全部确认
      acks: all
      # 发送重试次数
      retries: 3
      # 重试间隔
      retry-backoff-ms: 300
      # 保证分区内消息有序；注意：retries>0 时这个配置才有顺序意义
      max-in-flight-requests-per-connection: 1
      # 开启生产者幂等（推荐，防止重试产生重复消息）
      properties:
        enable.idempotence: true
```

### 消费者配置

```yaml
spring:
  kafka:
    consumer:
      # 关闭原生自动提交，交给Spring AckMode管控（必开）
      enable-auto-commit: false
      # 只读事务已提交消息，隔离未提交事务消息
      isolation-level: read_committed
    listener:
      # 推荐：BATCH / MANUAL / MANUAL_IMMEDIATE，不要用自动ack模式
      ack-mode: BATCH
      # 批量监听时，单次poll拉取条数
      batch-size: 200

```

### Broker服务端配置

```properties
# 副本数，建topic时指定，不是broker全局；全局是默认值
default.replication.factor=3
# ISR最小数量，acks=all 配合它使用
min.insync.replicas=2
# 禁止脏选主，避免数据丢失
unclean.leader.election.enable=false

# 刷盘：不建议依赖这两个做可靠性！Kafka靠副本持久化，刷盘是OS pagecache机制
# log.flush.interval.messages=10000
# log.flush.interval.ms=1000
```
