## 非阻塞重试

## 工作原理

> 传统的阻塞重试：
>
> 消费者从 Kafka 拉了一批消息，处理到第 2 条时挂了，于是开始走重试逻辑——等待 10 秒、重试、再等 20 秒、再重试……这期间整条线程就卡住了，后续消息只能干等着，造成消费延迟。

**非阻塞重试的核心思路是**：处理失败了，不原地等，而是把消息扔到专门的"延迟重试队列"里，到时间了再捞回来重试。 不会卡住后续消息的处理，所以叫"非阻塞"。

**工作原理：**

假设有一个主题叫 `orders`，配置了如下策略：

* 初始退避：1000ms（1秒）
* 倍率：2（每次翻倍）
* 最多尝试次数：4（1 次初始 + 3 次重试）

框架自动创建Topic：

| 主题名 | 用途 |
| --- | --- |
| `orders` | 主主题，正常消费 |
| `orders-retry-1000` | 第 1 次重试（1 秒后） |
| `orders-retry-2000` | 第 2 次重试（2 秒后） |
| `orders-retry-4000` | 第 3 次重试（4 秒后） |
| `orders-dlt` | 死信主题，最终失败的消息归宿 |

> ***但要注意***：**这个模式会失去 Kafka 原本的消息顺序保证**，因为失败的消息被跳过了

**AckMode配置建议：**

`RECORD` 是推荐选项：每处理完一条消息就提交一次偏移量。

非阻塞重试本身就是逐条处理失败消息的机制，用 `RECORD` 能保证每条消息的偏移量提交时机清晰可控，避免批量提交时出现混乱。

## 退避延迟精度

重试的时间点不是精确到毫秒的，框架只保证"不会提前"，不保证"绝对准时"。

***

## 配置

**使用方式**：这是实际使用的入口。提供三种配置方式：`@RetryableTopic` 注解（推荐）、`RetryTopicConfiguration` Bean、`RetryTopicConfigurationSupport` 全局配置类。

**配置方式**：

1. 注解方式：在 `@KafkaListener` 方法上添加 `@RetryableTopic`
2. Bean 方式：创建 `RetryTopicConfiguration` Bean，使用 `RetryTopicConfigurationBuilder` 构建
3. 全局配置：继承 `RetryTopicConfigurationSupport`，重写相关方法

* 若需要暴露非阻塞重试的基础设施组件，在配置类上加 `@EnableKafkaRetryTopic`

***注解方式：***

```java
@RetryableTopic(
    attempts = "4",  // 总尝试次数（初始1次 + 3次重试）
    backoff = @Backoff(
        value = 1000,      // 初始延迟 1000ms
        multiplier = 2,    // 每次翻倍 → 1000 → 2000 → 4000
        maxDelay = 5000    // 最大延迟上限 5000ms，防止无限翻倍
    ),
    kafkaTemplate = "retryableTopicKafkaTemplate"
)
@KafkaListener(topics = "orders", groupId = "order-group")
public void processOrder(Order order) {
    // 处理逻辑
}
```

> ***注意：***
>
> ***@RetryableTopic中的***`_**kafkaTemplate**_`***参数：***
>
> * 非阻塞重试的核心机制就是"处理失败 → 框架帮你把消息转发到重试主题"。这个"转发"的动作需要一个 `KafkaTemplate` 来发消息。`kafkaTemplate` 就是告诉框架：**用哪个 `KafkaTemplate` 来发这些转发消息。**
> * 如果没指定 kafkaTemplate 名称，将会查找名为 `defaultRetryTopicKafkaTemplate` 的 Bean。如果找不到该 Bean，则会抛出异常。  

***Bean 方式：***

```java
@Bean
public RetryTopicConfiguration myRetryTopic(KafkaTemplate<String, MyPojo> template) {
    return RetryTopicConfigurationBuilder
            .newInstance()
            .fixedBackOff(3000)              // 固定 3 秒退避
            .maxAttempts(5)                  // 最多尝试 5 次
            .concurrency(1)                  // 重试消费者并发数为 1
            .includeTopics(List.of("my-topic", "my-other-topic"))  // 只对这两个主题生效
            .create(template);
}
```

***全局配置方式：***

```java
@Configuration
public class MyRetryTopicConfiguration extends RetryTopicConfigurationSupport {

    @Override
    protected void configureBlockingRetries(BlockingRetriesConfigurer blockingRetries) {
        blockingRetries
                .retryOn(MyBlockingRetriesException.class, MyOtherBlockingRetriesException.class)
                .backOff(new FixedBackOff(3000, 3));
    }

    @Override
    protected void manageNonBlockingFatalExceptions(
            List<Class<? extends Throwable>> nonBlockingFatalExceptions) {
        nonBlockingFatalExceptions.add(MyNonBlockingException.class);
    }

    @Override
    protected void configureCustomizers(CustomizersConfigurer customizersConfigurer) {
        customizersConfigurer.customizeErrorHandler(eh -> {
            eh.setSeekAfterError(false);
        });
    }
}

```

