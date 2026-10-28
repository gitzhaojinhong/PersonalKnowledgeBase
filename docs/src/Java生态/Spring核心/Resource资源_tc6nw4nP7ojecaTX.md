## Resource资源

 处理各种底层资源访问，提供了一套统一、强大且易用的资源访问接口。

## Resource 接口的核心设计

`Resource` 接口继承了 `InputStreamSource`（该接口只定义了一个 `getInputStream()` 方法），在此基础上扩展了多个关键方法：

```java
public interface Resource extends InputStreamSource {
    boolean exists();           // 资源是否存在
    boolean isReadable();       // 是否可读
    boolean isOpen();           // 是否已打开流（仅 InputStreamResource 为 true）
    boolean isFile();           // 是否可解析为 File
    URL getURL() throws IOException;
    URI getURI() throws IOException;
    File getFile() throws IOException;
    long contentLength() throws IOException;
    long lastModified() throws IOException;
    Resource createRelative(String relativePath) throws IOException;
    String getFilename();
    String getDescription();    // 用于错误输出的描述信息
}
```

> 需要重点理解 `isOpen()` 方法
>
> * 绝大多数 `Resource` 实现返回 `false`，意味着你可以多次调用 `getInputStream()` 获取新的流。
> * 只有 `InputStreamResource` 返回 `true`，因为它包装的是一个已经打开的、一次性的输入流，用完即止。

***

## 七种内置Resource实现

Spring 提供了七种内置的 `Resource` 实现，每种对应一种资源来源场景：

**1. UrlResource**

包装 `java.net.URL`，支持通过 `file:`、`https:`、`ftp:` 等标准 URL 前缀访问资源。当你在路径中使用了标准 URL 前缀或不带前缀的路径时，Spring 默认会创建 `UrlResource`。

**2. ClassPathResource**

从类路径加载资源，使用线程上下文类加载器或指定的类加载器。这是最常见的资源加载方式之一。需要特别注意的是，如果资源位于 JAR 包中且未被解压到文件系统，则无法解析为 `java.io.File`，但始终可以解析为 `java.net.URL`。

**3. FileSystemResource**

基于 `java.io.File` 或 `java.nio.file.Path` 的文件系统资源实现。它通过 `java.nio.file.Files` API 执行所有操作。如果你需要纯粹的 `Path` 操作，官方推荐使用 `PathResource` 替代。

**4. PathResource**

基于 `java.nio.file.Path` 的纯 NIO( 同步非阻塞模型) 实现，通过 `Path` API 完成所有操作，并且实现了 `WritableResource` 接口（支持写入）。与 `FileSystemResource` 在 `createRelative()` 行为上有所不同。

**5. ServletContextResource**

专为 Web 应用设计，解释相对于 Web 应用根目录的路径。始终支持流式访问和 URL 访问，但只有在 WAR 包被解压、资源物理存在于文件系统上时，才能解析为 `java.io.File`。这取决于 Servlet 容器的实现。

**6. InputStreamResource**

包装一个已经打开的 `InputStream`。这是最特殊的一个实现——`isOpen()` 返回 `true`，意味着流只能读取一次。官方建议只在没有其他更合适的实现时使用，优先考虑 `ByteArrayResource` 或基于文件的实现。

**7. ByteArrayResource**

包装一个字节数组，为其创建 `ByteArrayInputStream`。当你手头有字节数组需要以资源形式访问时，这是一个比 `InputStreamResource` 更好的选择，因为它支持重复读取。

***

## 资源加载

1. **加载单个资源**

`ResourceLoader` 接口定义了资源加载的契约：

所有 `ApplicationContext` 都实现了 `ResourceLoader` 接口。这意味着，可以在任何 ApplicationContext 中通过 `getResource()` 方法获取资源。

```java
public interface ResourceLoader {
    Resource getResource(String location);
    ClassLoader getClassLoader();
}
```

