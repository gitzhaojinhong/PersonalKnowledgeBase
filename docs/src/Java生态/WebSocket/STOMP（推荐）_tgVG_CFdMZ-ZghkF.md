## STOMP(推荐)

为什么推荐？ 需要把消息发给不同的人、按主题分类、让多个客户端订阅同一个消息源，用原生WebSocket API 会写得非常痛苦。

而STOMP是发一条带有"目的地址"的消息，由 STOMP 帮忙路由到正确的地方。

## STOMP概述

### 帧结构

STOMP 的消息叫做"帧"（frame），结构长得跟 HTTP 请求差不多：

```plain
命令
头1:值1
头2:值2


消息正文^@
```

有命令、有消息头、有正文。比如客户端要发送一条消息，会这么写：

```plain
SEND
destination:/queue/trade
content-type:application/json
content-length:44


{"action":"BUY","ticker":"MMM","shares":44}^@
```

就是一个 `SEND` 命令，目标地址是 `/queue/trade`，正文是 JSON。和 HTTP 请求结构几乎一样。

### 三个核心操作

**订阅（SUBSCRIBE）**——客户端说"我想听哪些消息"。比如客户端订阅股票报价：

```plain
SUBSCRIBE
id:sub-1
destination:/topic/price.stock.*


^@
```

这就像在即时通讯软件里加入了一个群聊频道。

**发送（SEND）**——客户端说"我要发一条消息到某个地址"。比如客户端提交一个交易请求：

```plain
SEND
destination:/queue/trade
content-type:application/json
content-length:44


{"action":"BUY","ticker":"MMM","shares":44}^@
```

**广播（MESSAGE）**——服务器说"这条消息要给所有订阅了某个地址的人"。比如服务器推送给所有订阅了某只股票的用户：

```plain
MESSAGE
message-id:nxahklf6-1
subscription:sub-1
destination:/topic/price.stock.MMM


{"ticker":"MMM","price":129.45}^@
```

> **服务器不能主动给客户端发消息**。每一条服务器发出的 `MESSAGE` 都必须是响应某条客户端的 `SUBSCRIBE`，`message `里的 `subscription` 头必须和订阅时的 `id` 头匹配。这保证了消息的合法性。

### 地址约定：/topic 和 /queue

STOMP 规范并没有规定"目的地"该怎么写，地址的语义完全由服务器自己定义。

但在实际项目中有一个被广泛接受的约定：

* **`/topic/xxx`**——发布-订阅模式，一对多。发到 `/topic/price.stock.MMM` 的消息，所有订阅了 `/topic/price.stock.*` 的用户都会收到。广播用的
* **`/queue/xxx`**——点对点模式，一对一。发到 `/queue/trade` 的消息，只有指定的一个接收者会收到

## 启用STOMP

### 添加依赖

**加两个依赖。**`spring-messaging` 和 `spring-websocket`，这是 STOMP 的基础。

> 在 Spring Boot 项目里加 `spring-boot-starter-websocket` 就行，它会自动把这两个包带进来。

### 配置类

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    // 定义端点
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 定义 WebSocket 握手端点，客户端从这个地址连进来
        // 浏览器用 ws://你的域名/portfolio 来连接
        registry.addEndpoint("/portfolio");
        // 如果要兼容老浏览器，加上 SockJS 备用
        // registry.addEndpoint("/portfolio").withSockJS();
    }
    // 配置消息路由规则
    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // 以 /app 开头的消息，交给 @MessageMapping 方法处理
        config.setApplicationDestinationPrefixes("/app");
        // 以 /topic 或 /queue 开头的消息，交给内置 Broker 广播或点对点发送
        config.enableSimpleBroker("/topic", "/queue");
    }
}
```

> 前端的连接方式也很轻量：用 `stomp-js/stompjs` 这个库，new 一个 Client 填上 `brokerURL: 'ws://domain.com/portfolio'`，然后在 `onConnect` 回调里写订阅逻辑就行了。客户端不需要传用户名密码，服务端会忽略（或者说覆盖）这些参数，认证另有专门的机制。

## 配置服务器传输参数

### 服务器的全局参数

如果是`Jakarta WebSocket`容器。配置缓冲区和超时。

```java
@Bean
public ServletServerContainerFactoryBean createWebSocketContainer() {
    ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
    // 缓冲区
    container.setMaxTextMessageBufferSize(8192);
    container.setMaxBinaryMessageBufferSize(8192);
    // 超时
    container.setMaxSessionIdleTimeout(60000L);
    return container;
}
```

### STOMP专用传输属性

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

	@Override
	public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
		registry.setMessageSizeLimit(4 * 8192);
		registry.setTimeToFirstMessage(30000);
	}
}
```

