## 三、Servlet核心

### 3.1 Servlet概述

Servlet是运行在服务器端的Java程序，用于接收和响应客户端请求。

**核心特点：**
- 基于Java语言编写
- 运行在Servlet容器中（如Tomcat）
- 处理HTTP请求并生成响应
- 单实例多线程运行

### 3.2 JavaWeb目录结构规范

Servlet 规范规定了 JavaWeb 应用的标准目录结构，保证应用可以部署到任何符合规范的容器中：

```
webapproot/
├── html/                 # 静态资源（HTML、CSS、JS、图片等）
├── css/
├── javascript/
└── WEB-INF/              # 受保护目录，不可通过浏览器直接访问
    ├── classes/          # 编译后的字节码文件（.class）
    ├── lib/              # 项目依赖的第三方 jar 包
    └── web.xml           # Web 应用配置文件
```

**关键规则：**
- `WEB-INF` 名称必须全大写
- 放在 `WEB-INF` 下的资源**受保护**，浏览器无法通过地址栏直接访问（访问会得到 404）
- `WEB-INF/classes` 放字节码，`WEB-INF/lib` 放 jar 包
- `WEB-INF/lib` 是项目局部 jar，`CATALINA_HOME/lib` 是全局 jar

### 3.3 web.xml配置规则

web.xml 的文件名和位置不能随意更改（`webapproot/WEB-INF/web.xml`），配置格式也由 Servlet 规范规定：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="https://jakarta.ee/xml/ns/jakartaee"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="https://jakarta.ee/xml/ns/jakartaee
                      https://jakarta.ee/xml/ns/jakartaee/web-app_6_0.xsd"
  version="6.0"
  metadata-complete="false">

  <!-- Servlet配置 -->
  <servlet>
    <servlet-name>loginServlet</servlet-name>
    <servlet-class>com.example.servlet.LoginServlet</servlet-class>
    <!-- Servlet私有初始化参数 -->
    <init-param>
      <param-name>timeout</param-name>
      <param-value>3000</param-value>
    </init-param>
  </servlet>
  <servlet-mapping>
    <servlet-name>loginServlet</servlet-name>
    <!-- 路径以 / 开始，不加项目名，支持配置多个 -->
    <url-pattern>/login</url-pattern>
  </servlet-mapping>

  <!-- 全局上下文初始化参数（所有Servlet共享） -->
  <context-param>
    <param-name>application.name</param-name>
    <param-value>新闻发布系统</param-value>
  </context-param>

</web-app>
```

**`metadata-complete` 属性：**
- `metadata-complete="true"`：容器忽略所有注解（`@WebServlet` 等），只使用 web.xml 配置
- `metadata-complete="false"`（默认值）：容器扫描注解，注解与 web.xml 并存

### 3.4 Servlet核心接口与类

```
Servlet (接口)
    ↑
GenericServlet (抽象类) - 与协议无关
    ↑
HttpServlet (抽象类) - 专门处理HTTP
    ↑
自定义Servlet
```

#### Servlet接口方法

```java
public interface Servlet {
    // 初始化，Servlet实例创建时调用一次
    void init(ServletConfig config) throws ServletException;
    
    // 获取Servlet配置
    ServletConfig getServletConfig();
    
    // 处理请求的核心方法
    void service(ServletRequest req, ServletResponse res) throws ServletException, IOException;
    
    // 获取Servlet信息
    String getServletInfo();
    
    // 销毁，Servlet实例销毁时调用一次
    void destroy();
}
```

#### HttpServlet常用方法

```java
// 处理GET请求
protected void doGet(HttpServletRequest req, HttpServletResponse resp)

// 处理POST请求
protected void doPost(HttpServletRequest req, HttpServletResponse resp)

// 处理PUT请求
protected void doPut(HttpServletRequest req, HttpServletResponse resp)

// 处理DELETE请求
protected void doDelete(HttpServletRequest req, HttpServletResponse resp)
```

### 3.5 Servlet生命周期

Servlet生命周期由容器管理，包含四个阶段：

```
实例化 → 初始化(init) → 服务(service) → 销毁(destroy)
              ↑              ↓
              └────── 多次调用 ──────┘
