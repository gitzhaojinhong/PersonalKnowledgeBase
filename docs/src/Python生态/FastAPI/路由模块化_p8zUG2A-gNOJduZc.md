# 路由模块化

## 目录结构
```python
main.py
routers/
    __init__.py
    user.py
```

## 定义路由模块
```python
from fastapi import APIRouter

router = APIRouter(
    prefix='/user',        # 统一前缀
    tags=['用户功能'],      # 接口文档分组
    responses={404: {"description": "用户相关路径不存在"}}   # 统一响应文档
)

@router.get('/info')
def get_user_info(user_id: int) -> dict:
    return {"user_id": user_id, "username": "test_user", "email": "test@example.com"}
    
@router.post('/create')
def create_user(username: str, email: str) -> dict:
    return {"message": "User created successfully", "username": username, "email": email}
```

## 主应用注册路由模块
```python
from fastapi import FastAPI
from contextlib import asynccontextmanager
from routers.user import router as user_router  # 导入用户路由

@asynccontextmanager
async def lifespan(app: FastAPI):
    # ========== startup：应用启动时执行（服务器接收请求之前） ==========
    print("应用启动，初始化资源：连接数据库、创建kafka生产者、加载缓存...")
    
    yield   # 这里交出控制权，服务开始正常跑、处理请求
    
    # ========== shutdown：应用关闭时执行（不再接收新请求之后） ==========
    print("应用关闭，释放资源：关闭连接池、优雅停止消费、关闭文件...")
    
# 创建主应用实例
app = FastAPI(
    title="标题",
    version="版本",
    description="介绍",
    lifespan=lifespan,   # 生命周期钩子注册
)

# 根路由
@app.get('/')
async def welcome() -> dict:
    return {"message": "Welcome to Modular Router Demo", "docs_url": "/docs"}
    
# 整合子路由
app.include_router(user_router)   # 用户功能路由，路径前缀 /user
```