> * **`configureBlockingRetries`**：配置在非阻塞重试之前，先用阻塞重试试几次。这里的意思是：遇到 `MyBlockingRetriesException` 或 `MyOtherBlockingRetriesException` 时，先原地阻塞重试 3 次（每次等 3 秒），还不成功再走非阻塞重试
> * **`manageNonBlockingFatalExceptions`：把 `MyNonBlockingException` 标记为"致命异常"，意思是遇到这个异常不重试，直接进 DLT**。这个机制对应的是 `include`/`exclude` 的全局版本
> * **`configureCustomizers`**：自定义错误处理器。这里把 `seekAfterError` 设为 `false`，避免出错后重新拉取已处理的消息
>
> **注意**：用了这种方式，就不要再用 `@EnableKafkaRetryTopic`，改用普通的 `@EnableKafka`，否则 Bean 冲突导致启动失败。  

***

## 程序化构建

不用 `@KafkaListener` 注解，纯代码手搭非阻塞重试

[程序化构建官方文档跳转](https://docs.spring.io/spring-kafka/reference/3.3/retrytopic/programmatic-construction.html)

***

## 定制功能

### 重试间隔

*BackOff:*

```java
@RetryableTopic(attempts = 5,
    backoff = @Backoff(delay = 1000, multiplier = 2, maxDelay = 5000))
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}
```

> `delay = 1000` 是初始等待 1 秒，
>
> `multiplier = 2` 是每次翻倍，
>
> `maxDelay = 5000` 是上限 5 秒不继续翻。
>
> `attempts = 5` 共尝试 5 次（1 次初始 + 4 次重试）。

### 全局超时

*timeout:*

```java
@RetryableTopic(backoff = @Backoff(2_000), timeout = 5_000)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}
```

> `timeout = 5_000` 表示从第一次失败开始计时，5 秒内如果还没成功，第 5 秒后再次失败就直接进 DLT，不再继续重试了。
>
> `backoff = @Backoff(2_000)` 每次重试间隔 2 秒。

### 异常分类器

*include 指定只有这些异常才重试，其他异常不重试:*

```java
@RetryableTopic(
    include = {MyRetryException.class, MyOtherRetryException.class},
    traversingCauses = "true"
)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    throw new RuntimeException(new MyRetryException()); // 会触发重试
}
```

### 包含/排除主题

_这个功能只适用于 Bean 配置方式，注解方式不支持_

```java
@Bean
public RetryTopicConfiguration myRetryTopic(KafkaTemplate<Integer, MyPojo> template) {
    return RetryTopicConfigurationBuilder
            .newInstance()
            // 只对这两个主题生效
            .includeTopics(List.of("my-included-topic", "my-other-included-topic"))
            .create(template);
}

@Bean
public RetryTopicConfiguration myOtherRetryTopic(KafkaTemplate<Integer, MyPojo> template) {
    return RetryTopicConfigurationBuilder
            .newInstance()
            // 对这个主题不生效
            .excludeTopic("my-excluded-topic")
            .create(template);
}
```

### 主题自动创建

框架默认会自动创建重试主题和 DLT，可以指定分区数和副本数，也可以关闭自动创建。

```java
// 指定创建主题时用 2 个分区、3 个副本。
@RetryableTopic(numPartitions = "2", replicationFactor = "3")
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}
```

```java
// 关掉自动创建，需要自己提前把重试主题和 DLT 在 Kafka 里建好。
@RetryableTopic(autoCreateTopics = "false")
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}
```

### 失败头信息管理

> 每次转发失败消息时，框架会在消息头里附加一些信息（原始头、异常头）。默认行为是：只保留第一个"原始"头信息和最后一个异常头信息。这是为了避免消息过大。

*修改规则：*

```java
// 在继承 RetryTopicConfigurationSupport 的配置类里
@Override
protected void configureCustomizers(CustomizersConfigurer customizersConfigurer) {
    customizersConfigurer.customizeDeadLetterPublishingRecoverer(dlpr -> {
        dlpr.setAppendOriginalHeaders(true);        // 每次重试都追加原始头
        dlpr.setStripPreviousExceptionHeaders(false); // 不删除之前的异常头
    });
}
```

> 如果想在重试头之外添加自定义头信息，可以设置 `headersFunction`： `factory.setHeadersFunction((rec, ex) -> { ... })`
>
> 如果 `headersFunction` 返回的头中包含 `SingleRecordHeader` 类型的头，会替换而不是追加。

### 根据异常类型路由到不同的 DLT

```java
@RetryableTopic(exceptionBasedDltRouting = {
    @ExceptionBasedDltDestination(
        suffix = "-deserialization",
        exceptions = {DeserializationException.class}
    )}
)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}
```

> `exceptionBasedDltRouting` 传入一个数组。这里定义了一条规则：如果抛出 `DeserializationException`，就路由到后缀为 `-deserialization` 的 DLT。

## 先阻塞后非阻塞重试

先原地阻塞重试几次，再走非阻塞重试，两段式接力

**配置方式**：在继承 `RetryTopicConfigurationSupport` 后，通过 `configureBlockingRetries()` 方法配置阻塞重试的次数和退避策略。

**代码示例**：

```java
// 在继承 RetryTopicConfigurationSupport 的类里
@Override
protected void configureBlockingRetries(BlockingRetriesConfigurer blockingRetries) {
    blockingRetries
            .retryOn(MyBlockingRetryException.class, MyOtherBlockingRetryException.class)
            .backOff(new FixedBackOff(3000, 5));
}
// 致命异常，不重试，直接进DLT
@Override
protected void manageNonBlockingFatalExceptions(
        List<Class<? extends Throwable>> nonBlockingFatalExceptions) {
    nonBlockingFatalExceptions.add(ShouldSkipBothRetriesException.class);
}
```

> * `.retryOn(...)`：指定哪些异常需要走"先阻塞重试"这条路。只有这里列出来的异常才会先原地重试
> * `.backOff(new FixedBackOff(3_000, 5))`：固定间隔 3 秒，最多重试 5 次。注意这里 `FixedBackOff(interval, maxAttempts)`，第一个参数是间隔毫秒，第二个参数是重试次数

***

## 

## 重试次数获取

通过消息头获取：

```java
@RetryableTopic(backoff = @Backoff(...))
@KafkaListener(id = "dh1", topics = "dh1")
void listen(Thing thing,
    // 阻塞重试的次数
    @Header(KafkaHeaders.DELIVERY_ATTEMPT) int blockingAttempts,
    // 非阻塞的重试次数
    @Header(name = RetryTopicHeaders.DEFAULT_HEADER_ATTEMPTS, required = false) Integer nonBlockingAttempts) {
    // ...
}
```

通过 KafkaMessageHeaderAccessor 获取：

```java
@RetryableTopic(backoff = @Backoff(...))
@KafkaListener(id = "dh1", topics = "dh1")
void listen(Thing thing, KafkaMessageHeaderAccessor accessor) {
    // 阻塞重试的次数
    int blocking = accessor.getBlockingRetryDeliveryAttempt();
    // 非阻塞的重试次数
    int nonBlocking = accessor.getNonBlockingRetryDeliveryAttempt();
}
```

***

## 重试/DLT主题命名

**默认命名格式为** ：`主题名-retry-延迟值` 和 `主题名-dlt`。

***自定义后缀：***

```java
@RetryableTopic(
    retryTopicSuffix = "-my-retry-suffix",// 重试Topic后缀
    dltTopicSuffix = "-my-dlt-suffix"// DLT Topic后缀
)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
} 
// 重试主题名会变成 my-annotated-topic-my-retry-suffix-0，
// DLT 变成 my-annotated-topic-my-dlt-suffix
```

***选择后缀后面跟索引还是延迟值：***

```java
// TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE选择根索引
@RetryableTopic(topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}

```

***固定延迟单主题复用：***

```java
// 如果每次重试的间隔都一样（固定退避）
// 可以只建一个重试主题，所有重试都往这一个主题里放
// 不需要每次重试各建一个。
@RetryableTopic(backoff = @Backoff(2_000),
    sameIntervalTopicReuseStrategy = SameIntervalTopicReuseStrategy.SINGLE_TOPIC)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) { ... }
```

***自定义命名策略（注册***`_**RetryTopicNamesProviderFactory**_`***）：***

```java
// 替换默认命名工厂
@Override
protected RetryTopicComponentFactory createComponentFactory() {
    return new RetryTopicComponentFactory() {
        @Override
        public RetryTopicNamesProviderFactory retryTopicNamesProviderFactory() {
            return new CustomRetryTopicNamesProviderFactory();
        }
    };
}
// 自定义逻辑示例：
public class CustomRetryTopicNamesProviderFactory implements RetryTopicNamesProviderFactory {

    @Override
    public RetryTopicNamesProvider createRetryTopicNamesProvider(
                DestinationTopic.Properties properties) {

        // 如果是主主题，用默认命名
        if (properties.isMainEndpoint()) {
            return new SuffixingRetryTopicNamesProvider(properties);
        }
        // 如果是重试/DLT 主题，在前面加 "my-prefix-"
        else {
            return new SuffixingRetryTopicNamesProvider(properties) {

                @Override
                public String getTopicName(String topic) {
                    return "my-prefix-" + super.getTopicName(topic);
                }

            };
        }
    }
}
```

***

## 多个监听器，相同主题

如果两个 `@KafkaListener` 都监听 `orders` 主题，并且都加了 `@RetryableTopic`，它们默认都会生成 `orders-retry-0`、`orders-retry-1` 这些重试主题。那这两个监听器的重试消息就会混到一起，乱套了。**所以必须给每个监听器的重试主题起不同的名字。**

**代码示例**：

```java
// 监听器 1：消费 orders 主题
@RetryableTopic(
    retryTopicSuffix = "-listener1",          // 重试主题后缀用 -listener1，而不是默认的 -retry
    dltTopicSuffix = "-listener1-dlt",        // DLT 后缀用 -listener1-dlt，而不是默认的 -dlt
    topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE  // 后缀后面跟索引
)
@KafkaListener(id = "listener1", groupId = "group1", topics = "orders")
void listen1(String message, @Header(KafkaHeaders.RECEIVED_TOPIC) String receivedTopic) {
    // ... 处理逻辑
}

// 监听器 2：也消费 orders 主题，但不同消费者组
@RetryableTopic(
    retryTopicSuffix = "-listener2",          // 重试主题后缀用 -listener2，跟 listener1 区分开
    dltTopicSuffix = "-listener2-dlt",        // DLT 后缀也不同
    topicSuffixingStrategy = TopicSuffixingStrategy.SUFFIX_WITH_INDEX_VALUE
)
@KafkaListener(id = "listener2", groupId = "group2", topics = "orders")
void listen2(String message, @Header(KafkaHeaders.RECEIVED_TOPIC) String receivedTopic) {
    // ... 处理逻辑
}
```

***

## DLT 策略

**使用方式**：控制重试耗尽后消息的最终去向。可自定义 DLT 处理方法、配置 DLT 处理失败时的行为、也可以完全不配置 DLT。

**配置方式**：

* 在监听器类中使用`@DltHandler`注解定义 DLT 处理方法（常用）
* 通过 `RetryTopicConfigurationBuilder` 指定外部 Bean

自定义 DLT 处理方法：

```java
@RetryableTopic
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) { ... }

@DltHandler
public void processDltMessage(MyPojo message) {
    // 持久化、告警等
}
```

DLT 处理方法自己也可能抛异常。框架提供了两种策略：

| 策略 | 行为 |
| --- | --- |
| `ALWAYS_RETRY_ON_ERROR`（默认） | 把消息重新发回 DLT，不阻塞其他 DLT 消息的处理 |
| `FAIL_ON_ERROR` | 直接结束，不重新转发消息 |

```java
@RetryableTopic(dltProcessingFailureStrategy = DltStrategy.FAIL_ON_ERROR)
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) {
    // ... 消息处理
}
```

## 重试/DLT指定容器工厂

在 `@RetryableTopic` 注解中设置 `listenerContainerFactory` 属性。

```java
@RetryableTopic(listenerContainerFactory = "my-retry-topic-factory")
@KafkaListener(topics = "my-annotated-topic")
public void processMessage(MyPojo message) { ... }
```

***

## 在运行时访问主题信息

通过注入 `DestinationTopicContainer` Bean，你可以在运行时查到当前主题链中的下一个重试主题或 DLT 是什么

```java
@Autowired
private DestinationTopicResolver destinationTopicResolver;
```

***

## 更改 KafkaBackOffException 日志级别

重试主题的消费者在轮询时，发现消息的退避时间戳还没到，就会抛这个异常，然后暂停分区继续等待。这是正常运行流程的一部分，不是真正的"错误"，所以框架默认只打了 DEBUG 级别的日志。

但在调试或排查问题时，可能希望它的日志更显眼一些。

```java
//在继承 RetryTopicConfigurationSupport 的 @Configuration 类里@Override
protected void configureCustomizers(CustomizersConfigurer customizersConfigurer) {
    customizersConfigurer.customizeErrorHandler(defaultErrorHandler ->
                                                defaultErrorHandler.setLogLevel(KafkaException.Level.WARN));
}
```
