# Kafka集成

## 多模块结构集成

```plain
业务模块
└── src/main
    ├── java/
    │   ├── config/
    │   │   ├── properties/
    │   │   │   └── KafkaProperties.java
    │   │   └── KafkaConfiguration.java
    │   └── adapter/
    │       └── KafkaMessagingAdapter.java implements KafkaMessagingPort.java
    └── resources/
        └── application.yaml

集成模块
└── src/main
    ├── java/
    │   ├── port/   # 一个端口接口，让该模块可以获取 Kafka Topic 名称，而不需要直接依赖配置类。
    │   │   └── KafkaMessagingPort.java
    │   └── mq/
    │       ├── message/
    │       │   └── KafkaMessage.java
    │       ├── KafkaProducer.java
    │       └── KafkaConsumer.java
    └── resources/
        └── META-INF/
            └── spring
                └── org.springframework.boot.autoconfigure.AutoConfiguration.imports

```

## 集成模块

### KafkaMessagingPort.java

```java
@FunctionalInterface
public interface KafkaMessagingPort {

    MessagingTopics currentTopics();

    record MessagingTopics(String topicOne, String topicTwo) {

        public MessagingTopics {
            topicOne = normalize(topicOne, "topicOne-Name");
            topicTwo = normalize(topicTwo, "topicTwo-Name");
        }

        public static MessagingTopics defaults() {
            return new MessagingTopics(
                "Default-topicOne-Name",
                "Default-topicTwo-Name"
            );
        }

        private static String normalize(String value, String fallback) {
            return value == null || value.isBlank() ? fallback : value.trim();
        }
    }
}
```

### KafkaMessage.java

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class KafkaMessage {

    private Long id;

    private String message;
}
```

### KafkaProducer.java

```java
@AllArgsConstructor
@Component
public class KafkaProducer {

    private final KafkaTemplate<String, String> kafkaTemplate;

    private final ObjectMapper objectMapper;

    private final KafkaMessagingPort messagingPort;

    public void sendBuild(KafkaMessage message) {

        // 第一个参数： topicName
        // 第二个参数： 使用message中的业务属性作为 key，使同一类型消息在分区数不变时稳定落到同一分区。
        // 第三个参数： 消息体
        // 注意：key 只保证分区选择和分区内顺序，不等于“只消费一次”。
        send(messagingPort.currentTopics().parseTopic(), String.valueOf(message.getId()), message);
    }


    /**
     * 把业务消息序列化为 JSON，并同步等待 Kafka broker 的发送确认。
     *
     * @param topic 最终物理 topic 名称
     * @param key Kafka 分区 key
     * @param message 待序列化的业务消息对象
     * @throws XxxException 序列化、网络发送或等待确认失败时统一转换为业务异常
     */
    private void send(String topic, String key, Object message) {
        try {

            // 先序列化再发送。序列化失败同样意味着消息没有进入 Kafka，必须让上传请求感知失败。
            String payload = objectMapper.writeValueAsString(message);

            // send() 本身返回异步 Future；紧跟 get() 把它转成同步等待点。
            // get() 正常返回只代表 broker 接收，不代表消费者已经开始或完成解析。
            kafkaTemplate.send(topic, key, payload).get();
        } catch (Exception exception) {
            // 保留底层异常作为 cause，便于区分 JSON 序列化、连接失败、超时或 broker 拒绝。
            throw new XxxException(ManageCode.KAFKA_SEND_FAILED.getCode(),
                "Kafka 消息发送失败: " + exception.getMessage(), exception);
        }
    }
}
```

### KafkaConsumer.java

```java
@Slf4j
@Component
@AllArgsConstructor
public class KafkaConsumer {

    private final XxxService xxxService;

    private final ObjectMapper objectMapper;