**`setMessageSizeLimit`**——单条 STOMP 消息的最大字节数。默认值可能偏小，如果业务消息比较大（比如带 Base64 图片或长文本内容），需要调大。这里设的是 `4 * 8192 = 32768` 字节，约 32KB。这个参数只在 STOMP 层生效，不影响底层 WebSocket 的缓冲区大小。

**`setTimeToFirstMessage`**——客户端连接之后，必须在多少毫秒内发送第一条 STOMP 消息（比如 CONNECT 帧）。如果超过这个时间还没发，服务器会断开连接。默认是 `-1`（不限），生产环境建议设一个值来防止那些"连上来啥也不做"的僵尸连接。这里设了 30000 毫秒（30 秒）。

这两个参数分别对应"消息能不能传过去"和"连接是不是活的"，是 STOMP 生产部署中最实用的两个调优点。

## 消息流程

例子：

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/portfolio");
    }
    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.enableSimpleBroker("/topic");
    }
}
```

```java
@Controller
public class GreetingController {
    @MessageMapping("/greeting")
    public String handle(String greeting) {
        return "[" + new Date() + "]: " + greeting;
    }
}
```

完整路径流程：

* **第一步：连上线。** 浏览器用 WebSocket 连到 `localhost:8080/portfolio`。连上之后，STOMP 帧就开始在这条连接上跑了。
* **第二步：订阅。** 浏览器发了一条 SUBSCRIBE 帧，目标地址是 `/topic/greeting`。这条消息进来之后被解码成 Spring 内部的 Message 对象，送入`clientInboundChannel`（入站通道）。路由检查发现目的地是以 `/topic` 开头的，直接交给内置的 Broker，Broker 把这次订阅记录下来——"这个客户端想听 /topic/greeting 的消息"。
* **第三步：发送消息到业务代码。** 浏览器发了一条 SEND 帧，目标地址是 `/app/greeting`。消息同样进入`clientInboundChannel`，但这次路由发现是以 `/app` 开头的，于是把 `/app` 前缀剥掉，用剩下的 `/greeting` 去匹配 `@MessageMapping("/greeting")` 方法，交给你的代码处理。这里你的 `handle` 方法就拿到了用户发来的问候语。
* **第四步：返回值自动转为广播。** 你的 `handle` 方法返回了一个字符串（比如 `[09/11/2026 3:23:12 PM]: 大家好`）。Spring 自动把这个返回值包装成一条新的 Message，然后把目标地址从输入的 `/app/greeting` 自动推导为 `/topic/greeting`（把 `/app` 替换成了 `/topic`）。这条消息被送入 `brokerChannel`（Broker通道），交给内置的 Broker。
* **第五步：Broker 广播给所有人。** Broker 查了一下订阅列表，发现有人订阅了 `/topic/greeting`，于是通过 `clientOutboundChannel`（出站通道）给每个订阅的客户端发一条 MESSAGE 帧。这些帧在 WebSocket 连接上被推送到浏览器，前端 `subscribe` 的回调函数就能收到消息了。

## 注解控制器

### @MessageMapping

@MessageMapping——"收到指定地址的消息，进这个方法处理"

客户端发到 `/app/greeting` 的消息，进入标注了 `@MessageMapping("/greeting")` 的方法。

路径模式支持 Ant 风格通配符（`/thing/*`、`/thing/**`）也支持路径变量（`/thing/{id}`），路径变量的值用 `@DestinationVariable` 取出来。

**方法参数**可以写什么：

* **`@Payload`**——消息正文，Spring 会自动帮你做 JSON 反序列化（就像 `@RequestBody`）。这个注解可以不写，只要其他参数没匹配上，Spring 默认就把正文当作 payload
* **`@Header` 和 `@Headers`**——取某个 STOMP 消息头的值，或者取全部消息头。支持自动类型转换
* **`@DestinationVariable`**——从地址路径中提取变量，比如 `/room/{roomId}` 里取 roomId
* **`java.security.Principal`**——拿到当前登录用户的信息。WebSocket 握手时认证过的用户会注入到这里，做私聊、鉴权非常好用
* **`Message` / `MessageHeaders` / `StompHeaderAccessor`**——如果你需要操纵完整的消息对象或底层 STOMP 帧头

**返回值**

默认行为非常巧妙：方法返回的东西，Spring 自动包装成一条消息，推到 `brokerChannel`，然后 Broker 广播给所有订阅者。广播的目标地址默认就是把输入地址的 `/app` 换成 `/topic`——你收到 `/app/greeting`，返回值就发到 `/topic/greeting`。

两个注解可以覆盖这个默认行为：

* **`@SendTo("/topic/xxx")`**——指定广播到哪个地址，也支持指定多个地址
* **`@SendToUser("/queue/xxx")`**——只发给当前用户一个人，不是广播。典型的"私信"场景

> 这两个注解可以写在方法上（覆盖），也可以写在类上（整个类的默认值）。如果觉得注解不够灵活，还可以直接注入 `SimpMessagingTemplate` 自己控制发消息的时机和内容。

### @SubscribeMapping

这是 `@MessageMapping` 的变体，但它只处理 SUBSCRIBE 帧（订阅请求），不处理普通的 SEND 帧。关键在于**默认行为不同**：`@SubscribeMapping` 的返回值不是进 Broker 广播，而是直接通过 `clientOutboundChannel` 发给发起订阅的那一个客户端，一次性的，不经过 Broker。

**示例**：

```javascript
const client = new StompJs.Client({ brokerURL: 'ws://localhost:8080/chat' });
client.onConnect = () => {
  // 订阅消息频道，持续接收
  client.subscribe('/topic/room/123/messages', msg => {
    // 显示新消息...
  });
  // 发订阅到 /app 地址，服务端回复一次在线用户列表
  client.subscribe('/app/room/123/users', msg => {
    const users = JSON.parse(msg.body);
    // 显示在线用户...（只触发一次）
  });
};
client.activate();
```

服务端代码：

```java
@Controller
public class RoomController {

    // 有人订阅 /app/room/{roomId}/users 时触发，回复一次当前在线用户
    @SubscribeMapping("/room/{roomId}/users")
    public List<String> getOnlineUsers(@DestinationVariable String roomId) {
        // 查数据库或 Redis 里的在线用户列表，直接返回
        // 这个返回值只会发给这一个客户端，不经过 Broker 广播
        return roomService.getOnlineUsers(roomId);
    }

    // 处理聊天消息（持续推送走 /topic，跟 @SubscribeMapping 是两条路）
    @MessageMapping("/room/{roomId}/message")
    @SendTo("/topic/room/{roomId}/messages")
    public ChatMessage handleMessage(@Payload ChatMessage msg) {
        return msg;
    }
}
```

### @MessageExceptionHandler

@MessageExceptionHandler——" @MessageMapping 方法抛异常了，来这里处理"

跟 Spring MVC 的 `@ExceptionHandler` 完全一致，写在 Controller 里只管这个类，写在 `@ControllerAdvice` 标注的类里全局生效。支持的方法参数和返回值和 `@MessageMapping` 一样灵活，可以拿到异常实例然后返回一个错误对象发给客户端。

## 发送消息`SimpMessagingTemplate` 

`SimpMessagingTemplate` 在任何地方都能往 WebSocket 客户端推送消息——不限于 `@MessageMapping` 方法，甚至在普通的 HTTP 接口里也能触发广播

之前看到的模式全是"客户端发消息 -> `@MessageMapping` 方法处理 -> 返回值广播出去"，所有流程都绑定在 STOMP 消息的收发链条上。但现实中有很多情况你需要*从别的地方主动推消息*——比如用户通过 HTTP 提交了一个表单，你处理完之后想广播一条通知给所有在线的 WebSocket 客户端。`SimpMessagingTemplate` 就是干这个的。

示例：

```java
@Controller
public class GreetingController {

    private SimpMessagingTemplate template;

    @Autowired
    public GreetingController(SimpMessagingTemplate template) {
        this.template = template;
    }

    @PostMapping("/greetings")
    public void greet(String greeting) {
        String text = "[" + getTimestamp() + "]:" + greeting;
        this.template.convertAndSend("/topic/greetings", text);
    }
}
```

这是一个普通的 `@PostMapping` 方法，不是 `@MessageMapping`。

用户通过 HTTP POST 提交了数据，处理完之后，调用 `template.convertAndSend("/topic/greetings", text)`，这条消息就通过 `brokerChannel` 进了 Broker，然后广播给所有订阅了 `/topic/greetings` 的 WebSocket 客户端。

`SimpMessagingTemplate` 的场景：

* 在普通的 `@PostMapping` 或 `@GetMapping` 方法里触发 WebSocket 广播
* 在定时任务（`@Scheduled`）里推送定时消息，比如每隔几秒推送一次股票价格
* 在事件监听器里，监听到某个业务事件发生后推送通知
* 在 Service 层或 Repository 层，处理完数据变更后通知前端刷新

> 如果需要注入时指定名字，Spring 把这个 bean 的名字叫做 `brokerMessagingTemplate`，可以用 `@Qualifier("brokerMessagingTemplate")` 来限定，避免和其他同类型的 bean 混淆。

## 用户目标地址

### 前端订阅

```javascript
// 前端订阅，用的是通用地址
client.subscribe('/user/queue/position-updates', msg => {
  // 只有当前用户能收到
});
```

写的是 `/user/queue/position-updates`，但 Spring 的后台组件 `UserDestinationMessageHandler`(识别`/user`前缀) 会在收到这条订阅时，根据当前认证用户的信息，把它悄悄转成一个**只有这个用户会话独有的地址**，比如 `/queue/position-updates-user123`。这样不同用户订阅同样的 `/user/queue/position-updates`，实际在 Broker 里注册的是不同的私有地址，不会串消息。

### 发送端两个方式

**方式一：注解方式。**`@MessageMapping` 方法处理完消息后，用 `@SendToUser` 把结果只发给当前用户：

```java
@MessageMapping("/trade")
@SendToUser("/queue/position-updates")
public TradeResult executeTrade(Trade trade, Principal principal) {
    // 处理交易...
    return tradeResult;
}
```

这条结果只会发给发起这次交易的这一个用户，不会广播给所有人。

**方式二：编程方式。** 在 Service 层或者其他任何组件里，用 `SimpMessagingTemplate` 的 `convertAndSendToUser` 方法：

```java
this.messagingTemplate.convertAndSendToUser(
    trade.getUserName(), "/queue/position-updates", trade.getResult());
```

第一个参数是目标用户的用户名，第二个是通用地址。Spring 会自动把用户名拼进去，找到该用户的所有 WebSocket 会话并推送。

### 多设备场景

广播还是只发当前会话？

如果一个用户同时在手机和电脑上登录了两个 WebSocket 会话，默认情况下发到 `/user/xxx` 的消息**两个设备都能收到**。如果你只想发到"当前发消息的那个会话"（比如错误通知只需要通知用户当前操作的那个页面），可以关掉广播：

```java
@SendToUser(destinations="/queue/errors", broadcast=false)
```

## 简单的代理服务器

Simple Broker 的工作： 接订阅、存列表、做广播 。

* 客户端发一条 SUBSCRIBE 帧到 `/topic/news`，Simple Broker 就在内存里记下一笔："这个 WebSocket 连接订阅了 /topic/news"。
* 然后有人通过 `SimpMessagingTemplate.convertAndSend("/topic/news", data)` 或者 `@SendTo("/topic/news")` 发了一条消息到 `/topic/news`，Broker 就查一遍内存里的订阅表，找到所有订阅了这个地址的客户端，挨个把消息推过去。就这么简单。  

```java
config.enableSimpleBroker("/topic", "/queue");
```

这行干的事就是：启动一个"广播员"，它只做三件事：

1. **记订阅**——客户端说"我要听 `/topic/news`"，Broker 就记住"这个连接想听这个频道"
2. **收消息**——有人往 `/topic/news` 发了一条消息（比如通过 `SimpMessagingTemplate.convertAndSend`）
3. **查表推送**——Broker 翻一下自己记的那张表，找到所有订阅了 `/topic/news` 的连接，挨个推过去

**它就是一个看守内存列表的东西**。发给 `/topic/xxx` 的消息不会经过你的 Controller 代码，直接进 Broker，由它广播出去。

## 外部代理服务器

之前 Simple Broker 的架构是：

```plain
客户端 -> WebSocket -> Simple Broker（在应用内存里做广播）
```

换成 External Broker 之后变成：

```plain
客户端 -> WebSocket -> Broker Relay（Spring 里的一个组件）-> TCP 连接 -> RabbitMQ / ActiveMQ（外部专业 Broker）
```

配置外部代理服务器(*MQ的依赖和配置是前提*)：

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

	@Override
	public void registerStompEndpoints(StompEndpointRegistry registry) {
		registry.addEndpoint("/portfolio").withSockJS();
	}

	@Override
	public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Simple Broker 配置
        // registry.enableSimpleBroker("/topic", "/queue");
        // 换成外部 Broker 就改成：
		registry.enableStompBrokerRelay("/topic", "/queue");
		registry.setApplicationDestinationPrefixes("/app");
        //如果MQ不在默认地址，还需要指定MQ地址和端口等信息
        /*
        registry.enableStompBrokerRelay("/topic", "/queue")
            .setRelayHost("192.168.1.100")
            .setRelayPort(61613)
            .setSystemLogin("admin")
            .setSystemPasscode("admin")
            .setClientLogin("admin")
            .setClientPasscode("admin");
        registry.setApplicationDestinationPrefixes("/app");
        */
	}

}
```

就改一个方法名。其他的 `@MessageMapping`、`@SendTo`、`SimpMessagingTemplate` 全都不用动。

**需要的额外依赖：** 两个依赖来管理 TCP 连接，`reactor-netty` 和 `netty-all`。因为 Broker Relay 是通过 TCP 跟 RabbitMQ 通信的，不是 HTTP。如果是 Spring Boot 项目，加 `spring-boot-starter-reactor-netty` 就行。  

> ***权限控制：***
>
> **`systemLogin/systemPasscode`**——管的是那条"系统连接"。你的 `@PostMapping`、`@Scheduled`、Service 层调 `SimpMessagingTemplate.convertAndSend()` 时，消息走这条连接发给 MQ。全局只有一条。
>
> **`clientLogin/clientPasscode`**——管的是"客户端连接"。每个 WebSocket 客户端连上来时，Broker Relay 会替它在 MQ 那边创建一条独立的 TCP 连接，这条连接用的就是 `clientLogin/clientPasscode`。有多少个 WebSocket 客户端，MQ 那边就有多少条用这个身份建立的连接。

## 令牌身份验证

使用场景： Cookie 不好使时，比如前后端分离的项目压根不维护服务端 Session。这时候前端一般是通过 Header 传 JWT 令牌来认证的。

**绕过 HTTP 层，直接在 STOMP 协议层做认证。**

做法分两步：

* **第一步：前端在连接时把令牌放在 STOMP 的 CONNECT 帧里。** 很多 STOMP 客户端（包括 stompjs）允许你在 connect 时传自定义 header。前端发出来的 CONNECT 帧就会带上类似 `Authorization: Bearer xxx` 这样的头。
* **第二步：后端写一个 ChannelInterceptor，拦截 CONNECT 帧做认证。** 在 `configureClientInboundChannel` 里注册一个拦截器，检查 CONNECT 命令，从 STOMP 消息头里取出令牌，验证通过后调用 `accessor.setUser(user)` 把认证用户设上去。一旦设好了，后续这条连接上的所有消息都会自动带上这个用户信息。

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
    registration.interceptors(new ChannelInterceptor() {
        @Override
        public Message<?> preSend(Message<?> message, MessageChannel channel) {
            StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
            if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                // 从消息头取出令牌，验证后调用 accessor.setUser(user)
                String token = accessor.getFirstNativeHeader("Authorization");
                // 解析 token，构造 Principal，设回去
                accessor.setUser(parsedUser);
            }
            return message;
        }
    });
    }
}
```