```

#### 第一阶段：实例化

- 容器加载Servlet类
- 通过反射调用无参构造方法创建实例
- **只执行一次**

#### 第二阶段：初始化（init）

```java
@Override
public void init(ServletConfig config) throws ServletException {
    super.init(config);
    // 执行初始化操作：加载配置、创建连接池等
    String dbUrl = config.getInitParameter("dbUrl");
}
```

- 实例创建后立即调用
- 用于执行一次性初始化操作
- **只执行一次**

#### 第三阶段：服务（service）

```java
@Override
protected void doGet(HttpServletRequest req, HttpServletResponse resp) 
        throws ServletException, IOException {
    // 处理请求
}
```

- 每次请求都会调用
- HttpServlet根据请求方法分发到doGet/doPost等
- **可执行多次**

#### 第四阶段：销毁（destroy）

```java
@Override
public void destroy() {
    // 执行资源释放：关闭连接、清理缓存等
}
```

- 服务器关闭或应用卸载时调用
- 用于释放资源
- **只执行一次**

### 3.6 Servlet配置方式

#### 方式一：注解配置（推荐）

```java
@WebServlet(
    name = "UserServlet",                    // Servlet名称
    urlPatterns = {"/user", "/users/*"},     // URL映射路径
    initParams = {
        @WebInitParam(name = "encoding", value = "UTF-8")
    },
    loadOnStartup = 1                        // 启动时加载顺序
)
public class UserServlet extends HttpServlet {
    // ...
}
```

**@WebServlet属性说明：**

| 属性 | 说明 | 示例 |
|------|------|------|
| `name` | Servlet名称 | `"UserServlet"` |
| `urlPatterns` | URL映射路径数组 | `{"/user", "/users/*"}` |
| `value` | 同urlPatterns（简化写法） | `"/user"` |
| `initParams` | 初始化参数 | `@WebInitParam(name="k",value="v")` |
| `loadOnStartup` | 启动加载顺序 | `1`（越小越先加载，负数表示懒加载） |

#### 方式二：web.xml配置

```xml
<?xml version="1.0" encoding="UTF-8"?>
<web-app xmlns="https://jakarta.ee/xml/ns/jakartaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="https://jakarta.ee/xml/ns/jakartaee
                             https://jakarta.ee/xml/ns/jakartaee/web-app_6_0.xsd"
         version="6.0">
    
    <!-- Servlet定义 -->
    <servlet>
        <servlet-name>UserServlet</servlet-name>
        <servlet-class>com.example.servlet.UserServlet</servlet-class>
        <init-param>
            <param-name>encoding</param-name>
            <param-value>UTF-8</param-value>
        </init-param>
        <load-on-startup>1</load-on-startup>
    </servlet>
    
    <!-- Servlet映射 -->
    <servlet-mapping>
        <servlet-name>UserServlet</servlet-name>
        <url-pattern>/user</url-pattern>
    </servlet-mapping>
    
