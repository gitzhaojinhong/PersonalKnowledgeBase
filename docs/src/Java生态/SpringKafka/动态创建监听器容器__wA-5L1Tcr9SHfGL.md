## 动态创建监听器容器

Spring Kafka 支持**在运行时动态创建监听容器**，而不是在应用启动时就固定好所有监听器。这主要解决"订阅哪些主题是在运行中才确定的"这类场景。

## 动态创建容器两种方案

### 原型`Bean`+`@KafkaListener`(推荐)

利用 **Spring 的原型作用域（Prototype）**，每次获取 Bean 时都创建一个新的实例，每个实例上的 `@KafkaListener` 会自动注册为一个独立的监听容器。

```java
// 1. 定义一个普通的 POJO 类，内部使用 @KafkaListener
public class MyPojo {

    private final String id;    // 监听器唯一标识
    private final String topic; // 要监听的主题

    public MyPojo(String id, String topic) {
        this.id = id;
        this.topic = topic;
    }

    public String getId() {
        return this.id;
    }

    public String getTopic() {
        return this.topic;
    }

    // 关键点：@KafkaListener 中使用 SpEL 表达式引用外部属性
    @KafkaListener(
        id = "#{__listener.id}",       // 监听器 ID 动态注入
        topics = "#{__listener.topic}" // 监听的主题动态注入
    )
    public void listen(String in) {
        System.out.println("收到消息: " + in 
            + "，来自监听器: " + this.id);
    }
}

// 2. 配置为原型作用域的 Bean
@Bean
@Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
MyPojo pojo(String id, String topic) {
    return new MyPojo(id, topic);
}

// 3. 在运行时动态创建多个监听器
// 第一次获取：创建一个 id="one"、监听 "topic2" 的监听器
applicationContext.getBean(MyPojo.class, "one", "topic2");

// 第二次获取：创建一个 id="two"、监听 "topic3" 的监听器
applicationContext.getBean(MyPojo.class, "two", "topic3");

```

> **特殊的占位符机制**：`__listener` 引用的就是当前 Bean 实例本身。所以 `#{__listener.id}` 会调用 `getId()` 方法拿到实际 id 值，`#{__listener.topic}` 会调用 `getTopic()` 拿到实际主题名。这样就实现了"同一个类，不同实例监听不同主题"的效果。
>
> **原型作用域Bean**：原型作用域意味着每次从 `getBean()` 获取都会创建一个全新的对象。如果改为默认的单例（Singleton），整个应用里只有一个 `MyPojo` 实例，那 id 和 topic 只能固定一套值，根本无法动态创建多个不同的监听器。

### `MessageListener`接口+容器工厂

```java
 // 1. 定义一个监听器类，实现 MessageListener 接口
public class MyListener implements MessageListener<String, String> {

    @Override
    public void onMessage(ConsumerRecord<String, String> data) {
        // 业务处理逻辑
        System.out.println("收到消息: " + data.value() 
            + "，来自主题: " + data.topic()
            + "，分区: " + data.partition()
            + "，偏移量: " + data.offset());
    }
}

// 2. 在需要的时候动态创建容器
private ConcurrentMessageListenerContainer<String, String> createContainer(
        ConcurrentKafkaListenerContainerFactory<String, String> factory, 
        String topic, 
        String group) {

    // 通过工厂创建容器，指定要监听的主题
    ConcurrentMessageListenerContainer<String, String> container = 
        factory.createContainer(topic);

    // 设置监听器实例,告诉容器使用MyListener监听器
    container.getContainerProperties().setMessageListener(new MyListener());

    // 设置消费组 ID
    container.getContainerProperties().setGroupId(group);

    // 给容器起个名字，方便日志和监控
    container.setBeanName(group);

    // 启动容器——这一步才会真正连接到 Kafka 开始消费
    container.start();

    return container;
}

```

## 注销容器

> 动态创建的监听器，每个都有一个**唯一 ID**（就是 `@KafkaListener(id = "xxx")` 里的那个 id）。这个 ID 必须在整个应用生命周期内唯一。如果你不再需要某个监听器了，但未来可能想创建一个同名的新监听器，就必须先注销旧 ID，否则新容器注册时会报错："这个 ID 已经被占用了"。

```java
// 前提：你有一个想销毁的容器，它的 ID 是 "dynamic-listener-1"

// 第 1 步：获取注册表
KafkaListenerEndpointRegistry registry = 
    applicationContext.getBean(KafkaListenerEndpointRegistry.class);

// 第 2 步：先停止容器（必须手动调用！）
// 从注册表中拿到容器的引用
MessageListenerContainer container = 
    registry.getListenerContainer("dynamic-listener-1");
if (container != null) {
    container.stop();         // 停止消费，断开 Kafka 连接
    // 此时容器优雅关闭，不再拉取新消息，等待正在处理的消息消费完毕
}

// 第 3 步：再从注册表中删除这个 ID 的记录
registry.unregisterListenerContainer("dynamic-listener-1");
// 此时 "dynamic-listener-1" 这个 ID 恢复空闲状态
// 以后可以再创建一个同样 ID 的新容器

```


> 更新: 2026-09-20 13:29:41  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/dtbhcr/yc2gh3pkmy6bia63>