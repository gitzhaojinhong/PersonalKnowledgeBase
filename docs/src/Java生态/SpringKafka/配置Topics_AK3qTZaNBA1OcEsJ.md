## 配置Topics

> Kafka Broker 本身就支持_自动创建 Topic_——当生产者或消费者尝试往一个不存在的 Topic 发消息或订阅时，Broker 会自动创建它。这个行为由 Broker 端的配置 `auto.create.topics.enable` 控制（默认是 `true`）。
>
> 但在生产环境中，通常会把 `auto.create.topics.enable` 设为 `false`，因为_自动创建可能导致 Topic 的分区数、副本数等参数不符合预期_。这时候就需要你在应用启动时，通过 `NewTopic` Bean 显式声明 Topic 的规格，由 `KafkaAdmin` 去调用 Admin API 创建。

## `KafkaAdmin+NewTopic`配置`Topics`

### 定义Topic

定义一个 `KafkaAdmin` Bean，它会扫描 Spring 容器里所有的 `NewTopic` Bean，然后逐个在 Kafka 上创建出来：

```java
// 用 Spring Boot 的话，KafkaAdmin Bean 都不需要自己配了
// 直接写 NewTopic 的 @Bean 就行。
@Bean
public KafkaAdmin admin() {
    Map<String, Object> configs = new HashMap<>();
    configs.put(AdminClientConfig.BOOTSTRAP_SERVERS_CONFIG, "localhost:9092");
    return new KafkaAdmin(configs);
}
```

然后定义 Topic：

```java
// 单独一个Topic定义
@Bean
public NewTopic topic1() {
    return TopicBuilder.name("thing1")
    .partitions(10)
    .replicas(3)
    .compact()
    .build();
}
// 多个Topic打包一个Bean中
@Bean
public KafkaAdmin.NewTopics topics456() {
    return new NewTopics(
            TopicBuilder.name("defaultBoth").build(),
            TopicBuilder.name("defaultPart").replicas(1).build(),
            TopicBuilder.name("defaultRepl").partitions(3).build());
}

```

### `Topic`基本属性

* `.name(String name)` — 主题名称，必填
* `.partitions(int count)` — 分区数，从 2.6 起可省略，使用 broker 默认值（需 broker >= 2.4.0）
* `.replicas(int count)` — 副本因子，从 2.6 起可省略，使用 broker 默认值

### `Topic`主题级配置

* `.compact()` — 快捷设置日志清理策略为 compact，等价于 `.config(TopicConfig.CLEANUP_POLICY_CONFIG, "compact")`
* `.config(String name, String value)` — 添加任意 Kafka 主题级别的配置项，可多次调用

> ***通过***`_**.config()**_`***可设置的常见 Kafka 主题配置（定义在***`_**TopicConfig**_`***常量类中）：***
>
> * `COMPRESSION_TYPE_CONFIG` — 消息压缩类型：`"zstd"`、`"gzip"`、`"snappy"`、`"lz4"`、`"producer"`（默认）
> * `CLEANUP_POLICY_CONFIG` — 日志清理策略：`"delete"`（默认）、`"compact"`
> * `RETENTION_MS_CONFIG` — 日志保留时间（毫秒），默认 604800000（7 天）
> * `RETENTION_BYTES_CONFIG` — 日志保留大小上限
> * `MAX_MESSAGE_BYTES_CONFIG` — 最大消息大小，默认 1000012（约 1MB）
> * `SEGMENT_BYTES_CONFIG` — 日志段文件大小，默认 1073741824（1GB）
> * `SEGMENT_MS_CONFIG` — 日志段滚动时间，默认 604800000（7 天）
> * `MIN_IN_SYNC_REPLICAS_CONFIG` — 最小同步副本数

### `Topic`高级副本分配

* `.assignReplicas(int partition, List<Integer> replicas)` — 手动指定某个分区的副本分布在哪些 broker ID 上，替代 Kafka 自动分配

##  运行时操作 Topic  

KafkaAdmin的两个运行时方法：

```java
admin.createOrModifyTopics(...);   // 运行时创建/修改 Topic
admin.describeTopics(...);         // 运行时查询 Topic 信息
```

以及直接获取 Kafka 原生的 `AdminClient`：

```java
AdminClient client = AdminClient.create(admin.getConfigurationProperties());
client.close();
```

如果需要做比较复杂的 Topic 管理操作（比如列出所有 Topic、删除 Topic、查看消费者组信息），直接用 `AdminClient` 是最灵活的方式。


> 更新: 2026-09-21 20:04:20  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/dtbhcr/xmaw8nrpdey6asv6>