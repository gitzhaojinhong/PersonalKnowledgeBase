## 发送消息

## `KafkaTemplate`

### Spring Boot 下如何配

**纯 Java Config 的配置方式（非SpringBoot环境）：**

```java
@Bean
public ProducerFactory<Integer, String> producerFactory() {
    return new DefaultKafkaProducerFactory<>(producerConfigs());
}
@Bean
public Map<String, Object> producerConfigs() {
    Map<String, Object> props = new HashMap<>();
    props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
    props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, IntegerSerializer.class);
    props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, StringSerializer.class);
    return props;
}

@Bean
public KafkaTemplate<Integer, String> kafkaTemplate() {
    return new KafkaTemplate<Integer, String>(producerFactory());
}
```

> 但在 Spring Boot 下，不需要写这些。`spring-boot-starter-kafka` 已经自动创建了 `ProducerFactory` 和 `KafkaTemplate`，你直接注入 `KafkaTemplate` 就能用。只有当你需要自定义序列化器或者覆盖某些 Producer 配置时，才需要手动定义 Bean。

**SpringBoot环境下的配置方式：**

```yaml
spring:
  kafka:
    bootstrap-servers: localhost:9092
    # Boot 自动配的 KafkaTemplate 默认的 key/value 序列化器就是 StringSerializer
    # 所以如果只发 String 类型，不用配置producer，Boot有默认值。
    producer:
      key-serializer: org.apache.kafka.common.serialization.IntegerSerializer
      value-serializer: org.apache.kafka.common.serialization.StringSerializer

```

> Spring Boot 的 `KafkaAutoConfiguration` 读到这些配置后，会自动创建：
>
> * `ProducerFactory`（`DefaultKafkaProducerFactory` 实例）
> * `KafkaTemplate`直接注入就能用。
> * 只有需要自定义序列化器或者覆盖某些 Producer 配置时，才需要手动定义 Bean。

### 发送消息

```java
// 发到默认主题（需要提前设置默认主题）
sendDefault(V data);
sendDefault(K key, V data);
sendDefault(Integer partition, K key, V data);
sendDefault(Integer partition, Long timestamp, K key, V data);

// 指定主题发送
send(String topic, V data);
send(String topic, K key, V data);
send(String topic, Integer partition, K key, V data);
send(String topic, Integer partition, Long timestamp, K key, V data);

// 直接传 ProducerRecord 或 Spring Message
send(ProducerRecord<K, V> record);
send(Message<?> message);

```

Kafka 的 Producer 发送消息本身是异步的。`KafkaTemplate.send()` 不会等消息真正到达 Broker 才返回，它立刻返回一个 `CompletableFuture`，可以在这Future 上注册回调来处理发送结果。这是 Kafka 高性能的基石：发送和等待结果分离。

### 异步 vs 同步发送模式

**异步发送（推荐方式）：**

```java
public void sendToKafka(final MyOutputData data) {
    final ProducerRecord<String, String> record = createRecord(data);

    CompletableFuture<SendResult<String, String>> future = template.send(record);
    //whenComplete() 注册了一个回调：消息发送成功或失败后，会自动执行里面的代码。
    //这样主线程不用傻等着，可以继续干别的事。
    future.whenComplete((result, ex) -> {
        if (ex == null) {
            handleSuccess(data);// 发送成功，处理成功逻辑
        } else {
            handleFailure(data, record, ex);// 发送失败，处理失败逻辑
        }
    });
}
```

**同步发送（阻塞等待）：**

```java
public void sendToKafka(final MyOutputData data) {
    final ProducerRecord<String, String> record = createRecord(data);


    try {
        template.send(record).get(10, TimeUnit.SECONDS);// 最多等10秒
        handleSuccess(data);
    } catch (ExecutionException e) {
        handleFailure(data, record, e.getCause());// 发送失败
    } catch (TimeoutException | InterruptedException e) {
        handleFailure(data, record, e);// 超时或被中断
    }
}
```

文档中特别提示：失败的 `Throwable` 可以转型为 `KafkaProducerException`，它上面有个 `producerRecord` 属性，可以拿到发送失败的原始记录，方便做重试或落盘处理。

###  全局监听发送结果 

除了每次发送时手动处理回调，你还可以给 `KafkaTemplate` 配一个全局的监听器`ProducerListener`：

