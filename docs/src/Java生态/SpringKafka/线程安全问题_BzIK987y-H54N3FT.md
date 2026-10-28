## 线程安全问题

## 安全问题场景

```java
@Component
public class UnsafeListener {


    // ❌ 成员变量，线程不安全！
    private int messageCount = 0;


    @KafkaListener(id = "unsafe", topics = "orders", concurrency = "3")
    public void listen(String in) {
        // 多个线程同时执行 messageCount++，结果不准
        messageCount++;
        System.out.println("已处理 " + messageCount + " 条消息");
    }
}
```

3 个线程同时执行 `messageCount++`，这不是原子操作，最终计数值会偏少。这就是典型的**有状态监听器的线程安全问题**。

***

## 三种解决方案

### 方案一：无状态监听器（最佳实践，首选）

**能不用成员变量，就不用。** 让监听器只处理传入的参数，不保存任何状态：

```java
@Component
public class StatelessListener {


    @KafkaListener(id = "safe", topics = "orders", concurrency = "3")
    public void listen(String in) {
        // ✅ 不依赖任何成员变量
        // 所有信息都来自 ConsumerRecord 或方法参数
        processOrder(in);
    }


    // ✅ 工具方法也是纯函数，不依赖成员变量
    private void processOrder(String data) {
        // 只处理输入，不保存状态
    }
}
```

**大多数业务代码都应该写成这样。** 这是最安全、最简单、性能最好的方式。

***

### 方案二：ThreadLocal 保存线程私有状态

如果确实需要在监听器中保存状态（比如跟踪当前线程已经处理了多少条），用 `ThreadLocal` 让**每个线程有自己的副本**：

```java
@Component
public class ThreadLocalListener {


    // ✅ 每个线程有自己的计数器，互不干扰
    private final ThreadLocal<Integer> messageCount =
    ThreadLocal.withInitial(() -> 0);


    @KafkaListener(id = "tl-safe", topics = "orders", concurrency = "3")
    public void listen(String in) {
        // 当前线程自己的计数器加 1
        messageCount.set(messageCount.get() + 1);
        System.out.println(
            Thread.currentThread().getName()
            + " 已处理 " + messageCount.get() + " 条消息"
        );
    }
}
```

**但是有个隐患：** 线程停止时，`ThreadLocal` 里的值不会被自动清理，可能导致内存泄漏。解决方案是监听 `ConsumerStoppedEvent`，在消费者线程退出时清理：

```java
@Component
public class CleanupListener {


    private final ThreadLocal<Integer> messageCount =
    ThreadLocal.withInitial(() -> 0);


    @KafkaListener(id = "clean", topics = "orders", concurrency = "3")
    public void listen(String in) {
        messageCount.set(messageCount.get() + 1);
    }


    // ✅ 每个消费者线程停止时，自动清理 ThreadLocal
    @EventListener
    public void onConsumerStopped(ConsumerStoppedEvent event) {
        messageCount.remove();
    }
}
```

***

### 方案三：每个线程一个独立的监听器实例

如果不想碰 `ThreadLocal`，也无法做到无状态——那就让每个消费者线程使用**独立的监听器实例**。但这有个限制：**对 `@KafkaListener` 不适用**，只能用原型作用域的 `MessageListener` Bean。

```java
// 1. 定义监听器类（有状态也没关系，因为每个线程有自己的实例）
public class MyListener implements MessageListener<String, String> {


    private int messageCount = 0;  // 每个实例独一份


    @Override
    public void onMessage(ConsumerRecord<String, String> data) {
        messageCount++;
        System.out.println(Thread.currentThread().getName()
                           + " 处理了 " + messageCount + " 条");
    }
}


// 2. 在配置中，创建 n 个 concurrency=1 的容器
@Configuration
public class Config {


    @Bean
    public ConcurrentMessageListenerContainer<String, String> container1(
        ConcurrentKafkaListenerContainerFactory<String, String> factory) {
        ConcurrentMessageListenerContainer<String, String> c = factory.createContainer("orders");
        c.getContainerProperties().setMessageListener(new MyListener());  // 实例 1
        c.getContainerProperties().setGroupId("group-1");
        return c;
    }


    @Bean
    public ConcurrentMessageListenerContainer<String, String> container2(
        ConcurrentKafkaListenerContainerFactory<String, String> factory) {
        ConcurrentMessageListenerContainer<String, String> c = factory.createContainer("orders");
        c.getContainerProperties().setMessageListener(new MyListener());  // 实例 2
        c.getContainerProperties().setGroupId("group-2");
        return c;
    }
}
```

每个容器 `concurrency=1`，一个容器一个监听器实例——彻底解决了共享问题，但代码比较啰嗦，生产环境很少这么用。


> 更新: 2026-09-20 15:05:30  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/dtbhcr/we22e0br8eulm1my>