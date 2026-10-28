## 接收消息

## 消息监听器

Spring Kafka 提供了 8 种消息监听器接口，本质上就是 2 个维度（单条 vs 批量） x 2 个维度（是否手动确认） x 2 个维度（是否需要 Consumer 对象）= 8 种组合

### 消息监听器3个维度8个接口

| 维度 | 选项 A | 选项 B |
| --- | --- | --- |
| 处理方式 | **单条处理**（一条一条处理） |**批量处理**（一次 poll 拿到的所有消息一起处理） |
| 提交偏移量方式 | **自动/容器管理提交**（不用你管） |**手动提交**（自己调用 acknowledgment） |
| 是否需要 Consumer 对象 | **不需要**|**需要**（极少用） |

**1. `MessageListener<K, V>` —— 最基础，单条自动提交**

```java
public interface MessageListener<K, V> {
    void onMessage(ConsumerRecord<K, V> data);
}
```

> *解释*：这是最简版的监听器。你只管在 `onMessage` 里处理传进来的每一条消息。偏移量怎么提交不用管，由容器（或 Kafka 自动提交）负责。
>
> *什么时候用*：自动提交 offset 的场景，或者交给容器管理 `AckMode` 的场景。大多数情况下，不会直接实现这个接口，而是用 `@KafkaListener` 注解，它底层就是这个接口。

**2. `AcknowledgingMessageListener<K, V>` —— 单条手动确认**

```java
public interface AcknowledgingMessageListener<K, V> {
    void onMessage(ConsumerRecord<K, V> data, Acknowledgment acknowledgment);
}
```

> *解释*：多了一个 `acknowledgment` 参数。处理完消息后，要主动调用 `acknowledgment.acknowledge()` 告诉 Kafka：这条消息我处理完了，可以提交偏移量了。
>
> *什么时候用*：业务逻辑需要"确保处理完才提交 offset"。比如处理完入库后手动确认，确保重启后不会重复消费。

**代码示例**：

```java
@Component
public class MyAckListener implements AcknowledgingMessageListener<String, String> {

    @Override
    public void onMessage(ConsumerRecord<String, String> data, Acknowledgment ack) {
        try {
            // 处理消息，比如写入数据库
            processMessage(data.value());
            // 处理成功，手动确认
            ack.acknowledge();
        } catch (Exception e) {
            // 处理失败，不确认——Kafka 不会提交 offset，下次重启会重新消费
            log.error("处理失败，等待重试", e);
        }
    }
}
```

**3. `ConsumerAwareMessageListener<K, V>` —— 单条自动提交+能拿Consumer**

```java
public interface ConsumerAwareMessageListener<K, V> extends MessageListener<K, V> {
    void onMessage(ConsumerRecord<K, V> data, Consumer<?, ?> consumer);
}
```

> *解释*：比 `MessageListener` 多了一个 `Consumer` 对象。你可以通过它做一些底层操作，比如手动 seek 到某个偏移量。
>
> *什么时候用*：极少用。除非你需要直接操作 Kafka Consumer API，比如"消息有异常，跳过这条消息，把 offset 手动移到下一条"。

**代码示例**：

```java
@Component
public class MyConsumerAwareListener implements ConsumerAwareMessageListener<String, String> {

    @Override
    public void onMessage(ConsumerRecord<String, String> data, Consumer<?, ?> consumer) {
        if (isPoisonPill(data)) {
            // 毒丸消息：跳过，手动把 offset 移到下一条
            consumer.seek(new TopicPartition(data.topic(), data.partition()), data.offset() + 1);
            return;
        }
        processMessage(data.value());
    }
}
```

**4. `AcknowledgingConsumerAwareMessageListener<K, V>` —— 单条手动确认 + Consumer**

```java
public interface AcknowledgingConsumerAwareMessageListener<K, V> extends MessageListener<K, V> {
    void onMessage(ConsumerRecord<K, V> data, Acknowledgment acknowledgment, Consumer<?, ?> consumer);
}
```

> *解释*：上面第 2 种（手动确认）和第 3 种（需要 Consumer）的结合体。参数最多：data、ack、consumer 全给你。
>
> *什么时候用*：需要手动确认 offset，同时还需要操作 Consumer 对象。极少数高级场景。

***

**批量版本**

上面 4 种接口都有对应的批量版本，唯一的区别是 `ConsumerRecord<K, V>` 变成了 `List<ConsumerRecord<K, V>>`：

| 单条版 | 批量版 | 区别 |
| --- | --- | --- |
| `MessageListener` | `BatchMessageListener` | `onMessage(List<ConsumerRecord<K, V>> data)` |
| `AcknowledgingMessageListener` | `BatchAcknowledgingMessageListener` | 多了 ack 参数 |
| `ConsumerAwareMessageListener` | `BatchConsumerAwareMessageListener` | 多了 consumer 参数 |
| `AcknowledgingConsumerAwareMessageListener` | `BatchAcknowledgingConsumerAwareMessageListener` | ack + consumer 全有 |

> *什么时候用批量*：当想一次处理一批消息（比如批量写入数据库）时，效率更高。配置 `@KafkaListener` 时加 `batch = true` 就是批量模式。

### @KafkaListener（常用方式）

Spring 官方文档说的是"底层有 8 个接口"，但实际你很少直接实现它们。

用注解就行了：

