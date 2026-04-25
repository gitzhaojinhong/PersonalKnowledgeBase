
## 10.1 HttpServletRequest常用方法

```java
// 获取请求参数
String getParameter(String name);
String[] getParameterValues(String name);
Map<String, String[]> getParameterMap();
Enumeration<String> getParameterNames();

// 获取请求信息
String getMethod();                    // GET/POST
String getRequestURI();                // /app/user/list
StringBuffer getRequestURL();          // http://localhost:8080/app/user/list
String getServletPath();               // /user/list
String getContextPath();               // /app
String getQueryString();               // name=value&age=20
String getRemoteAddr();                // 客户端IP

// 获取请求头
String getHeader(String name);
Enumeration<String> getHeaderNames();
Enumeration<String> getHeaders(String name);
String getContentType();
int getContentLength();

// 属性操作
void setAttribute(String name, Object o);
Object getAttribute(String name);
void removeAttribute(String name);

// Cookie和Session
Cookie[] getCookies();
HttpSession getSession();
HttpSession getSession(boolean create);

// 请求转发
RequestDispatcher getRequestDispatcher(String path);
```

## 10.2 HttpServletResponse常用方法

```java
// 设置响应类型
void setContentType(String type);
void setCharacterEncoding(String charset);

// 输出流
PrintWriter getWriter();
ServletOutputStream getOutputStream();

// 设置响应头
void setHeader(String name, String value);
void addHeader(String name, String value);
void setIntHeader(String name, int value);
void setDateHeader(String name, long date);

// 设置状态码
void setStatus(int sc);
void sendError(int sc);
void sendError(int sc, String msg);

// 重定向
void sendRedirect(String location);

// Cookie
void addCookie(Cookie cookie);
```

## 10.3 HttpSession常用方法

```java
// 属性操作
void setAttribute(String name, Object value);
Object getAttribute(String name);
void removeAttribute(String name);

// Session信息
String getId();
long getCreationTime();
long getLastAccessedTime();
int getMaxInactiveInterval();
void setMaxInactiveInterval(int interval);

// 失效
void invalidate();
boolean isNew();
```

## 10.4 Cookie常用方法

```java
// 构造方法
Cookie(String name, String value);

// 属性设置
void setMaxAge(int expiry);        // 有效期（秒）
void setPath(String uri);          // 生效路径
void setDomain(String pattern);    // 生效域名
void setHttpOnly(boolean httpOnly);
void setSecure(boolean flag);

// 属性获取
String getName();
String getValue();
int getMaxAge();
String getPath();
```

## 10.5 开发避坑指南

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 中文乱码 | 编码不一致 | request.setCharacterEncoding("UTF-8") |
| 404错误 | 路径错误或Servlet未注册 | 检查@WebServlet和访问路径 |
| 500错误 | 代码异常 | 查看日志，处理空指针等异常 |
| 参数获取为null | 参数名错误或方法不对 | 检查表单name和getParameter |
| Session丢失 | Cookie被禁用或超时 | 检查浏览器设置和超时配置 |
| 文件上传失败 | 未设置enctype | 表单添加enctype="multipart/form-data" |
| 线程安全问题 | Servlet中使用成员变量 | 使用局部变量或同步机制 |
| 过滤器不生效 | 配置错误或顺序问题 | 检查@WebFilter和urlPatterns |

## 10.6 路径写法规范（7条必记）

不同场景下路径是否需要加项目名，是开发中最常踩的坑：

| 场景 | 以 / 开头 | 是否加项目名 | 示例 |
|------|----------|-------------|------|
| 前端HTML中的链接/表单action | 是 | 要加 | `/myapp/hello` |
| web.xml 中 `<url-pattern>` | 是 | 不加 | `/hello` |
| `getRealPath(path)` 参数 | 是 | 不加 | `/WEB-INF/web.xml` |
| `getResourceAsStream(path)` 参数 | 是 | 不加 | `/WEB-INF/config.properties` |
| 欢迎页面（`<welcome-file>`） | 否 | 不加 | `index.html` |
| 转发路径（`getRequestDispatcher`） | 是 | 不加 | `/list` |
| 重定向路径（`sendRedirect`） | 是 | 要加 | `request.getContextPath() + "/list"` |

> **记忆口诀：** 前端发请求、重定向，都要带项目名。服务器内部（web.xml、转发、getRealPath），不带项目名。

## 10.7 response编码 vs HTML meta charset

`response.setCharacterEncoding("UTF-8")` 和 HTML 中的 `<meta charset="UTF-8">` 不是一回事：

- `response.setCharacterEncoding("UTF-8")`：**服务器端**行为，设置 `PrintWriter` 将 Java 字符串转换为字节时的编码方式，同时会自动设置响应头 `Content-Type: text/html;charset=UTF-8`。这是**根本**的编码设置，决定数据在传输时的实际编码。必须在 `getWriter()` 之前调用。
- `<meta charset="UTF-8">`：**HTML文档内部**的声明，浏览器在解析 HTML 时参考此提示。如果 HTTP 响应头已指定 charset，meta 标签通常被忽略。

**推荐写法（一行搞定）：**

```java
// 必须在 getWriter() 之前调用
response.setContentType("text/html;charset=UTF-8");
PrintWriter out = response.getWriter();
```

## 10.8 Tomcat标准输出流乱码（System.out中文乱码）

**现象：** IDEA + Tomcat 环境下，`System.out.println("中文")` 在控制台输出乱码。

**原因：** Tomcat 的标准输出流（System.out）默认使用 GBK 编码输出，而 IDEA 控制台期望接收 UTF-8，编码不匹配导致乱码。

**解决：** 在 IDEA 的 Tomcat 服务器配置中，VM options 添加：

```
-Dstdout.encoding=UTF-8
```

---

*本手册基于JakartaEE 10 / Servlet 6.0编写，适用于Tomcat 10.x及以上版本*
