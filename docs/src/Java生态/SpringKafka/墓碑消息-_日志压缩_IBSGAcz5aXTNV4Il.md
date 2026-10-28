## 墓碑消息->日志压缩

## 为什么需要墓碑消息

假设用 Kafka 存储用户信息，key 是用户 ID，value 是用户资料：

```plain
key: 1001 → value: {"name":"张三","status":"active"}
key: 1002 → value: {"name":"李四","status":"active"}
```

某天用户 1001 注销了账号。不想让这条记录永远占着日志空间，怎么办？

发一条 **payload 为 null** 的消息：

```plain
key: 1001 → value: null   ← 这就是墓碑
key: 1002 → value: {"name":"李四","status":"active"}
```

日志压缩运行时看到 key=1001 的最新消息是 null，就知道"这个 key 被删了"，于是把 key=1001 的所有历史记录全部清理掉。 让**从头消费的新消费者**只看到每个 key 的最新状态，避免"先读到旧数据、再读到新数据"的无意义处理。  

> 以往的场景发送消息不需要Key， key 的核心作用是决定消息发到哪个分区。
>
> 如果 key 不为 null，`分区号 = hash(key) % 分区总数`

## Topic定义

***局部：***

```java
@Bean
public NewTopic userStatusTopic() {
    return TopicBuilder.name("user-status")
        .partitions(3)
        .replicas(1)
        .compact()  // 等价于 .config("cleanup.policy", "compact")
        .build();
}
```

***全局：***

```yaml
spring:
  kafka:
    topics:
      - name: user-status
        partitions: 3
        replicas: 1
        properties:
          cleanup.policy: compact
```

## 发送端

有两种方式发 payload=null 的消息：

**方式一：直接用 `send()` 传 null**

```java
kafkaTemplate.send("myTopic", "key-1001", null);
```

这是最简洁的写法，value 参数直接传 null 即可。

**方式二：用 `send(Message<?>)` 方法**

Spring 的 `Message<?>` 不允许 payload 为 null，所以需要用 `KafkaNull` 做占位符：

```java
Message<String> message = MessageBuilder
.withPayload(KafkaNull.INSTANCE)  // 特殊占位符
.setHeader(KafkaHeaders.RECEIVED_KEY, "key-1001")
.build();


kafkaTemplate.send(message);
```

框架检测到 payload 是 `KafkaNull.INSTANCE`，实际发送时会把 value 设成 null。

***

## 接收端

关键点：`@Payload` 必须加 `required = false`，否则框架发现 payload 为 null 就直接报错了。

**简单场景：单个 `@KafkaListener`**

```java
@KafkaListener(id = "deletableListener", topics = "myTopic")
public void listen(
    @Payload(required = false) String value,
    @Header(KafkaHeaders.RECEIVED_KEY) String key) {


    if (value == null) {
        System.out.println("用户 " + key + " 被删除了");
        // 执行删除逻辑，比如从数据库删除
    } else {
        System.out.println("用户 " + key + " 的数据是: " + value);
    }
}
```

> 因为 `required = false`，当消息 payload 为 null 时，`value` 参数就是 `null`。配合 `@Header(RECEIVED_KEY)` 拿到 key，就能知道"哪个 key 被删了"，然后执行对应的业务逻辑。


> 更新: 2026-09-21 14:07:03  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/dtbhcr/tfn1udrno422r89y>