```java
@Service
public class MyService {

    @KafkaListener(id = "myGroup", topics = "myTopic")
    public void listen(String message) {
        // 一条一条处理，offset 自动提交
        System.out.println("收到消息: " + message);
    }

    @KafkaListener(id = "myBatchGroup", topics = "myBatchTopic")
    public void listenBatch(List<String> messages) {
        // 批量处理，一次 poll 拿到的所有消息
        System.out.println("收到批量消息: " + messages.size() + " 条");
    }
}
```

如果需要手动确认：

```java
@KafkaListener(id = "myManualGroup", topics = "myManualTopic")
public void listenWithAck(String message, Acknowledgment ack) {
    try {
        processMessage(message);
        ack.acknowledge();  // 手动确认 该方式需要额外设置AckMode
    } catch (Exception e) {
        // 不确认，下次还会消费到
    }
}
```

> `@KafkaListener` 底层会自动实现上面那 8 种接口中的某一种，根据你方法的参数自动匹配。

**所以只需要关心 `@KafkaListener` 怎么写参数，不需要关心具体用了哪个接口。**

参数规则如下：

| 方法参数 | 底层用的接口 |
| --- | --- |
| `String message` | `MessageListener` |
| `String message, Acknowledgment ack` | `AcknowledgingMessageListener` |
| `String message, Consumer<?, ?> consumer` | `ConsumerAwareMessageListener` |
| `String message, Acknowledgment ack, Consumer<?, ?> c` | `AcknowledgingConsumerAwareMessageListener` |
| `List<String> messages` | `BatchMessageListener` |
| `List<String> messages, Acknowledgment ack` | `BatchAcknowledgingMessageListener` |
| 以此类推... | 对应批量版 |

## `@KafkaListener`详解

### 基础使用

#### 简单示例

```java
@KafkaListener(id = "foo", topics = "myTopic", clientIdPrefix = "myClientId")
public void listen(String data) {
    System.out.println("收到消息：" + data);
}
```

**参数解释：**

* `id = "foo"` —— 给这个监听器起个名字，也是消费者 `group.id` 的默认值
* `topics = "myTopic"` —— 订阅哪个主题
* `clientIdPrefix = "myClientId"` —— 消费者客户端的 ID 前缀，实际会变成 `myClientId-0`、`myClientId-1`……（并发数大于 1 时）
* `String data` —— 方法参数就是消息体，框架自动帮你反序列化

#### `@KafkaListener` 放到类上  

 把 `@KafkaListener` 提到类级别，然后在该类里写多个 `@KafkaHandler` 方法，Spring 会根据消息反序列化后的实际类型，自动路由到对应的处理方法。  

*示例：*

```java
@Component
@KafkaListener(id = "multi", topics = "myTopic")
static class MultiListenerBean {

    @KafkaHandler
    public void listen(String foo) {
        // 消息是 String 类型时，走这里
        System.out.println("收到字符串消息: " + foo);
    }

    @KafkaHandler
    public void listen(Integer bar) {
        // 消息是 Integer 类型时，走这里
        System.out.println("收到整数消息: " + bar);
    }

    // isDefault = true —— 标记为兜底方法。
    @KafkaHandler(isDefault = true)
    public void listenDefault(Object object) {
        // 以上类型都不匹配时，走这里（兜底方法）
        System.out.println("收到未知类型的消息: " + object);
    }
}
```

> ***注意：***
>
> 兜底方法**无法**通过在参数上添加`@Header`注解的方式，直接获取离散的字符串类型消息头。 
>
> 正确做法：参数使用`@Header(KafkaHeaders.RECORD_METADATA) ConsumerRecordMetadata meta`，获取完整的元数据对象。  

#### @KafkaListener 作为元注解

 允许你自定义一个注解（比如 `@MyThreeConsumersListener`），把它当作 `@KafkaListener` 的"快捷方式"或"模板"。

可以在自定义注解里预先设置好一些公共属性（比如 concurrency=3），然后用这个新注解替代每次重复写 `@KafkaListener`。  

*示例：*

```java
@Target(ElementType.METHOD)       // 这个注解只能用在方法上
@Retention(RetentionPolicy.RUNTIME) // 运行时保留（反射可读）
@KafkaListener                      // 关键：把 @KafkaListener 作为元注解
public @interface MyThreeConsumersListener {

    @AliasFor(annotation = KafkaListener.class, attribute = "id")
    String id();

    @AliasFor(annotation = KafkaListener.class, attribute = "topics")
    String[] topics();

    @AliasFor(annotation = KafkaListener.class, attribute = "concurrency")
    String concurrency() default "3";  // 默认并发数为 3

}
```

> `@AliasFor(annotation = KafkaListener.class, attribute = "id")`把自定义注解的 `id()` 属性，映射到 `@KafkaListener` 的 `id` 属性上。
>
> 这样写 `@MyThreeConsumersListener(id = "xxx")` 时，Spring 就知道等价于 `@KafkaListener(id = "xxx")`。  

#### 通过消费者组实现广播与单播

**单播（Unicast）——同一消费者组内负载均衡**

当多个消费者实例使用相同的 `group.id` 时，它们属于同一个消费者组。Kafka 会将 Topic 中的分区分配给组内的消费者，每条消息只会被组内的一个消费者实例消费。

* 每条消息只送达一次
* 应用实例中天然实现负载均衡和水平扩展
* 适合任务分发、事件驱动的微服务架构

**广播（Broadcast）——不同消费者组独立消费**

多个消费者使用不同的 `group.id` 时，它们属于不同的消费者组。

每个消费者组都会独立地从 Topic 消费全部消息。

