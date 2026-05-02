
## 5.1 静态资源处理

### 5.1.1 默认静态资源路径

```
classpath:/META-INF/resources/
classpath:/resources/
classpath:/static/          # 最常用
classpath:/public/
```

### 5.1.2 静态资源配置

```yaml
spring:
  mvc:
    static-path-pattern: /static/**  # URL前缀
  web:
    resources:
      static-locations: classpath:/static/,classpath:/public/  # 物理路径
      cache:
        period: 3600  # 缓存时间(秒)
```

### 5.1.3 代码方式配置

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:/opt/uploads/");
    }
}
```

## 5.2 WebJars支持

WebJars将前端库（jQuery、Bootstrap等）打包成JAR，方便Maven管理。

```xml
<!-- 引入vue的webjar -->
<dependency>
    <groupId>org.webjars.npm</groupId>
    <artifactId>vue</artifactId>
    <version>3.5.12</version>
</dependency>
```

访问规则：`/webjars/**` 映射到 `classpath:/META-INF/resources/webjars/`

访问示例：`http://localhost:8080/webjars/vue/3.5.12/index.js`

## 5.3 静态资源缓存配置

```yaml
spring:
  web:
    resources:
      cache:
        period: 3600           # 缓存有效期(秒)
        use-last-modified: true  # 使用Last-Modified头
        cachecontrol:
          max-age: 3600
          cache-public: true
```

Cache-Control指令说明：
- `max-age`：资源在指定秒数内被视为新鲜
- `public`：响应可被所有缓存存储
- `private`：仅浏览器缓存，CDN/代理不缓存
- `no-cache`：使用前需向服务器验证
- `no-store`：禁止任何形式的缓存

## 5.4 路径匹配策略

SpringBoot默认使用PathPatternParser（性能好），支持以下语法：

| 符号 | 说明 |
|------|------|
| `*` | 匹配0-N个字符，不含`/` |
| `**` | 匹配任意数量目录层级，只能在末尾 |
| `?` | 匹配任意单个字符 |
| `[]` | 匹配指定范围内的单个字符 |
| `{}` | 路径变量，如 `/users/{userId}` |

```java
@GetMapping("/{path:[a-z]+}/a?/*.do/**")
public String path(HttpServletRequest request, @PathVariable String path) {
    return request.getRequestURI() + "," + path;
}
```

## 5.5 拦截器配置

```java
// 定义拦截器
@Component
public class AuthInterceptor implements HandlerInterceptor {
    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        // 前置处理
        return true;  // true继续执行，false中断
    }
    
    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) {
        // 后置处理
    }
    
    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) {
        // 完成处理
    }
}

// 注册拦截器
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Autowired
    private AuthInterceptor authInterceptor;
    
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/**")           // 拦截路径
                .excludePathPatterns("/login");  // 排除路径
    }
}
```

## 5.6 跨域配置（CORS）

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOrigins("*")           // 允许来源
                .allowedMethods("GET", "POST", "PUT", "DELETE")
                .allowedHeaders("*")
                .maxAge(3600);                  // 预检缓存时间
    }
}
```

## 5.7 异常处理

### 5.7.1 全局异常处理（前后端分离推荐）

```java
@RestControllerAdvice
public class GlobalExceptionHandler {
    
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public Result<Void> handleValidation(MethodArgumentNotValidException e) {
        String message = e.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return Result.error(400, message);
    }
    
    @ExceptionHandler(BusinessException.class)
    public Result<Void> handleBusiness(BusinessException e) {
        return Result.error(e.getCode(), e.getMessage());
    }
    
    @ExceptionHandler(Exception.class)
    public Result<Void> handleException(Exception e) {
        return Result.error(500, "系统异常");
    }
}
```

### 5.7.2 传统Web项目错误页面

```
classpath:/templates/error/404.html    # 精确错误码
classpath:/templates/error/4xx.html    # 模糊错误码
classpath:/templates/error.html        # 通用错误页
```

## 5.8 内容协商

```yaml
spring:
  mvc:
    contentnegotiation:
      favor-parameter: true       # 优先使用参数方式
      parameter-name: format      # 参数名
      media-types:
        yaml: text/yaml           # 自定义媒体类型
```

## 5.9 自定义HttpMessageConverter

以支持YAML格式为例：

```java
public class YamlHttpMessageConverter extends AbstractHttpMessageConverter<Object> {

    private ObjectMapper objectMapper = new ObjectMapper(
        new YAMLFactory().disable(YAMLGenerator.Feature.WRITE_DOC_START_MARKER)
    );

    public YamlHttpMessageConverter() {
        super(new MediaType("text", "yaml", Charset.forName("UTF-8")));
    }

    @Override
    protected boolean supports(Class<?> clazz) {
        return true;  // 支持所有类型
    }

    @Override
    protected Object readInternal(Class<?> clazz, HttpInputMessage inputMessage) throws IOException {
        return objectMapper.readValue(inputMessage.getBody(), clazz);
    }

    @Override
    protected void writeInternal(Object o, HttpOutputMessage outputMessage) throws IOException {
        objectMapper.writeValue(outputMessage.getBody(), o);
    }
}
```

注册转换器：

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        converters.add(new YamlHttpMessageConverter());
    }
}
```

## 5.10 文件上传

```yaml
spring:
  servlet:
    multipart:
      max-file-size: 10MB        # 单个文件最大
      max-request-size: 100MB    # 总请求最大
```

```java
@PostMapping("/upload")
public Result<String> upload(@RequestParam("file") MultipartFile file) {
    String filename = file.getOriginalFilename();
    file.transferTo(new File("/uploads/" + filename));
    return Result.ok("/uploads/" + filename);
}
```

## 5.11 Web服务器配置

### 5.11.1 切换为Jetty

```xml
<!-- 排除Tomcat -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <exclusions>
        <exclusion>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-tomcat</artifactId>
        </exclusion>
    </exclusions>
</dependency>
<!-- 添加Jetty -->
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-jetty</artifactId>
</dependency>
```

### 5.11.2 Tomcat优化配置

```properties
# 连接超时时间
server.tomcat.connection-timeout=20000

# 最大线程数
server.tomcat.max-threads=200

# 等待队列容量
server.tomcat.accept-count=100

# 最小空闲线程
server.tomcat.min-spare-threads=10

# 会话超时时间(分钟)
server.tomcat.session-timeout=30

# URI编码
server.tomcat.uri-encoding=UTF-8
```
