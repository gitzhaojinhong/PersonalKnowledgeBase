## 跨域

CORS（跨源资源共享） 是一套浏览器和服务器之间的通信协议， 让服务器告诉浏览器"这个跨域请求我允许，放行吧"。  

> 浏览器的**同源策略**（Same-Origin Policy）：它默认禁止一个源的脚本访问另一个源的资源。两个 URL 的协议、域名、端口三者完全一致才叫"同源"。

## CORS 的两种请求

**简单请求**

满足以下所有条件的算是"简单请求"：

* 请求方法是 `GET`、`HEAD` 或 `POST`
* 没有自定义请求头，或者只有 `Accept`、`Accept-Language`、`Content-Language`、`Content-Type` 这几个

对于简单请求，浏览器直接发出实际请求，然后在响应头里检查服务器是否允许跨域。如果服务器返回了 `Access-Control-Allow-Origin` 且值匹配，浏览器才会把响应交给前端代码，否则就报错拦住。

**预检请求（Preflight）**

当请求不满足简单请求的条件时——比如用了 `PUT`、`DELETE` 方法，或者加了自定义头——浏览器会先发一个 `OPTIONS` 请求（这就是预检请求），询问服务器："我要发一个跨域请求，你允许吗？" 服务器通过 `Access-Control-Allow-*` 系列响应头回答，浏览器确认允许后才发真正的请求。

## 配置跨域

#### 1. 注解方式 `@CrossOrigin`

最灵活的方式，可以直接贴在控制器方法上，也可以贴在类上，类级别的配置会被所有方法继承。

```java
@CrossOrigin(origins = "https://domain2.com", maxAge = 3600)
@RestController
@RequestMapping("/account")
public class AccountController {

    @GetMapping("/{id}")
    public Account retrieve(@PathVariable Long id) {
        // ...
    }
}
```

> 默认情况下，无参数的`@CrossOrigin` 允许所有来源、所有请求头、所有匹配的 HTTP 方法，但**不开启凭证**（即不允许携带 Cookie）。`maxAge` 默认 30 分钟，表示浏览器可以缓存预检结果的时间。

#### 2. 全局配置 —— CorsRegistry

适合统一管理所有接口的 CORS 规则，通过 `WebMvcConfigurer` 配置：

```java
@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
        .allowedOrigins("https://domain2.com")
        .allowedMethods("PUT", "DELETE")
        .allowedHeaders("header1", "header2")
        .allowCredentials(true)
        .maxAge(3600);
    }
}
```

#### 3. CorsFilter

如果想更底层地控制，或者需要结合 Spring Security 等其他框架一起使用，可以直接注册 `CorsFilter`。注意 Spring Security 本身也有 CORS 支持，两者配合使用时要小心重复配置。

***

> **关于 Credential（凭证请求）**
>
> 有一个很重要的细节：当需要跨域请求携带 Cookie 或认证信息时，需要开启 `allowCredentials(true)`。但这样做了之后，`allowedOrigins`就*不能用通配符__ `_"*****"_`* 了，必须指定具体的域名。这是因为一旦允许携带 Cookie，浏览器要求明确知道要把敏感信息发给谁，不能含糊地"允许所有来源"。
>
> 可以用 `allowedOriginPatterns` 来匹配动态的一组来源，比如 `"https://*.domain2.com"`。
>
> **全局配置与局部配置的叠加规则**
>
> 全局配置（`CorsRegistry`）和局部配置（`@CrossOrigin`）可以同时存在，规则是*加法叠加*——比如全局允许来源A，局部允许来源B，那最终来源A和B都允许。但对于那些只能取单一值的属性（比如 `allowCredentials` 和 `maxAge`），局部配置会覆盖全局的。