```java
// 消费者组 "group-a" 内的消费者 —— 单播（消息只被其中一个消费）
@KafkaListener(topics = "my-topic", groupId = "group-a")
public void listenA(String message) { ... }

@KafkaListener(topics = "my-topic", groupId = "group-a")
public void listenA2(String message) { ... }

// 消费者组 "group-b" —— 广播，与 group-a 独立消费全量消息
@KafkaListener(topics = "my-topic", groupId = "group-b")
public void listenB(String message) { ... }
```

### 参数解析与数据校验

#### 获取消息头信息

> 获取消息的全部信息，包括消息的元信息。

***发送自定义Header消息：***

```java
@Service
public class OrderService {

    @Autowired
    private KafkaTemplate<String, Object> kafkaTemplate;

    public void sendOrder(Order order) {
        // 使用 MessageBuilder 构建带 Header 的消息
        Message<Order> message = MessageBuilder
        .withPayload(order)
        .setHeader("orderSource", "WEB")           // String 类型
        .setHeader("userId", 12345)                 // Integer 类型，自动 JSON 序列化
        .setHeader("traceId", UUID.randomUUID())    // UUID 类型
        .setHeader("eventTimestamp", Instant.now()) // Instant 类型
        .build();

        kafkaTemplate.send(message);
    }
}
```

***接收自定义Header消息：***

```java
@Component
public class OrderListener {

    // 方式一：
    @KafkaListener(topics = "orders")
    public void onOrder(Message<Order> message) {
        Order order = message.getPayload();
        MessageHeaders headers = message.getHeaders();

        // 直接拿，类型自动还原
        String orderSource = headers.get("orderSource", String.class);
        Integer userId = headers.get("userId", Integer.class);
        UUID traceId = headers.get("traceId", UUID.class);
        Instant timestamp = headers.get("eventTimestamp", Instant.class);
    }
    // 方式二：
    @KafkaListener(topics = "orders")
    public void listen(
            Order payload,
            // 默认@Header是required = true的，如果不存在就会抛异常。
            @Header("orderSource") String orderSource,
            @Header("userId") Integer userId) {
        // 直接用了，不需要手动 get
    }
    // 方式三（很不推荐）：
    @KafkaListener(topics = "orders")
    public void listen(ConsumerRecord<String, Order> record) {
        Headers kafkaHeaders = record.headers();  // 这是 Kafka 原生的 Headers（byte[] 形式）
        Header header = kafkaHeaders.lastHeader("orderSource");
        byte[] value = header.value();  // 需要自己转
    }
}
```

#### 获取消息的元信息

> 只获取消息的 topic、partition、offset、timestamp

```java
// 方式一：
@KafkaListener(id = "qux", topicPattern = "myTopic1")
public void listen(
        @Payload String foo,
        // 默认@Header是required = true的，如果不存在就会抛异常。
        @Header(name = KafkaHeaders.RECEIVED_KEY, required = false) Integer key,
        @Header(KafkaHeaders.RECEIVED_PARTITION) int partition,
        @Header(KafkaHeaders.RECEIVED_TOPIC) String topic,
        @Header(KafkaHeaders.RECEIVED_TIMESTAMP) long ts) {
    // 拿到的都是单条消息的元数据
}
// 方式二（简洁）：
@KafkaListener(id = "simple", topics = "myTopic")
public void listen(String data, ConsumerRecordMetadata meta) {
    System.out.println("消息体：" + data);
    System.out.println("来自主题：" + meta.topic());
    System.out.println("分区：" + meta.partition());
    System.out.println("偏移量：" + meta.offset());
    System.out.println("时间戳：" + meta.timestamp());
}

```

#### 获取消费者组ID

在多个容器中运行相同的监听器代码时，能够确定记录来自哪个容器（通过其 group.id 消费者属性标识）可能会很有用。

```java
// 用@Header注入
@KafkaListener(id = "id", topicPattern = "someTopic")
public void listener(@Payload String payload,
                     @Header(KafkaHeaders.GROUP_ID) String groupId) {
    System.out.println("当前消费组是：" + groupId);
    // 比如打日志时带上 groupId，方便排查
}
// KafkaUtils.getConsumerGroupId()（兜底方案）
@KafkaListener(id = "id", topicPattern = "someTopic")
public void listener(ConsumerRecords<?, ?> records) {
    String groupId = KafkaUtils.getConsumerGroupId();
    System.out.println("当前消费组是：" + groupId);
}
```

> 当批处理监听器直接收 `ConsumerRecords<?, ?>` 参数时，`@Header` 方式不生效。因为 `ConsumerRecords` 是 Kafka 客户端原始返回对象，Spring 没法往里面再塞一个 GROUP_ID 头。这时候 `KafkaUtils.getConsumerGroupId()` 就是唯一的办法——它在底层从当前线程的上下文里把 `group.id` 掏出来。

#### `@Payload``@Valid`自动验证

`@Payload @Valid ValidatedClass val` —— 关键组合。`@Payload` 表示方法参数接收的是消息体；`@Valid` 告诉 Spring 在把消息体注入这个方法之前，先对它做一次校验。

> Spring Boot项目，引入了 `spring-boot-starter-validation`，`LocalValidatorFactoryBean` 会自动配置好，直接注入进来就能使用。

_实现 *`_KafkaListenerConfigurer_`*，把校验器注册进去  :_