    /**
     * Kafka topic 的消费入口。
     * groupId: Kafka消费者组的标识。消费者组内负载均衡，不同消费者组实现广播消费
     */
    @KafkaListener(topics = "${app.manage.kafka.parse-topic}", groupId = "${app.manage.kafka.group-id}-parse")
    public void consumeXxx(String payload) {
        try {

            KafkaMessage message = objectMapper.readValue(payload, KafkaMessage.class);

            xxxService.consumeService(message.getId(), message.getMessage());
        }
        catch (Exception exception) {
            
            log.error("消费消息失败，payload={}", payload, exception);
        }
    }
}

```

### META-INF.spring

文件名：`org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```java
# 该文件内只需填写 "需要注册的配置类@Configuration" 的源根路径
```

## 业务模块

### application.yaml

```yaml
spring:
  kafka:
    # Kafka 集群引导地址，多个节点使用逗号分隔。
    bootstrap-servers: 127.0.0.1:9092
    producer:
      # Kafka 生产者的消息键序列化器，按字符串编码。
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      # Kafka 生产者的消息值序列化器，按字符串编码。
      value-serializer: org.apache.kafka.common.serialization.StringSerializer
    consumer:
      # Kafka 消费者的消息键反序列化器，按字符串读取。
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      # Kafka 消费者的消息值反序列化器，按字符串读取。
      value-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      # 消费组没有有效已提交位点时，从最早可用消息开始消费；不覆盖已有有效位点。
      auto-offset-reset: earliest
      # 消费者单次 poll 最多返回的消息条数，限制每轮交付的文档任务数量。
      max-poll-records: 1
      properties:
        # 文档索引构建会触发向量化、GraphRAG、RAPTOR 等长耗时任务。
        # Kafka listener 只负责提交后台任务，但这里仍显式放大 poll 间隔，避免本地调试或同步入口耗时接近默认 5 分钟时重复投递。
        # 消费者两次 poll 之间允许的最大间隔，单位：毫秒；超时可能触发消费组重平衡。
        max.poll.interval.ms: ${NEXUS_AGENT_PRO_KAFKA_MAX_POLL_INTERVAL_MS:1800000}
        
app:
  manage:
    kafka:
      # topicName 1
      topic-one: nameOne
      # topicName 2
      topic-two: nameTwo
      # Kafka 消费组名称。
      group-id: xxxxxxxx
      # 本地开发时是否自动创建主题。
      # 如果线上 Kafka 不允许自动建 topic，可以改成 false，然后手动创建。
      auto-create-topics: true
```

### KafkaProperties.java

```java
@Data
@ConfigurationProperties(prefix = "app.manage")
public class KafkaProperties {

    private Kafka kafka = new Kafka();

    @Data
    public static class Kafka {
        private String topicOne = "default-name1";
        private String topicTwo = "default-name2";
        private String groupId = "default-group-id";
        private Boolean autoCreateTopics = Boolean.TRUE;
    }
}
```

### KafkaConfiguration.java

```java
@EnableKafka
@Configuration
@EnableConfigurationProperties(KafkaProperties.class)
public class KafkaConfiguration {

    @Bean
    @ConditionalOnProperty(prefix = "app.manage.kafka", name = "auto-create-topics", havingValue = "true", matchIfMissing = true)
    public NewTopic topicOne(KafkaProperties properties) {
        Kafka kafka = properties.getKafka();
        // partitions 分区数;  replicas 副本数
        return TopicBuilder.name(kafka.getTopicOne()).partitions(1).replicas(1).build();
    }

    @Bean
    @ConditionalOnProperty(prefix = "app.manage.kafka", name = "auto-create-topics", havingValue = "true", matchIfMissing = true)
    public NewTopic topicTwo(KafkaProperties properties) {
        Kafka kafka = properties.getKafka();
        return TopicBuilder.name(kafka.getTopicTwo()).partitions(1).replicas(1).build();
    }
}

```

### KafkaMessagingAdapter.java