> 如果同时用了 Spring Security 的消息级权限控制，这个自定义的认证拦截器得配在 Spring Security 的拦截器前面，保证先认证后鉴权。方法是在 `WebSocketMessageBrokerConfigurer` 上加 `@Order(Ordered.HIGHEST_PRECEDENCE + 99)`。

## 消息顺序

Spring STOMP 默认不保证消息顺序，想要保序就得手动开两个开关，但会牺牲一点性能

原因在于三个消息通道（`clientInboundChannel`、`clientOutboundChannel`、`brokerChannel`）背后都是 `ThreadPoolExecutor` 线程池在驱动。消息进入通道后会被分配到不同的线程去处理，谁先跑完谁先出去，顺序就乱了。

Spring 给了两个开关来解决这个问题，一个管"发"，一个管"收"。

* **`setPreservePublishOrder(true)`**——配在 `configureMessageBroker` 里，管服务端往外发的顺序。开了之后，同一个 WebSocket 会话的消息会排队依次写入 `clientOutboundChannel`，前一条处理完才处理下一条，保证推送到浏览器的顺序和发布的顺序一致。
* **`setPreserveReceiveOrder(true)`**——配在 `registerStompEndpoints` 里，管服务端收到的顺序。开了之后，同一个客户端发来的消息会排队依次进入 `clientInboundChannel` 处理，保证你的 `@MessageMapping` 方法处理消息的顺序和客户端发送的顺序一致。