```java
@Configuration
@EnableKafka
public class Config implements KafkaListenerConfigurer {

    @Autowired
    private LocalValidatorFactoryBean validator;
    // 配置完这一步，校验器就被"挂载"到整个 @KafkaListener 的消息处理流程中了
    @Override
    public void configureKafkaListeners(KafkaListenerEndpointRegistrar registrar) {
        registrar.setValidator(this.validator);
    }
}
```

_在 *`_@KafkaListener_`* 的 *`_@Payload_`* 参数上加 *`_@Valid_`*：_

ValidatedClass类属性上可以使用所有 Bean Validation 标准注解

```java
@KafkaListener(id = "validated", topics = "annotated35",
        errorHandler = "validationErrorHandler",// 校验失败也会触发该handler
        containerFactory = "kafkaJsonListenerContainerFactory")
public void validatedListener(@Payload @Valid ValidatedClass val) {
    // 能走到这里，说明消息已经通过了校验
    System.out.println("校验通过，bar = " + val.getBar());
}
```

*校验失败处理：*

定义一个`KafkaListenerErrorHandler`_Bean_

```java
@Bean
public KafkaListenerErrorHandler validationErrorHandler() {
    return (m, e) -> {
        // m: 原始消息（Message<?>）
        // e: 异常信息，包含了校验失败的细节
        System.out.println("校验失败，消息内容: " + m.getPayload());
        System.out.println("异常原因: " + e.getMessage());
        // 可以在这里做补偿处理，比如记录死信、发告警等
        return null;  // 返回 null 表示消费完成（不抛异常）
    };
}
```

### 消息处理

#### 手动ACK

```yaml
spring:
  kafka:
    consumer:
      # 关闭消费者的自动提交偏移量功能
      enable-auto-commit: false
    listener:
      // ackMode设置为手动提交
      ack-mode: MANUAL
```

方法参数上添加Acknowledgment

```java
@KafkaListener(id = "cat", topics = "myTopic")
public void listen(String data, Acknowledgment ack) {
    try {
        // 处理业务
        process(data);
        // 业务成功了，手动告诉 Kafka：这条可以标记为已处理
        ack.acknowledge();
    } catch (Exception e) {
        // 处理失败了，不调 acknowledge，Kafka 不会推进 offset
        log.error("处理失败", e);
    }
}

```

#### 拒绝消息投递

**`nack()`——拒绝消息重投递**

`Acknowledgment` 接口上`nack(long sleep)` 方法。它的语义是：**这条消息我处理失败了，但我暂时不要抛异常，我想要延迟重试**。AckMode只允许是 `AckMode.MANUAL` / `MANUAL_IMMEDIATE`。

```java
@KafkaListener(id = "nackDemo", topics = "orders")
public void listen(String message, Acknowledgment ack) {
    try {
        process(message);
        ack.acknowledge();
    } catch (TemporaryException e) {
        // 暂时失败，5秒后重试
        ack.nack(5000);
    }
}
```

***调用***`_**nack()**_`***后容器会做什么？***

调用 nack() 后，待处理的偏移量会被提交，本轮 poll 剩余的消息会被丢弃，容器会在对应的分区上执行 seek，这样失败的消息和未处理的消息会在下一次 poll() 时重新投递。通过 sleep 参数可以让消费者在重新投递前暂停。

***关于 sleep 参数，精度问题：***

消费者在 sleep 期间会被暂停，同时继续 poll broker 以保持连接存活。实际的 sleep 时间取决于容器的 pollTimeout（默认 5 秒）。最小 sleep 时间等于 pollTimeout，所有 sleep 时间都是它的整数倍。如果需要更精确的控制，可以减少容器的 pollTimeout。

也就是说传 `nack(1000)` 想暂停 1 秒，实际可能暂停 5 秒。要精确控制的话需要调小 `pollTimeout`：

```yaml
spring:
  kafka:
    listener:
      poll-timeout: 1000  # 改成 1 秒
```

#### `@SendTo`转发

`@SendTo` 可以在 `@KafkaListener` 方法处理完消息后，自动把返回值发到另一个 Kafka 主题，实现"消费-处理-转发"一条龙。

*示例：*

```java
@KafkaListener(topics = "orders")         // 从 orders 主题消费
@SendTo("processedOrders")                 // 返回值自动发到 processedOrders 主题
public String handleOrder(String orderJson) {
    // 处理订单...
    return "processed:" + orderJson;       // 返回值就是发到下一个主题的消息内容
}
```

> ***注意：***
>
> 就算方法本身是void的，如果设置了`errorHandler`，处理失败时也能把错误信息转发到另一个主题

`_@SendTo_`*的写法：*

```java
// 固定的目标主题
@SendTo("annotated23reply")  

// 启动时从 myBean 的 replyTopic 字段取值
@SendTo("#{myBean.replyTopic}")

// 运行时 SpEL
@SendTo("!{request.value()}")  

// 等价于 @SendTo("!{source.headers['kafka_replyTopic']}")
// 去消息头里找 kafka_replyTopic 这个 Header 的值作为目标主题
@SendTo  
```

> `@SendTo` 不是凭空就能发的，它背后需要一个 `KafkaTemplate` 来执行实际的发送操作。这个模板配置在监听器容器工厂的 `replyTemplate` 属性上。
>
> Spring Boot 项目，它会自动把已经配置好的 `KafkaTemplate` 注入到工厂里！

***

**ReplyHeadersConfigurer  操作消息头**

当用 `@SendTo` 发回复时，Spring 默认会把原消息里的部分头信息复制到回复消息里。

`ReplyHeadersConfigurer` 就是决定：哪些头复制过去，哪些不加，以及要不要额外塞一些头进去。