> 加载策略遵循一个聪明的规则：**如果路径不带特定前缀，返回的资源类型与 ApplicationContext 类型匹配**。
>
> 具体来说，同样的路径 `some/resource/path/myTemplate.txt`：
>
> * ApplicationContext 类型为：`ClassPathXmlApplicationContext`，返回的 Resource 类型为：`ClassPathResource`
> * ApplicationContext 类型为：`FileSystemXmlApplicationContext`，返回的 Resource 类型`FileSystemResource`
> * ApplicationContext 类型为：`WebApplicationContext`，返回的 Resource 类型`ServletContextResource`
>
> 如果需要强制使用某种特定的资源类型，可以通过前缀来覆盖这个默认行为：
>
> * `classpath:`，示例：`classpath:com/myapp/config.xml`，说明：强制从类路径加载
> * `file:`，示例：`file:///data/config.xml`，说明：强制从文件系统加载
> * `https:`，示例：`https://myserver/logo.png`，说明：强制通过网络 URL 加载
> * （无前缀），示例：`/data/config.xml`，说明：取决于 ApplicationContext 类型

2. **批量加载与通配符**

`ResourcePatternResolver` 扩展了 `ResourceLoader`，增加了按模式匹配批量加载资源的能力。它定义了一个特殊前缀 `classpath*:`，用于从类路径中加载所有匹配的资源：

```java
public interface ResourcePatternResolver extends ResourceLoader {
    String CLASSPATH_ALL_URL_PREFIX = "classpath*:";
    Resource[] getResources(String locationPattern) throws IOException;
}
```

>  ResourcePatternResolver接口的默认实现：`PathMatchingResourcePatternResolver` 支持 Ant 风格的通配符模式
>
> 例如：
>
> * `/WEB-INF/*-context.xml` —— 匹配目录下所有以 `-context.xml` 结尾的文件
> * `com/mycompany/**/applicationContext.xml` —— 匹配任意层级子目录下的文件
> * `classpath*:META-INF/*-beans.xml` —— 搜索所有类路径位置中的匹配文件
>
> `classpath*:` 和 `classpath:` 的区别非常关键：`classpath*:` 通过 `ClassLoader.getResources()` 获取所有类路径位置上匹配的资源，而 `classpath:` 只返回第一个找到的资源。当多个 JAR 包中存在同名的配置文件时，这个区别尤为重要。

***

## 资源注入的两种方式

在 Spring 中，你可以通过两种方式让 Bean 获取资源：

### ResourceLoader动态加载

当资源路径需要动态确定时（例如根据用户角色加载不同的模板），可以让 Bean 实现 `ResourceLoaderAware` 接口，或者直接通过 `@Autowired` 注入 `ResourceLoader`：

```java
@Component
public class MyBean {
    @Autowired
    private ResourceLoader resourceLoader;

    public void useResource() {
        Resource res = resourceLoader.getResource("classpath:template.txt");
    }
}
```

### 直接注入 Resource 属性

当资源是静态的、已知的，可以直接将 `Resource` 作为属性注入。Spring 内置的 `PropertyEditor` 会自动将字符串路径转换为 `Resource` 对象：

```java
@Component
public class MyBean {
    // 方式一: 读取指定文件
    //@Value("classpath:data/config.json")
    // 方式二: 从yaml或properties文件中读取配置
    @Value("${template.path}")
    private Resource template;
}
```

配合 `@Value` 注解和属性占位符，可以从配置文件中读取路径并自动转换为 `Resource`。甚至支持注入 `Resource[]` 数组，配合 `classpath*:` 前缀可以一次性注入所有匹配的资源。

***

## FileSystemResource 的注意事项

这是一个容易踩坑的地方。当 `FileSystemApplicationContext` 作为 `ResourceLoader` 时，出于向后兼容性的原因，**所有路径都会被当作相对路径处理**，无论是否以斜杠开头。这意味着：

* `ctx.getResource("some/resource/path/myTemplate.txt")`
* `ctx.getResource("/some/resource/path/myTemplate.txt")`

两者在 `FileSystemXmlApplicationContext` 中等价，都相对于当前工作目录解析。如果你需要绝对路径，建议使用 `file:` 前缀强制使用 `UrlResource`：

```java
ctx.getResource("file:///absolute/path/to/file.txt");
```
