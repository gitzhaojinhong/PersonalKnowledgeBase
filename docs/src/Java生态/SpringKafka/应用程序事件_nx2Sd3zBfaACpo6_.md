## 应用程序事件

## 事件全览（按生命周期排列）

我把文档中列出的所有事件按**发生顺序**整理如下，这样更容易理解：

### 启动阶段

| 事件 | 触发时机 |
| --- | --- |
| `ConsumerStartingEvent` | 消费者线程首次启动后、开始轮询之前 |
| `ConsumerStartedEvent` | 消费者即将开始轮询 |
| `ConsumerFailedToStartEvent` | 如果在 `consumerStartTimeout`内没收到 StartingEvent |

### 运行阶段

| 事件 | 触发时机 |
| --- | --- |
| `ListenerContainerIdleEvent` | 在设置的时间间隔内没有新消息到达 |
| `ListenerContainerNoLongerIdleEvent` | 空闲之后终于来了一条消息 |
| `ListenerContainerPartitionIdleEvent` | 某个具体分区长时间没消息 |
| `ListenerContainerPartitionNoLongerIdleEvent` | 该分区恢复消息 |
| `NonResponsiveConsumerEvent` | 消费者在 `poll()`方法中被阻塞太久（超过 `3x pollTimeout`） |
| `ConsumerPausedEvent` | 容器被调用 `pause()` |
| `ConsumerResumedEvent` | 容器被调用 `resume()` |
| `ConsumerPartitionPausedEvent` | 某个分区被暂停 |
| `ConsumerPartitionResumedEvent` | 该分区恢复 |
| `ConsumerRetryAuthEvent` | 消费者认证/授权失败正在重试 |
| `ConsumerRetryAuthSuccessfulEvent` | 重试后认证成功 |

### 停止阶段

| 事件 | 触发时机 |
| --- | --- |
| `ConsumerStoppingEvent` | 每个消费者线程即将停止前 |
| `ConsumerStoppedEvent` | 消费者完全关闭后 |
| `ContainerStoppedEvent` | 所有消费者都停止了 |
| `ConcurrentContainerStoppedEvent` | 整个 `ConcurrentMessageListenerContainer`停止 |

另外，`ConsumerStoppedEvent` 还带有一个 **`reason`** 字段，告诉你为什么停的：

| reason 值 | 含义 |
| --- | --- |
| `NORMAL` | 正常停止（您调用了 `container.stop()`） |
| `ERROR` | 抛出了 `java.lang.Error` |
| `FENCED` | 事务生产者被 Kafka 判定为"被踢出局"，且 `stopContainerWhenFenced=true` |
| `AUTH` | 认证/授权异常且没有配置 `authExceptionRetryInterval` |
| `NO_OFFSET` | 分区没有位移，且 `auto.offset.reset=none` |

## 事件使用示例

### 消费者空转检测示例

***配置空闲事件间隔：***

```java
// 方式一：创建容器时直接设置
@Bean
public KafkaMessageListenerContainer<String, String> container(
    ConsumerFactory<String, String> consumerFactory) {
    ContainerProperties containerProps = new ContainerProperties("topic1", "topic2");

    // ★ 关键配置：每 60 秒检测一次容器是否空闲
    containerProps.setIdleEventInterval(60000L);

    KafkaMessageListenerContainer<String, String> container = 
    new KafkaMessageListenerContainer<>(consumerFactory, containerProps);
    return container;
}


// 方式二：在 @KafkaListener 的容器工厂中统一设置
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> kafkaListenerContainerFactory() {
    ConcurrentKafkaListenerContainerFactory<String, String> factory =
    new ConcurrentKafkaListenerContainerFactory<>();
    // 工厂中设置，所有通过该工厂创建的容器都生效
    factory.getContainerProperties().setIdleEventInterval(60000L);
    return factory;
}
```

