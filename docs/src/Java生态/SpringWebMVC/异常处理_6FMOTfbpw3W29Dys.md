## 异常处理

## @ControllerAdvice

### 注解使用

_`@ControllerAdvice`_就是为了把_`@ExceptionHandler`_、`~~@InitBinder~~`~~、~~`~~@ModelAttribute~~` 这些方法从单个 Controller 里抽出来，集中到一个地方，对所有 Controller 全局生效  。

多个 `@ControllerAdvice`，可以通过 `@Order` 注解控制它们的执行顺序。

> `@RestControllerAdvice`——前后端分离项目用的快捷注解
>
> `@RestControllerAdvice` 是 `@ControllerAdvice` + `@ResponseBody` 的组合注解。

### 限制生效范围

默认情况下，`@ControllerAdvice` 对所有 Controller 都生效。但可以通过注解属性限制它只对特定范围的 Controller 生效：

```java
// 只对标注了 @RestController 的 Controller 生效
@ControllerAdvice(annotations = RestController.class)
public class ExampleAdvice1 {}

// 只对指定包下的 Controller 生效
@ControllerAdvice("org.example.controllers")
public class ExampleAdvice2 {}

// 只对指定类型或子类的 Controller 生效
@ControllerAdvice(assignableTypes = {ControllerInterface.class, AbstractController.class})
public class ExampleAdvice3 {}
```

## @ExceptionHandler

### 注解使用

在 Controller 内部写，只处理当前 Controller 的异常：

```java
@Controller
public class SimpleController {

    @ExceptionHandler(IOException.class)
    public ResponseEntity<String> handle() {
        return ResponseEntity.internalServerError().body("文件存储读取失败");
    }
}
```

更常见的做法是写在 `@ControllerAdvice` 里，全局生效：

```java
@RestControllerAdvice
// @Order注解可用于多个@ControllerAdvice的优先级
public class GlobalExceptionHandler {

    @ExceptionHandler(IOException.class)
    public ResponseEntity<String> handleIOException(IOException ex) {
        return ResponseEntity.internalServerError().body("文件存储读取失败: " + ex.getMessage());
    }
}
```

一个重要的细节：如果你在 `@ExceptionHandler` 注解里列出了多个异常类型，但方法参数声明的是父类（比如 `Exception`），那传入的异常实例可能是**包装异常**本身，而不是你真正想匹配的那个子类。

```java
@ExceptionHandler({FileSystemException.class, RemoteException.class})
public ResponseEntity<String> handleExceptions(Exception ex) {
    // 如果 FileSystemException 被包装在另一个 IOException 里抛出，
    // 那 ex 可能是那个包装异常，而不是 FileSystemException 本身
    // 真正的匹配异常需要通过 ex.getCause() 获取
}
```

### `produces`指定响应头

`@ExceptionHandler` 支持 `produces` 属性，让你可以根据客户端期望的响应类型（`Accept` 头）返回不同的错误格式。比如 API 客户端返回 JSON，浏览器返回 HTML 页面：

```java
@ExceptionHandler(produces = "application/json")
public ResponseEntity<ErrorMessage> handleJson(IllegalArgumentException exc) {
    return ResponseEntity.badRequest().body(new ErrorMessage(exc.getMessage(), 42));
}

@ExceptionHandler(produces = "text/html")
public String handleHtml(IllegalArgumentException exc, Model model) {
    model.addAttribute("error", new ErrorMessage(exc.getMessage(), 42));
    return "errorView";
}
```

### 方法参数类型

`@ExceptionHandler` 方法的签名也很灵活，支持以下参数类型：

| 参数 | 用途 |
| --- | --- |
| **异常类型** | 获取抛出的异常实例 |
| `HandlerMethod` | 获取抛出异常的 Controller 方法信息 |
| `WebRequest` / `NativeWebRequest` | 访问请求参数和属性，不直接依赖 Servlet API |
| `ServletRequest` / `ServletResponse` | 直接操作原始请求和响应 |
| `HttpSession` | 获取当前会话 |
| `Principal` | 获取当前认证用户 |
| `HttpMethod` | 获取请求的 HTTP 方法 |
| `Locale` | 获取当前请求的区域设置 |
| `TimeZone` / `ZoneId` | 获取当前请求的时区 |
| `OutputStream` / `Writer` | 直接写入响应体 |
| `Map` / `Model` / `ModelMap` | 向错误响应模型添加数据（始终为空） |
| `RedirectAttributes` | 重定向时传递属性 |
| `@SessionAttribute` | 访问 session 属性 |
| `@RequestAttribute` | 访问 request 属性 |