> 两个开关默认都是关的。文档专门提醒了：保序会带来一点性能开销，因为本来可以并行处理的消息变成了串行。只在需要严格保序的场景下才开——比如炒股软件里"先下单后撤单"这种操作必须保持顺序。像普通的聊天室，消息顺序乱一点不影响用户体验，就别开。

示例：

```java
@Configuration
@EnableWebSocketMessageBroker
public class PublishOrderWebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

	@Override
	public void configureMessageBroker(MessageBrokerRegistry registry) {
		// ...
		registry.setPreservePublishOrder(true);
	}

}
//---------------------------------------------------------------
@Configuration
@EnableWebSocketMessageBroker
public class ReceiveOrderWebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

	@Override
	public void registerStompEndpoints(StompEndpointRegistry registry) {
		registry.setPreserveReceiveOrder(true);
	}
}
```

## 事件回调

Spring STOMP 会发布 6 种应用事件，只要实现 `ApplicationListener` 就能监听——从客户端连接到断开、从 Broker 可用到不可用，全都通知到位

这些事件相当于 Spring 在 STOMP 运行过程中给你的"回调通知"，在关键时刻插入自己的逻辑。一共 6 种，按生命周期排下来：

1. **`BrokerAvailabilityEvent`**——Broker（无论是 Simple Broker 还是外部的 RabbitMQ）的可用状态变了。应用启动时 Broker 立即可用，但如果用的是外部 MQ，MQ 挂了又恢复了，这个事件就会触发两次——一次通知你"不可用"，一次通知你"又好了"。你监听这个事件之后，可以在 MQ 不可用时暂停发消息，不用等到抛异常了再处理。
2. **`SessionConnectEvent`**——服务器收到了客户端发来的 CONNECT 帧，表示连接请求进来了。事件里带着完整的消息内容，包括 session ID、用户信息和客户端传来的自定义头。如果你想在连接正式建立前干点什么（比如记日志），在这里做。
3. **`SessionConnectedEvent`**——上面那个事件之后，Broker 回复了 CONNECTED 帧，此时连接才算真正建立了。如果你想在连接完全建立后再做事（不是"收到了请求"而是"已成功建立"），监听这个。
4. **`SessionSubscribeEvent`**——收到了 SUBSCRIBE 帧，有人订阅了某个地址。
5. **`SessionUnsubscribeEvent`**——收到了 UNSUBSCRIBE 帧，有人取消了订阅。
6. **`SessionDisconnectEvent`—**—会话结束了。可能是客户端主动发的 DISCONNECT，也可能是 WebSocket 连接关闭时自动生成的。文档特别说了一个要注意的点：一个会话可能多次触发这个事件，所以你的监听代码得是幂等的（跑一次和跑多次效果一样）。

