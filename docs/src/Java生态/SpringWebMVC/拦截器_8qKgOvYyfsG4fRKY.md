## 拦截器

## 定义拦截器

```java
public class MyInterceptor implements HandlerInterceptor {

    /**
     * 在 Controller 方法执行之前调用
     * @return true 放行，false 拦截
     */
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        // 权限校验、日志记录、参数校验等
        return true;
    }

    /**
     * 在 Controller 方法执行之后、视图渲染之前调用
     */
    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {
        // 对 ModelAndView 做额外修改，比如加公共页面数据
    }

    /**
     * 在整个请求处理完成之后（视图渲染完毕）调用
     */
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        // 资源清理、请求耗时统计等收尾工作
    }
}

```

## 注册拦截器

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new MyInterceptor())
                .addPathPatterns("/api/**")   // 拦截哪些路径
                .excludePathPatterns("/api/login");  // 排除哪些路径
    }
}

```

> **一个重要的坑：@ResponseBody 的情况**
>
> 如果你用 `@ResponseBody` 或 `ResponseEntity` 直接返回 JSON 数据，那么响应体在 `postHandle` 调用之前就已经被 `HandlerAdapter` 写入并提交了。也就是说，这时候 `postHandle` 里再想修改响应内容已经来不及了。如果需要在这种情况下对响应做额外处理（比如加个响应头），应该用 `ResponseBodyAdvice`，而不是拦截器。

## 拦截器 vs Filter

* **Filter** 是 Servlet 规范里的东西，在请求到达 DispatcherServlet 之前就执行了，它不知道 Spring MVC 的 Controller 是什么，只看得见请求路径
* **拦截器** 是 Spring MVC 层面的东西，在 HandlerMapping 匹配到特定处理器之后才执行，它能拿到具体的 Controller 方法和参数，能做的事情更精细
