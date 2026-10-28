## SockJS

SockJS 的目标是让应用能用 WebSocket 的 API，但运行时如果走不通，可以自动降级到别的传输方式，而且不需要修改任何应用代码。

具体怎么做呢？SockJS 客户端启动时会先发一个 `GET /info` 请求去探路，看看服务器支持什么、当前网络环境怎么样，然后选一个当前能用的最佳方案。选择顺序是这样的：

* **能走 WebSocket 就走 WebSocket**——一条连接，双向通信，效率最高
* **不行的话，试试 HTTP 流（Streaming）**——客户端发一个长请求挂着，服务器有消息就顺着这个连接往下写，看起来就像"流"一样。不需要反复建连
* **还不行，就用 HTTP 长轮询（Long Polling）**——最古老的方式，客户端不停地问"有消息吗"，服务器有消息就回，没有就等一会儿再回。请求多、效率低，但兼容性最好

对于绝大多数现代浏览器，至少能走到第二步。实在不行的（比如老旧的 IE），才会掉到长轮询。

## 启动SockJS

跟之前 WebSocket API 里一模一样。唯一的变化就是在注册 handler 的时候加一个 `.withSockJS()`。

```java
@Configuration
@EnableWebSocket
public class WebSocketConfiguration implements WebSocketConfigurer {

	@Override
	public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
		registry.addHandler(myHandler(), "/myHandler").withSockJS();
	}

	@Bean
	public WebSocketHandler myHandler() {
		return new MyHandler();
	}

}
```
