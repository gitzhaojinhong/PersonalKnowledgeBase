## Tomcat 服务器
### Web 服务器&应用服务器
:::info
Web Server（**Web服务器**）

:::

**Web服务器**是专门用于处理HTTP请求的软件，主要功能是存储、处理和传递网页给客户端（通常是浏览器）。

**主要特点**：

+ 处理HTTP/HTTPS协议请求
+ 返回静态内容（HTML、CSS、JS、图片等）
+ 轻量级，性能高

**Java Web服务器代表**：

1. **Apache Tomcat** - 最流行的Java Web服务器和Servlet容器
2. **Jetty** - 轻量级、嵌入式的Web服务器
3. **Undertow** - JBoss提供的轻量高性能Web服务器

:::info
Application Server（**应用服务器**）

:::

**应用服务器**是为应用程序提供业务逻辑的中间件平台，功能比Web服务器更全面。

**主要特点**：

+ 包含Web服务器的所有功能
+ 支持EJB、JMS、JTA等企业级特性
+ 提供事务管理、连接池、集群等高级功能
+ 支持分布式计算和复杂业务逻辑

**Java应用服务器代表**：

1. **WildFly** (原JBoss AS) - Red Hat开发的开源应用服务器
2. **WebLogic** - Oracle提供的商业应用服务器
3. **WebSphere Application Server** - IBM的商业应用服务器
4. **GlassFish** - Oracle提供的开源参考实现

:::info
总结

:::

**<font style="color:rgb(64, 64, 64);">Web 服务器</font>**<font style="color:rgb(64, 64, 64);"> = 只实现了 Jakarta EE 中的 Servlet + JSP 规范。</font>

**<font style="color:rgb(64, 64, 64);">应用服务器</font>**<font style="color:rgb(64, 64, 64);"> = 实现了完整的 Jakarta EE 规范。</font>

**现代趋势**：随着微服务架构的流行，轻量级的Web服务器(如Tomcat)结合Spring Boot等框架的使用越来越普遍，传统重量级应用服务器的使用在减少。

### Tomcat 简介
:::info
核心功能

:::

+ **<font style="color:rgb(64, 64, 64);">Servlet/JSP容器</font>**<font style="color:rgb(64, 64, 64);">：实现Java EE（现Jakarta EE）的Servlet、JSP规范，支持动态Web应用。</font>
+ **<font style="color:rgb(64, 64, 64);">轻量级</font>**<font style="color:rgb(64, 64, 64);">：相比完整应用服务器，Tomcat更专注于Servlet容器功能。</font>
+ **<font style="color:rgb(64, 64, 64);">嵌入式支持</font>**<font style="color:rgb(64, 64, 64);">：可嵌入Spring Boot等框架作为内嵌服务器。</font>

:::info
<font style="color:rgb(64, 64, 64);">核心组件</font>

:::

+ **<font style="color:rgb(64, 64, 64);">Catalina</font>**<font style="color:rgb(64, 64, 64);">：Servlet容器。（</font>**<font style="color:#DF2A3F;">它是最核心的组件，相当于 Tomcat 的大脑</font>**<font style="color:rgb(64, 64, 64);">）</font>**<font style="color:rgb(64, 64, 64);">Santa Catalina Island</font>**<font style="color:rgb(64, 64, 64);"> 是美国加州附近的一座风景优美的岛屿，延续了 Apache 软件基金会的“地理风”命名风格。</font>
+ **<font style="color:rgb(64, 64, 64);">Coyote</font>**<font style="color:rgb(64, 64, 64);">：HTTP连接器（支持HTTP/1.1、HTTP/2）。</font>
+ **<font style="color:rgb(64, 64, 64);">Jasper</font>**<font style="color:rgb(64, 64, 64);">：JSP引擎。</font>
+ **<font style="color:rgb(64, 64, 64);">Cluster</font>**<font style="color:rgb(64, 64, 64);">：高可用性模块。</font>

:::info
<font style="color:rgb(64, 64, 64);">版本历史</font>

:::

