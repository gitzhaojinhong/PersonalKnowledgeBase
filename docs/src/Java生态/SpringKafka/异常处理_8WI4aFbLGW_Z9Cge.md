## 异常处理

## `DefaultErrorHandler`示例

```java
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<String, String> factory = new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory());
    factory.getContainerProperties().setAckMode(AckMode.RECORD);

    // 重试 2 次（总共投递 3 次），每次间隔 1 秒
    factory.setCommonErrorHandler(new DefaultErrorHandler(new FixedBackOff(1000L, 2L)));
    return factory;
}
```

## `AfterRollbackProcessor`事务场景

如果开启了事务，监听器抛异常会导致事务回滚。默认情况下回滚后整批消息重新拉取重试。如果想控制重试次数或失败后发死信，用 `DefaultAfterRollbackProcessor`：

```yaml
# 开启事务
spring.kafka.producer.transaction-id-prefix=myapp-
# 关闭自动提交，把提交权交给事务了，是为了防止异常后无法回滚
spring.kafka.consumer.enable-auto-commit=false
```

```java
// 事务型工厂：需要事务的监听器用这个
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory(
        ConsumerFactory<String, String> consumerFactory) {
    ConcurrentKafkaListenerContainerFactory<String, String> factory =
            new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory);
    // 配回滚后重试+死信
    DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate);
    DefaultAfterRollbackProcessor<String, String> processor =
            new DefaultAfterRollbackProcessor<>(recoverer, new FixedBackOff(1000L, 2L));
    factory.setAfterRollbackProcessor(processor);
    return factory;
}
```

## 异常处理策略

### 固定间隔退避策略

_FixedBackOff（固定间隔）:_

```java
// 间隔 1 秒，最多重试 2 次（共投递 3 次）
new FixedBackOff(1000L, 2L);

// 无限重试（小心使用）
new FixedBackOff(1000L, FixedBackOff.UNLIMITED_ATTEMPTS);
```

### 指数退避策略

_ExponentialBackOffWithMaxRetries（指数退避）:_

```java
ExponentialBackOffWithMaxRetries backOff = new ExponentialBackOffWithMaxRetries(6);
backOff.setInitialInterval(1_000L);    // 第一次等 1 秒
backOff.setMultiplier(2.0);            // 每次翻倍
backOff.setMaxInterval(10_000L);       // 最长等 10 秒

DefaultErrorHandler handler = new DefaultErrorHandler(myRecoverer, backOff);
// 重试间隔：1s → 2s → 4s → 8s → 10s → 10s，然后走恢复逻辑
```

## 死信队列

```java
// 死信恢复器Bean
@Bean
public DeadLetterPublishingRecoverer recoverer(KafkaTemplate<Object, Object> template) {
    // 默认发送到 <原topic>-dlt，同分区
    return new DeadLetterPublishingRecoverer(template);
}

// 错误处理器Bean，重试+死信
@Bean
public DefaultErrorHandler errorHandler(DeadLetterPublishingRecoverer recoverer) {
    FixedBackOff backOff = new FixedBackOff(1000L, 2L);
    return new DefaultErrorHandler(recoverer, backOff);
}
// 添加到 ConcurrentKafkaListenerContainerFactory 自定义工厂中
factory.setCommonErrorHandler(errorHandler);
```

> 默认情况下：
>
> * 目标 topic 名 = 原topic-dlt
> * 发到相同的分区（所以死信 topic 的分区数必须 >= 原 topic）
> * 死信消息会带上原始异常的堆栈、原始 topic/partition/offset 等 header

***根据异常类型路由到不同的死信队列：***

```java
@Bean
public DeadLetterPublishingRecoverer recoverer(KafkaTemplate<Object, Object> template) {
    return new DeadLetterPublishingRecoverer(template,
        (record, exception) -> {
            if (exception instanceof FooException) {
                return new TopicPartition("foo-dlt", record.partition());
            } else {
                return new TopicPartition("other-dlt", record.partition());
            }
        });
}
```

## 重试投递计数

可以让框架在消息上附加一个 header，记录这是第几次投递尝试（从 1 开始）

```java
// 在容器工厂上开启
factory.getContainerProperties().setDeliveryAttemptHeader(true);

// 在监听器里读取
@KafkaListener(topics = "orders")
public void listen(
        Order order,
        @Header(KafkaHeaders.DELIVERY_ATTEMPT) int deliveryAttempt) {
    System.out.println("这是第 " + deliveryAttempt + " 次尝试处理这条消息");
}
```

## 批量消费异常

如果用 `List<Thing>` 批量消费，框架不知道批里哪条消息失败了，需要告诉它：

```java
@KafkaListener(id = "recovering", topics = "someTopic")
public void listen(List<Thing> things) {
    for (int i = 0; i < things.size(); i++) {
        try {
            process(things.get(i));
        } catch (Exception e) {
            // 告诉框架：第 i 条消息失败了
            throw new BatchListenerFailedException("处理失败", i);
        }
    }
}
```

这样 `DefaultErrorHandler` 就知道：这条消息之前的记录正常提交 offset，从这条开始往后重新投递。

## 致命异常不会重试

`DefaultErrorHandler` 默认认为下面这些异常“重试也没用”，第一次失败就直接走恢复逻辑（跳过或发死信队列）：

* `DeserializationException` — 消息反序列化失败
* `MessageConversionException` — 消息转换失败
* `ConversionException` — 转换失败
* `MethodArgumentResolutionException` — 方法参数解析失败
* `NoSuchMethodException` — 找不到方法
* `ClassCastException` — 类型转换异常

*也可以添加自定义致命异常：*

```java
@Bean
public DefaultErrorHandler errorHandler() {
    DefaultErrorHandler handler = new DefaultErrorHandler(new FixedBackOff(1000L, 2L));
    handler.addNotRetryableExceptions(IllegalArgumentException.class);
    return handler;
}
```

## 其他ErrorHandler

| 处理器 | 作用 |
| --- | --- |
| `DefaultErrorHandler` | **最重要、最常用**。重试 + 恢复（发死信/记日志） |
| `CommonContainerStoppingErrorHandler` | 监听器抛异常就**停掉整个容器**，适合严重错误 |
| `CommonLoggingErrorHandler` | 只记日志，不重试、不跳过，直接把剩余消息传给监听器 |
| `CommonDelegatingErrorHandler` | 根据异常类型**委托到不同的处理器** |
| `CommonMixedErrorHandler` | 给单条监听器和批量监听器分别配不同的处理器 |