> 如果你用外部 Broker，**客户端连接不会自动重连**。Broker Relay 的系统连接会自动重连（MQ 重启了它能自动连回去），但每个 WebSocket 客户端的连接不会。如果 MQ 挂了又恢复，客户端的连接已经断了，需要前端自己实现重连逻辑。心跳默认 10 秒发一次，客户端一般 10 秒内就能感知到 MQ 不在了。

## 拦截器

**方法一：**

**`ChannelInterceptor`**——每次消息发送到通道时触发一次。适合做消息检查、日志记录、拒绝某些消息。在 Token 认证那篇里你见过它的用法：拦截 CONNECT 帧，取出令牌做认证，调用 `accessor.setUser(user)` 把用户身份设上去。

```java
public class MyChannelInterceptor implements ChannelInterceptor {
    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(message);
        StompCommand command = accessor.getCommand();
        // 检查或修改消息...
        return message; // 返回 null 就拦下来了
    }
}
```

**方式二：**

**`ExecutorChannelInterceptor`——是 `ChannelInterceptor` 的子接口，回调在执行消息处理的那个线程**里触发。区别在于：`ChannelInterceptor` 只管"消息进了通道"这个瞬间，而 `ExecutorChannelInterceptor` 可以拿到消息被实际处理的那个线程上下文，提供更细粒度的回调（比如处理前、处理后、处理完成）。

