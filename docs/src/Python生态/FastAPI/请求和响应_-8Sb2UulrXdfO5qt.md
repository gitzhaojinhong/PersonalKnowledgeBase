# 请求和响应

## 请求数据

### 查询参数 ？

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/")
def read_item(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}
```

请求示例：

`[http://127.0.0.1:8000/items/?skip=1&limit=5](http://127.0.0.1:8000/items/?skip=1&limit=5)`

> 将默认值设为 None 即可声明可选的查询参数

### 路径参数 path

```python
from fastapi import FastAPI

app = FastAPI()
# 路径参数item_id + 查询参数q
@app.get("/items/{item_id}")
def read_item(item_id: int, q: str = None):
    return {"item_id": item_id, "q": q}

# 包含路径的路径参数
# 访问 http://127.0.0.1:8000/files/home/johndoe/myfile.txt，返回：{"file_path": "home/johndoe/myfile.txt"}
# :path 表示该参数可以匹配包含斜杠的路径
@app.get("/files/{file_path:path}")
async def read_file(file_path: str):
    return {"file_path": file_path}
```

请求示例：

`[http://127.0.0.1:8000/items/5/?q=runoob](http://127.0.0.1:8000/items/5/?q=runoob)`

### 请求体 body

```python
from pydantic import BaseModel
from fastapi import FastAPI

app = FastAPI()
# 使用Pydantic模型声明请求体
class Item(BaseModel):
    name: str
    description: str | None = None   # 可选
    price: float
    tax: float | None = None  # 可选

@app.post("/items/")
def create_item(item: Item):
    return item
```

请求示例：

`[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)`

curl示例：

```powershell
curl -X 'POST' \
  'http://127.0.0.1:8000/items/' \
  -H 'accept: */*' \
  -H 'Content-Type: application/json' \
  -d '{
  "name": "lucy",
  "description": "lucy",
  "price": 0,
  "tax": 0
}'
```

## 参数校验

类型注解：

```python
Annotated[类型, 元数据1, 元数据2, 元数据3, ...]
```

> * 第 1 个位置：真实数据类型（`str`、`int`、`str | None`、`BaseModel` 等）
> * 后面全部是：元数据。数量不限，可以放多个
> * Annotated 本身**不改变类型**，只是给这个类型注解附加额外信息

### 查询参数校验

类型注解`Annotated` 与 校验规则`Query`配合使用

Query() 标记查询参数 并 校验：

| Query()常用参数 | 作用 |
| --- | --- |
| `title` | 文档标题 |
| `description` | 文档里的说明 |
| `alias` | URL 上的参数名（比如 `item-query`） |
| `deprecated` | 文档标记参数废弃 |
| `include_in_schema` | 是否放进 openapi 文档，隐藏参数设 False |
| `min_length` / `max_length` | 字符串长度限制 |
| `pattern` | 正则表达式 |
| `ge` / `le` | 大于等于、小于等于 |
| `gt` / `lt` | 大于、小于 |

示例：

```python
from typing import Annotated
from fastapi import FastAPI, Query

app = FastAPI()

@app.get("/items/")
async def read_items(
    # 使用 Annotated + Query 添加校验，带默认值None(可选)
    q: Annotated[str | None, Query(max_length=50)] = None,
):
    return q
```

### 路径参数校验

类型注解`Annotated` 与 校验规则`Path`配合使用

Path() 标记路径参数 并 校验：

| 参数 | 说明 |
| --- | --- |
| `title` | 文档标题 |
| `description` | 接口文档里的描述 |
| `alias` | 别名（路径参数很少用 alias） |
| `deprecated` | 在文档标记该参数废弃 |
| `include_in_schema` | 是否展示在 openapi 文档 |
| `gt / ge / lt / le` | 数字大小校验：大于、大于等于、小于、小于等于 |
| `min_length / max_length` | 字符串长度校验（Path 是字符串类型时用） |
| `pattern` | 正则表达式匹配 |

示例：

```python
from typing import Annotated
from fastapi import FastAPI, Path

app = FastAPI()

@app.get("/items/{item_id}")
async def read_items(
    item_id: Annotated[int, Path(ge=1)],  # item_id 必须 >= 1
):
    return {"item_id": item_id}
```

### 请求体参数校验

类型注解`Annotated` 与 校验规则`Field`配合使用

Pydantic 模型内部使用 Field 声明字段校验：

| 参数 | 作用 |
| --- | --- |
| `title` | 文档标题 |
| `description` | OpenAPI 文档里的描述 |
| `alias` | 字段别名：接口传别的名字，模型内部用原名 |
| `deprecated` | 文档标记废弃 |
| `default` | 默认值；如果不写，代表必填 |
| `default_factory` | 动态默认值（比如 `default_factory=datetime.now`，不能和 default 一起用） |
| `gt / ge / lt / le` | 数字大小校验 |
| `min_length / max_length` | 字符串长度 |
| `pattern` | 正则匹配 |
| `exclude` | model_dump () 序列化时排除该字段 |
| `include` | 序列化时强制包含 |

示例：

```python
from typing import Annotated
from pydantic import BaseModel, Field
from fastapi import FastAPI

app = FastAPI()

class Item(BaseModel):
    name: Annotated[str, Field(min_length=1, max_length=100, description="商品名称")]
    description: Annotated[str | None, Field(default=None, max_length=300, description="商品描述")]
    price: Annotated[float, Field(gt=0, description="商品价格")]
    tax: Annotated[float | None, Field(default=None, ge=0, description="税费")]

@app.post("/items/")
async def create_item(item: Item):
    return item

```

## 响应数据

### 返回Json数据

```python
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/")
def read_item(skip: int = 0, limit: int = 10):
    return {"skip": skip, "limit": limit}
```

### 返回Pydantic数据

```python
from pydantic import BaseModel
from fastapi import FastAPI

app = FastAPI()
class Item(BaseModel):
    name: str
    description: str = None
    price: float
    tax: float = None

@app.post("/items/")
def create_item(item: Item):
    return item
```

### 使用返回类型注解

1. 使用response_model参数示例：

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Item(BaseModel):
    name: str
    description: str | None = None
    price: float


@app.get("/items/{item_id}", response_model=Item)
async def read_item(item_id: int):
    # 返回的数据会自动按照 Item 模型过滤和校验
    return {
        "name": "Foo",
        "description": "A very nice Item",
        "price": 22.2,
        "secret": "this should not be visible",  # 不在 Item 中的字段会被过滤
    }
```

2. 当返回类型与响应模型不一致时，使用装饰器的 response_model 参数：

```python
from fastapi import FastAPI
from pydantic import BaseModel, EmailStr

app = FastAPI()

# 输入模型（包含密码）
class UserIn(BaseModel):
    username: str
    password: str
    email: EmailStr


# 输出模型（不包含密码）
class UserOut(BaseModel):
    username: str
    email: EmailStr


# 函数接收 UserIn，但响应使用 UserOut
@app.post("/users/", response_model=UserOut)
async def create_user(user: UserIn):
    # 返回的 user 包含密码，但 response_model=UserOut 会过滤掉密码
    return user
```

3. 使用 response_model_exclude_unset=True，只返回实际设置了值的字段：

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float = 10.5
    tags: list[str] = []


items = {
    "foo": {"name": "Foo", "price": 50.2},
    "bar": {"name": "Bar", "description": "The bartenders", "price": 62, "tax": 20.2},
    "baz": {"name": "Baz", "description": None, "price": 50.2, "tax": 10.5, "tags": []},
}


@app.get("/items/{item_id}", response_model=Item, response_model_exclude_unset=True)
async def read_item(item_id: str):
    return items[item_id]   # 只返回显式设置的字段，省略了description字段
```

4. 使用 response_model_include 和 response_model_exclude 精确控制输出字段：

> 虽然 response_model_include 和 response_model_exclude 可以快速过滤字段，但推荐使用多个模型类来代替，因为它们无法从 OpenAPI 文档中移除被排除的字段。

```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()


class Item(BaseModel):
    name: str
    description: str | None = None
    price: float
    tax: float = 10.5


# 只包含 name 和 description
@app.get("/items/{item_id}", response_model=Item, response_model_include={"name", "description"})
async def read_item_name(item_id: str):
    return items[item_id]


# 排除 tax
@app.get("/items/{item_id}/no-tax", response_model=Item, response_model_exclude={"tax"})
async def read_item_no_tax(item_id: str):
    return items[item_id]
```

## 请求头

### 获取请求头和Cookie

> 请求头和 Cookie 参数支持与查询参数相同的校验规则

```python
from fastapi import Header, Cookie
from fastapi import FastAPI

app = FastAPI()

@app.get("/items/")
# Python 变量名用下划线，FastAPI 自动转换为 X-Token 请求头
def read_item(x_token: Annotated[list[str] | None, Header()] = None,
              user_agent: str = Header(None), 
              session_token: str = Cookie(None)):
    return {"User-Agent": user_agent, "Session-Token": session_token}
```

### 自定义响应头

```python
from fastapi import FastAPI
from fastapi.responses import JSONResponse

app = FastAPI()

@app.get("/items/{item_id}")
def read_item(item_id: int):
    content = {"item_id": item_id}
    headers = {"X-Custom-Header": "custom-header-value"}
    return JSONResponse(content=content, headers=headers)
```

## 响应状态码

### 路由参数声明状态码

> 装饰器里的 status_code 只是一个"成功响应的默认值"。只要请求最终由你的函数正常返回，就用它；
>
> 一旦中途抛出异常，或者直接返回了 Response 对象，这个声明就会被覆盖或绕过。

```python
from fastapi import FastAPI, status

app = FastAPI()

# 创建资源时，使用 201 状态码
@app.post("/items/", status_code=status.HTTP_201_CREATED)
async def create_item(name: str):
    return {"name": name}
```

### 状态码含义

常用状态码含义：

* 1xx 信息：很少直接使用
* 2xx 成功
  * 200 OK：请求成功（默认状态码）
  * 201 Created：资源创建成功
  * 204 No Content：成功但无内容返回
* 3xx 重定向
  * 304 Not Modified：资源未修改（缓存有效）
* 4xx 客户端错误
  * 400 Bad Request：请求格式错误
  * 401 Unauthorized：未认证
  * 403 Forbidden：已认证但无权限
  * 404 Not Found：资源不存在
* 5xx 服务器错误
  * 500 Internal Server Error：服务器内部错误

## 重定向

```python
@app.get("/redirect")
def redirect():
    return RedirectResponse(url="/items/")
```

> 访问 http://127.0.0.1:8000/redirect/
>
> 会自动跳转到 http://127.0.0.1:8000/items/
