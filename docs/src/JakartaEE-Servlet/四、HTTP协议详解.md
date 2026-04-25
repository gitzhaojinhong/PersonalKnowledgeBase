## 四、HTTP协议详解

### 4.1 HTTP概述

HTTP（HyperText Transfer Protocol）是浏览器与Web服务器之间的通信协议。

**核心特点：**
- 基于请求-响应模型
- 无状态协议（每次请求独立）
- 支持多种数据类型
- 灵活可扩展

### 4.2 HTTP请求

#### 请求行

```
POST /login HTTP/1.1
```

- **请求方法**：GET、POST、PUT、DELETE等
- **请求路径**：/login
- **协议版本**：HTTP/1.1

#### 请求头

```
Host: www.example.com
Content-Type: application/x-www-form-urlencoded
Content-Length: 27
User-Agent: Mozilla/5.0
Accept: text/html,application/xhtml+xml
Accept-Language: zh-CN,zh;q=0.9
Accept-Encoding: gzip, deflate
Connection: keep-alive
Cookie: sessionId=abc123
```

**常用请求头说明：**

| 请求头 | 说明 | 示例 |
|--------|------|------|
| `Host` | 目标服务器地址 | `www.example.com` |
| `Content-Type` | 请求体数据类型 | `application/json` |
| `Content-Length` | 请求体长度（字节） | `27` |
| `User-Agent` | 客户端信息 | `Mozilla/5.0...` |
| `Accept` | 可接受的响应类型 | `text/html` |
| `Accept-Language` | 可接受的语言 | `zh-CN` |
| `Accept-Encoding` | 可接受的编码 | `gzip, deflate` |
| `Cookie` | 携带的Cookie | `sessionId=abc123` |
| `Authorization` | 认证信息 | `Bearer token123` |
| `Referer` | 来源页面URL | `https://www.example.com/login` |

#### 请求体

POST/PUT请求携带的数据：

```
username=admin&password=123456
```

### 4.3 HTTP响应

#### 响应行

```
HTTP/1.1 200 OK
```

- **协议版本**：HTTP/1.1
- **状态码**：200
- **状态描述**：OK

#### 响应头

```
Content-Type: text/html;charset=UTF-8
Content-Length: 1234
Date: Mon, 23 May 2023 08:00:00 GMT
Server: Apache/2.4.41
Set-Cookie: sessionId=abc123; Path=/; HttpOnly
Cache-Control: no-cache
```

**常用响应头说明：**

| 响应头 | 说明 | 示例 |
|--------|------|------|
| `Content-Type` | 响应体类型 | `text/html;charset=UTF-8` |
| `Content-Length` | 响应体长度 | `1234` |
| `Date` | 响应时间 | `Mon, 23 May 2023...` |
| `Server` | 服务器信息 | `Apache/2.4.41` |
| `Set-Cookie` | 设置Cookie | `sessionId=abc123` |
| `Location` | 重定向地址 | `/home` |
| `Cache-Control` | 缓存控制 | `no-cache` |

#### 响应体

服务器返回的实际内容：

```html
<!DOCTYPE html>
<html>
<head><title>首页</title></head>
<body><h1>欢迎</h1></body>
</html>
```

### 4.4 HTTP状态码

| 状态码 | 含义 | 说明 |
|--------|------|------|
| **200** | OK | 请求成功 |
| **201** | Created | 资源创建成功 |
| **204** | No Content | 成功但无返回内容 |
| **301** | Moved Permanently | 永久重定向 |
| **302** | Found | 临时重定向 |
| **304** | Not Modified | 资源未修改，使用缓存 |
| **400** | Bad Request | 请求参数错误 |
| **401** | Unauthorized | 未认证 |
| **403** | Forbidden | 无权限访问 |
| **404** | Not Found | 资源不存在 |
| **405** | Method Not Allowed | 请求方法不允许 |
| **500** | Internal Server Error | 服务器内部错误 |
| **502** | Bad Gateway | 网关错误 |
| **503** | Service Unavailable | 服务不可用 |

### 4.5 请求方法对比

| 方法 | 用途 | 幂等性 | 安全性 | 请求体 |
|------|------|--------|--------|--------|
| GET | 获取资源 | 是 | 是 | 无 |
| POST | 创建资源 | 否 | 否 | 有 |
| PUT | 更新资源（全量） | 是 | 否 | 有 |
| PATCH | 更新资源（部分） | 否 | 否 | 有 |
| DELETE | 删除资源 | 是 | 否 | 无 |

**幂等性**：多次执行结果相同
**安全性**：不会改变服务器状态

### 4.6 GET与POST区别

| 特性 | GET | POST |
|------|-----|------|
| 数据位置 | URL参数（?key=value） | 请求体 |
| 数据大小 | 受URL长度限制（约2KB） | 无限制 |
| 安全性 | 参数暴露在URL中 | 参数在请求体中 |
| 缓存 | 会被浏览器缓存 | 不会被缓存 |
| 书签 | 可收藏为书签 | 不可收藏 |
| 用途 | 获取数据 | 提交数据、修改资源 |

### 4.7 HTTP/1.0 vs HTTP/1.1

| 特性 | HTTP/1.0 | HTTP/1.1 |
|------|----------|----------|
| 连接方式 | 短连接：每次请求新建TCP连接，响应后立即断开 | 持久连接（长连接）：默认 `Connection: keep-alive`，同一连接可发送多个请求 |
| 性能 | 每次请求都有TCP握手开销，性能差 | 连接复用，减少握手次数，性能好 |
| Host请求头 | 可选 | **必须携带**（支持虚拟主机） |
| 断开时机 | 请求-响应结束即断开 | 响应头 `Connection: close` 或超时后断开 |

现代浏览器默认使用 HTTP/1.1，HTTP/2 进一步引入了多路复用（同一连接并发请求）。

---