**注册：**

跟配置 STOMP 的其他东西一样，在 `WebSocketMessageBrokerConfigurer` 里：

```java
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfiguration implements WebSocketMessageBrokerConfigurer {

	@Override
	public void configureClientInboundChannel(ChannelRegistration registration) {
		registration.interceptors(new MyChannelInterceptor());
	}
}
```

三个通道都可以配拦截器：

* `configureClientInboundChannel` 拦客户端发来的消息
* `configureClientOutboundChannel` 拦发往客户端的消息

## STOMP Clinent

`WebSocketStompClient` 是 Spring 官方提供的 Java STOMP 客户端，在 Java 代码里也能**像浏览器一样**连 WebSocket 收发 STOMP 消息——服务器对服务器通信、集成测试、模拟并发用户，全靠它

**第一步：创建客户端，配置消息转换器和心跳**

```java
WebSocketClient webSocketClient = new StandardWebSocketClient();
WebSocketStompClient stompClient = new WebSocketStompClient(webSocketClient);
stompClient.setMessageConverter(new StringMessageConverter());
stompClient.setTaskScheduler(taskScheduler); // 心跳需要
```

`StandardWebSocketClient` 是标准 JSR-356 实现。如果要兼容 SockJS，换成 `SockJsClient` 就行。

**第二步：连上服务器**

