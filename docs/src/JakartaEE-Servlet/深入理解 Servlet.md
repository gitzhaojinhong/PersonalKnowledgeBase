## 深入理解 Servlet
### BS 系统涉及的角色与协议
**<font style="color:#DF2A3F;">详细图：</font>**

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748698438324-7379061b-2b64-4a15-b633-8be0a994a1d3.png)



**<font style="color:#DF2A3F;">简略图：</font>**

<!-- 这是一张图片，ocr 内容为： -->
![1](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748591918933-62254fe4-fd52-4fd3-a83f-76da1d33a44e.png)

****

**4 个角色：**

+ 浏览器开发者（开发谷歌浏览器的那些人）
+ Web 服务器开发者（开发 Tomcat 服务器的那些人）
+ Web 应用开发者（JavaWeb 程序员，说的是我们）
+ 数据库服务器开发者（开发 MySQL 数据库的那些人）



**3 个协议：**

+ 浏览器和 Web 服务器之间的通信协议 HTTP。
+ Web 服务器和 Web 应用之间都必须遵循 Servlet 规范。这样 Web 服务器和 Web 应用才可以解耦合。**<font style="color:#DF2A3F;">（怎么理解解耦合：Web 应用开发完成后不一定非要部署到 Tomcat 中，可以部署到任何一个实现了 Servlet 规范的容器中）</font>**
+ Web 应用中的 Java 程序和数据库服务器之间必须遵循 JDBC 规范。这样 Java 程序和具体的数据库产品就解耦合了。**<font style="color:#DF2A3F;">（怎么理解解耦合：Java 程序不一定非要连接 MySQL 数据库，不改任何代码的前提下，还可以连接 Oracle 数据库）</font>**

### Servlet 规范的规定
只有遵守了 Servlet 规范，web 应用才能够运行在不同的符合规范的 web 服务器中。你需要永远记住这句话。

:::info
定义了一些接口和类

:::

Servlet 规范定义了一些接口和类，例如接口 `jakarta.servlet.Servlet`、`jakarta.servlet.ServletRequest`、`jakarta.servlet.ServletResponse`。Tomcat 服务器面向接口调用和实现。JavaWeb 程序员也面向这些接口调用和实现。这样 Web 服务器和 Web 应用就达到了解耦合。

:::info
规定了 JavaWeb 应用的目录结构

:::

JavaWeb 应用的目录结构不能随便写，也是 Servlet 规范中规定的，这样我的项目就可以不依赖具体的 Web 服务器了。只要这个服务器是一个符合 Servlet 规范的服务器，都可以运行我的项目。



为了保证 web 应用的可移植性（可以运行在不同的 web 服务器中），Servlet 规范中规定了 web 应用的目录结构，一个标准的 JavaWeb 应用目录结构必须遵守以下规范：

```plain
webapproot
    |-------html
    |-------css
    |-------javascript
    |-------其它静态资源
    |-------WEB-INF
               |-------classes
               |-------lib
               |-------web.xml
```



1. 静态资源直接放在 web 应用的根目录下即可。这里的静态资源包括但不限于：html css javascript images 等。
2. WEB-INF 名字必须是全部大写的 `WEB-INF`
3. 放在 `WEB-INF`目录下的资源是**<font style="color:#DF2A3F;">受保护的</font>**，不可在浏览器地址栏上通过地址直接访问。例如在 `WEB-INF`放一个 `index.html`，在浏览器地址栏上访问 `http://localhost:8080/webapproot/WEB-INF/index.html`会出现 `404`错误。（404 是 HTTP 状态码，表示访问的资源找不到。）
4. `WEB-INF\classes`目录下放字节码。
5. `WEB-INF\lib`目录下放第三方的 `jar`包。如连接数据库的驱动 jar 包。当然也可以放到 `CATALINA_HOME/lib`目录下也是可以的，`CATALINA_HOME/lib`是全局的，`WEB-INF/lib`是局部的。
6. `WEB-INF\web.xml`文件中编写请求路径和 Servlet 全限定类名的映射关系。

:::info
规定的配置文件不能随便写

:::

Servlet 规范中规定了 web 应用的配置文件不能随意编写，因为 Tomcat 服务器是按照这个规范去找这个文件，去解析这个文件的：

1. 文件名必须叫做 `web.xml`。
2. 文件必须存放到 `webapproot/WEB-INF/web.xml`这个位置。
3. web.xml 文件中的具体配置信息也不能随便写，例如要配置一个请求路径和 Servlet 全限定类名之间的映射关系，必须按照以下配置进行：

```xml
<!--servlet配置信息-->
<servlet>
  <!--servlet的名字随便写一个，但是要保证和servlet mapping中的servlet名字一致。-->
  <servlet-name>loginServlet</servlet-name>
  <!--这里必须填写Servlet类的全限定类名-->
  <servlet-class>com.jkweilai.servlet.LoginServlet</servlet-class>
</servlet>
<!--servlet映射信息-->
<servlet-mapping>
  <servlet-name>loginServlet</servlet-name>
  <!--请求路径必须以 / 开始，不要添加项目名。-->
  <url-pattern>/login</url-pattern>
  <!--支持编写多个-->
  <url-pattern>/a/b/c</url-pattern>
</servlet-mapping>
```



