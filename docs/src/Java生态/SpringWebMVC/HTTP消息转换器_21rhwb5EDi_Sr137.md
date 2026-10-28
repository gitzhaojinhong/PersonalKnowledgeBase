## HTTP 消息转换器

HttpMessageConverter 是 Spring MVC 里负责"序列化/反序列化"的组件，它把 Java 对象转换成 HTTP 响应体（比如 JSON）发出去，也把 HTTP 请求体（比如 JSON）转换成 Java 对象接进来

## 调用流程

```plain
前端请求 (JSON) 
    → Filter 链 
    → DispatcherServlet 
    → HandlerMapping 找到 Controller 
    → HandlerAdapter 调用方法
        → HttpMessageConverter 反序列化请求体 (JSON → Java 对象)
        → Controller 方法执行
        → HttpMessageConverter 序列化响应体 (Java 对象 → JSON)
    → 返回响应
```

## Spring内置的HTTP消息转换器

| 转换器 | 作用 | 支持的媒体类型 |
| --- | --- | --- |
| **StringHttpMessageConverter** | 读写字符串 | `text/*`
（默认 `text/plain`
） |
| **FormHttpMessageConverter** | 读写表单数据 | `application/x-www-form-urlencoded`
、`multipart/form-data` |
| **ByteArrayHttpMessageConverter** | 读写字节数组 | `*/*`
（默认 `application/octet-stream`
） |
| **MappingJackson2HttpMessageConverter** | 读写 JSON | `application/json`
（需要 jackson-databind 依赖） |
| **MappingJackson2XmlHttpMessageConverter** | 读写 XML | `application/xml`
（需要 jackson-dataformat-xml 依赖） |
| **GsonHttpMessageConverter** | 用 Gson 读写 JSON | `application/json`
（需要 gson 依赖） |
| **ProtobufHttpMessageConverter** | 读写 Protobuf 二进制格式 | `application/x-protobuf` |
| **MarshallingHttpMessageConverter** | 用 Spring OXM 读写 XML | `text/xml`
、`application/xml` |

## 自定义HTTP消息转换器

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
        // 完全替换默认的转换器列表,危险，不推荐
    }

    @Override
    public void extendMessageConverters(List<HttpMessageConverter<?>> converters) {
        // 在默认列表基础上追加或修改，安全，推荐
    }
}
```

> `configureMessageConverters` 会覆盖掉 Spring 默认注册的所有转换器，`extendMessageConverters` 则是在默认列表的基础上再添加或修改。通常用 `extendMessageConverters` 更安全。


> 更新: 2026-09-09 19:03:05  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/egdchb/uos2nrav11uu8vd7>