```java
String url = "ws://127.0.0.1:8080/endpoint";
StompSessionHandler sessionHandler = new MyStompSessionHandler();
stompClient.connect(url, sessionHandler);
```

**第三步：连接建立后，发消息和订阅**

```java
public class MyStompSessionHandler extends StompSessionHandlerAdapter {
    @Override
    public void afterConnected(StompSession session, StompHeaders connectedHeaders) {
        // 发消息
        session.send("/topic/something", "payload");
        // 订阅，收到消息时回调
        session.subscribe("/topic/something", new StompFrameHandler() {
            @Override
            public Type getPayloadType(StompHeaders headers) {
                return String.class;
            }
            @Override
            public void handleFrame(StompHeaders headers, Object payload) {
                // 处理收到的消息
            }
        });
    }
}
```

## WebSocket 作用域

**WebSocket Scope 让每个 WebSocket 会话拥有独立、隔离的 Bean 实例**，就像每个用户连接进来，Spring 就自动为它创建一个专属的"小盒子"存放状态数据，连接断开时盒子自动销毁。这样既能安全地保存连接级别的数据，又能享受 Spring 完整的依赖注入和生命周期管理。

### 定义一个 WebSocket 作用域的 Bean

```java
@Component
@Scope(scopeName = "websocket", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class MyBean {
    @PostConstruct
    public void init() {
        // WebSocket 连接建立后，第一次被用到时触发
    }

    @PreDestroy
    public void destroy() {
        // WebSocket 连接关闭时触发
    }
}
```

