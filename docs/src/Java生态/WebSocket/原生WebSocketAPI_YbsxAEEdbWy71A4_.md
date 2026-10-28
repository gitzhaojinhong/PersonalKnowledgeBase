## 原生WebSocket API

#### **核心使用**

Spring 把 WebSocket 通信抽象成了极其简单的接口。只需要写一个类继承 `TextWebSocketHandler`（处理文本消息）或 `BinaryWebSocketHandler`（处理二进制消息），然后重写 `handleTextMessage` 方法，在里面写上你收到消息后要干嘛。

```java
public class MyHandler extends TextWebSocketHandler {
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        // 收到消息后的处理逻辑
    }
}
```

写完处理器之后，用 `@EnableWebSocket` + `WebSocketConfigurer` 把它注册到某个路径上就行了：

```java
@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(new MyHandler(), "/myHandler");
    }
}
```

浏览器连上 `ws://你的地址/myHandler`，就能收到消息了。

> **JSR-356 标准底层的 WebSocket 会话不允许同时发消息**。如果在高并发的场景下用 WebSocketHandler API（或者通过 STOMP 间接使用），发消息的时候必须做同步控制，不然会出问题。Spring 提供了 `ConcurrentWebSocketSessionDecorator`，把它包装一层就能解决。

#### **握手**

握手就是浏览器发那个带 `Upgrade: websocket` 的 HTTP 请求、服务器返回 `101 Switching Protocols` 的过程。Spring 允许在握手前后"插一脚"。

最简单的定制方式是用 `HandshakeInterceptor`。例子：用 `HttpSessionHandshakeInterceptor` 把 HTTP 会话里的属性自动传到 WebSocket 会话里。这样你在 WebSocket 处理器里就能直接拿到用户的登录信息之类的数据。

```java
@Configuration
@EnableWebSocket
public class WebSocketConfiguration implements WebSocketConfigurer {

	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		registry.addHandler(new MyHandler(), "/myHandler")
				.addInterceptors(new HttpSessionHandshakeInterceptor());
	}

}
```

> 如果需要更精细的控制（比如校验客户端来源、协商子协议），可以继承 `DefaultHandshakeHandler`。Spring 还自带了一个 `ExceptionWebSocketHandlerDecorator`，默认就装上了——如果处理器里抛了没捕获的异常，它会自动关闭连接并返回 1011 状态码，表示服务器内部错误。

#### **配置服务器`(调缓冲区大小和超时时间)`**

可以配置底层 WebSocket 服务器的参数。最常用的两个：**消息缓冲区大小**（超过大小会报错）和**空闲超时时间**（太久没动静自动断开连接）。

用 Tomcat 这类标准 Jakarta WebSocket 服务器的话，加个 `ServletServerContainerFactoryBean` 就行：

```java
@Bean
public ServletServerContainerFactoryBean createWebSocketContainer() {
    ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
    container.setMaxTextMessageBufferSize(8192);
    container.setMaxBinaryMessageBufferSize(8192);
    return container;
}
```

用 Jetty 的话则通过回调来配置，方式稍有不同但本质一样。

#### **允许的来源**

**限制谁能连的 WebSocket 服务器**。Spring 4.1.5 之后默认只允许同源访问（和网页在同一个域名下），这是最安全的方式。如果需要允许其他域名来连，可以手动配白名单。

三种模式：

* **仅同源（默认）**——最安全，但启用 SockJS 时会禁掉 JSONP 传输，IE6/7 不支持
* **指定域名白名单**——每个域名要以 `http://` 或 `https://` 开头，启用 SockJS 时会禁掉 IFrame 传输，IE6~9 不支持
* **允许所有（`*`）**——完全开放，所有传输方式都能用

```java
@Configuration
@EnableWebSocket
public class WebSocketConfiguration implements WebSocketConfigurer {

	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		registry.addHandler(myHandler(), "/myHandler").setAllowedOrigins("https://mydomain.com");
	}

	@Bean
	public WebSocketHandler myHandler() {
		return new MyHandler();
	}
}
```

> 这个限制主要针对浏览器客户端，其他类型的客户端可以随意伪造 `Origin` 头，所以不能把它当作唯一的安全手段。