| **<font style="color:rgb(64, 64, 64);">Tomcat版本</font>** | **<font style="color:rgb(64, 64, 64);">发布日期</font>** | **<font style="color:rgb(64, 64, 64);">Servlet/JSP规范</font>** | **<font style="color:rgb(64, 64, 64);">Java EE/Jakarta EE版本</font>** | **<font style="color:rgb(64, 64, 64);">JDK 要求</font>** | **<font style="color:rgb(64, 64, 64);">状态</font>** | **<font style="color:rgb(64, 64, 64);">备注</font>** |
| --- | --- | --- | --- | --- | --- | --- |
| **Tomcat 11** | 2023 年 | Servlet 6.0, JSP 3.1 | Jakarta EE 10 | **JDK 11+** | **过渡版本** |  |
| **<font style="color:#DF2A3F;">Tomcat 10.1</font>** | <font style="color:#DF2A3F;">2022年（持续更新）</font> | <font style="color:#DF2A3F;">Servlet 6.0, JSP 3.1</font> | <font style="color:#DF2A3F;">Jakarta EE 10</font> | **<font style="color:#DF2A3F;">JDK 11+</font>** | **<font style="color:#DF2A3F;">长期支持（LTS）</font>** | <font style="color:#DF2A3F;">包名改为 </font>`**<font style="color:#DF2A3F;background-color:rgb(236, 236, 236);">jakarta.*</font>**`<font style="color:#DF2A3F;">（不兼容旧版）</font><br/><font style="color:#DF2A3F;">当前企业主流版本，呈上升趋势。</font> |
| **Tomcat 10.0** | 2021年 | Servlet 5.0, JSP 3.0 | Jakarta EE 9 | **JDK 8+** | 过渡版本 | 首个 Jakarta EE 兼容版本 |
| **<font style="color:#DF2A3F;">Tomcat 9.0</font>** | <font style="color:#DF2A3F;">2018年（持续更新）</font> | <font style="color:#DF2A3F;">Servlet 4.0, JSP 2.3</font> | <font style="color:#DF2A3F;">Java EE 8</font> | **<font style="color:#DF2A3F;">JDK 8+</font>** | **<font style="color:#DF2A3F;">长期支持（LTS）</font>** | <font style="color:#DF2A3F;">当前企业使用呈减少趋势。</font> |
| **<font style="color:rgb(64, 64, 64);">Tomcat 8.5</font>** | <font style="color:rgb(64, 64, 64);">2016年</font> | <font style="color:rgb(64, 64, 64);">Servlet 3.1, JSP 2.3</font> | <font style="color:rgb(64, 64, 64);">Java EE 7</font> | **<font style="color:rgb(64, 64, 64);">JDK 7+</font>**<font style="color:rgb(64, 64, 64);">（推荐8+）</font> | **<font style="color:rgb(64, 64, 64);">2024年3月终止支持</font>** | <font style="color:rgb(64, 64, 64);">支持HTTP/2、TLS 1.2等</font> |
| **<font style="color:rgb(64, 64, 64);">Tomcat 7.0</font>** | <font style="color:rgb(64, 64, 64);">2011年</font> | <font style="color:rgb(64, 64, 64);">Servlet 3.0, JSP 2.2</font> | <font style="color:rgb(64, 64, 64);">Java EE 6</font> | **<font style="color:rgb(64, 64, 64);">JDK 6+</font>** | <font style="color:rgb(64, 64, 64);">已终止（2021年3月）</font> | <font style="color:rgb(64, 64, 64);">需升级到更高版本</font> |
| **<font style="color:rgb(64, 64, 64);">Tomcat 6.0</font>** | <font style="color:rgb(64, 64, 64);">2007年</font> | <font style="color:rgb(64, 64, 64);">Servlet 2.5, JSP 2.1</font> | <font style="color:rgb(64, 64, 64);">Java EE 5</font> | **<font style="color:rgb(64, 64, 64);">JDK 5+</font>** | <font style="color:rgb(64, 64, 64);">已终止（2016年12月）</font> | <font style="color:rgb(64, 64, 64);">仅适合遗留系统</font> |
| **<font style="color:rgb(64, 64, 64);">Tomcat 5.5</font>** | <font style="color:rgb(64, 64, 64);">2004年</font> | <font style="color:rgb(64, 64, 64);">Servlet 2.4, JSP 2.0</font> | <font style="color:rgb(64, 64, 64);">J2EE 1.4</font> | **<font style="color:rgb(64, 64, 64);">JDK 1.4+</font>** | <font style="color:rgb(64, 64, 64);">已终止（2012年）</font> | <font style="color:rgb(64, 64, 64);">需要JDK 1.4或更高版本</font> |
| **<font style="color:rgb(64, 64, 64);">Tomcat 4.x</font>** | <font style="color:rgb(64, 64, 64);">2002年</font> | <font style="color:rgb(64, 64, 64);">Servlet 2.3, JSP 1.2</font> | <font style="color:rgb(64, 64, 64);">J2EE 1.3</font> | **<font style="color:rgb(64, 64, 64);">JDK 1.3+</font>** | <font style="color:rgb(64, 64, 64);">已终止</font> | <font style="color:rgb(64, 64, 64);">首个Apache主导版本</font> |
| **<font style="color:rgb(64, 64, 64);">Tomcat 3.x</font>** | <font style="color:rgb(64, 64, 64);">1999年</font> | <font style="color:rgb(64, 64, 64);">Servlet 2.2, JSP 1.1</font> | <font style="color:rgb(64, 64, 64);">-</font> | **<font style="color:rgb(64, 64, 64);">JDK 1.1+</font>** | <font style="color:rgb(64, 64, 64);">已终止</font> | <font style="color:rgb(64, 64, 64);">原始版本（Sun捐赠代码）</font> |




