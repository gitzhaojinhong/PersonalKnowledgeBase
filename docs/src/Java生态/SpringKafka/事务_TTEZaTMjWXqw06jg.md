## 事务

生产者老化问题在此没有叙述，参考官方文档

[事务官方文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/kafka/transactions.html)

## 开启Kafka事务

**Spring Boot 最简配置**

```properties
# 只要配了这两行，剩下的 Spring Boot 自动搞定
# 设定的值需要每个实例都不相同，防止冲突
spring.kafka.producer.transaction-id-prefix=myapp-
# 关闭自动提交，把提交权交给事务了，是为了防止异常后无法回滚
spring.kafka.consumer.enable-auto-commit=false
```

这一行配置做了三件事：

* 创建一个支持事务的 `ProducerFactory`
* 自动配置一个 `KafkaTransactionManager` Bean
* 把这个事务管理器自动注入到监听容器中——从此每个 `@KafkaListener` 方法都在 Kafka 事务中执行

**局部配置：**

```java
@Configuration
public class KafkaConfig {

    // 事务型 ProducerFactory
    @Bean
    public ProducerFactory<String, String> transactionalProducerFactory() {
        Map<String, Object> props = KafkaAdminUtils.buildProducerProperties(); // 你自己构建公共配置
        DefaultKafkaProducerFactory<String, String> factory =
                new DefaultKafkaProducerFactory<>(props);
        factory.setTransactionIdPrefix("tx-");  // ✅ 开启了事务能力
        return factory;
    }

    // 非事务型 ProducerFactory（没有 transactionIdPrefix）
    @Bean
    public ProducerFactory<String, String> nonTransactionalProducerFactory() {
        Map<String, Object> props = KafkaAdminUtils.buildProducerProperties();
        return new DefaultKafkaProducerFactory<>(props);  // ❌ 不设前缀
    }

    // 事务型容器工厂
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> transactionalFactory(
            ConsumerFactory<String, String> consumerFactory,
            @Qualifier("transactionalProducerFactory") ProducerFactory<String, String> pf) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        // 底层 ProducerFactory 有前缀，容器自动开启事务
        return factory;
    }

    // 非事务型容器工厂
    @Bean
    public ConcurrentKafkaListenerContainerFactory<String, String> nonTransactionalFactory(
            ConsumerFactory<String, String> consumerFactory,
            @Qualifier("nonTransactionalProducerFactory") ProducerFactory<String, String> pf) {
        ConcurrentKafkaListenerContainerFactory<String, String> factory =
                new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(consumerFactory);
        // 底层 ProducerFactory 没有前缀，容器不开启事务
        return factory;
    }
}
```

## 四种用法解决的四种问题

#### 用法一：监听器方法自动事务

配了 `spring.kafka.producer.transaction-id-prefix` 之后，什么都不用改：

```java
@KafkaListener(id = "tx-group", topics = "orders")
public void listen(String in) {
    // 这个方法已经在事务中了！
    // 如果抛异常，所有发送的消息和已提交的偏移都会回滚
    kafkaTemplate.send("processed", in);
    // 甚至发多条
    kafkaTemplate.send("audit", "processed: " + in);
    // 如果这里抛异常，上面的两条消息都不会真正到达 Kafka
    throw new RuntimeException("哦豁，要回滚");
}
```

**容器内部的工作流程：**

1. 消费者拉取到消息
2. 容器开启一个 Kafka 事务
3. 调用你的 `listen()` 方法
4. 方法正常结束 → 提交事务（消息发出 + 偏移提交）
5. 方法抛异常 → 回滚事务（消息撤回 + 偏移不提交，下次重新消费这条消息）

####  用法二：Kafka发送 + @Transactional 

如果有一个方法既要发 Kafka 消息，又要做其他操作（比如调用其他服务），可以用 `@Transactional`：

```java
@Service
public class OrderService {

    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Transactional // 使用 KafkaTransactionManager，后台装配
    public void processOrder(Order order) {
        kafkaTemplate.send("orders", order.toJson());
        kafkaTemplate.send("audit", "order created: " + order.getId());
        // 方法正常结束 → 提交事务；抛异常 → 回滚
    }
}
```

> **如果用了 `@Transactional`，KafkaTemplate 会自动使用当前事务中的 Producer，而不是创建一个新的。**

#### 用法三：Kafka发送 + 数据库操作

***需考虑额外添加补偿机制***

数据库先提交，Kafka后提交

```java
@Service
public class HybridService {


    @Autowired
    private KafkaTemplate<String, String> kafkaTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Transactional // 默认使用的是 DataSourceTransactionManager（数据库事务）
    public void processWithDb(List<Thing> things) {
        // 发 Kafka 消息——这个操作会同步到数据库事务中
        things.forEach(thing -> kafkaTemplate.send("topic", thing));

        // 更新数据库
        jdbcTemplate.update("UPDATE orders SET status = ? WHERE id = ?", ...);
    }
}
```

> 实际执行顺序： 数据库事务先提交 → Kafka 事务后提交。如果 Kafka 提交失败，数据库已经提交了——这是有风险的。

如果想要 Kafka 先提交、数据库后提交：

```java
// 外层事务是数据库事务
@Transactional(transactionManager = "dataSourceTransactionManager")
public void outerMethod(List<Thing> things) {
    // 内层事务是 Kafka 事务——Kafka 先提交
    innerMethod(things);
    // 数据库后提交
    updateDb(things);
}

// 内部方法用 Kafka 事务
@Transactional(transactionManager = "kafkaTransactionManager")
public void innerMethod(List<Thing> things) {
    things.forEach(thing -> kafkaTemplate.send("topic", thing));
}
```

> 但这个方案依然有风险： 如果 Kafka 提交成功但数据库提交失败，两个事务已经解耦。

#### 用法四：KafkaTemplate（本地事务）

不想全局事务，只想让一次 Kafka 发多条消息保证原子性：

```java
// 如果回调抛异常 → 自动回滚
boolean result = kafkaTemplate.executeInTransaction(t -> {
    t.sendDefault("thing1", "thing2");
    t.sendDefault("cat", "hat");
    return true;  // 正常返回 → 提交事务
});
```