这里有一个关键细节：**`proxyMode = ScopedProxyMode.TARGET_CLASS`。为什么需要代理？因为注入 `MyBean` 的控制器通常是单例**（在整个应用生命周期内只创建一次），而 WebSocket 作用域的 Bean 需要在每个会话中单独创建。代理模式解决了这个矛盾——控制器持有的是一个"替身"（代理对象），每次调用方法时，代理会去当前 WebSocket 会话中查找真正的实例。

### 注入到控制器中

```java
@Controller
public class MyController {

    private final MyBean myBean;

    @Autowired
    public MyController(MyBean myBean) {
        this.myBean = myBean;  // 注入的是代理，不是真正的实例
    }

    @MessageMapping("/action")
    public void handle() {
        // 每次调用 myBean 时，代理都会从当前 WebSocket 会话中取出对应的实例
        myBean.doSomething();
    }
}
```

### Spring 在背后做的事情

* **首次访问**：控制器中的代理检测到当前 WebSocket 会话还没有 `MyBean` 实例，于是创建一个新的，存入会话属性中，然后返回给调用方
* **后续访问**：同一会话中再次调用，代理直接从会话属性中取出已有的实例返回
* **连接关闭**：Spring 监听 WebSocket 会话的关闭事件，自动调用 `@PreDestroy` 方法，清理资源

***

**如果不用`WebScoket`作用域，则需要手动操作 `SessionAttributes`：**

```java
@MessageMapping("/action")
public void handle(SimpMessageHeaderAccessor headerAccessor) {
    Map<String, Object> attrs = headerAccessor.getSessionAttributes();
    MyBean myBean = (MyBean) attrs.get("myBean");
    if (myBean == null) {
        myBean = new MyBean();
        attrs.put("myBean", myBean);
    }
    myBean.doSomething();
}
```

而有了 WebSocket 作用域，这一切都变成了声明式的，框架替你完成了上述样板代码。

## 监控

**Spring STOMP 自带一个"仪表盘"，每 30 分钟自动出一份体检报告，告诉你系统内部在发生什么**

你只要用了 `@EnableWebSocketMessageBroker`，Spring 就会自动开始收集各个组件的运行指标，汇总到一个叫 `WebSocketMessageBrokerStats` 的 Bean 里，**默认每 30 分钟以 INFO 级别打印一次日志**。还可以通过 JMX 导出，用 jconsole 实时看。

说白了就是：不用你自己埋点打日志，Spring 已经把该看的指标都准备好了。

## 测试

[STOMP测试文档跳转](https://docs.spring.io/spring-framework/reference/6.2/web/websocket/stomp/testing.html)

**测试 Spring STOMP 消息处理器，核心就是两条路：服务端切片测，端到端整盘测**

> 纯单元测试对 STOMP 控制器基本没用——因为控制器的行为高度依赖它的注解（比如 `@MessageMapping`），你没法 mock 掉这些东西然后指望测出什么有意义的结果。所以 Spring 提供了两种正经的测试方式：一种是不启动容器的服务端测试，另一种是启动真实 WebSocket 服务器和客户端的端到端测试。两者不互斥，各有各的用处。
