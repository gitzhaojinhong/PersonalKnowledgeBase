## HTTP缓存

## 请求逻辑

第一次请求：

```plain
浏览器 → 服务器：我要 book/123
服务器 → 浏览器：给你数据，另外记好了——
                Cache-Control: max-age=2592000（30天内别来找我）
                ETag: "v1.0"
浏览器：收到，存到本地
```

30天内的再次请求：

```plain
浏览器 → 服务器：我要 book/123，但我之前有 ETag 是 "v1.0"
               （实际通过 If-None-Match 请求头发送）
服务器 → 浏览器：ETag 没变，用你本地那份吧
                HTTP 304 Not Modified（响应体是空的！）
浏览器：好勒，直接用本地缓存渲染
```

## `CacheControl` 工具类

Spring 提供了一个 `CacheControl` 工具类，让你用链式调用的方式生成 `Cache-Control` 头，不用自己拼字符串：

```java
// 缓存1小时 → "Cache-Control: max-age=3600"
CacheControl.maxAge(1, TimeUnit.HOURS)

// 禁止缓存 → "Cache-Control: no-store"
CacheControl.noStore()

// 缓存10天，允许公共缓存（如 CDN），禁止代理篡改
// → "Cache-Control: max-age=864000, public, no-transform"
CacheControl.maxAge(10, TimeUnit.DAYS).noTransform().cachePublic()
```

## 两种使用方式

### ResponseEntity+ETag（推荐）

在 Controller 里直接返回带缓存控制的 `ResponseEntity`，Spring 会自动判断要不要返回 304：

```java
@GetMapping("/book/{id}")
public ResponseEntity<Book> showBook(@PathVariable Long id) {
    Book book = findBook(id);
    String version = book.getVersion();   // 例如 "v1.0" 或时间戳

    return ResponseEntity
        .ok()
        .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS))
        .eTag(version)                // 自动处理条件判断
        .body(book);
}
```

这段代码做了三件事：

1. 告诉浏览器缓存 30 天
2. 给响应打上 ETag 标记
3. 如果浏览器下次带着 `If-None-Match: "v1.0"` 来，自动返回 304 空响应，不走后续业务逻辑

### 手动检查条件请求

```java
@GetMapping("/api/books/{id}")
public Book getBook(@PathVariable Long id, WebRequest request) {
    // 1. 先查数据，算 ETag
    Book book = bookService.findById(id);
    String eTag = book.getVersion(); // 比如 "v1.0"

    // 2. 检查客户端传过来的 If-None-Match 是否匹配
    if (request.checkNotModified(eTag)) {
        return null;  // Spring 会自动处理成 304，body 为空
    }

    // 3. 不匹配，返回完整数据
    return book;
}
```

> `checkNotModified` 方法同时支持 `ETag`、`Last-Modified` 或两者组合。对于 `GET`/`HEAD` 请求返回 `304`，对于 `POST`/`PUT`/`DELETE` 则返回 `412 (Precondition Failed)`，防止并发修改冲突。

### ETag过滤器

ShallowEtagHeaderFilter   把这个 Filter 注册到 Spring 容器里，它会自动为所有匹配的请求计算响应体的 MD5 作为 ETag，资源没变就返回 304 空响应，省的是带宽而不是 CPU。

SpringBoot注册：

```java
// 默认应用到所有控制层
@Bean
public ShallowEtagHeaderFilter shallowEtagHeaderFilter() {
    return new ShallowEtagHeaderFilter();
}
```

Controller:

```java
@GetMapping("/book/{id}")
public ResponseEntity<Book> showBook(@PathVariable Long id) {
    Book book = findBook(id);
    return ResponseEntity
            .ok()
            .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS))  // 还是得加
            .body(book);
}
```