```java
// shouldCopy —— 筛选哪些头复制过去
// additionalHeaders —— 额外加自定义头  
@Bean
public ConcurrentKafkaListenerContainerFactory<Integer, String> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<Integer, String> factory =
        new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(cf());
    // 一旦手动手动声明了一个 ConcurrentKafkaListenerContainerFactory Bean，
    // Spring Boot 的自动配置就不覆盖该的自定义 Bean 了
    // 所以必须设置ReplyTemplate，否则 @SendTo 没法发
    factory.setReplyTemplate(template());  
    factory.setReplyHeadersConfigurer(new ReplyHeadersConfigurer() {

      @Override
      public boolean shouldCopy(String headerName, Object headerValue) {
        return false;
      }

      @Override
      public Map<String, Object> additionalHeaders() {
        return Collections.singletonMap("qux", "fiz");
      }

    });
    return factory;
}
```

#### 消息过滤

消息过滤是为了在重复消息到达监听器方法之前就把它拦住，避免在业务代码里写 if-else 判断幂等。

核心： 实现 `RecordFilterStrategy`

***全局配置：***

```java
// 定义过滤器
public class DuplicateFilter implements RecordFilterStrategy {

    @Override
    public boolean filter(ConsumerRecord<String, String> record) {
        String orderId = record.value();
        boolean exists = orderService.isProcessed(orderId);
        return exists;  // true = 重复了，过滤掉；false = 放行
    }
}
// 配置Bean
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<String, String> factory = ...;
    factory.setRecordFilterStrategy(new DuplicateFilter());
    factory.setAckDiscarded(true);  // 过滤掉的消息也提交偏移量，下次不会重复拉取
    return factory;
}
```

***单独覆盖：***

```java
@Component("myFilter")
public class MyFilter implements RecordFilterStrategy {
    @Override
    public boolean filter(ConsumerRecord record) {
        return record.value().contains("skip");
    }
}
// filter 属性的值传的是 Spring Bean 的名称（"myFilter"），不是类名。
@KafkaListener(id = "filtered", topics = "topic", filter = "myFilter")
public void listen(Thing thing) {
    // 只有没被过滤的消息才会走到这里
}
```

> **`ackDiscarded` —— 过滤掉的消息还要不要提交偏移量？**
>
> * `false`（默认）：不提交，重启后会重新拉取并再次过滤。适合"宁可多过滤一次，也不漏掉一条"的场景。
> * `true`：提交偏移量，后续不再拉取。适合"过滤逻辑 100% 可靠，不需要再检查"的场景。

批量消息使用`filterBatch`

```java
public class BatchFilter implements RecordFilterStrategy {

    @Override
    public List<ConsumerRecord<String, String>> filterBatch(
            List<ConsumerRecord<String, String>> consumerRecords) {
        // 返回过滤后的子列表
        return consumerRecords.stream()
            .filter(record -> !isDuplicate(record))
            .collect(Collectors.toList());
    }
}
```

> 如果一批消息全部被过滤掉，监听器方法是否还要被调用？
>
> * 默认是**要调用的**（收到空列表）。可以通过 `ignoreEmptyBatch()` 控制

#### 异步返回

支持的异步返回类型一共三种：

* **`CompletableFuture<?>`** —— Java 标准库的异步容器，最常用
* **`Mono<?>`** —— Reactor 框架的异步容器，Spring WebFlux 框架常用
* **Kotlin `suspend` 函数** —— Kotlin 协程风格

> *为何不使用方法内编写异步代码的方式？*
>
> * 返回 CompletableFuture：告诉Kafka框架这是异步任务，延迟提交 offset
> * void + 异步代码：框架不知道异步任务，方法返回即提交 offset

```plain
收到消息 -> 进入监听器方法 -> 返回 CompletableFuture（立即返回）  -> 处理下一条消息
                    |
                    v（异步线程处理中）
                处理完成 -> future.complete(...) -> 框架自动 ACK

```

**CompletableFuture`<String>`  使用示例：**

```java
// 简洁的方式
@KafkaListener(id = "orderProcessor", topics = "order-events")
public CompletableFuture<String> processOrder(String orderJson) {
    String orderId = extractOrderId(orderJson);
    return CompletableFuture.supplyAsync(() -> processPayment(orderId));
}
// 或者使用偏底层的代码
@KafkaListener(id = "orderProcessor", topics = "order-events")
public CompletableFuture<String> processOrder(String orderJson) {
    String orderId = extractOrderId(orderJson);
    CompletableFuture<String> future = new CompletableFuture<>();
    executor.submit(() -> {
        try {
            future.complete(processPayment(orderId));
        } catch (Exception e) {
            future.completeExceptionally(e);
        }
    });
    return future;
}
```

> *注意：*
>
> * 如果检测到异步返回类型，会自动将 AckMode 设置为 MANUAL，并启用乱序提交；相反，异步操作完成时会自动确认异步完成的 ACK。
> * 当异步结果因错误而完成时，消息是否可恢复取决于容器的错误处理器。
> * 如果在监听器方法中发生异常，导致无法创建异步结果对象，则必须捕获该异常并返回适当的返回对象，以确保消息能够 ACK 或恢复。

#### 批处理

批处理监听器：一次处理一批消息

默认是一条一条处理。如果想一次 poll 拿到的多条消息一起处理，就开批处理模式。

**第一步：先配一个批处理工厂**

