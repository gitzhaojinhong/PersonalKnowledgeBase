# CORS跨域

CORS（Cross-Origin Resource Sharing，跨域资源共享）是一种安全机制，允许或限制网页从不同域名请求资源。当前后端分离开发时，前端页面通常运行在不同的域名或端口上，需要配置 CORS 才能正常访问后端 API。

## 配置CORS
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# 配置 CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=[               # 允许的源（域名列表）
        "http://localhost:3000",   # 前端开发服务器
        "http://localhost:8080",
    ],
    allow_credentials=True,       # 允许携带 Cookie
    allow_methods=["*"],          # 允许的 HTTP 方法
    allow_headers=["*"],          # 允许的请求头
)

@app.get("/")
async def root():
    return {"message": "Hello World"}
```

参数说明：

| 参数 | 类型 | 说明 | 推荐值 |
| --- | --- | --- | --- |
| allow_origins | list[str] | 允许跨域的源列表 | 生产环境用具体域名 |
| allow_methods | list[str] | 允许的 HTTP 方法 | ["GET", "POST", "PUT", "DELETE"] |
| allow_headers | list[str] | 允许的请求头 | 按需配置 |
| allow_credentials | bool | 是否允许携带 Cookie 和认证信息 | 需要认证时设为 True |
| expose_headers | list[str] | 前端可以访问的响应头 | 按需配置 |
| max_age | int | 预检请求的缓存时间（秒） | 600 |


> 设置了 max_age 后，浏览器会缓存预检结果，在指定时间内不会重复发送预检请求，减少网络开销。
>

