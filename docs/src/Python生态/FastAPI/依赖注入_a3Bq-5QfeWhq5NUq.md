# 依赖注入

## 概念

依赖就是一个函数，它可以使用与路径操作函数相同的参数（查询参数、路径参数、请求体等）。

FastAPI 会在执行路由函数之前自动调用依赖函数，并将其返回值传递给路由函数。

关键词`Depends`：`from fastapi import Depends`

**当请求到达时，依赖的执行流程：**

* 识别路由函数及其依赖
* 执行依赖函数（按依赖顺序）
* 将依赖函数的返回值传递给路由函数
* 执行路由函数

## 函数作为依赖

```python
from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()


# 1. 定义依赖函数
def common_parameters(q: str | None = None, skip: int = 0, limit: int = 100):
    return {"q": q, "skip": skip, "limit": limit}


# 2. 在路由中使用依赖
@app.get("/items/")
async def read_items(commons: dict = Depends(common_parameters)):
    # commons 接收依赖函数的返回值
    return commons


@app.get("/users/")
async def read_users(commons: dict = Depends(common_parameters)):
    # 多个路由可以复用同一个依赖
    return commons
```

## 类作为依赖

```python
from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()


# 用类声明依赖
class CommonQueryParams:
    def __init__(self, q: str | None = None, skip: int = 0, limit: int = 100):
        self.q = q
        self.skip = skip
        self.limit = limit


# 使用类作为依赖
@app.get("/items/")
async def read_items(commons: Annotated[CommonQueryParams, Depends()]):
    return {"q": commons.q, "skip": commons.skip, "limit": commons.limit}
```

## 子依赖

依赖传递：

```python
from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()


# 依赖函数
def query_extractor(q: str | None = None):
    return q


# 子依赖：依赖 query_extractor
def query_checker(q: str = Depends(query_extractor)):
    if q == "admin":
        # 子依赖可以进行校验
        return q + " (checked)"
    return q


# 路由使用子依赖
@app.get("/items/")
async def read_items(q: str = Depends(query_checker)):
    return {"q": q}
```

## 在装饰器中使用依赖

有时只需要依赖的副作用（如权限校验），不需要其返回值。可以在装饰器的 dependencies 参数中声明：

```python
from fastapi import Depends, FastAPI, Header, HTTPException

app = FastAPI()


# 依赖：请求头校验 API Key
async def verify_api_key(x_api_key: str = Header()):
    if x_api_key != "secret-key":
        raise HTTPException(status_code=400, detail="X-API-Key invalid")


# 在装饰器中使用依赖，不需要返回值
@app.get("/items/", dependencies=[Depends(verify_api_key)])
async def read_items():
    return [{"item": "Foo"}]


# 对整个路由组使用依赖
@app.get("/users/", dependencies=[Depends(verify_api_key)])
async def read_users():
    return [{"user": "Bar"}]
```

## 全局依赖

可以在 FastAPI 实例上声明全局依赖，对所有路由生效：

```python
from fastapi import Depends, FastAPI, Header, HTTPException

async def verify_token(x_token: str = Header()):
    if x_token != "fake-super-secret-token":
        raise HTTPException(status_code=400, detail="X-Token header invalid")


# 全局依赖：所有路由都需要通过 token 校验
app = FastAPI(dependencies=[Depends(verify_token)])


@app.get("/items/")
async def read_items():
    return [{"item": "Foo"}]


@app.get("/users/")
async def read_users():
    return [{"user": "Bar"}]
```

## 使用yield的依赖

```python
from typing import Annotated
from fastapi import Depends, FastAPI

app = FastAPI()


# 使用 yield 的依赖：请求前创建连接，请求后关闭连接
def get_db():
    db = "database_connection"  # 模拟创建数据库连接
    try:
        yield db  # 请求处理期间提供数据库连接
    finally:
        print("关闭数据库连接")  # 请求完成后清理资源


@app.get("/items/")
async def read_items(db: str = Depends(get_db)):
    return {"db": db}
```

> 执行流程：
>
> * 请求到达时，执行 yield 之前的代码，创建数据库连接
> * yield 将连接传递给路由函数
> * 路由函数执行完毕后，执行 finally 块中的清理代码
