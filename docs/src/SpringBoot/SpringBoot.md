# Spring Boot 开发速查手册

> 基于 Spring Boot 3.x，面向开发场景的快速参考指南

---

## 目录

1. [快速开始](#一快速开始)
2. [核心注解](#二核心注解)
3. [配置管理](#三配置管理)
4. [自动配置原理](#四自动配置原理)
5. [Web开发](#五web开发)
6. [数据访问](#六数据访问)
7. [常用功能](#七常用功能)
8. [AOP编程](#八aop编程)
9. [高级特性](#九高级特性)
10. [附录：常用配置速查](#十附录常用配置速查)

---

## 一、快速开始

### 1.1 项目创建方式

#### 方式一：Spring Initializr（推荐）
- 官网：https://start.spring.io
- 阿里云：https://start.aliyun.com

#### 方式二：IDEA内置脚手架
File → New → Project → Spring Initializr

#### 方式三：手动创建
```xml
<!-- 继承Spring Boot父项目 -->
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.5.8</version>
</parent>

<dependencies>
    <!-- Web启动器 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>
</dependencies>

<build>
    <plugins>
        <!-- 打包插件 -->
        <plugin>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-maven-plugin</artifactId>
        </plugin>
    </plugins>
</build>
```

### 1.2 项目结构

```
src/
├── main/
│   ├── java/
│   │   └── com/example/demo/
│   │       ├── DemoApplication.java    # 主入口类
│   │       ├── controller/             # 控制器层
│   │       ├── service/                # 业务层
│   │       ├── repository/             # 数据访问层
│   │       ├── entity/                 # 实体类
│   │       └── config/                 # 配置类
│   └── resources/
│       ├── static/                     # 静态资源
│       ├── templates/                  # 模板文件
│       ├── application.properties      # 主配置文件
│       └── application-dev.yml         # 环境配置文件
└── test/                               # 测试代码
```

### 1.3 主入口类

```java
@SpringBootApplication
public class DemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(DemoApplication.class, args);
    }
}
```

**注意**：默认只扫描主入口类所在包及子包。

### 1.4 打包与部署

```bash
# 打jar包（默认）
mvn clean package
java -jar target/demo-0.0.1-SNAPSHOT.jar

# 指定配置文件启动
java -jar demo.jar --spring.config.location=file:/path/to/config/

# 指定激活的环境
java -jar demo.jar --spring.profiles.active=prod
```

---

## 二、核心注解

### 2.1 组合注解

| 注解 | 说明 | 包含功能 |
|------|------|----------|
| `@SpringBootApplication` | 主入口类标记 | `@SpringBootConfiguration` + `@EnableAutoConfiguration` + `@ComponentScan` |

### 2.2 配置类相关

| 注解 | 说明 | 使用场景 |
|------|------|----------|
| `@Configuration` | 声明配置类 | 定义Bean、配置组件 |
| `@Bean` | 定义Bean对象 | 在配置类中创建Bean |
| `@ConfigurationProperties(prefix="xxx")` | 配置绑定 | 将配置批量绑定到Bean属性 |
| `@EnableConfigurationProperties(Xxx.class)` | 启用配置属性 | 主类上启用指定配置类 |
| `@ConfigurationPropertiesScan` | 扫描配置属性类 | 批量扫描配置绑定类 |
| `@PropertySource("classpath:xxx.properties")` | 指定配置文件 | 加载额外的properties文件 |
| `@ImportResource("classpath:xxx.xml")` | 导入XML配置 | 兼容旧版Spring XML配置 |

### 2.3 组件扫描相关

| 注解 | 说明 | 使用层级 |
|------|------|----------|
| `@Component` | 通用组件 | 所有层 |
| `@Service` | 业务层组件 | Service层 |
| `@Repository` | 数据访问层组件 | DAO/Mapper层 |
| `@Controller` | 控制器组件 | Web层（返回视图） |
| `@RestController` | REST控制器 | Web层（返回数据）= `@Controller` + `@ResponseBody` |

### 2.4 自动配置相关

| 注解 | 说明 | 使用场景 |
|------|------|----------|
| `@EnableAutoConfiguration` | 启用自动配置 | 自动配置Spring组件 |
| `@ConditionalOnClass` | 类存在时生效 | 条件配置 |
| `@ConditionalOnMissingClass` | 类不存在时生效 | 条件配置 |
| `@ConditionalOnBean` | Bean存在时生效 | 条件配置 |
| `@ConditionalOnMissingBean` | Bean不存在时生效 | 条件配置 |
| `@ConditionalOnProperty` | 配置属性满足时生效 | 条件配置 |
| `@ConditionalOnWebApplication` | Web应用时生效 | 条件配置 |

### 2.5 测试相关

| 注解 | 说明 |
|------|------|
| `@SpringBootTest` | 集成测试，加载完整上下文 |
| `@Test` | 标记测试方法 |
| `@Autowired` | 自动注入依赖 |

### 2.6 代码示例

```java
// 配置类示例
@Configuration
public class AppConfig {
    
    @Bean
    public Date currentDate() {
        return new Date();
    }
}

// 配置绑定示例
@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {
    private String name;
    private String version;
    // getter/setter
}

// 在主类启用配置绑定
@SpringBootApplication
@EnableConfigurationProperties(AppProperties.class)
public class DemoApplication { }
```

---

## 三、配置管理

### 3.1 配置文件优先级（从高到低）

1. `file:./config/` - 工作目录config文件夹
2. `file:./` - 工作目录根
3. `classpath:/config/` - 类路径config文件夹
4. `classpath:/` - 类路径根

**规则**：高优先级覆盖低优先级同名属性，所有配置合并生效。

### 3.2 多环境配置

```yaml
# application.yml（主配置）
spring:
  profiles:
    active: dev  # 激活dev环境

---
# application-dev.yml（开发环境）
server:
  port: 8080

---
# application-prod.yml（生产环境）
server:
  port: 80
```

**切换方式**：
- 配置文件：`spring.profiles.active=prod`
- 命令行：`--spring.profiles.active=prod`

### 3.3 配置读取方式

#### 方式一：@Value注解

```java
@Service
public class UserService {
    @Value("${app.name}")
    private String appName;
    
    @Value("${app.timeout:30}")  // 带默认值
    private Integer timeout;
    
    @Value("${JAVA_HOME}")  // 读取系统环境变量
    private String javaHome;
}
```

#### 方式二：@ConfigurationProperties绑定

```java
@Data
@Configuration
@ConfigurationProperties(prefix = "spring.datasource")
public class DataSourceConfig {
    private String url;
    private String username;
    private String password;
    private String driverClassName;
}
```

#### 方式三：Environment对象

```java
@Autowired
private Environment env;

public void test() {
    String port = env.getProperty("server.port");
    String[] profiles = env.getActiveProfiles();
}
```

### 3.4 配置文件合并

```yaml
# application.yml
spring:
  config:
    import:
      - classpath:application-db.yml
      - classpath:application-redis.yml
```

### 3.5 YAML语法细节

```yaml
# 单引号：不转义，\n 作为普通字符串
name: 'hello\nworld'  # 输出：hello\nworld

# 双引号：转义，\n 作为换行符
name: "hello\nworld"  # 输出：hello
                     #       world

# | 保留文本格式（保留换行）
description: |
  第一行
  第二行
  第三行

# > 换行变空格
description: >
  这是
  一段
  文字      # 输出：这是 一段 文字

# --- 文档切割（一个文件多个配置段）
---
# 第一个配置段
spring:
  profiles: dev
---
# 第二个配置段
spring:
  profiles: prod
```

### 3.6 常用配置项

```properties
# 服务器配置
server.port=8080
server.servlet.context-path=/api

# 数据源配置
spring.datasource.url=jdbc:mysql://localhost:3306/db
spring.datasource.username=root
spring.datasource.password=123456
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver

# Jackson配置
spring.jackson.date-format=yyyy-MM-dd HH:mm:ss
spring.jackson.time-zone=GMT+8

# 日志配置
logging.level.root=INFO
logging.level.com.example=DEBUG
logging.file.name=./logs/app.log

# 日志分组（批量设置多个包的日志级别）
spring.logging.group.mybusiness=com.example.service,com.example.controller
logging.level.mybusiness=DEBUG

# SpringBoot内置日志组：web、sql
logging.level.web=DEBUG
logging.level.sql=DEBUG
```

---

## 四、自动配置原理

### 4.1 自动配置加载流程

```
@SpringBootApplication
    └── @EnableAutoConfiguration
            └── @Import(AutoConfigurationImportSelector.class)
                    └── 读取 META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
                            └── 加载约150+自动配置类
                                    └── @Conditional条件过滤
                                            └── 符合条件的配置生效
```

### 4.2 条件注解说明

| 条件注解 | 判断依据 |
|----------|----------|
| `@ConditionalOnClass` | 类路径存在指定类 |
| `@ConditionalOnMissingClass` | 类路径不存在指定类 |
| `@ConditionalOnBean` | 容器中存在指定Bean |
| `@ConditionalOnMissingBean` | 容器中不存在指定Bean |
| `@ConditionalOnProperty` | 配置属性满足条件 |
| `@ConditionalOnWebApplication` | 是Web应用 |

### 4.3 自动配置类来源

1. **Spring Boot官方**：`spring-boot-autoconfigure.jar`
2. **第三方启动器**：各自jar包中
3. **自定义**：项目内定义

**约定位置**：`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

### 4.4 排除自动配置

```java
// 方式一：注解排除
@SpringBootApplication(exclude = {DataSourceAutoConfiguration.class})

// 方式二：配置排除
spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration
```

### 4.5 查看自动配置报告

```properties
# 开启调试模式，查看自动配置详情
debug=true
```

---

## 五、Web开发

### 5.1 静态资源处理

#### 默认静态资源路径

```
classpath:/META-INF/resources/
classpath:/resources/
classpath:/static/          # 最常用
classpath:/public/
```

#### 静态资源配置

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

#### 代码方式配置

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

### 5.2 WebJars支持

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

### 5.3 静态资源缓存配置

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

### 5.4 路径匹配策略

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

### 5.5 拦截器配置

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

### 5.3 跨域配置（CORS）

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

### 5.4 异常处理

#### 全局异常处理（前后端分离推荐）

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

#### 传统Web项目错误页面

```
classpath:/templates/error/404.html    # 精确错误码
classpath:/templates/error/4xx.html    # 模糊错误码
classpath:/templates/error.html        # 通用错误页
```

### 5.6 内容协商

```yaml
spring:
  mvc:
    contentnegotiation:
      favor-parameter: true       # 优先使用参数方式
      parameter-name: format      # 参数名
      media-types:
        yaml: text/yaml           # 自定义媒体类型
```

### 5.7 自定义HttpMessageConverter

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

### 5.8 文件上传

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

### 5.9 Web服务器配置

#### 切换为Jetty

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

#### Tomcat优化配置

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

---

## 六、数据访问

### 6.1 整合MyBatis

#### 依赖

```xml
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
    <version>3.0.3</version>
</dependency>
<dependency>
    <groupId>com.mysql</groupId>
    <artifactId>mysql-connector-j</artifactId>
    <scope>runtime</scope>
</dependency>
```

#### 配置

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/db
    username: root
    password: 123456
    driver-class-name: com.mysql.cj.jdbc.Driver

mybatis:
  mapper-locations: classpath:mapper/*.xml
  type-aliases-package: com.example.entity
  configuration:
    map-underscore-to-camel-case: true  # 下划线转驼峰
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl  # 打印SQL
```

#### Mapper扫描

```java
@SpringBootApplication
@MapperScan("com.example.mapper")
public class DemoApplication { }
```

### 6.2 整合MyBatis-Plus

```xml
<dependency>
    <groupId>com.baomidou</groupId>
    <artifactId>mybatis-plus-boot-starter</artifactId>
    <version>3.5.5</version>
</dependency>
```

```java
@Mapper
public interface UserMapper extends BaseMapper<User> { }
```

### 6.3 分页插件（PageHelper）

```xml
<dependency>
    <groupId>com.github.pagehelper</groupId>
    <artifactId>pagehelper-spring-boot-starter</artifactId>
    <version>2.1.0</version>
</dependency>
```

```java
@GetMapping("/list")
public PageInfo<User> list(@RequestParam(defaultValue = "1") int pageNo) {
    PageHelper.startPage(pageNo, 10);
    List<User> list = userService.findAll();
    return new PageInfo<>(list);
}
```

### 6.4 事务管理

```java
@Service
@Transactional(rollbackFor = Exception.class)
public class OrderServiceImpl implements OrderService {
    
    @Override
    public void createOrder(Order order) {
        // 事务内的操作
    }
}
```

---

## 七、常用功能

### 7.1 Bean Validation

#### 依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-validation</artifactId>
</dependency>
```

#### 常用约束注解

| 注解 | 说明 |
|------|------|
| `@NotNull` | 值不为null |
| `@NotEmpty` | 不为null且长度>0 |
| `@NotBlank` | 不为null且trim后长度>0 |
| `@Size(min,max)` | 长度范围 |
| `@Min(value)` | 最小值 |
| `@Max(value)` | 最大值 |
| `@Email` | 邮箱格式 |
| `@Pattern(regexp)` | 正则匹配 |

#### 使用示例

```java
@Data
public class UserDTO {
    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 20, message = "用户名长度2-20")
    private String username;
    
    @NotBlank(message = "邮箱不能为空")
    @Email(message = "邮箱格式不正确")
    private String email;
    
    @Pattern(regexp = "^1[3-9]\\d{9}$", message = "手机号格式不正确")
    private String phone;
}

@PostMapping("/user")
public Result<Void> create(@Valid @RequestBody UserDTO dto) {
    // 校验失败自动抛出异常
    return Result.ok();
}
```

### 7.2 统一响应封装

```java
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class R<T> {
    private Integer code;
    private String msg;
    private T data;
    private Long timestamp;
    
    public static <T> R<T> ok() {
        return R.<T>builder().code(200).msg("成功").timestamp(System.currentTimeMillis()).build();
    }
    
    public static <T> R<T> ok(T data) {
        return R.<T>builder().code(200).msg("成功").data(data).timestamp(System.currentTimeMillis()).build();
    }
    
    public static <T> R<T> error(String msg) {
        return R.<T>builder().code(500).msg(msg).timestamp(System.currentTimeMillis()).build();
    }
    
    public static <T> R<T> error(int code, String msg) {
        return R.<T>builder().code(code).msg(msg).timestamp(System.currentTimeMillis()).build();
    }
}
```

### 7.3 定时任务

#### 启用定时任务

```java
@SpringBootApplication
@EnableScheduling
public class DemoApplication { }
```

#### 定义定时任务

```java
@Component
public class ScheduledTasks {
    
    // 固定频率执行（上次开始时间+间隔）
    @Scheduled(fixedRate = 5000)
    public void fixedRateTask() { }
    
    // 固定延迟执行（上次结束时间+间隔）
    @Scheduled(fixedDelay = 5000)
    public void fixedDelayTask() { }
    
    // 初始延迟
    @Scheduled(initialDelay = 10000, fixedRate = 5000)
    public void initialDelayTask() { }
    
    // Cron表达式（秒 分 时 日 月 周）
    @Scheduled(cron = "0 0 2 * * ?")  // 每天凌晨2点
    public void cronTask() { }
}
```

#### Cron表达式详解

Cron表达式由6-7个字段组成，用空格分隔：

```
秒 分 时 日 月 星期 [年]
```

| 字段 | 范围 | 说明 |
|------|------|------|
| 秒 | 0-59 | |
| 分 | 0-59 | |
| 时 | 0-23 | |
| 日 | 1-31 | |
| 月 | 1-12或JAN-DEC | |
| 星期 | 0-7或SUN-SAT | 0和7都表示周日 |
| 年 | 1970-2099 | 可选 |

**通配符说明：**

| 符号 | 含义 |
|------|------|
| `*` | 所有可能的值 |
| `,` | 列出的值，如 `0 0 0,12 * * ?` 表示0点和12点 |
| `-` | 范围，如 `0 0 0-3 * * ?` 表示0点到3点 |
| `/` | 增量，如 `0 0/5 * * * ?` 表示每5分钟 |
| `?` | 不指定（仅用于日和星期字段） |
| `L` | 最后一天（日字段）或最后一个（星期字段） |
| `W` | 离指定日期最近的工作日 |
| `#` | 每月第几个星期几，如 `6#3` 表示第3个星期六 |

**常用表达式示例：**

| 表达式 | 说明 |
|--------|------|
| `0 0 * * * ?` | 每小时 |
| `0 0 0 * * ?` | 每天零点 |
| `0 0 0 * * 1` | 每周一零点 |
| `0 0 0 1 * ?` | 每月1号零点 |
| `0 */5 * * * ?` | 每5分钟 |
| `0 30 * * * ?` | 每小时的第30分钟 |
| `0 0 14 * * ?` | 每天14:00执行 |
| `0 0 14 ? * MON` | 每周一14:00执行 |
| `59 59 23 L * ?` | 每月最后一天的23:59:59 |
| `0 0 9 1W * ?` | 每月第一个工作日的09:00 |
| `0 0 17 ? * 5L` | 每月最后一个星期五的17:00 |
| `0 0 12 ? * WED#2` | 每月第二个星期三的12:00 |

### 7.4 异步方法

#### 启用异步

```java
@SpringBootApplication
@EnableAsync
public class DemoApplication { }
```

#### 配置线程池

```java
@Configuration
public class AsyncConfig {
    
    @Bean("taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }
}
```

#### 使用异步方法

```java
@Service
public class EmailService {
    
    @Async("taskExecutor")
    public void sendEmail(String to, String subject, String content) {
        // 异步发送邮件
    }
}
```

**注意事项**：
- 必须是public方法
- 同类内部调用不生效（基于代理）
- 建议配置线程池参数
- 生产环境一定要配置合理的拒绝策略

#### 多线程池配置

```java
@Configuration
public class AsyncConfig {

    // 通用线程池
    @Bean("taskExecutor")
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(10);
        executor.setMaxPoolSize(50);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("async-task-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.setWaitForTasksToCompleteOnShutdown(true);
        executor.setAwaitTerminationSeconds(60);
        executor.initialize();
        return executor;
    }

    // IO密集型任务线程池
    @Bean("ioTaskExecutor")
    public Executor ioTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(20);      // IO密集型可设置更多线程
        executor.setMaxPoolSize(100);
        executor.setQueueCapacity(500);
        executor.setThreadNamePrefix("async-io-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.CallerRunsPolicy());
        executor.initialize();
        return executor;
    }

    // CPU密集型任务线程池
    @Bean("cpuTaskExecutor")
    public Executor cpuTaskExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        int cpuCores = Runtime.getRuntime().availableProcessors();
        executor.setCorePoolSize(cpuCores + 1);  // CPU核数+1
        executor.setMaxPoolSize(cpuCores * 2);
        executor.setQueueCapacity(100);
        executor.setThreadNamePrefix("async-cpu-");
        executor.setRejectedExecutionHandler(new ThreadPoolExecutor.AbortPolicy());
        executor.initialize();
        return executor;
    }
}
```

使用指定线程池：

```java
@Service
public class OrderService {
    
    @Async("ioTaskExecutor")
    public void processFile() {
        // IO密集型任务
    }
    
    @Async("cpuTaskExecutor")
    public void calculate() {
        // CPU密集型任务
    }
}
```

### 7.5 接口文档（Knife4j）

#### 依赖

```xml
<dependency>
    <groupId>com.github.xiaoymin</groupId>
    <artifactId>knife4j-openapi3-jakarta-spring-boot-starter</artifactId>
    <version>4.5.0</version>
</dependency>
```

#### 配置

```yaml
spring:
  mvc:
    pathmatch:
      matching-strategy: ant_path_matcher

knife4j:
  enable: true
  openapi:
    title: API文档
    description: 接口文档描述
    version: 1.0.0
```

#### 注解使用

```java
@Tag(name = "用户管理", description = "用户相关接口")
@RestController
@RequestMapping("/users")
public class UserController {
    
    @Operation(summary = "创建用户", description = "添加新用户")
    @PostMapping
    public Result<User> create(
            @Parameter(description = "用户信息", required = true)
            @RequestBody User user) {
        return Result.ok();
    }
}

@Schema(description = "用户实体")
public class User {
    @Schema(description = "用户ID", example = "1")
    private Long id;
    
    @Schema(description = "用户名", required = true)
    private String username;
}
```

---

## 八、AOP编程

### 8.1 引入依赖

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-aop</artifactId>
</dependency>
```

引入后会自动引入aop依赖和aspectj依赖：
- **aop依赖**：纯Spring AOP实现
- **aspectj依赖**：功能更强大的第三方AOP框架（推荐）

### 8.2 核心概念

| 概念 | 说明 |
|------|------|
| **切面(Aspect)** | 横切关注点的模块化，包含通知和切入点 |
| **通知(Advice)** | 切面在特定连接点执行的动作 |
| **切入点(Pointcut)** | 匹配连接点的表达式 |
| **连接点(JoinPoint)** | 程序执行过程中的某个点，如方法调用 |
| **目标对象(Target)** | 被代理的原始对象 |

### 8.3 通知类型

| 注解 | 说明 |
|------|------|
| `@Before` | 前置通知，方法执行前 |
| `@After` | 后置通知，方法执行后（无论是否异常） |
| `@AfterReturning` | 返回通知，方法成功返回后 |
| `@AfterThrowing` | 异常通知，方法抛出异常后 |
| `@Around` | 环绕通知，包裹方法执行 |

### 8.4 切入点表达式

```java
// 匹配service包下所有类的所有方法
@Before("execution(* com.example.service..*.*(..))")

// 匹配指定类的方法
@Before("execution(* com.example.service.UserService.*(..))")

// 匹配以save开头的方法
@Before("execution(* com.example.service.*.save*(..))")

// 匹配第一个参数为String的方法
@Before("execution(* com.example.service.*.*(String, ..))")

// 使用@annotation匹配标注了特定注解的方法
@Before("@annotation(com.example.annotation.Log)")

// 组合表达式
@Before("execution(* com.example.service..*.*(..)) && @annotation(log)")
```

### 8.5 完整示例

```java
@Component  // 纳入IoC容器
@Aspect     // 声明为切面类
public class LogAspect {

    // 定义切入点（复用）
    @Pointcut("execution(* com.example.service..*.*(..))")
    public void servicePointcut() {}

    // 前置通知
    @Before("servicePointcut()")
    public void beforeLog(JoinPoint joinPoint) {
        String methodName = joinPoint.getSignature().getName();
        Object[] args = joinPoint.getArgs();
        System.out.println("[LOG] 方法 " + methodName + " 开始执行，参数：" + Arrays.toString(args));
    }

    // 后置返回通知
    @AfterReturning(pointcut = "servicePointcut()", returning = "result")
    public void afterReturningLog(JoinPoint joinPoint, Object result) {
        String methodName = joinPoint.getSignature().getName();
        System.out.println("[LOG] 方法 " + methodName + " 执行成功，返回值：" + result);
    }

    // 异常通知
    @AfterThrowing(pointcut = "servicePointcut()", throwing = "ex")
    public void afterThrowingLog(JoinPoint joinPoint, Exception ex) {
        String methodName = joinPoint.getSignature().getName();
        System.out.println("[LOG] 方法 " + methodName + " 抛出异常：" + ex.getMessage());
    }

    // 环绕通知
    @Around("servicePointcut()")
    public Object aroundLog(ProceedingJoinPoint joinPoint) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        long start = System.currentTimeMillis();
        
        System.out.println("[LOG] 环绕通知：方法 " + methodName + " 开始");
        
        try {
            Object result = joinPoint.proceed();  // 执行目标方法
            long cost = System.currentTimeMillis() - start;
            System.out.println("[LOG] 环绕通知：方法 " + methodName + " 结束，耗时 " + cost + "ms");
            return result;
        } catch (Exception e) {
            System.out.println("[LOG] 环绕通知：方法 " + methodName + " 异常");
            throw e;
        }
    }
}
```

### 8.6 自定义注解实现AOP

定义注解：

```java
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Log {
    String value() default "";
    boolean printParams() default true;
}
```

切面类：

```java
@Component
@Aspect
public class LogAnnotationAspect {

    @Around("@annotation(log)")
    public Object around(ProceedingJoinPoint joinPoint, Log log) throws Throwable {
        String methodName = joinPoint.getSignature().getName();
        String desc = log.value();
        
        System.out.println("[LOG] " + desc + " - 方法：" + methodName);
        
        if (log.printParams()) {
            System.out.println("[LOG] 参数：" + Arrays.toString(joinPoint.getArgs()));
        }
        
        long start = System.currentTimeMillis();
        Object result = joinPoint.proceed();
        long cost = System.currentTimeMillis() - start;
        
        System.out.println("[LOG] 耗时：" + cost + "ms");
        return result;
    }
}
```

使用注解：

```java
@Service
public class UserService {
    
    @Log("保存用户")
    public void saveUser(User user) {
        // 业务逻辑
    }
}
```

### 8.7 常见应用场景

1. **日志记录**：记录方法入参、返回值、执行时间
2. **权限校验**：方法执行前检查用户权限
3. **事务管理**：统一控制事务边界
4. **性能监控**：统计方法执行耗时
5. **异常处理**：统一捕获和处理异常
6. **缓存控制**：方法级缓存的添加和清除

---

## 九、高级特性

### 9.1 自定义Starter

#### 项目结构

```
my-spring-boot-starter/
├── src/main/java/
│   └── com/example/autoconfigure/
│       ├── MyAutoConfiguration.java
│       ├── MyProperties.java
│       └── MyService.java
└── src/main/resources/
    └── META-INF/
        └── spring/
            └── org.springframework.boot.autoconfigure.AutoConfiguration.imports
```

#### 配置属性类

```java
@Data
@ConfigurationProperties(prefix = "my.starter")
public class MyProperties {
    private String name = "default";
    private boolean enabled = true;
    private int timeout = 3000;
}
```

#### 服务类

```java
public class MyService {
    private MyProperties properties;
    
    public MyService(MyProperties properties) {
        this.properties = properties;
    }
    
    public String sayHello() {
        return "Hello, " + properties.getName();
    }
}
```

#### 自动配置类

```java
@Configuration
@ConditionalOnClass(MyService.class)
@EnableConfigurationProperties(MyProperties.class)
public class MyAutoConfiguration {
    
    @Bean
    @ConditionalOnMissingBean
    @ConditionalOnProperty(prefix = "my.starter", name = "enabled", havingValue = "true", matchIfMissing = true)
    public MyService myService(MyProperties properties) {
        return new MyService(properties);
    }
}
```

#### 注册自动配置

创建文件：`META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`

```
com.example.autoconfigure.MyAutoConfiguration
```

#### 打包发布

```xml
<!-- pom.xml -->
<groupId>com.example</groupId>
<artifactId>my-spring-boot-starter</artifactId>
<version>1.0.0</version>

<dependencies>
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter</artifactId>
    </dependency>
</dependencies>
```

#### 使用Starter

```xml
<dependency>
    <groupId>com.example</groupId>
    <artifactId>my-spring-boot-starter</artifactId>
    <version>1.0.0</version>
</dependency>
```

```yaml
my:
  starter:
    name: myapp
    enabled: true
    timeout: 5000
```

```java
@Service
public class UserService {
    @Autowired
    private MyService myService;
    
    public void test() {
        System.out.println(myService.sayHello());
    }
}
```

### 9.2 事件监听

```java
// 定义事件
public class OrderCreatedEvent extends ApplicationEvent {
    private Long orderId;
    
    public OrderCreatedEvent(Object source, Long orderId) {
        super(source);
        this.orderId = orderId;
    }
}

// 发布事件
@Service
public class OrderService {
    @Autowired
    private ApplicationEventPublisher publisher;
    
    public void createOrder() {
        // 创建订单...
        publisher.publishEvent(new OrderCreatedEvent(this, orderId));
    }
}

// 监听事件
@Component
public class OrderEventListener {
    @EventListener
    public void handleOrderCreated(OrderCreatedEvent event) {
        // 处理订单创建事件
    }
}
```

### 9.3 健康检查

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics
  endpoint:
    health:
      show-details: always
```

---

## 十、附录：常用配置速查

### 9.1 Server配置

```properties
server.port=8080
server.servlet.context-path=/api
server.tomcat.max-threads=200
server.tomcat.connection-timeout=20000
```

### 9.2 数据源配置

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/db
spring.datasource.username=root
spring.datasource.password=123456
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.type=com.zaxxer.hikari.HikariDataSource
```

### 9.3 Redis配置

```properties
spring.data.redis.host=localhost
spring.data.redis.port=6379
spring.data.redis.password=
spring.data.redis.database=0
```

### 9.4 日志配置

```properties
# 日志级别
logging.level.root=INFO
logging.level.com.example=DEBUG

# 日志分组（批量设置多个包）
spring.logging.group.mybusiness=com.example.service,com.example.controller
logging.level.mybusiness=DEBUG

# SpringBoot内置日志组
logging.level.web=DEBUG    # Spring Web相关
logging.level.sql=DEBUG    # JDBC和Hibernate相关

# 日志文件
logging.file.name=./logs/app.log

# 滚动日志
logging.logback.rollingpolicy.max-file-size=100MB
logging.logback.rollingpolicy.max-history=30
```

### 9.5 Lombok常用注解

```java
// 基础注解
@Data                    // 生成getter、setter、toString、equals、hashCode
@Getter                 // 仅生成getter
@Setter                 // 仅生成setter
@ToString               // 生成toString
@EqualsAndHashCode      // 生成equals和hashCode

// 构造方法
@NoArgsConstructor      // 无参构造
@AllArgsConstructor     // 全参构造
@RequiredArgsConstructor // 为final字段生成构造方法

// 高级注解
@Value                  // 创建不可变对象（所有字段final，只有getter）
@Builder                // 生成建造者模式代码
@Singular("addItem")    // 配合@Builder使用，支持集合的链式添加
@Slf4j                  // 生成日志对象：private static final Logger log
```

@Builder使用示例：

```java
@Builder
public class User {
    private String name;
    private Integer age;
    private List<String> hobbies;
}

// 使用
User user = User.builder()
    .name("张三")
    .age(25)
    .hobby("读书")      // @Singular生成的单数方法
    .hobby("游泳")
    .build();
```

@Slf4j使用示例：

```java
@Slf4j
@Service
public class UserService {
    public void save() {
        log.info("保存用户");
        log.debug("调试信息：{}", "参数值");
        log.error("错误信息", exception);
    }
}
```

### 9.6 Banner配置

```properties
# 关闭banner
spring.main.banner-mode=off
```

```java
// 代码方式关闭
@SpringBootApplication
public class MyApplication {
    public static void main(String[] args) {
        SpringApplication app = new SpringApplication(MyApplication.class);
        app.setBannerMode(Banner.Mode.OFF);
        app.run(args);
    }
}
```

自定义banner：在`src/main/resources`下创建`banner.txt`，内容如：

```
  ___  ___  ___
 / __|| _ )/ __|
 \__ \| _ \\__ \
 |___/|___/|___/
```

### 9.7 Jackson配置

```properties
spring.jackson.date-format=yyyy-MM-dd HH:mm:ss
spring.jackson.time-zone=GMT+8
spring.jackson.default-property-inclusion=non_null
```

### 9.8 Maven常用命令

```bash
# 编译
mvn compile

# 测试
mvn test

# 打包
mvn clean package

# 跳过测试打包
mvn clean package -DskipTests

# 运行
mvn spring-boot:run
```

---

## 开发避坑指南

### 1. 组件扫描问题
- **现象**：Controller/service无法注入
- **原因**：类不在主入口类所在包及子包下
- **解决**：调整包结构或手动配置`@ComponentScan`

### 2. 配置不生效
- **现象**：修改配置后无变化
- **原因**：配置文件位置错误或优先级被覆盖
- **解决**：检查配置文件位置和优先级规则

### 3. 事务不生效
- **现象**：@Transactional标注后事务未回滚
- **原因**：同类内部调用或异常被捕获
- **解决**：确保外部调用，异常抛出且配置rollbackFor

```java
// 正确做法
@Service
public class OrderService {
    @Transactional(rollbackFor = Exception.class)
    public void createOrder() {
        // 业务逻辑，异常会自动回滚
    }
}

// 错误做法：同类内部调用
@Service
public class OrderService {
    public void process() {
        createOrder();  // 事务不生效！
    }
    
    @Transactional
    public void createOrder() {
        // 事务不会生效
    }
}
```

### 4. 异步方法不生效
- **现象**：@Async标注后仍是同步执行
- **原因**：同类内部调用
- **解决**：通过注入的代理对象调用

```java
// 正确做法
@Service
public class OrderService {
    @Autowired
    private OrderService self;  // 注入自己
    
    public void process() {
        self.sendEmail();  // 通过代理调用
    }
    
    @Async
    public void sendEmail() {
        // 异步执行
    }
}
```

### 5. 静态资源404
- **现象**：访问静态资源返回404
- **原因**：路径配置错误或控制器拦截
- **解决**：检查static-path-pattern和拦截器配置

### 6. Cron表达式不生效
- **现象**：定时任务不按预期执行
- **原因**：表达式格式错误或时区问题
- **解决**：使用在线工具验证，必要时指定时区

```java
// 指定时区
@Scheduled(cron = "0 0 2 * * ?", zone = "Asia/Shanghai")
public void task() {
    // 每天凌晨2点执行（上海时区）
}
```

### 7. AOP不生效
- **现象**：切面逻辑未执行
- **原因**：目标对象未被Spring管理或同类内部调用
- **解决**：确保目标类有@Component等注解，通过代理调用

```java
// 确保切面类被扫描
@Component
@Aspect
public class LogAspect {
    // ...
}

// 确保目标类被Spring管理
@Service
public class UserService {
    // ...
}
```

---

*本手册基于Spring Boot 3.x编写，持续更新中...*