> **`setIdleEventInterval(60000L)` 是什么意思？**
>
> * 每隔 60 秒检查一次：如果这 60 秒内**一条消息都没消费**，就发布一个 `ListenerContainerIdleEvent`
> * 默认不设置的话，永远不会发布空闲事件
> * 如果容器一直空闲，每隔 60 秒就会重复发布一个事件

***监听空闲事件：***

```java
@Component
public class KafkaEventListener {

    @KafkaListener(id = "qux", topics = "annotated")
    public void listen4(@Payload String foo, Acknowledgment ack) {
        // 正常的消息消费逻辑
        System.out.println("收到消息: " + foo);
    }

    // 监听空闲事件
    @EventListener(condition = "event.listenerId.startsWith('qux-')")
    public void handleIdle(ListenerContainerIdleEvent event) {
        System.out.println("容器 " + event.getListenerId() + " 已空闲 " 
                           + event.getIdleTime() + " 毫秒");
        System.out.println("当前分配的分区: " + event.getTopicPartitions());

        // 可以在这里做告警、日志、或者动态调整
    }
}
```

> `condition = "event.listenerId.startsWith('qux-')"` 为什么要判断 `startsWith`？
>
> 因为 `@KafkaListener(id = "qux")` 如果设置了并发度（比如 `concurrency = 3`），Spring 会创建 3 个子容器，它们的 ID 分别是 `qux-1`、`qux-2`、`qux-3`。所以条件是 `startsWith("qux-")` 才能匹配到所有这些子容器发出的空闲事件。

***空闲事件有哪些属性可以用：***

拿到 `ListenerContainerIdleEvent` 后，您可以拿到这些信息：

```java
@EventListener
public void onIdle(ListenerContainerIdleEvent event) {
    event.getSource();              // 发布事件的容器实例
    event.getContainer();           // 容器（或父容器）
    event.getListenerId();          // 监听器 ID，例如 "qux-1"
    event.getIdleTime();            // 已经空闲了多久（毫秒）
    event.getTopicPartitions();     // 当前分配的主题和分区
    event.getConsumer();            // Kafka Consumer 对象（可以调 resume/pause）
    event.isPaused();               // 容器是否被暂停
}
```

### 非响应消费者检测示例

在某些极端情况下（比如 Kafka Broker 连不上），消费者的 `poll()` 方法可能被卡住，一直不返回。这时候连空闲事件都发不了（因为 poll 不返回，没机会检查）。Spring 为此提供了 `NonResponsiveConsumerEvent`。

```java
@Bean
public ConcurrentKafkaListenerContainerFactory<String, String> factory() {
    ConcurrentKafkaListenerContainerFactory<String, String> factory =
    new ConcurrentKafkaListenerContainerFactory<>();

    ContainerProperties props = factory.getContainerProperties();
    // poll 超时时间
    props.setPollTimeout(3000L);
    // 多久检查一次消费者是否卡死（默认 30 秒）
    props.setMonitorInterval(10000L);  
    // 超过 pollTimeout 多少倍还没返回，就认为"非响应"（默认 3.0）
    props.setNoPollThreshold(3.0f);    
    // 综合：如果 poll 超过 3 × 3s = 9秒 没返回，就发 NonResponsiveConsumerEvent
    // 每 10 秒检查一次

    return factory;
}
```

**这些参数怎么协同工作？**

* `pollTimeout = 3000` ：每次 poll 最多等 3 秒
* `noPollThreshold = 3.0` ：超过 3 倍的 pollTimeout 没返回 = 非响应
* `monitorInterval = 10000` ：每 10 秒检查一次
* 所以：如果 poll() 调用超过了 3×3=9 秒还没返回，就会触发 `NonResponsiveConsumerEvent`

收到这个事件后，最常见的做法是**重启容器**，让卡住的 poll 被强行唤醒：

```java
@EventListener
public void handleNonResponsive(NonResponsiveConsumerEvent event) {
log.warn("消费者 {} 无响应，准备重启", event.getListenerId());
event.getSource(MessageListenerContainer.class).stop();
event.getSource(MessageListenerContainer.class).start();
}
```

