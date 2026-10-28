## 主题/分区偏移量

## 初始偏移量两种规则

* 一：Kafka Broker 自动分配分区（最常用）
* 二：手动分配分区（精细化控制）

***自动分配分区配置的配置项：***

`auto.offset.reset`

> 这个配置决定了**当消费者组第一次订阅 topic，或者当前提交的 offset 已不存在（如日志过期被清理）时**，从哪里开始消费：

| 值 | 含义 |
| --- | --- |
| `latest`（默认） | 新消费者组从最新消息开始，只消费启动后的消息 |
| `earliest` | 新消费者组从最老的消息开始，消费全部历史 |
| `none` | 如果找不到已提交的偏移，直接抛异常 |

## 跳转到特定偏移量

Seeking to a Specific Offset 就是在消费者运行过程中，强行把某个分区的消费指针跳到任意位置

常用：

* 监听器所属类继承 `AbstractConsumerSeekAware`，调用里面的方法
* [其他使用方法参考官方文档](https://docs.spring.io/spring-kafka/reference/3.3/kafka/seek.html)