```java
@Bean
public KafkaListenerContainerFactory<?> batchFactory() {
    ConcurrentKafkaListenerContainerFactory<Integer, String> factory =
    new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory());
    factory.setBatchListener(true);   // 关键：开启批处理模式
    return factory;
}
```

**第二步：在注解里引用这个工厂，参数改成 List**

```java
@KafkaListener(id = "list", topics = "myTopic", containerFactory = "batchFactory")
public void listen(List<String> list) {
    System.out.println("一次性收到 " + list.size() + " 条消息");
    for (String msg : list) {
        // 批量处理每条消息
    }
}
```

**批处理的元数据也是批量的：** 每个消息头字段都变成了 List

```java
@KafkaListener(id = "list", topics = "myTopic", containerFactory = "batchFactory")
public void listen(List<String> list,
                   @Header(KafkaHeaders.RECEIVED_KEY) List<Integer> keys,
                   @Header(KafkaHeaders.OFFSET) List<Long> offsets) {
    // list.get(0) 和 keys.get(0)、offsets.get(0) 对应同一条消息
}
```

> 如果想要最原始的形态，还可以直接收 `ConsumerRecords<?, ?>`——就是 Kafka 客户端 `poll()` 方法返回的那个对象本身。

### 规范化定制

#### 自定义监听器线程名称

默认的 Kafka 线程名（如 `container-0-C-3`）每次重启都会变，不方便排查；

| 启动次数 | 消费者 0 的线程名 | 消费者 1 的线程名 |
| --- | --- | --- |
| 第一次启动 | `container-0-C-1` | `container-1-C-1` |
| 停掉再启动（第二次） | `container-0-C-2` | `container-1-C-2` |
| 再停再启（第三次） | `container-0-C-3` | `container-1-C-3` |

通过两个属性来接管线程命名：

1. **`changeConsumerThreadName = true`** —— 开启自定义线程名功能
2. **`threadNameSupplier`** —— 一个函数，输入是 `MessageListenerContainer`，输出是你想要的线程名

默认实现就是返回 `container.getListenerId()`，也就是在 `@KafkaListener(id = "...")` 里设置的 id。

容器工厂与监听器：

```java
// Bean的名字是kafkaListenerContainerFactory，说明修改的是默认配置
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<String, String> factory =
            new ConcurrentKafkaListenerContainerFactory<>();
    factory.setConsumerFactory(consumerFactory());

    factory.getContainerProperties().setChangeConsumerThreadName(true);
    // 默认 threadNameSupplier 已经返回 listenerId，一般不用改
    // 如果非要自定义，可以这样：
    // factory.getContainerProperties().setThreadNameSupplier(
    //         container -> "MyCustom-" + container.getListenerId());

    return factory;
}
```

```java
@KafkaListener(id = "orderProcessor", topics = "orders")
public void listen(String data) { ... }
```

开启自定义线程名后，线程名就会变成 `orderProcessor` 而不是 `container-0-C-3`。日志里一看线程名就知道"这是 orderProcessor 在处理消息"，排查问题更方便。

#### 容器创建前批量修改注解属性

允许在容器创建之前，用代码批量修改 `@KafkaListener` 注解的属性，无需挨个改源码，

> 典型场景：
>
> * **批量规范命名** —— 统一给所有监听器自动生成有规律的 `groupId`，避免手写遗漏或格式不统一。
> * **环境差异适配** —— 根据不同环境（开发/测试/生产），用增强器自动修改 `topics` 前缀（比如测试环境自动加 `-dev` 后缀）。
> * **统一安全/监控配置** —— 批量给所有监听器添加统一的错误处理器、拦截器引用等，不用在每个 `@KafkaListener` 属性里重复写。

注册一个 `AnnotationEnhancer` 类型的 Bean 即可。它本质上就是一个"钩子函数"，会在处理每个 `@KafkaListener` 注解时被调用。

*示例：*

```java
@Bean   //自动拼接出一个唯一且有意义的 groupId
public static AnnotationEnhancer groupIdEnhancer() {
    return (attrs, element) -> {
        // attrs: 当前 @KafkaListener 注解的所有属性（Key-Value 形式）
        // element: 被注解的元素，可能是 Class（类）或 Method（方法）
        
        attrs.put("groupId", attrs.get("id") + "."
            + (element instanceof Class
                ? ((Class<?>) element).getSimpleName()
                : ((Method) element).getDeclaringClass().getSimpleName()
                    + "." + ((Method) element).getName()));
        
        return attrs;  // 返回修改后的属性映射
    };
}
```

> ***注意：***
>
> Bean 必须声明为 `static`—— 因为 `AnnotationEnhancer` 在 Spring 容器生命周期的极早期就需要被使用，那时候非静态 Bean 还没创建好。所以必须用 `@Bean` + `static`。
>
> 调用时机 —— 增强器会在所有 SpEL 表达式和占位符 `${...}` 解析**之前**被调用。这意味着你可以在增强器里直接填入 SpEL 表达式，Spring 后续还会再解析一次。
>
> 多个增强器的执行顺序 —— 可以注册多个 `AnnotationEnhancer`，如果它们实现了 `Ordered` 接口，就按 `order()` 从小到大依次执行，前一个的输出传给后一个。

### 其他高级功能

#### @KafkaListener 生命周期管理

`@KafkaListener` 创建的监听器容器不是普通的 Spring Bean，而是注册在 `KafkaListenerEndpointRegistry` 里的"编外成员"。

可以通过这个注册中心，在运行时对它们进行启动、停止、查找等生命周期管理。