</web-app>
```

#### 路径匹配规则

| 路径类型 | 示例 | 说明 |
|----------|------|------|
| 精确匹配 | `/user/login` | 完全匹配该路径 |
| 前缀匹配 | `/user/*` | 以/user/开头的所有路径 |
| 扩展名匹配 | `*.do` | 以.do结尾的所有路径 |
| 根路径 | `/` | 匹配所有请求（默认Servlet） |
| 默认匹配 | `/*` | 匹配所有请求（优先级最低） |

**匹配优先级：** 精确匹配 > 前缀匹配 > 扩展名匹配 > 默认匹配

### 3.7 Servlet开发模板

```java
package com.example.servlet;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.HttpServlet;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

@WebServlet("/user")
public class UserServlet extends HttpServlet {
    
    @Override
    public void init() throws ServletException {
        // 初始化操作
    }
    
    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) 
            throws ServletException, IOException {
        // 设置响应内容类型和编码
        resp.setContentType("application/json;charset=UTF-8");
        
        // 获取请求参数
        String id = req.getParameter("id");
        
        // 执行业务逻辑
        
        // 输出响应
        resp.getWriter().write("{\"status\":\"success\"}");
    }
    
    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) 
            throws ServletException, IOException {
        // 处理POST请求
        req.setCharacterEncoding("UTF-8");
        
        // 获取表单数据
        String username = req.getParameter("username");
        
        // 处理业务逻辑
        
        // 响应或转发
        resp.sendRedirect(req.getContextPath() + "/list");
    }
    
    @Override
    public void destroy() {
        // 资源释放
    }
}
```

### 3.8 设计模式：适配器模式与模板方法模式

理解这两个模式，能让你看懂 Servlet 继承体系的设计意图。

#### 缺省适配器模式（GenericServlet的设计原理）

`Servlet` 接口定义了 `init`、`service`、`destroy`、`getServletConfig`、`getServletInfo` 多个方法，直接实现接口必须写全所有方法，很繁琐。

**缺省适配器**的做法：创建一个抽象类实现目标接口，为所有方法提供空实现（或默认实现），子类只需继承该抽象类并重写自己关注的方法。

`GenericServlet` 正是 `Servlet` 接口的缺省适配器：

```java
// 缺省适配器：为所有方法提供默认实现
public abstract class GenericServlet implements Servlet, ServletConfig, Serializable {
    private transient ServletConfig config;

    // 有参init：保存config，再调用无参init
    @Override
    public void init(ServletConfig config) throws ServletException {
        this.config = config;
        this.init();  // 调用无参版本
    }

    // 无参init：子类覆盖此方法做初始化（不会丢失config）
    public void init() throws ServletException {}

    // 唯一抽象方法，子类必须实现
    @Override
    public abstract void service(ServletRequest req, ServletResponse res) throws ServletException, IOException;

    @Override
    public void destroy() {}  // 空实现

    // 额外扩展：代理到config的方法
    @Override
    public String getInitParameter(String name) { return getServletConfig().getInitParameter(name); }
    @Override
    public Enumeration<String> getInitParameterNames() { return getServletConfig().getInitParameterNames(); }
    @Override
    public ServletContext getServletContext() { return getServletConfig().getServletContext(); }
    @Override
    public String getServletName() { return config.getServletName(); }
}
```

> **注意：** 如果子类需要覆盖 `init`，请覆盖**无参的 `init()`**，不要覆盖 `init(ServletConfig)`，否则 `config` 属性无法被赋值。

#### 模板方法模式（HttpServlet的设计原理）

模板方法模式定义算法骨架放在父类，可变步骤延迟到子类实现。

`HttpServlet` 中的 `service(HttpServletRequest, HttpServletResponse)` 就是模板方法，它根据请求方法（GET/POST/PUT/DELETE…）自动分发到对应的 `doXxx` 钩子方法：

```java
// 模板方法：定义算法骨架，不可重写
protected void service(HttpServletRequest req, HttpServletResponse resp) {
    String method = req.getMethod();
    if (method.equals("GET")) {
        doGet(req, resp);   // 钩子方法：子类重写
    } else if (method.equals("POST")) {
        doPost(req, resp);  // 钩子方法：子类重写
    }
    // ...其他方法
}

// 钩子方法默认实现：返回405，子类按需重写
protected void doGet(HttpServletRequest req, HttpServletResponse resp) {
    sendMethodNotAllowed(req, resp, "GET not supported");
}
protected void doPost(HttpServletRequest req, HttpServletResponse resp) {
    sendMethodNotAllowed(req, resp, "POST not supported");
}
```

这就是为什么我们只需要继承 `HttpServlet` 并重写 `doGet` / `doPost`，无需关心请求分发逻辑。

---

### 3.9 ServletConfig

#### ServletConfig是什么

`ServletConfig` 是 Servlet 规范的一部分（`jakarta.servlet.ServletConfig`），由 Web 服务器创建，在 `init(ServletConfig)` 执行之前创建好，封装了该 Servlet 在 `web.xml` 或注解中的配置信息。

**关系：每一个 Servlet 对象对应一个专属的 `ServletConfig` 对象（一对一关系）。**

#### 如何获取ServletConfig

```java
// 在Servlet中直接调用（GenericServlet已扩展此方法）
ServletConfig config = this.getServletConfig();
```

#### ServletConfig常用方法

```java
// 获取某个初始化参数的值
String value = servletConfig.getInitParameter("paramName");

// 获取所有初始化参数名
Enumeration<String> names = servletConfig.getInitParameterNames();

// 获取当前Servlet的名字（即<servlet-name>中的配置）
String name = servletConfig.getServletName();

// 获取ServletContext对象
ServletContext context = servletConfig.getServletContext();
```

**也可以不先获取ServletConfig，直接在Servlet中调用（GenericServlet已代理好）：**

```java
// 等价写法，底层也是调用servletConfig的方法
String value = this.getInitParameter("paramName");
String name = this.getServletName();
ServletContext context = this.getServletContext();
```

#### 配置示例

```xml
<servlet>
    <servlet-name>uploadServlet</servlet-name>
    <servlet-class>com.example.servlet.FileUploadServlet</servlet-class>
    <!-- Servlet私有初始化参数，封装进该Servlet的ServletConfig -->
    <init-param>
        <param-name>uploadDir</param-name>
        <param-value>/uploads</param-value>
    </init-param>
    <init-param>
        <param-name>maxFileSize</param-name>
        <param-value>10485760</param-value>
    </init-param>
</servlet>
```

```java
// 读取上面的配置
String uploadDir = this.getInitParameter("uploadDir");
String maxSize = this.getInitParameter("maxFileSize");
```

---

### 3.10 ServletContext

#### ServletContext是什么

`ServletContext`（`jakarta.servlet.ServletContext`）是整个 Web 应用共享的一个对象，变量名一般叫 `application`。

- Web 服务器**启动时创建**，**关闭时销毁**，整个应用只有**一个**
- 所有 Servlet 共享同一个 `ServletContext`

#### 如何获取ServletContext

```java
// 方式一：通过ServletConfig获取
ServletContext application = this.getServletConfig().getServletContext();

// 方式二：直接调用（推荐）
ServletContext application = this.getServletContext();
```

#### ServletContext常用方法

```java
// ——— 应用域数据共享 ———
void setAttribute(String name, Object object);   // 存入应用域
Object getAttribute(String name);                // 读取应用域
void removeAttribute(String name);               // 删除应用域数据

// ——— 获取全局初始化参数（context-param）———
String getInitParameter(String name);
Enumeration<String> getInitParameterNames();

// ——— 访问应用资源 ———
String getContextPath();                         // 获取应用根路径，如 /myapp
String getRealPath(String path);                 // 获取资源绝对路径
InputStream getResourceAsStream(String path);    // 以流方式获取资源

// ——— 日志记录 ———
void log(String message);
void log(String message, Throwable throwable);
```

#### init-param vs context-param

| 配置 | 范围 | 读取方式 |
|------|------|----------|
| `<init-param>` | 单个Servlet私有 | `getServletConfig().getInitParameter("name")` |
| `<context-param>` | 所有Servlet共享 | `getServletContext().getInitParameter("name")` |

**context-param配置示例：**

```xml
<!-- 全局参数，所有Servlet都能读到 -->
<context-param>
    <param-name>pagination.defaultPageSize</param-name>
    <param-value>10</param-value>
</context-param>
```

```java
// 在任意Servlet中读取
String pageSize = this.getServletContext().getInitParameter("pagination.defaultPageSize");
```

#### 访问应用资源示例

```java
ServletContext application = this.getServletContext();

// 获取应用根路径（部署路径，如 /myapp）
String contextPath = application.getContextPath();

// 获取文件在服务器磁盘上的绝对路径（路径从应用根目录开始，以 / 开头）
String realPath = application.getRealPath("/WEB-INF/web.xml");

// 以流方式读取文件
InputStream in = application.getResourceAsStream("/WEB-INF/config.properties");
```

#### 应用域使用原则

应用域中的数据**所有 Servlet、所有线程共享**，注意线程安全。适合存放：热点数据、少量数据、低频变更的全局配置。

**域对象选择原则：优先选择最小的域，小的满足不了再选大的。**

- `request` 域：仅在同一次请求内有效（最小）
- `session` 域：在同一会话内有效（中等）
- `application` 域：整个应用有效，服务器级别（最大）

#### Servlet、ServletConfig、ServletContext关系

- 一个Web应用只有**一个** `ServletContext`（全局共享）
- 每个 `Servlet` 有自己独立的 `ServletConfig`（存放私有配置）
- `Servlet` 通过 `ServletConfig` 可以获取 `ServletContext`

---
