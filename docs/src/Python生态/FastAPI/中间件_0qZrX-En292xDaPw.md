# 中间件

## 工作原理
中间件是一种在每个请求到达路由处理函数之前和之后执行的函数。

中间件可以用于添加日志、修改请求/响应、处理 CORS 等通用逻辑。



中间件的执行流程：

+ 请求到达中间件
+ 中间件执行预处理逻辑
+ 中间件将请求传递给下一个中间件或路由函数
+ 路由函数返回响应
+ 中间件执行后处理逻辑
+ 响应返回给客户端

> 多个中间件执行顺序：先进后出
>

## 使用中间件
### 自定义中间件
使用 @app.middleware("http") 装饰器创建中间件：

```python
import time
from fastapi import FastAPI, Request

app = FastAPI()


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    # 1. 请求前的处理
    # XXXXXXXXXXXXXX

    # 2. 将请求传递给下一个中间件或路由函数
    response = await call_next(request)

    # 3. 响应后的处理：计算处理时间并添加响应头
    # XXXXXXXXXXXXXX
    return response


@app.get("/")
async def root():
    return {"message": "Hello World"}
```

### 使用Starlette内置中间件
FastAPI 继承自 Starlette，可以直接使用 Starlette 提供的中间件：

```python
from fastapi import FastAPI
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware

app = FastAPI()

# 强制 HTTPS 重定向
app.add_middleware(HTTPSRedirectMiddleware)


@app.get("/")
async def root():
    return {"message": "使用 HTTPS 访问"}
```

| 常用内置中间件 | 说明 |
| --- | --- |
| HTTPSRedirectMiddleware | 强制将 HTTP 请求重定向为 HTTPS |
| TrustedHostMiddleware | 限制允许访问的主机名 |
| GZipMiddleware | 自动压缩响应内容 |
| CORSMiddleware | 处理跨域请求 |