[@KafkaListener 生命周期管理文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/receiving-messages/kafkalistener-lifecycle.html)

#### 重新平衡监听器

在 Kafka 消费者组发生重新平衡（rebalance）时，插入自定义逻辑——比如在分区被收回前保存偏移量、在拿到新分区后跳转到指定位置。

Spring Kafka 提供了比原生 API 更细致的回调接口，在 rebalance 的不同时间点做不同的事。

[重新平衡监听器文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/receiving-messages/rebalance-listeners.html)

[强制消费者重新平衡文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/receiving-messages/enforced-rebalance.html)

#### 暂停和恢复监听器容器/分区

暂停和恢复监听器容器或分区，就是在不让消费者重新平衡（rebalance）的前提下，临时让某个监听器或监听器的某个分区"闭嘴"或"开口"

[暂停和恢复监听器容器官方文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/pause-resume.html)

[在监听器容器上暂停和恢复分区官方文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/pause-resume-partitions.html)

#### 按顺序启动 @KafkaListeners

`ContainerGroupSequencer` 可以控制多个 `@KafkaListener` 按组依次启动——第一组消费完了，第二组才开始，以此类推。典型场景：先把配置数据加载到内存，再启动业务处理。

[按顺序启动 @KafkaListeners 文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/receiving-messages/sequencing.html)

#### `KafkaTemplate`主动拉取消息

消费 Kafka 消息有两种方式：

* **基于监听器**（`@KafkaListener`）：被动等待，消息来了自动处理
* **基于拉取**（`KafkaTemplate.receive()`）：主动查询，你知道某条消息在某个分区的某个偏移量上，直接去取

[使用 KafkaTemplate 接收 文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/receiving-messages/template-receive.html)

## 消息监听器容器

### 设置并发数

**两种容器**

* **`KafkaMessageListenerContainer`** —— 单线程的，一个容器实例就是一个线程，负责消费指定的 Topic/分区
* **`ConcurrentMessageListenerContainer`** —— 多线程的，它里面包了多个 `KafkaMessageListenerContainer` 实例，每个实例跑一个线程

`@KafkaListener` 的 `concurrency` 属性最终设置的是 `ConcurrentMessageListenerContainer` 的并发数。

```java
@KafkaListener(id = "myConsumer", topics = "orders", concurrency = "3")
public void listen(String message) {
// ...
}
```

这意味着容器会创建 3 个 `KafkaMessageListenerContainer` 实例，也就是 3 个消费者线程。**这里的核心原则是：concurrency 不要超过 Topic 的分区数。**

> 开发时的做法：
>
> * 开发环境：Topic 通常只有 1 个分区，concurrency 设 1 就行
> * 生产环境：concurrency 通常设成和分区数一致，比如 Topic 是 10 个分区，concurrency 就设 10

### 偏移量提交(**`AckMode`** 选型)

**配置项：enable-auto-commit**

这是关闭 Kafka 消费者的自动提交偏移量功能。关闭后，需要手动控制 offset 提交时机。

设置了 `enable-auto-commit: false` 后，还需要配合配置 `spring.kafka.listener.ack-mode` 来定义提交策略。如果不配置，Spring Boot 默认使用 `BATCH` 模式。

```yaml
spring:
  kafka:
    consumer:
      enable-auto-commit: false
```

***

**7种`AckMode`：**

| **AckMode**|**提交时机**|**使用场景** |
| --- | --- | --- |
| **`RECORD`** | 每条消息处理完立即提交 | 最严格，每条消息都不能丢，但性能最差 |
| **`BATCH`** | 每次 `poll()`返回的一批消息全部处理完才提交 | 默认模式，性能和可靠性平衡 |
| **`TIME`** | 类似 BATCH，但额外要求距离上次提交超过 `ackTime` | 控制提交频率上限 |
| **`COUNT`** | 类似 BATCH，但额外要求距离上次提交积累了 `ackCount`条 | 控制提交数量上限 |
| **`COUNT_TIME`** | TIME 和 COUNT 任一条件满足就提交 | 更灵活的时间+数量控制 |
| **`MANUAL`** | 由业务代码调 `acknowledge()`触发，提交的是直到调用时的一整批 | 需要手动控制提交时机 |
| **`MANUAL_IMMEDIATE`** | 业务代码调 `acknowledge()`后立即提交 | 最细粒度的手动控制 |

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
    factory.getContainerProperties().setAckMode(ContainerProperties.AckMode.MANUAL);
    return factory;
}
```

```java
// containerFactory参数指定容器工厂
@KafkaListener(id = "manualConsumer", topics = "payments",
               containerFactory = "manualAckFactory")
public void listenManual(String message, Acknowledgment ack) {
    try {
        processPayment(message);
        ack.acknowledge();
    } catch (Exception e) {
        // 手动处理，不提交偏移量
    }
}

```

> 补充：***关于asyncAcks***
>
> 手动提交偏移量时，默认必须按消息顺序提交，但`asyncAcks` 允许乱序提交。
>
> ***为什么存在这个功能？***
>
> 每次 `poll()` 拉回一批消息，然后把每条消息交给一个线程池去异步处理。不同消息的处理速度不同，快的先处理完，慢的后处理完。在默认的顺序提交模式下，必须等所有消息处理完才能提交，快的线程得等慢的。开了 `asyncAcks` 后，快的线程可以提前调 `acknowledge()`
>
> ***限制：***
>
>  使用该功能后，无法在提交偏移量时使用 nack()。 
>
> ***链接：***
>
> [官网文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/receiving-messages/ooo-commits.html)

### 多Topic消费的分区分配策略

这是开发中最容易踩的坑。假设有三个 Topic（order-events、payment-events、notification-events），每个 5 个分区，你用同一个 `@KafkaListener` 订阅它们并设 `concurrency=15`：

```java
@KafkaListener(id = "allEvents", topics = {"order-events", "payment-events", "notification-events"},
               concurrency = "15")
