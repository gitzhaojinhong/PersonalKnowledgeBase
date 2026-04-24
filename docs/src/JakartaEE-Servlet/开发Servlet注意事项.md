## 开发Servlet注意事项
### web注解扫描开关
Tomcat 服务器 webapps 目录下自带了几个项目，这些项目当中都有 `web.xml`，可以从这里拷贝样例文件。

在 `web01\WEB-INF\`目录下新建 `web.xml`文件，进行以下的配置：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="https://jakarta.ee/xml/ns/jakartaee"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="https://jakarta.ee/xml/ns/jakartaee
                      https://jakarta.ee/xml/ns/jakartaee/web-app_6_0.xsd"
  version="6.0"
  metadata-complete="true">

  <servlet>
  	<servlet-name>firstServlet</servlet-name>
  	<servlet-class>com.jkweilai.servlet.HelloServlet</servlet-class>
  </servlet>
  <servlet-mapping>
  	<servlet-name>firstServlet</servlet-name>
  	<url-pattern>/hello</url-pattern>
  </servlet-mapping>
  
</web-app>
```

**需要引起注意：**

`**metadata-complete="true"**`：容器忽略所有注解，只使用 web.xml 配置

`<font style="color:rgb(15, 17, 21);">metadata-complete="false"</font>`<font style="color:rgb(15, 17, 21);">(默认值)：容器会扫描注解</font>

### <font style="color:rgb(15, 17, 21);">前端路径访问写法</font>
```html
<a href="http://localhost:8080/web01/hello">hello1</a>
<!--http://ip:port 可以省略。前端编写的路径目前都以 / 开头，并且一定要添加项目名。-->
<a href="/web01/hello">hello1</a>
```

### WEB-INF目录下的资源受保护
**将 index.html 放到 WEB-INF 目录下测试**

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748859250198-96529326-6d70-419d-9943-1c26131411d9.png)

启动服务器，打开浏览器，输入地址：`http://localhost:8080/web01/WEB-INF/index.html`，如下：

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748859309266-480d57e4-e5f1-498f-8557-a1306d9ea7c6.png)

通过测试得知，放在 WEB-INF 目录下的资源是受保护的。

### 浏览器响应乱码
修改 `HelloServlet.java`中的代码，响应一段中文到浏览器。修改代码之后，保存，然后重新编译，将新生成的代码重新拷贝到 Tomcat 服务器的 `web01/WEB-INF/classes`目录下，最后启动 Tomcat 服务器，打开浏览器访问。

```java
public void service(ServletRequest request,ServletResponse response)
    throws ServletException, IOException{
    // 向控制台打印
    System.out.println("Hello Servlet!");
    // 向浏览器上响应HTML
    PrintWriter out = response.getWriter();
    out.print("<h1>Hello Servlet!</h1>");
    out.print("<h1>你好，服务器端的小程序！</h1>");
}
```



运行效果：

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748859785380-65dcda4d-636c-4795-a329-acade8134963.png)



发现响应中文的时候出现了乱码问题，编写以下代码来解决响应时的中文乱码问题：

```java
public void service(ServletRequest request,ServletResponse response)
    throws ServletException, IOException{
    // 向控制台打印
    System.out.println("Hello Servlet!");
    
    // 向浏览器上响应HTML
    response.setContentType("text/html"); // 设置响应的内容类型，这个对解决响应时的中文乱码问题没有作用。
    response.setCharacterEncoding("UTF-8"); // 设置响应时采用的字符编码方式。这个是解决响应时中文乱码问题的关键。
    
    PrintWriter out = response.getWriter();
    out.print("<h1>Hello Servlet!</h1>");
    out.print("<h1>你好，服务器端的小程序！</h1>");
}
```

重新编译、重新部署、重启服务器访问：

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748860098856-21253950-c8e3-49a0-ba03-49da074c50a6.png)



中文乱码问题就解决了。另外，以上解决中文乱码的两行代码：

```java
response.setContentType("text/html");
response.setCharacterEncoding("UTF-8");
```

可以合并为一行：

```java
response.setContentType("text/html;charset=UTF-8");
```