**Jakarta EE、JavaSE（JDK）、Servlet、Tomcat，它们的关系是什么？**

+ Jakarta EE 是 Java 企业级开发规范。
+ Jakarta EE 是建立在 Java SE 基础上的（JDK 是最基本的）。
+ Jakarta EE 中的子规范很多，Servlet 是其中的一个子规范。
+ Tomcat 是实现了 Servlet 规范的 Web 服务器/Web 容器。

### Tomcat 下载
Apache 软件基金会官网地址：[https://apache.org/](https://apache.org/)，该页面底部找到 Tomcat

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748569878538-1fdd4748-b1c4-487b-bbb9-0b829f3b7484.png)



或者直接输入 Tomcat 的官网地址：[https://tomcat.apache.org/](https://tomcat.apache.org/) （是 apache 软件基金会官网的子域名，大家可以记住这个子域名的特点。）

`Maven`也是 Apache 的子项目，它的官网地址是：[https://maven.apache.org/](https://maven.apache.org/)



<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748570146789-0b484b5b-e364-4a71-b08a-a10ef6583b90.png)



<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748570270716-5ab64525-228a-4487-8742-eb3b3455ad2a.png)



我们这里把 Tomcat 服务器以及 Tomcat 服务器的源码全部下载下来：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748570460182-4151c19a-05e3-4be0-a893-fb4c3c006ca2.png)

### Tomcat 安装
解压就是安装，直接将<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748570595795-0e188c7e-c198-4a79-b68d-da7c16568f4b.png)解压到没有中文的路径中，

打开 Tomcat 服务器的根目录，如下：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748570701192-239a8725-acac-4a51-be96-92ff3a30fa1a.png)

### Tomcat 目录介绍
:::info
`bin`（Binary）

:::

+ **作用**：存放 Tomcat 的可执行脚本和启动/停止相关的文件。
+ **关键内容**：
    - **启动/停止脚本**：如 `startup.sh`（Linux/macOS）和 `startup.bat`（Windows）用于启动 Tomcat；`shutdown.sh`/`shutdown.bat` 用于停止。
    - 其他工具：如 `catalina.sh`（核心脚本）、`version.sh`（版本检查）等。

:::info
`conf`（Configuration）

:::

+ **作用**：存放 Tomcat 的全局配置文件。
+ **关键文件**：
    - `server.xml`：主配置文件，定义**<font style="color:#DF2A3F;">服务器端口（默认 8080）</font>**、虚拟主机（Host）、连接器（Connector）等。
    - `web.xml`：所有 Web 应用的默认部署描述符（如默认 Servlet、MIME 类型）。

:::info
`lib`（Libraries）

:::

+ **作用**：存放 Tomcat 运行所需的全局 Java 库（JAR 文件）。
+ **关键内容**：Tomcat 核心库：如 `servlet-api.jar`、`jsp-api.jar`、`catalina.jar` 等。

:::info
`logs`

:::