public void listen(String message) {
// ...
}
```

期望的是 15 个线程各消费一个分区，但实际上只有 5 个线程活跃，10 个空闲。

因为默认的 Kafka ConsumerPartitionAssignor 是 RangeAssignor。对于三个 Topic 各 5 个分区的情况，每个消费者会从每个 Topic 分到一个分区，因此只有 5 个消费者是活跃的。

解决方法是换成 `RoundRobinAssignor`：

```yaml
spring:
  kafka:
    consumer:
      properties:
        partition.assignment.strategy: org.apache.kafka.clients.consumer.RoundRobinAssignor
```

改完后 15 个消费者线程每个都能分到一个分区。

### 其他容器属性

**1. `missingTopicsFatal`——Topic 不存在时阻止容器启动**

如果 Topic 还不存在就启动消费者，容器会一直在 `consumer.poll()` 里打日志循环等待。设成 `true` 可以让容器直接启动失败，方便开发时快速发现问题：

```yaml
spring:
  kafka:
    listener:
      missing-topics-fatal: true
```

**2. `authExceptionRetryInterval`——权限认证失败后自动重试**

如果 Kafka 认证失败，默认容器会直接停止。设了这个属性后容器会不断重试，等权限修复后自动恢复：

```yaml
spring:
  kafka:
    listener:
      auth-exception-retry-interval: 5s
```

[监听器容器属性 文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/container-props.html)

### 容器与容器工厂(自由度最高)

```plain
想要做什么？
│
├─ 只用 @KafkaListener，不改任何配置
│   → 啥也不用管，Spring Boot 全自动
│
├─ 给所有 @KafkaListener 统一改配置
│   → 定义 Bean 名称 = kafkaListenerContainerFactory 修改默认自动配置
│   → 或用 spring.kafka.consumer.* 配置项
│
├─ 给某个 @KafkaListener 用不同配置
│   → 定义另一个工厂 Bean + containerFactory = "xxx"
│
├─ 给所有容器加统一额外配置
│   → factory.setContainerCustomizer(...)
│
├─ 只给某个容器加特殊配置
│   → @KafkaListener(containerPostProcessor = "beanName")
│
└─ 运行时动态创建容器/手动创建容器
    → factory.createContainer("topic") + 声明为 @Bean

```

> ***注意：***
>
> 名字叫 `kafkaListenerContainerFactory`的Bean，是 Spring Kafka 的默认工厂。在这个 Bean 上改的任何配置，都会影响到所有没指定 `containerFactory` 的所有 `@KafkaListener`。

**自定义容器工厂+@KafkaListener**

```java
@Configuration
public class KafkaConfig {
    // 自定义容器工厂
    @Bean
    KafkaListenerContainerFactory<ConcurrentMessageListenerContainer<Integer, String>>
                kafkaListenerContainerFactory() {
        ConcurrentKafkaListenerContainerFactory<Integer, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory());   // 告诉工厂怎么连 Kafka
        factory.setConcurrency(3);                        // 开 3 个并发线程消费
        factory.getContainerProperties().setPollTimeout(3000); // 每次 poll 的超时时间
        return factory;
    }

    @Bean
    public ConsumerFactory<Integer, String> consumerFactory() {
        return new DefaultKafkaConsumerFactory<>(consumerConfigs());
    }

    @Bean
    public Map<String, Object> consumerConfigs() {
        Map<String, Object> props = new HashMap<>();
        props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
        // ... 其他配置
        return props;
    }
}

```

**为监听器加特殊配置**

```java
// 1. 定义一个后置处理器
@Component
public class AlertPostProcessor
                implements ContainerPostProcessor<String, String,
                            AbstractMessageListenerContainer<String, String>> {

    @Override
    public void postProcess(AbstractMessageListenerContainer<String, String> container) {
        container.setErrorHandler((thrownException, data) -> {
            System.err.println("🔥 告警：监听器异常 - " + thrownException.getMessage());
            // 发告警通知...
        });
    }
}
```

```java
// 2. 只对某个监听器使用这个处理器
@KafkaListener(
    id = "critical-orders",
    topics = "orders",
    containerPostProcessor = "alertPostProcessor"  // 独门配置
)
public void listen(String in) { ... }
```

***

**手动创建容器**

```java
@Bean
public ConcurrentMessageListenerContainer<String, String> manualContainer(
        ConcurrentKafkaListenerContainerFactory<String, String> factory) {

    // factory 是 Spring Boot 自动配置好的那个
    // 直接用它创建容器
    ConcurrentMessageListenerContainer<String, String> container =
        factory.createContainer("manual-topic");

    // 设置监听逻辑
    container.setupMessageListener((MessageListener<String, String>) data ->
        System.out.println("手动容器收到: " + data.value()));

    // 设置组 ID    container.getContainerProperties().setGroupId("manual-group");
    container.setBeanName("manual-container");

    // ★ 必须声明为 @Bean，否则容器不被 Spring 管理
    // 这样声明后，Spring 自动调 start()
    return container;
}
```