### 返回值类型

| 返回值 | 行为 |
| --- | --- |
| `@ResponseBody` + 任意对象 | 自动序列化为 JSON/XML 写到响应体 |
| `ResponseEntity<B>` / `HttpEntity<B>` | 完全控制响应状态码、头和体 |
| `ErrorResponse` / `ProblemDetail` | 渲染 RFC 9457 格式的错误响应 |
| `String` | 返回视图名，由 ViewResolver 解析 |
| `View` | 直接返回 View 对象 |
| `Map` / `Model` | 返回模型属性，视图名由 `RequestToViewNameTranslator`推断 |
| `ModelAndView` | 同时返回视图和模型，可选响应状态码 |
| `void` | 如果方法有 `ServletResponse`或 `OutputStream`参数，表示已完全处理响应 |

### 重新抛出异常

`@ExceptionHandler` 方法可以选择不处理异常，而是重新抛出。这样异常会继续沿着异常解析链传递，就像这个 `@ExceptionHandler` 不存在一样。这在某些场景下很有用——比如你只关心根异常匹配，或者只想在特定上下文中处理异常。

***

## 错误响应格式

统一了错误响应的格式和写法，方便前端对接。

### 错误响应结构标准化

RFC 9457 定义了一个通用的错误响应结构，类似医院病历上的标准字段：

```json
{
  "type": "about:blank",
  "title": "Not Found",
  "status": 404,
  "detail": "No static resource available",
  "instance": "/api/users/999"
}
```

核心字段含义：

* **`type`**：指向这个错误类型描述的 URI，默认是 `about:blank`
* **`title`**：错误简短描述，类似"标题"
* **`status`**：HTTP 状态码
* **`detail`**：具体错误详情
* **`instance`**：出错的请求路径

从此你的项目里所有异常响应都遵循同一套模板，前端闭着眼睛都能解析。

### Spring 的四种方式

#### ProblemDetail 

就是上面那个 JSON 对应的 Java 类，可以直接在任何 `@ExceptionHandler` 或 `Controller(不推荐)`方法里返回它：

```java
@ExceptionHandler(ProductNotFoundException.class)
public ProblemDetail handleNotFound(ProductNotFoundException ex) {
    ProblemDetail pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
    pd.setTitle("商品不存在");
    pd.setProperty("productId", ex.getProductId()); // 自定义字段
    return pd;
}
```

返回的 JSON 会自动包含标准字段，通过 `setProperty` 添加的自定义字段也会被展开到 JSON 顶层。

#### ErrorResponse 

以前抛异常只管"抛"，调用方拿到什么全靠猜。现在只要异常实现了 `ErrorResponse` 接口，它自己就能告诉 Spring："我该返回什么状态码、什么响应头、什么 body"。Spring MVC 所有内置异常（比如 `HttpMessageNotReadableException`、`MissingServletRequestParameterException`）都已经实现了这个接口。

```java
// 假设已经有了这个异常，不想改它的父类
public class UserNotFoundException extends RuntimeException implements ErrorResponse {

    private final Long userId;
    
    public UserNotFoundException(Long userId) {
        super("未找到用户: " + userId);
        this.userId = userId;
    }

    @Override
    public HttpStatusCode getStatusCode() {
        return HttpStatus.NOT_FOUND;
    }

    @Override
    public ProblemDetail getBody() {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            getStatusCode(), getMessage());
        pd.setTitle("用户不存在");
        pd.setProperty("userId", this.userId);
        return pd;
    }
}

```

#### ErrorResponseException 

不想自己实现接口？直接继承 `ErrorResponseException` 就好了：

