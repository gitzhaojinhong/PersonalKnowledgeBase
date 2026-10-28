## 异步请求

## 非流式返回

### DeferredResult 由外部事件触发结果

这是最灵活的异步方式。`DeferredResult`就像一个"空盒子"，控制器先把它返回，然后在某个合适的时机（比如收到JMS消息、定时任务触发、另一个线程处理完毕），由你手动往盒子里塞结果。

```java
@GetMapping("/quotes")
@ResponseBody
public DeferredResult<String> quotes() {
    DeferredResult<String> deferredResult = new DeferredResult<>();
    // 把deferredResult存到某个地方，比如一个队列里
    return deferredResult;
}


// 在另一个线程里，比如消息监听器里：
deferredResult.setResult("最终结果");
```

此时Servlet线程早已"下班"，业务代码在任意线程里调用`setResult`后，Spring MVC会自动发起一次ASYNC分发，重新进入DispatcherServlet的处理流程，就像控制器刚刚返回了这个值一样。

### Callable 交给线程池去跑

`Callable`更简单直接：返回一个`Callable`对象，Spring MVC把它提交给配置好的`AsyncTaskExecutor`（默认是`SimpleAsyncTaskExecutor`），在另一个线程里执行，执行完后自动把结果返回。

```java
@PostMapping
public Callable<String> processUpload(final MultipartFile file) {
    return () -> {
        // 耗时的处理逻辑...
        return "someView";
    };
}
```

### WebAsyncTask 增强版Callable

`WebAsyncTask`在`Callable`的基础上，允许你自定义超时时间和专用的`AsyncTaskExecutor`，而不是使用全局默认配置。

```java
@GetMapping("/callable")
WebAsyncTask<String> handle() {
    return new WebAsyncTask<>(20000L, () -> {
        Thread.sleep(10000);
        return "异步请求完成";
    });
}
```

### 处理流程详解

Spring MVC内部的异步处理流程是这样的：

1. 控制器返回`DeferredResult`或`Callable`后，Spring MVC调用`request.startAsync()`将请求置为异步模式
2. `DispatcherServlet`和所有Filter退出当前线程（但响应连接保持打开）
3. 对于`DeferredResult`：等待外部线程调用`setResult()`；对于`Callable`：提交给`AsyncTaskExecutor`执行
4. 结果就绪后，Spring MVC发起一次ASYNC分发回到Servlet容器
5. `DispatcherServlet`再次被调用，用异步产生的结果恢复处理流程

> **异常处理**：`DeferredResult`可以调用`setErrorResult(exception)`，`Callable`可以直接抛出异常，两者都会走常规的异常处理机制（如`@ExceptionHandler`）。

## 流式返回

### ResponseBodyEmitter 流式发送对象

```java
@GetMapping("/events")
public ResponseBodyEmitter handle() {
    ResponseBodyEmitter emitter = new ResponseBodyEmitter();
    // 存起来，在别的地方调用
    return emitter;
}


// 在其他线程中：
emitter.send("第一条消息");
emitter.send("第二条消息");
emitter.complete(); // 结束
```

每个对象都会通过`HttpMessageConverter`序列化后写入响应。

### SseEmitter 服务器推送事件

`SseEmitter`是`ResponseBodyEmitter`的子类，按照W3C的SSE规范格式化数据，非常适合浏览器端使用`EventSource API`接收：

```java
@GetMapping(path = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public SseEmitter handle() {
    SseEmitter emitter = new SseEmitter();
    // 使用方式同上
    return emitter;
}
```

### StreamingResponseBody 直接写原始流

绕过消息转换，直接往`OutputStream`里写数据，适合文件下载等场景：

```java
@GetMapping("/download")
public StreamingResponseBody handle() {
    return outputStream -> {
        // 直接写二进制数据到outputStream
    };
}
```


> 更新: 2026-09-22 16:14:13  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/egdchb/bp9racdgqs1gpd8p>