**注意：这行代码必须出现在 **`**PrintWriter out = response.getWriter();**`**之前才能解决乱码问题。**





`**<font style="color:#DF2A3F;">response.setCharacterEncoding("UTF-8");</font>**`**<font style="color:#DF2A3F;">和 HTML 中的 </font>**`**<font style="color:#DF2A3F;"><meta charset="UTF-8"></font>**`**<font style="color:#DF2A3F;">有什么区别？</font>**

+ <font style="color:rgb(64, 64, 64);">前者：设置Servlet输出流的字符编码方式，影响</font>`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">PrintWriter</font>**`<font style="color:rgb(64, 64, 64);">如何将Java字符串转换为字节序列，是服务器端的行为，发生在内容发送到客户端之前，会自动设置</font>`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">Content-Type</font>**`<font style="color:rgb(64, 64, 64);">响应头的charset部分，例如：</font>`**<font style="color:rgb(64, 64, 64);background-color:rgb(236, 236, 236);">Content-Type: text/html;charset=UTF-8</font>**`<font style="color:rgb(64, 64, 64);">这是最根本的编码设置，决定了数据在传输时的实际编码。</font>
+ <font style="color:rgb(64, 64, 64);">后者：是HTML文档内部的编码声明，浏览器在解析HTML时会参考这个提示，当HTTP响应头没有指定charset时，浏览器会查找meta标签，如果HTTP头已指定charset，meta标签通常会被忽略。</font>

### <font style="color:rgb(64, 64, 64);">关于路径的总结</font>
1. 前端发送请求的路径：以 `/`开始，添加项目名。
2. `web.xml`中 `<url-pattern>` 配置的路径：以 `/` 开始，不添加项目名。
3. `String realPath = application.getRealPath("/WEB-INF/web.xml");` 以 `/` 开始，不添加项目名
4. `InputStream in = application.getResourceAsStream("/WEB-INF/web.xml");` 以 `/` 开始，不添加项目名
5. 欢迎页面：不以 `/` 开始。从项目的根路径下开始加载。
6. 转发路径：以 `/`开始，不添加项目名。
7. 重定向路径：以 `/`开始，添加项目名。

### <font style="color:rgb(64, 64, 64);">关于 Tomcat 标准输出流乱码问题</font>
**当前环境信息如下：**

1. win10 简体中文环境
2. Tomcat 版本： 10.1.48
3. IDEA 版本：2025.2.2
4. JDK 版本：21



**前提是：**

1. IDEA 工具所有涉及到字符编码配置方面都已经配置了 UTF-8
2. Tomcat 服务器的 config/logging.properties 中的字符编码方式也都配置了 UTF-8



**问题是：**在这种情况下，在 Servlet 中使用 `System.out.println()`打印中文时仍然会出现乱码。



**什么原因？**

+ <font style="color:rgb(15, 17, 21);">根本原因：Tomcat容器的标准输出流(System.out)编码与IDEA控制台显示编码不一致。</font>
+ <font style="color:rgb(15, 17, 21);">具体来说：Tomcat的System.out默认使用GBK编码输出，IDEA控制台期望接收UTF-8编码的文本，编码不匹配导致中文显示为乱码。</font>
+ <font style="color:rgb(15, 17, 21);">在 </font>`<font style="color:rgb(15, 17, 21);">Servlet</font>`<font style="color:rgb(15, 17, 21);">程序中可以通过 </font>`**<font style="color:#DF2A3F;">System.out.charset()</font>**`**<font style="color:#DF2A3F;">方法</font>**<font style="color:rgb(15, 17, 21);">来获取 Tomcat 容器的标准输出流的字符编码方式，结果是 GBK。</font>

<font style="color:rgb(15, 17, 21);"></font>

**怎么解决？在 Tomcat 服务器的 **`**VM options**`**配置中添加这个配置：**<font style="color:rgb(15, 17, 21);background-color:rgb(235, 238, 242);">-Dstdout.encoding=UTF-8</font>

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1762937114583-cb3378ea-1d25-4a48-a6d3-d45eec9c0167.png)

