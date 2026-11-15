# Pydantic模型

## 概念

Pydantic 是一个 Python 数据校验库，它的核心思想是：用 Python 类型注解定义数据结构，Pydantic 自动负责校验和转换。

用于：

* 请求体校验：自动校验客户端发送的 JSON 数据是否符合模型定义
* 响应体序列化：将模型数据自动转换为 JSON 响应
* 自动文档：模型的字段、类型和校验规则自动出现在 API 文档中

## 使用

### 定义Pydantic模型

创建一个继承 BaseModel 的类

```python
from pydantic import BaseModel

class Item(BaseModel):
    name: str               # 必填：商品名称
    description: str | None = None  # 可选：商品描述
    price: float            # 必填：商品价格
    tax: float | None = None        # 可选：税费
```

> 字段是否必填取决于是否有默认值

### 使用Pydantic模型

作为请求体

```python
@app.post("/items/")
async def create_item(item: Item):
    # FastAPI 自动校验请求体，校验通过后赋值给 item 参数
    return item
```

### 操作模型数据

| 方法 | v2（推荐） | 说明 |
| --- | --- | --- |
| 序列化为字典 | `item.model_dump()` | 将模型转为 Python 字典 |
| 序列化为 JSON | `item.model_dump_json()` | 将模型转为 JSON 字符串 |
| 从字典创建 | `Item.model_validate(data)` | 从字典创建并校验模型 |
| 从 JSON 创建 | `Item.model_validate_json(json_str)` | 从 JSON 字符串创建模型 |
| 获取 JSON Schema | `Item.model_json_schema()` | 获取模型的 JSON Schema |

示例：

```python
@app.post("/items/")
async def create_item(item: Item):
    # 访问模型属性
    print(item.name)       # 直接访问属性
    print(item.price)      # 编辑器提供自动补全

    # 序列化为字典
    item_dict = item.model_dump()
    print(item_dict)       # {"name": "Foo", "description": None, "price": 45.2, "tax": None}

    # 序列化为 JSON 字符串
    item_json = item.model_dump_json()
    print(item_json)       # '{"name":"Foo","description":null,"price":45.2,"tax":null}'

    return item_dict
```

## Json Schema与数据验证

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

## 模型配置

```python
from pydantic import BaseModel, ConfigDict

class Item(BaseModel):
    name: str
    price: float

    # Pydantic v2 的配置方式
    model_config = ConfigDict(
        json_schema_extra={  # 在 API 文档中显示示例
            "examples": [
                {
                    "name": "Foo",
                    "price": 35.4
                }
            ]
        }
    )
```

## 模型继承

Pydantic 模型支持继承，可以方便地创建输入模型和输出模型：

```python
from pydantic import BaseModel, EmailStr

# 基础模型
class UserBase(BaseModel):
    username: str       # 必填
    email: EmailStr     # 必填，自动校验邮箱格式
    full_name: str | None = None  # 可选


# 创建用户时的输入模型（包含密码）
class UserCreate(UserBase):
    password: str       # 必填


# 返回用户信息时的输出模型（不包含密码）
class UserOut(UserBase):
    id: int             # 由服务器生成


# 使用示例
@app.post("/users/", response_model=UserOut)
async def create_user(user: UserCreate):
    # 函数接收 UserCreate（含密码），但响应使用 UserOut（不含密码）
    # 这样密码就不会出现在 API 响应中
    return {"id": 1, **user.model_dump(exclude={"password"})}
```
