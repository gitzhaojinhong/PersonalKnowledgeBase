## DispatcherServlet

DispatcherServlet 自己只负责"流程控制"——也就是决定请求来了之后先做什么、再做什么。但具体每步谁来做，它不管，交给一堆可替换的"委托组件"去干。这就意味着，你想换掉某个环节的实现，只要换个组件就行，不用动整体流程。

## 上下文层次结构

允许把 Spring 的 IoC 容器分成上下两层：

* 一个**根容器**存放全局共享的 Bean；
* 每个 DispatcherServlet 再拥有一个**子容器**存放自己私有的 Bean。子容器能"看到"根容器里的 Bean，但反过来不行。

> 但如果用 **Spring Boot**，它走的是另一套逻辑——不依赖 Servlet 容器的生命周期，而是用 Spring 配置自举，所以不太会有手动配置父子容器的场景。Spring Boot 对大多数场景来说，一个容器就够了。

## 特殊Bean类型

DispatcherServlet 自己只负责"总调度"——它管流程，不管具体怎么干。具体干活的事，全交给这 8 种特殊 Bean。每种 Bean 负责一个环节，而且都是接口，可以随时换掉它们的实现（SpringMVC为每一个特殊的Bean都提供了默认实现）。

| 特殊 Bean | 一句话职责 |
| --- | --- |
| **HandlerMapping** | 根据请求 URL 和方法，找到对应的 Controller 方法 |
| **HandlerAdapter** | 调用找到的 Controller 方法，负责解析参数、适配调用方式 |
| **HandlerExceptionResolver** | 处理 Controller 抛出的异常，映射到错误页面或错误响应 |
| **ViewResolver** | 把逻辑视图名（如 `"home"`
）解析成实际视图（如 `home.jsp`
） |
| **LocaleResolver** | 判断用户的语言和时区，返回国际化视图 |
| **ThemeResolver** | 解析应用主题，提供个性化布局 |
| **MultipartResolver** | 解析文件上传请求，提取上传的文件 |
| **FlashMapManager** | 在重定向场景下，暂存数据并在下一次请求中传递，用完即焚 |

## 请求处理流程

DispatcherServlet 的处理流程就是一个 6 步流水线

绑定上下文 -> 绑定区域 -> 绑定主题 -> 检查文件上传 -> 查找并执行处理器 -> 渲染视图。

每一步都对应前面讲过的某个特殊 Bean 来干活，异常处理则贯穿始终。

## 拦截器

## Multipart 解析器

Multipart Resolver 就是 Spring MVC 里处理文件上传的组件，它的作用是把浏览器发来的 multipart/form-data 请求解析出来，让你在 Controller 里能方便地拿到上传的文件

当用户通过 HTML 表单提交文件时，表单的 `enctype` 会被设为 `multipart/form-data`，这种请求的格式跟普通表单不一样，不能直接用 `@RequestParam` 来拿文件。MultipartResolver 就是用来处理这个问题的——它解析请求体，把文件部分提取出来，然后把原始的 `HttpServletRequest` 包装成 `MultipartHttpServletRequest`，这样你在 Controller 里就能用 `@RequestParam("file") MultipartFile file` 来获取上传的文件了。

#### **启用multipart 解析**

**第一步：告诉 Servlet 容器支持 multipart 解析**

如果你用传统的 `AbstractAnnotationConfigDispatcherServletInitializer` 配置，需要重写 `customizeRegistration` 方法：

```java
@Override
protected void customizeRegistration(ServletRegistration.Dynamic registration) {
    registration.setMultipartConfig(new MultipartConfigElement("/tmp"));
}
```

`MultipartConfigElement` 可以传几个参数：

* **上传文件临时目录**：比如 `/tmp`，文件在解析过程中会被暂存到这里
* **单个文件大小上限**：`maxFileSize`，默认无限制
* **整个请求大小上限**：`maxRequestSize`，默认无限制
* **文件大小阈值**：`fileSizeThreshold`，小于这个值保持在内存，大于这个值才写入磁盘临时文件

**第二步：声明 MultipartResolver Bean**

```java
@Bean
public MultipartResolver multipartResolver() {
    return new StandardServletMultipartResolver();
}
```

Bean 的名字必须叫 `multipartResolver`，DispatcherServlet 是按名字来查找它的。

***

#### **在 Spring Boot 中使用**

Spring Boot 把这两步都自动做了。你只要引入 `spring-boot-starter-web`，然后在 `application.properties` 里配置几个参数就行：

```properties
spring.servlet.multipart.enabled=true
spring.servlet.multipart.max-file-size=10MB
spring.servlet.multipart.max-request-size=10MB
spring.servlet.multipart.location=/tmp
```

Spring Boot 会自动注册 `StandardServletMultipartResolver`，并且自动配置内嵌的 Servlet 容器以支持 multipart 解析。

***

#### **在 Controller 里使用**

启用之后，在 Controller 里接收文件非常简单：

```java
@PostMapping("/upload")
public String handleUpload(@RequestParam("file") MultipartFile file) {
    String originalFilename = file.getOriginalFilename();  // 原始文件名
    byte[] bytes = file.getBytes();                        // 文件内容
    long size = file.getSize();                            // 文件大小
    // 保存文件或处理
    return "上传成功";
}
```

你也可以一次接收多个文件：

```java
@PostMapping("/uploads")
public String handleUploads(@RequestParam("files") List<MultipartFile> files) {
    // 处理多个文件
}
```

## Logging

Spring MVC 的日志设计理念是"默认简洁、默认安全"——DEBUG 和 TRACE 日志默认只输出关键信息，不会打印请求参数和请求头这些敏感数据，只有当你明确开启后才会显示完整内容

Spring MVC 的日志分两个级别：**DEBUG**和**TRACE**。DEBUG 级别只输出反复有用的高价值信息，TRACE 级别则更详细一些，但两者都不是"洪水般"的输出，都是有节制、有重点的。

***

#### **敏感数据默认被遮蔽**

这是最值得注意的一点。出于安全考虑，DispatcherServlet 的 DEBUG 和 TRACE 日志**默认不会记录请求参数和请求头**的完整内容。因为这些东西可能包含用户的密码、Token、Cookie 等敏感信息。日志里只会输出参数名，但参数值会用 `masked` 代替。

如果确实需要调试某些问题，必须显式开启才能看到完整内容。在传统 Spring MVC 项目中，可以通过在 `DispatcherServlet` 上设置初始化参数来开启：

```java
@Override
protected void customizeRegistration(ServletRegistration.Dynamic registration) {
    registration.setInitParameter("enableLoggingRequestDetails", "true");
}
```

在 Spring Boot 中则可以在 `application.properties` 里设置：

```properties
spring.mvc.log-request-details=true
```

**但注意：生产环境不要开启这个，否则敏感信息会暴露在日志里。**

***

#### **DEBUG 和 TRACE 日志输出**

开启日志输出后，能看到的信息包括：

* 请求的 HTTP 方法和路径
* 匹配到的 HandlerMapping 和 Controller 方法
* 请求参数（开启后）
* 请求头（开启后）
* 视图解析的过程
* 异常处理路径


> 更新: 2026-09-10 19:23:00  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/egdchb/hwgr8gpdl8galtcr>