```java
@Component
public final class KafkaMessagingAdapter implements KafkaMessagingPort {

    private final KafkaProperties properties;

    public KafkaMessagingAdapter(KafkaProperties properties) {
        this.properties = properties == null ? new KafkaProperties() : properties;
    }

    @Override
    public MessagingTopics currentTopics() {
        KafkaProperties.Kafka kafka = properties.getKafka();
        if (kafka == null) {
            return MessagingTopics.defaults();
        }
        return new MessagingTopics(kafka.getParseTopic(), kafka.getIndexTopic());
    }
}
```

## 关于死信队列的说明

> **Kafka 原生没有内置 DLQ 机制**，Spring Kafka 的死信，本质是：消费失败、重试耗尽后，通过 `DeadLetterPublishingRecoverer`，用 `KafkaTemplate` 把这条消息转发到另一个死信 Topic（约定后缀 `-dlt`）。
>
> **如果使用死信队列功能，需要手动在 KafkaConfiguration.java 添加 DLT Topic 创建逻辑**

### Bean方式配置死信队列

在业务模块中的 \*\*KafkaConfiguration.java \*\*中添加两个Bean：

```java
/**
 * 死信恢复器：消费重试耗尽后，转发到 topic-dlt
 */
@Bean
public DeadLetterPublishingRecoverer deadLetterPublishingRecoverer(KafkaTemplate<?, ?> kafkaTemplate) {
    // 默认发送到 <原topic>-dlt，同分区
    return new DeadLetterPublishingRecoverer(template);
}

/**
 *错误处理器Bean，重试+死信
 */
@Bean
public DefaultErrorHandler errorHandler(DeadLetterPublishingRecoverer recoverer) {
    // FixedBackOff(重试间隔ms, 最大重试次数)
    // 示例：间隔1000ms，最多重试2次，一共尝试 3 次（原始1次 + 重试2次）
    FixedBackOff backOff = new FixedBackOff(1000L, 2L);
    return new DefaultErrorHandler(recoverer, backOff);
}

/**
 * Kafka 监听器容器工厂，绑定上面的 errorHandler
 * Bean名称是 kafkaListenerContainerFactory，作为全局默认工厂。@KafkaListener 无需额外指定。否则监听器需添加containerFactory参数
 */
@Bean
public ConcurrentKafkaListenerContainerFactory<String, Object> kafkaListenerContainerFactory(
        ConsumerFactory<String, Object> consumerFactory,
        DefaultErrorHandler errorHandler
) {
    ConcurrentKafkaListenerContainerFactory<String, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory);
    factory.setCommonErrorHandler(errorHandler);
    return factory;
}
```

使用：

```java
// 指定使用上面配置好的工厂，自动拥有重试+DLT能力
@KafkaListener(topics = "order-topic")
public void consume(ConsumerRecord<String, String> record) {
    // 调用业务/应用层逻辑
    // 这里抛出异常，会触发 DefaultErrorHandler 的重试逻辑
    throw new RuntimeException("消费失败测试");
}

// 死信监听
@KafkaListener(topics = "order-topic-dlt")
public void consumeDlt(ConsumerRecord<String, String> record) {
    // 告警、落库、人工处理
}
```

### 注解方式

**@RetryableTopic（非阻塞重试注解）+@DltHander（DLT死信主题注解）**

这是推荐的方式，但需要提供一个接口供业务模块实现死信队列逻辑，或直接集成到Port接口上。

```java
// 重试topic注解，支持指定哪些异常重试、哪些直接进死信
@RetryableTopic(
        attempts = "3",   // 总尝试次数（初始1次 + 2次重试）
        backoff = @Backoff(delay = 1000),  // 重试功能定制
        notRetryOn = {IllegalArgumentException.class} // 参数异常，不重试直接进死信
)
@KafkaListener(topics = "order-topic", groupId = "order-group")
public void consume(String msg) {
    throw new RuntimeException("消费异常");
}

// 死信处理器，专门接收该监听的死信
@DltHandler
public void dltHandler(String msg) {
    // 死信处理器逻辑...
    log.error("注解版死信消息：{}", msg);
}

```
