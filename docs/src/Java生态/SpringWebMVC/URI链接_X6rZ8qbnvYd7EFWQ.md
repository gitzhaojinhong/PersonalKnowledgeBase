## URI链接

URI Links 就是 Spring 提供的代码构建、解析、编码 URI，以及在 Controller 和视图里生成指向其他 Controller 方法的链接，不用手动拼接字符串。

#### **构建任意 URI**

最常用的场景是从 URI 模板 + 变量生成最终的 URI：

java

下载复制

```plain
URI uri = UriComponentsBuilder
    .fromUriString("https://example.com/hotels/{hotel}?q={q}")
    .build("Westin", "123");
// 结果: https://example.com/hotels/Westin?q=123
```

`{hotel}` 和 `{q}` 是模板变量，`build()` 里传入的实际值会按顺序替换进去。你还可以链式调用 `.queryParam()`、`.path()` 等方法来逐步构建 URI。



#### **基于当前请求构建相对 URI**

在 Controller 里，你经常需要基于当前请求生成新的 URI。`ServletUriComponentsBuilder` 可以帮你复用当前请求的 scheme、host、port 等信息：

```java
// 假设当前为：GET https://localhost:8080/myapp/users?accountId=999&page=1
// 最终目标为：https://localhost:8080/myapp/users?accountId=123&page=1
// 复用当前请求的 scheme、host、port、path 和 query string
URI uri = ServletUriComponentsBuilder.fromRequest(request)
.replaceQueryParam("accountId", "{id}")
.build("123");

// 假设当前为：GET https://localhost:8080/myapp/users
// 最终目标为：https://localhost:8080/myapp/accounts
// 只复用 context path（比如 /myapp），然后拼上 /accounts
URI uri = ServletUriComponentsBuilder.fromContextPath(request)
.path("/accounts")
.build()
.toUri();
```

***

#### **生成指向 Controller 方法的链接**

这是最实用的功能。你有一个 Controller 方法，想在另一个地方生成指向它的 URL，不用硬编码路径，直接通过方法名或方法调用来生成：

```java
// 假设有一个Controller
@Controller
@RequestMapping("/hotels/{hotel}")
public class BookingController {
    @GetMapping("/bookings/{booking}")
    public ModelAndView getBooking(@PathVariable Long booking) { ... }
}

// 通过方法名生成
// 最终变为：https://localhost:8080/myapp/hotels/42/bookings/21
UriComponents uriComponents = MvcUriComponentsBuilder
    .fromMethodName(BookingController.class, "getBooking", 21)
    .buildAndExpand(42);
URI uri = uriComponents.encode().toUri();
// 21 是方法参数（booking 的值），42 是剩余的路径变量（hotel 的值）


// 通过方法调用生成（更直观，类似 mock 测试）
// 最终变为：https://localhost:8080/myapp/hotels/42/bookings/21
UriComponents uriComponents = MvcUriComponentsBuilder
.fromMethodCall(on(BookingController.class).getBooking(21))
.buildAndExpand(42);
```

> **注意**：`fromMethodCall` 对 Controller 方法的返回类型有限制，不能是 `final` 类型（比如 `String`），因为底层需要生成运行时代理。建议用 `ModelAndView` 或 `Object` 作为返回类型，或者直接用 `fromMethodName`。
