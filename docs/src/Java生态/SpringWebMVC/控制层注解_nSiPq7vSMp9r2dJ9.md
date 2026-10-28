## 控制层注解

## 类声明

@Controller 和 @RestController 就是声明"这个类是 Spring MVC 的控制器"的方式，让 Spring 知道它负责处理 HTTP 请求

* @Controller——传统方式，用于返回视图页面
* @RestController——前后端分离，直接返回 JSON

## 请求映射

Mapping Requests 就是通过 **`@RequestMapping`** 及其快捷注解，告诉 Spring"什么样的请求应该交给哪个 Controller 方法去处理"

推荐：

* 类级别使用`@RequestMapping("/persons")`
* 方法级别使用`@RequestMapping`的专用快捷注解`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@PatchMapping`

**URI模式匹配**

| 模式 | 含义 | 例子 |
| --- | --- | --- |
| `/spring` | 精确匹配 | 匹配 `/spring` |
| `?` | 匹配一个字符 | `/pages/t?st.html`匹配 `/pages/test.html` 和 `/pages/t3st.html` |
| `*` | 匹配一个路径段内的零个或多个字符 | `/resources/*.png`匹配 `/resources/file.png`，但不匹配 `/resources/images/file.png` |
| `**` | 匹配零个或多个路径段 | `/resources/**`匹配 `/resources`、`/resources/file.png`、`/resources/images/file.png` |
| `{name}` | 路径变量，捕获一个路径段 | `/projects/{project}/versions`匹配 `/projects/spring/versions`，捕获 `project=spring` |
| `{name:regex}` | 带正则约束的路径变量 | `/projects/{project:[a-z]+}/versions`只匹配纯字母的 project 名 |
| `{*path}` | 匹配多个路径段并捕获 | `/resources/{*file}`匹配 `/resources/images/file.png`，捕获 `file=/images/file.png` |

> 当多个模式都能匹配同一个 URL 时，Spring 会选择"最具体"的那个。具体规则是：
>
> * 路径变量（`{name}`）算 1 分，单通配符（`*`）算 1 分，双通配符（`**`）算 2 分
> * 分数越低越具体，排前面
> * 分数相同，选路径更长的
> * 分数和长度都相同，选路径变量多于通配符的
> * `/**` 永远排最后

**注解参数缩小匹配范围：**

* **`consumes`——按请求的 Content-Type 过滤**

指定方法只处理特定 Content-Type 的请求。如果客户端发来的请求 Content-Type 不匹配，这个方法就不会被选中。

* **`produces`——按客户端期望的响应类型（Accept 头）过滤**

指定方法只生产特定类型的响应。客户端通过 `Accept` 头告诉服务器它想要什么格式，只有匹配的方法才会被选中。

* **`params`——按请求参数过滤**

根据请求中是否存在某个参数、参数的值是否等于某个值来决定是否匹配。

* **`headers`——按请求头过滤**

根据请求头是否存在、值是否等于某个值来决定是否匹配。

***

> **`@HttpExchange`——`@RequestMapping` 的替代方案**
>
> `@HttpExchange` 是 Spring 6 引入的另一种映射方式，它在服务端 Controller 上可以作为 `@RequestMapping` 的替代。它的特点是声明一个具体的端点（明确的 HTTP 方法、路径、内容类型），而不是像 `@RequestMapping` 那样可以灵活匹配多种请求。它通常与 HTTP 接口（HTTP Interface）结合使用，在 Spring Cloud 中比较常见，适合内部 API 的客户端和服务端共享同一套接口定义。

## 处理器方法参数

Handler Methods 就是 Spring MVC Controller 方法里，你能在参数列表里写什么、在返回值里写什么

[处理器方法文档跳转](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-controller/ann-methods.html)

### 请求参数取数据

| 注解/类型 | 从哪里取数据 | 示例 |
| --- | --- | --- |
| `@PathVariable` | URL 路径变量 | `/user/{id}`中的 `{id}` |
| `@RequestParam` | 查询参数或表单字段 | `?name=张三`中的 `name` |
| `@RequestHeader` | 请求头 | `Accept`、`Authorization`等 |
| `@CookieValue` | Cookie | 从请求的 Cookie 中取值 |
| `@RequestBody` | 请求（JSON/XML） | 整个请求体反序列化成 Java 对象 |
| `@ModelAttribute` | 多个来源绑定到对象 | 表单数据自动绑定到 Java 对象 |
| `@RequestAttribute` | request 作用域属性 | 由 Filter 或拦截器设置到 request 的属性 |
| `@RequestPart` | 拿 multipart 请求体 里某个分片（Part）的数据   | 从请求体中取出一个分片反序列化 |

### 请求参数拿Servlet原生对象

| 类型 | 作用 |
| --- | --- |
| `HttpServletRequest` / `HttpServletResponse` | 直接操作 Servlet 请求和响应 |
| `HttpSession` | 获取当前会话 |
| `Principal` | 获取当前认证用户信息 |
| `HttpMethod` | 获取请求的 HTTP 方法 |
| `Locale` | 获取当前请求的区域设置 |
| `TimeZone` / `ZoneId` | 获取当前请求的时区 |
| `InputStream` / `Reader` | 读取请求体原始内容 |
| `OutputStream` / `Writer` | 写入响应体原始内容 |

### 其他常用的

| 类型 | 作用 |
| --- | --- |
| `MultipartFile` | 接收上传的文件 |
| `BindingResult` | 获取参数校验结果，必须在被校验的对象后面紧跟着声明 |
| `SessionStatus` | 标记会话处理完成，清除 `@SessionAttributes`中的属性 |
| `UriComponentsBuilder` | 构建当前请求相关的 URI |
| `RedirectAttributes` | 重定向时传递属性 |
| `Model` / `Map` / `ModelMap` | 向视图传递数据 |

### 方法返回值

| 返回值 | 行为 |
| --- | --- |
| `String` | 返回逻辑视图名，由 ViewResolver 解析 或者 返回 `redirect:`或 `forward:`前缀开头的字符串做跳转 |
| `void` | 方法自己通过 `HttpServletResponse`写入响应体，不需要 Spring 帮你渲染 |
| `ModelAndView` | 同时返回视图名和模型数据 |
| `@ResponseBody`
 注解的方法返回任意对象 | 自动序列化为 JSON/XML 写到响应体（最常用） |
| `ResponseEntity<T>` | 返回响应体 + 状态码 + 响应头，完全控制响应 |
| `HttpEntity<T>` | 同上，但状态码由其他方式设置 |
| `Model`/ `Map` | 返回模型数据，视图名由 `RequestToViewNameTranslator`从请求路径推断 |
| `View` | 直接返回 View 对象，不经过 ViewResolver |
| `Callable<T>` / `WebAsyncTask` | 异步处理，Spring MVC 会把请求放到单独的线程中执行 |
| `DeferredResult<T>` | 异步处理，由其他线程设置结果 |
| `ListenableFuture<T>` / `CompletableFuture<T>` | 基于 Future 的异步处理 |


> 更新: 2026-10-23 14:26:13  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/egdchb/tzsllk01nfugstln>