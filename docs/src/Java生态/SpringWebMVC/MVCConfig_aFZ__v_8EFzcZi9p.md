## MVC Config

## 启动与配置MVC

> SpringBoot项目已经自动配置好了MVC的一切，不需要加`@EnableWebMVC`，如果强行添加`@EnableWebMVC`，SpringBoot的自动配置会失效。

正确做法：

```java
// 这样 Spring Boot 的自动配置依然生效，你只是在它基础上加点东西。
@Configuration
public class WebConfiguration implements WebMvcConfigurer {
    // 只重写你想定制的方法，比如加拦截器、配CORS
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // ...
    }
}
```

## 类型转换器配置

Spring MVC 启动时自动装好了常用类型的格式化工具：

* **数字类型**：`Integer`、`Long`、`BigDecimal`、`Double` 等，字符串进来自动解析
* **日期类型**：`LocalDate`、`LocalDateTime`、`Date` 等，支持常见格式

如果默认转换器不能满足，可通过`WebMvcConfigurer`注册自定义转换器：

```java
@Configuration
public class WebConfiguration implements WebMvcConfigurer {

    @Override
    public void addFormatters(FormatterRegistry registry) {
        registry.addConverter(new Converter<String, Gender>() {
            @Override
            public Gender convert(String source) {
                if ("male".equalsIgnoreCase(source)) return Gender.MALE;
                if ("female".equalsIgnoreCase(source)) return Gender.FEMALE;
                throw new IllegalArgumentException("无法识别的性别: " + source);
            }
        });
    }
}
```

注册之后，Controller 里参数直接写 `@RequestParam Gender gender` 就能自动转了。

## 消息转换器

消息转换器就是 Spring MVC 里的"翻译官"——把你 Controller 返回的 Java 对象翻译成客户端想要的格式（JSON、XML 等），反过来也把客户端发来的格式翻译成 Java 对象。

### 最常用的就是 Jackson

Spring Boot 项目引入 `spring-boot-starter-web` 后，Jackson 自动就配好了。默认注册了一堆转换器，涵盖了日常所有需求：

* `MappingJackson2HttpMessageConverter`：JSON ←→ Java 对象
* `StringHttpMessageConverter`：普通文本
* `ByteArrayHttpMessageConverter`：字节数组
* `FormHttpMessageConverter`：表单数据
* 等等

classpath 上有 Jackson XML 扩展的话，还会自动注册 XML 转换器。

### 自定义消息转换器

默认的够用了，但有些场景需要微调，比如：

* 想统一全局的日期格式
* 想美化输出的 JSON（缩进排版）
* 想给 Jackson 注册额外的模块

Spring 提供了两个入口：

**`configureMessageConverters`**：彻底替换默认的转换器列表（慎用，会把 Spring Boot 自动配的全覆盖掉）

**`extendMessageConverters`**：在默认列表末尾追加你的转换器（推荐，不影响原有的）

```java
@Configuration
public class WebConfiguration implements WebMvcConfigurer {

    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        Jackson2ObjectMapperBuilder builder = new Jackson2ObjectMapperBuilder()
        .indentOutput(true)                          // JSON 缩进美化
        .dateFormat(new SimpleDateFormat("yyyy-MM-dd"));  // 全局日期格式


        // 替换掉默认的 JSON 转换器，用上你的自定义配置
        converters.add(0, new MappingJackson2HttpMessageConverter(builder.build()));
    }
}
```

Jackson 的 `Jackson2ObjectMapperBuilder` 还干了几件贴心的事：

* 自动关掉 `FAIL_ON_UNKNOWN_PROPERTIES`——JSON 里有多余字段不会报错
* 自动关掉 `DEFAULT_VIEW_INCLUSION`
* classpath 上检测到 `jackson-datatype-jsr310`，自动支持 `LocalDate`、`LocalDateTime` 等 Java 8 日期类型
* 检测到 `jackson-datatype-jdk8`，自动支持 `Optional`
* 检测到 `jackson-module-kotlin`，自动支持 Kotlin 数据类

***

> Spring Boot 的特别提醒
>
> Spring Boot 项目中，`WebMvcAutoConfiguration` 会自动检测并注册自己声明的 `HttpMessageConverter` Bean。所以在 Boot 项目里优先用 `HttpMessageConverters` 机制，或者用 `extendMessageConverters` 来追加，千万别用 `configureMessageConverters` 把默认的全覆盖了，否则 Spring Boot 帮你配的那些东西就全没了。

## 静态资源

静态资源配置就是告诉 Spring："这些 URL 别交给 Controller，直接去指定目录下找文件返回，顺便还能加缓存策略。"

> 例如：
>
> 一个 Web 应用里除了动态页面，还有一堆 CSS、JS、图片、字体——这些就是静态资源。没有配置的话，你访问 `/styles/main.css`，Spring MVC 会去 Controller 里找有没有对应的 `@GetMapping`，找不到就 404。配置了静态资源后，Spring 知道 `/styles/**` 这类路径直接去文件系统找，无需经过 Controller。

**Spring Boot 默认已经配好了：**`src/main/resources/static`、`/public`、`/resources`、`/META-INF/resources` 这四个目录下的文件自动作为静态资源提供服务，开箱即用。你直接把文件扔进 `static/` 目录就能访问到。

[手动添加文档跳转](https://docs.spring.io/spring-framework/reference/6.2/web/webmvc/mvc-config/static-resources.html)

## 路径匹配（统一添加路径前缀）

`configurePathMatch` ——批量给某一类 Controller 加上路径前缀，而不用改动每个 Controller 里的代码。

最实用的用法：给 @RestController 统一加 /api 前缀

```java
@Configuration
public class WebConfiguration implements WebMvcConfigurer {


    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        configurer
            .addPathPrefix("/api",HandlerTypePredicate.forAnnotation(RestController.class));
    }
}
```

做了两件事：

* `HandlerTypePredicate.forAnnotation(RestController.class)` 选中所有加了 `@RestController` 的类
* `addPathPrefix("/api", ...)` 给这些类里所有接口路径前面都加上 `/api`

> 如果 Spring Boot 项目里已经通过 `server.servlet.context-path=/api` 配置了全局上下文路径，再用 `addPathPrefix` 加前缀，效果是**叠加**的。