```java
// 第一步：自定义一个异常，继承 ErrorResponseException
public class UserNotFoundException extends ErrorResponseException {
    
    public UserNotFoundException(Long userId) {
        super(HttpStatus.NOT_FOUND, 
              createProblemDetail(userId));
    }
    
    private static ProblemDetail createProblemDetail(Long userId) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.NOT_FOUND, 
            "未找到 ID 为 " + userId + " 的用户");
        pd.setTitle("用户不存在");
        pd.setProperty("errorCode", "USER_NOT_FOUND");
        pd.setProperty("timestamp", Instant.now().toString());
        return pd;
    }
}

// 第二步：Controller 里直接抛
@RestController
public class UserController {

    @GetMapping("/api/users/{id}")
    public User getUser(@PathVariable Long id) {
        User user = userService.findById(id);
        if (user == null) {
            throw new UserNotFoundException(id); // 直接抛
        }
        return user; // 正常返回业务数据，类型干净
    }
}

```

#### ResponseEntityExceptionHandler 推荐

这是一个 `@ControllerAdvice` 的基类，把所有 Spring MVC 内置异常都收拾得服服帖帖。你只需要继承它，然后在 Spring 配置里声明为 `@ControllerAdvice`：

```java
@ControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    // —— 框架内置异常，全都不用你管了 ——
    // 参数缺失、类型不匹配、方法不支持、媒体类型不支持……
    // 父类 ResponseEntityExceptionHandler 已经全部处理好了
    
    // —— 你只需要加自己的业务异常处理方法 ——
    
    @ExceptionHandler(UserNotFoundException.class)
    public ProblemDetail handleUserNotFound(UserNotFoundException ex) {
        return ex.getBody(); // 异常自己已经把 ProblemDetail 准备好了
    }
    
    @ExceptionHandler(InsufficientStockException.class)
    public ProblemDetail handleInsufficientStock(InsufficientStockException ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.CONFLICT, ex.getMessage());
        pd.setTitle("库存不足");
        pd.setProperty("productId", ex.getProductId());
        return pd;
    }
    
    // 兜底：所有没被上面覆盖的异常
    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnknown(Exception ex) {
        ProblemDetail pd = ProblemDetail.forStatusAndDetail(
            HttpStatus.INTERNAL_SERVER_ERROR, "服务器内部错误");
        pd.setTitle("系统异常");
        return pd;
    }
}

```

加上之后，框架抛出的所有内置异常（参数缺失、类型不匹配、方法不支持等）都会自动按 RFC 9457 格式返回，再也不用自己写一堆 `@ExceptionHandler` 去一个个兜底了。

***

**配置内置异常中文提示**

 在 `messages.properties` 里配一下国际化，框架内置异常的提示也能变成友好的中文：  

```properties
problemDetail.title.org.springframework.web.bind.MissingServletRequestParameterException=缺少请求参数
problemDetail.detail.org.springframework.web.bind.MissingServletRequestParameterException=必须提供参数 [{0}]
```

### `ProblemDetail` vs `ResponseEntity`

| 场景 | 返回值 |
| --- | --- |
| 只返回标准错误，不需要特殊响应头 | `ProblemDetail` |
| 需要加自定义响应头 | `ResponseEntity<ProblemDetail>` |
| 返回非错误数据（正常业务响应） | `ResponseEntity<T>` |
| 既可能返回错误也可能返回正常数据，想统一用 `ResponseEntity` 包装 | `ResponseEntity<Object>`
或 `ResponseEntity<?>` |

> 这两种方式**JSON 体一模一样**，区别只在于 `ResponseEntity` 让你多了一层对响应元数据（状态码、响应头）的控制权。平时大多数场景直接返回 `ProblemDetail` 就好，清爽够用。
>
> **最佳做法**：
>
> * 异常处理场景直接用 `ProblemDetail` 就够了；
> * 如果需要操作用户自定义响应头，再用 `ResponseEntity<ProblemDetail>` 包装一下。
> * 正常业务返回还是继续用 `ResponseEntity<T>`，它俩各司其职，不冲突。


> 更新: 2026-09-10 09:36:18  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/egdchb/orvtuag20azfaqp4>