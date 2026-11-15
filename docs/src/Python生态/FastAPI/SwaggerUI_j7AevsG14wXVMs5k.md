# Swagger UI

## API文档信息生成
### 默认OpenAPI schema
```python
from fastapi import FastAPI

app = FastAPI(
    title="我的 API",                    # API 标题
    description="这是一个示例 API，展示文档自定义功能",  # API 描述
    version="1.0.0",                    # API 版本
    terms_of_service="http://example.com/terms/",  # 服务条款 URL
    contact={                           # 联系信息
        "name": "开发者",
        "url": "http://example.com/contact/",
        "email": "dev@example.com",
    },
    license_info={                      # 许可证信息
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
)
```

### 自定义OpenAPI schema
```python
from fastapi import FastAPI
from fastapi.openapi.utils import get_openapi

# 自定义 OpenAPI schema
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
   
    openapi_schema = get_openapi(
        title="自定义 API 文档",
        version="2.5.0",
        description="这是自定义的 OpenAPI schema",
        routes=app.routes,  # 把项目所有路由传进去
    )
   
    # 添加自定义信息
    openapi_schema["info"]["x-logo"] = {
        "url": "https://example.com/logo.png"
    }

    # 联系人
    openapi_schema["info"]["contact"] = {
        "name": "管理员",
        "email": "admin@test.com"
    }
    # 许可证
    openapi_schema["info"]["license"] = {
        "name": "MIT"
    }
    # 全局鉴权（非常常用！给所有接口加上ApiKey鉴权定义）
    # swagger 页面右上角就会出现🔐 Authorize 按钮，可以填 X-API-Key，一键给请求带上 header。
    openapi_schema["components"]["securitySchemes"] = {
        "ApiKeyAuth": {
            "type": "apiKey",
            "in": "header",
            "name": "X-API-Key"
        }
    }
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

# 这一行，要写在所有路由定义之后！
app.openapi = custom_openapi
```

## 路由文档信息生成
| 参数 | 位置 | 说明 |
| --- | --- | --- |
| summary | 装饰器 | 路由的简短摘要 |
| description | 装饰器 | 路由的详细描述 |
| response_description | 装饰器 | 响应的描述 |
| tags | 装饰器 | 路由分组 |
| docstring | 函数体 | 函数的文档字符串 |


> 如果同时设置了 description 和函数的 docstring，description 优先生效。docstring 支持 Markdown 格式，适合编写较长的说明。
>

```python
from typing import Annotated
from fastapi import FastAPI, Path, Query

app = FastAPI()


@app.get(
    "/items/{item_id}",
    summary="获取商品信息",              # 简短摘要
    description="根据商品 ID 获取商品的详细信息",  # 详细描述
    response_description="商品信息对象",   # 响应描述
    tags=["商品管理"],                   # 分组标签
)
async def read_item(
    item_id: Annotated[int, Path(ge=1, description="商品ID")],
    q: Annotated[str | None, Query(description="搜索关键词")] = None,
):
    """
    获取商品信息(docstring)：

    - **item_id**: 商品的唯一标识符
    - **q**: 可选的搜索关键词
    """
    return {"item_id": item_id, "q": q}
```

## 生产环境禁用文档
```python
from fastapi import FastAPI

# 禁用文档
app = FastAPI(docs_url=None, redoc_url=None)
```

