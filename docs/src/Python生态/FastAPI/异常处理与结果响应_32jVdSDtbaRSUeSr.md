# 异常处理与结果响应

## HTTPException

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| status_code | int | HTTP状态码（必填） |
| detail | Any | 错误详情（字符串，字典，列表等） |
| headers | dict | None | 额外的响应头（可选） |

示例：

```python
from fastapi import FastAPI, HTTPException

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: str):
    if item_id == "invalid":
        # detail 可以是字典，包含更多错误信息
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": "INVALID_ID",
                "message": "商品ID格式不正确",
                "hint": "请使用字母数字组合的ID"
            },
            headers={"X-Error": "There goes my error"},  # 自定义响应头
        )
    return {"item_id": item_id}
```

## 异常处理器

### 自定义异常处理器

为自定义异常或内置异常注册处理器，统一处理错误响应格式：

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse


# 自定义异常类
class UnicornException(Exception):
    def __init__(self, name: str):
        self.name = name


app = FastAPI()


# 注册异常处理器
@app.exception_handler(UnicornException)
async def unicorn_exception_handler(request: Request, exc: UnicornException):
    # 返回自定义格式的错误响应
    return JSONResponse(
        status_code=418,
        content={"message": f"Oops! {exc.name} did something wrong"},
    )


@app.get("/unicorns/{name}")
async def read_unicorn(name: str):
    if name == "yolo":
        # 抛出自定义异常
        raise UnicornException(name=name)
    return {"unicorn_name": name}
```

### 覆盖默认异常处理器

FastAPI 有默认的异常处理器，可以覆盖它们来自定义错误响应格式

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

app = FastAPI()


# 覆盖 HTTP 异常处理器
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": f"HTTP error: {exc.detail}"},
    )


# 覆盖请求校验失败的异常处理器
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "数据校验失败", "details": exc.errors()},
    )
```

## 结果响应

### JSONResponse

#### 自定义响应头和状态码

FastAPI 里如果直接 `return {"item_id": item_id}`，底层也会自动包装成 `JSONResponse`，但是不方便地加自定义响应头。

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/items/{item_id}")
async def read_item(item_id: int):
    content = {"item_id": item_id}
    headers = {"X-Custom-Header": "custom-header-value"}
    # 手动构造 JSON 响应，自定义返回体 + 响应头 + 状态码
    return JSONResponse(content=content, headers=headers, status_code=200)

```

#### 封装响应工具函数

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

def resp_success(data=None, msg: str = "success", code: int = 200, headers: dict | None = None):
    return JSONResponse(
        content={
            "code": code,
            "msg": msg,
            "data": data
        },
        headers=headers
    )


@app.get("/items/{item_id}")
async def read_item(item_id: int):
    # 一行调用，干净很多
    return resp_success(
        data={"item_id": item_id},
        headers={"X-Custom-Header": "custom-header-value"}
    )
```

#### 自定义Response类

```python
from fastapi.responses import JSONResponse

class ApiResponse(JSONResponse):
    def __init__(self, code=200, msg="success", data=None, headers=None):
        super().__init__(
            content={"code": code, "msg": msg, "data": data},
            headers=headers
        )

# 使用
@app.get("/test")
async def test():
    return ApiResponse(data={"id": 1})

```

### 中间件自动全局包装

```python
from typing import Any
from fastapi import FastAPI, Request, Response
import json

app = FastAPI()


def is_wrapped(data: Any) -> bool:
    # 判断是否已经是统一返回结构，避免二次包装
    return isinstance(data, dict) and {"code", "message", "data"} <= data.keys()


@app.middleware("http")
async def dispatch(request: Request, call_next):
    # 白名单：openapi 文档、swagger 静态资源，不包装！
    skip_paths = {"/openapi.json", "/docs", "/redoc", "/favicon.ico"}
    if request.url.path in skip_paths:
        return await call_next(request)

    response = await call_next(request)

    # 从 header 拿 content-type ,如果不是 application/json ,则原样返回
    content_type = response.headers.get("content-type", "").split(";")[0].strip()
    if content_type != "application/json":
        return response

    # 读取 body 流
    chunks = [chunk async for chunk in response.body_iterator]
    raw = b"".join(chunks)

    try:
        data = json.loads(raw) if raw else None
    except (json.JSONDecodeError, UnicodeDecodeError):
        # 不是合法json，原样返回
        return Response(
            content=raw,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
            background=response.background,
        )

    # 没有包装过，才套一层统一结构
    if not is_wrapped(data):
        data = {"code": 0, "message": "ok", "data": data}

    new_body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    headers = dict(response.headers)
    headers["content-length"] = str(len(new_body))

    return Response(
        content=new_body,
        status_code=response.status_code,
        headers=headers,
        media_type="application/json",
        background=response.background,
    )


@app.get("/items/{item_id}")
async def read_item(item_id: int):
    return {"item_id": item_id}

```
