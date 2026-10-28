## 消息的序列号与反序列化

## 消息是 JSON 格式

配置：

```yaml
spring:
  kafka:
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer #springboot中默认就是这个
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
    consumer:
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer # springboot中默认就是这个
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer
      properties:
        spring.json.trusted.packages: "*"
        spring.json.value.default.type: com.example.YourEntity

```

> `spring.json.trusted.packages: "*"` 的作用是**放开反序列化的包白名单**，让 `JsonDeserializer` 可以反序列化任意包下的自定义类；
>
> `spring.json.value.default.type: com.example.YourEntity` 的作用是**指定反序列化的兜底目标类型**，当消息 Header 中没有类型信息时，用这个类型来反序列化。

[序列化、反序列化和消息转换官方文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/serdes.html)


> 更新: 2026-09-20 16:56:58  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/dtbhcr/xm0obgmglsssgbtl>