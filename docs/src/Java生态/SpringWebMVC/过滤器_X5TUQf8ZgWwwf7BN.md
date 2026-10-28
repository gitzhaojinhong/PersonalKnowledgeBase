## 过滤器

## 执行流程

一个请求进来，先经过 Filter 链，然后才到 DispatcherServlet，再到拦截器，最后到 Controller。

> Filter 关注的是"请求本身长什么样"，而不是"请求要交给哪个 Controller 处理"。
>
> Filter 是 Java Servlet 规范定义的标准组件,不属于MVC。

## 定义过滤器

### 纯 Servlet 标准 Filter

```java
public class MyFilter implements jakarta.servlet.Filter {

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        // 初始化，可以读取 FilterConfig 里的参数
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
    throws IOException, ServletException {
        // 请求处理前：可以做字符编码、日志、安全检查等
        // ...
        chain.doFilter(request, response);  // 放行，继续执行后续 Filter 和目标 Servlet
        // 请求处理后：可以做资源清理等
        // ...
    }

    @Override
    public void destroy() {
        // 销毁时清理资源
    }
}
```

### Spring 封装的（推荐）

Spring封装的`OncePerRequestFilter`

保证一次请求只会被该 Filter 执行一次。在某些场景下（比如内部转发），标准 Filter 可能会被调用多次，这个基类避免了这个问题。

```java
public class MyOncePerRequestFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // 请求处理前
        // ...
        filterChain.doFilter(request, response);
        // 请求处理后
        // ...
    }
}
```

***

## 注册过滤器

**在 Spring Boot 中注册**

方式一：声明为 Bean 即可，Spring Boot 会自动注册（默认拦截/*）：

```java
@Configuration
public class FilterConfig {
    @Bean
    public Filter myFilter() {
        return new MyOncePerRequestFilter();
    }
}
```

方式二：如果需要控制顺序和拦截路径，用 `FilterRegistrationBean`：

```java
@Bean
public FilterRegistrationBean<MyOncePerRequestFilter> myFilterRegistration() {
    FilterRegistrationBean<MyOncePerRequestFilter> registration = new FilterRegistrationBean<>();
    registration.setFilter(new MyOncePerRequestFilter());
    registration.addUrlPatterns("/api/*");
    registration.setOrder(1);
    return registration;
}
```

## 过滤器 vs 拦截器

| 对比 | Filter | 拦截器（HandlerInterceptor） |
| --- | --- | --- |
| 所属层面 | Servlet 规范，不依赖 Spring | Spring MVC 层面 |
| 执行时机 | 请求到达 DispatcherServlet 之前 | HandlerMapping 匹配到处理器之后 |
| 能拿到的信息 | 只能拿到原始的 request、response | 能拿到具体的 Controller 方法和参数 |
| 典型用途 | 字符编码、请求包装、安全校验、ETag | 日志、权限校验、公共数据填充 |
| 路径匹配 | 基于 URL 模式 | 基于 HandlerMapping 的匹配规则 |