```java
public interface ProducerListener<K, V> {
    default void onSuccess(ProducerRecord<K, V> producerRecord, RecordMetadata recordMetadata) { }
    default void onError(ProducerRecord<K, V> producerRecord, RecordMetadata recordMetadata, Exception exception) { }
}
```

> **解释**：这个接口有两个默认方法——`onSuccess`（发送成功时触发）和 `onError`（发送失败时触发）。默认情况下，`KafkaTemplate` 配了一个 `LoggingProducerListener`，它只在失败时记日志，成功时什么都不干。你可以自己实现这个接口，比如失败时发告警短信。

步骤：

**1. 自定义监听器**

```java
@Component
public class MyProducerListener implements ProducerListener<Integer, String> {

    private static final Logger log = LoggerFactory.getLogger(MyProducerListener.class);

    @Override
    public void onSuccess(ProducerRecord<Integer, String> producerRecord, RecordMetadata recordMetadata) {
        log.info("发送成功，主题：{}，分区：{}，偏移量：{}",
                 recordMetadata.topic(),
                 recordMetadata.partition(),
                 recordMetadata.offset());
    }

    @Override
    public void onError(ProducerRecord<Integer, String> producerRecord,
                        RecordMetadata recordMetadata, Exception exception) {
        log.error("发送失败，主题：{}，key：{}，value：{}，异常：{}",
                  producerRecord.topic(),
                  producerRecord.key(),
                  producerRecord.value(),
                  exception.getMessage());
        // 这里可以做告警，比如发送钉钉/邮件通知
    }
}
```

**2. 注册到 KafkaTemplate**

```java
@Configuration
public class KafkaConfig {

    @Autowired
    private MyProducerListener myProducerListener;

    @Bean
    public KafkaTemplate<Integer, String> kafkaTemplate(
            ProducerFactory<Integer, String> producerFactory) {
        KafkaTemplate<Integer, String> template = new KafkaTemplate<>(producerFactory);
        template.setProducerListener(myProducerListener);
        return template;
    }
}

```

### 同一个工厂生产不同的Template

可以基于同一个`ProducerFactory`，通过覆写某些配置来创建不同的`KafkaTemplate`：

```java
@Bean
public KafkaTemplate<String, String> stringTemplate(ProducerFactory<String, String> pf) {
    return new KafkaTemplate<>(pf);
}

@Bean
public KafkaTemplate<String, byte[]> bytesTemplate(ProducerFactory<String, byte[]> pf) {
    return new KafkaTemplate<>(pf,
                               Collections.singletonMap(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, ByteArraySerializer.class));
}
```

这样你不需要配两个 `ProducerFactory`，仅覆写序列化器这一个配置就行。比如一个发 JSON 字符串，一个发二进制数据。

## KafkaTemplate的三个变体

| 模板 | 适用场景 | 核心特点 |
| --- | --- | --- |
| `KafkaTemplate` | 普通发消息 | 包装原生 Producer，支持异步/同步 |
| `RoutingKafkaTemplate` | 不同主题不同序列化 | 按主题名正则匹配，动态选工厂 |
| `ReplyingKafkaTemplate` | 发消息等回复 | 额外配一个监听容器收回复 |
| `AggregatingREplingKafkaTemplate` | 发一条等多人回复 | 释放策略控制何时返回 |

## 生产者配置项

### spring.kafka.producer.acks

```yaml
spring:
  kafka:
    producer:
      acks: all
```

生产者发送消息到 broker 后，等待多少个副本确认写入成功，才认为本次发送成功。

* `acks=0`：发出去就不管，不等待 broker 任何应答；性能最高，丢消息风险最大。
* `acks=1`：只要**leader 分区**写入成功并返回应答，就认为成功；副本还没同步。leader 宕机但副本还没同步，消息丢失。
* `acks=all`（`acks=-1`）：**leader + 所有 ISR（in-sync replica，同步副本）全部写完，才返回成功**。

> 默认值：
>
> * **Kafka 2.x 及更早客户端：默认 `acks=1`** 只等 leader 写入成功就返回，不等副本同步。
> * **Kafka 3.0+ 客户端：默认 `acks=all`，同时默认开启 `enable.idempotence=true`（幂等生产者**）Confluent