***

### 容器被 Fenced 后自动重启示例

事务场景下，Kafka 可能会判定某个生产者事务被"踢出"（Fenced），此时如果配置了 `stopContainerWhenFenced=true`，容器会自动停止并发布 `ConsumerStoppedEvent`，`reason = FENCED`。

文档给了一个经典用法——**检测到被踢出后自动重启容器**：

```java
@EventListener
public void handleConsumerStopped(ConsumerStoppedEvent event) {
if (event.getReason().equals(ConsumerStoppedEvent.Reason.FENCED)) {
    log.warn("消费者被踢出事务组，尝试重启: {}", event.getListenerId());
    // 重新启动容器
    event.getSource(MessageListenerContainer.class).start();
}
}
```

***

***重要注意事项***

**1. 不要在监听器线程上 stop 容器**

`IdleEvent` 是在消费者线程上发布的，如果在同一个线程上调用 `container.stop()`，会导致**死锁**——stop 要等当前任务执行完才能继续，但 stop 命令本身就是当前任务，互相卡死。

✅ 正确做法：交给异步线程处理

```java
@EventListener
public void onIdle(ListenerContainerIdleEvent event) {
// 用 getContainer() 获取父容器（如果是子容器，会自动返回父容器）
MessageListenerContainer container = 
event.getContainer(MessageListenerContainer.class);

// 交给异步线程去 stop，避免在消费者线程上死锁
new Thread(() -> {
    container.stop();
    // 如果需要重启，可以继续调 container.start()
}).start();
}
```

**关键区别：**`event.getContainer()` 返回的是**父容器**（`ConcurrentMessageListenerContainer`），`event.getSource()` 返回的是发布事件的具体实例（可能是子容器）。必须 stop 父容器，不能直接 stop 子容器。

***

**2. 不要 stop 子容器**

为什么会遇到子容器？

```java
@KafkaListener(id = "qux", topics = "my-topic", concurrency = 3)
```

`concurrency = 3` 时，Spring 内部创建：

* 1 个**父容器**（`ConcurrentMessageListenerContainer`），ID = `"qux"`
* 3 个**子容器**（`KafkaMessageListenerContainer`），ID = `"qux-1"`、`"qux-2"`、`"qux-3"`

| 方法 | 返回值 | 是否适合 stop |
| --- | --- | --- |
| `event.getSource()` | 发布事件的容器实例，**可能是子容器** | ❌ |
| `event.getContainer()` | 子容器 → 返回父容器；父容器 → 返回自身 | ✅ 总是安全的 |

```java
// ✅ 正确：stop 父容器
MessageListenerContainer parent = event.getContainer(MessageListenerContainer.class);
new Thread(() -> parent.stop()).start();


// ❌ 错误：stop 子容器可能引发异常
MessageListenerContainer child = event.getSource(MessageListenerContainer.class);
new Thread(() -> child.stop()).start();  // 不推荐
```

> 唯一的例外是单线程容器（`concurrency=1`），此时子容器不存在，`getSource()` 和 `getContainer()` 返回同一个对象，两者没区别。

**3. 事件默认在调用线程上发布**

```java
// 如果配置了异步的事件多播器：
@Bean
public ApplicationEventMulticaster applicationEventMulticaster() {
    SimpleApplicationEventMulticaster multicaster = new SimpleApplicationEventMulticaster();
    multicaster.setTaskExecutor(new SimpleAsyncTaskExecutor());
    return multicaster;
}
```

如果改成异步，那么事件里携带的 `Consumer` 对象已经不归属于消费者线程了，不能再调用 `Consumer` 的任何方法（比如 `pause()`、`resume()`），否则会出线程安全问题。


> 更新: 2026-09-20 13:57:03  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/dtbhcr/qfe9w8g84fu12dgr>