+ **作用**：存放 Tomcat 运行日志和应用日志。
+ **关键文件**：
    - `catalina.out`**/**`catalina.log`：核心引擎日志（启动/停止错误等）。
    - `localhost.log`：应用部署相关的日志（如 Context 加载失败）。
+ **注意**：日志是排查问题的首要位置，可通过 `conf/logging.properties` 配置格式和级别。

:::info
`temp`

:::

+ **作用**：存放临时文件（如上传的文件、Session 持久化数据等）。

:::info
`webapps`

:::

+ **作用：**默认的 Web 应用部署目录。我们开发的 webapp 默认都放到这个目录下。

:::info
`work`

:::

+ **作用**：存放运行时生成的临时文件（主要是 JSP 编译后的 Servlet 类文件和 Session 数据）。
+ **JSP 编译结果**：如 `org/apache/jsp/index_jsp.java` 和 `.class` 文件。

### Tomcat 配置
:::info
配置哪些环境变量

:::

Tomcat 服务器是纯 Java 语言实现的。

启动 Tomcat 服务器时，需要执行 `bin`目录下的 `startup.bat`**<font style="color:#DF2A3F;">（bat 文件是 windows 批处理文件，可批量执行 dos 命令）</font>**，用文本编辑器打开 `startup.bat`文件，可以搜索`CATALINA_HOME`：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748572180318-c7997c9d-ccb7-4dca-ba8b-ee1c59df8bb3.png)

在 windows 环境中，取环境变量值的语法是 `**<font style="color:#DF2A3F;">%变量名%</font>**`，因此 `CATALINA_HOME`这个环境变量是**<font style="color:#DF2A3F;">必须要配置的</font>**，如果没有配置会导致 Tomcat 服务器启动失败。

并且通过以上命令可以看出：当我们执行 `startup.bat`的时候，会自动去找 `catalina.bat`文件。我们再使用文本编辑器将 `catalina.bat`打开，可以搜索 `JAVA_HOME`：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748572466662-737f4d52-821a-47c8-8668-691c333b9c81.png)

通过以上内容可以看出 `JAVA_HOME`环境变量也是必须配置的，如果不配置则无法启动 Tomcat。

Tomcat 服务器是纯 Java 语言实现的，启动 Tomcat 服务器实质上就是执行某个类的 main 方法。



因此要启动 Tomcat 服务器有两个环境变量是必须要配置的：

+ JAVA_HOME=JDK 的根
+ CATALINA_HOME=Tomcat 的根



另外为了能够在 dos 命令窗口的任意位置都能启动和关闭 Tomcat 服务器，还需要将 `CATALINA_HOME\bin`目录配置到 `PATH`环境变量中，但这不是必须的：

+ PATH=%CATALINA_HOME%\bin

:::info
JAVA_HOME 配置

:::

此电脑-->右键-->属性-->高级系统设置-->环境变量

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748572849994-6616f6bb-ff9f-4741-b60f-86128be4e9d8.png)

:::info
CATALINA_HOME 配置

:::

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748572890094-eb822abf-2301-4c97-bd1b-314eaa892bc5.png)

:::info
PATH 配置

:::

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748572944980-ef5c63e0-9be8-4315-84f9-a732d1682e56.png)

### Tomcat 启动和关闭
:::info
启动

:::

windows 环境中执行 startup.bat 来启动 Tomcat：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748573362686-0b7c325b-80df-4559-a4e3-6246167156b1.png)

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748573317395-c624e5dd-af6d-4cd1-994a-a42e46ee7e45.png)

以上的控制台窗口中会显示 Tomcat 服务器运行过程中打印的日志信息。

Tomcat 服务器运行期间这个控制台窗口不能关闭。

:::info
关闭

:::

windows 环境中执行 shutdown.bat 来关闭 Tomcat：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748573450532-cca507ec-3890-4072-a524-5c155eb3fe5d.png)

执行该命令后，之前的控制台窗口会关闭，Tomcat 服务器退出。



日志信息乱码可以通过修改配置文件来解决，打开 `CATALINA_HOME/conf/logging.properties`，将 `UTF-8`修改为 `GBK`，如下(使用idea工具则不需要修改)：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748573620144-c767747f-edc4-49b9-937a-6093d98fe117.png)

重新启动 Tomcat，查看控制台，乱码已解决：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748573657112-0d08445a-6a83-48d9-b91c-3d2d52e0cdf8.png)

:::info
测试

:::

打开浏览器，在浏览器地址栏上输入：http://localhost:8080，你将看到以下页面：

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748574057820-cb1da0a9-2cf1-4d76-b5a7-cc1795b64e5c.png)



提醒：`127.0.0.1` 和 `localhost` 都表示本机。

### 部署项目
部署就是将开发的项目拷贝到 `CATALINA_HOME/webapps`目录下，将开发好的`dept`目录拷贝到该目录下。

<!-- 这是一张图片，ocr 内容为： -->
![](https://cdn.nlark.com/yuque/0/2025/png/21376908/1748586755670-1d70ae94-0e65-4740-8b01-b1f3bbae18a0.png)

