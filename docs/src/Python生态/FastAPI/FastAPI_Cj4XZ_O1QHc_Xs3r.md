# FastAPI

## ASGI与异步编程

ASGI（Asynchronous Server Gateway Interface）是 Python 异步 Web 服务器和应用程序之间的标准接口。

### 同步VS异步

```python
import asyncio
import time
import httpx

# 同步方式 - 阻塞执行
def sync_fetch_data():
    start_time = time.time()
    # 模拟三个网络请求
    time.sleep(1)  # 第一个请求
    time.sleep(1)  # 第二个请求
    time.sleep(1)  # 第三个请求
    print(f"同步执行耗时: {time.time() - start_time:.2f}秒")  # 约3秒

# 异步方式 - 并发执行
async def async_fetch_data():
    start_time = time.time()
    # 三个请求并发执行
    await asyncio.gather(
        asyncio.sleep(1),  # 第一个请求
        asyncio.sleep(1),  # 第二个请求
        asyncio.sleep(1),  # 第三个请求
    )
    print(f"异步执行耗时: {time.time() - start_time:.2f}秒")  # 约1秒

# 运行示例
sync_fetch_data()  # 输出: 同步执行耗时: 3.00秒
asyncio.run(async_fetch_data())  # 输出: 异步执行耗时: 1.00秒
```

> 选型：
>
> * IO密集型 ： 异步
> * CPU密集型 ： 同步

### 异步编程

FastAPI 会智能识别路由函数类型，不用手动配置线程池：

* `async def` 路由：直接在主事件循环中执行，无线程切换开销，纯 IO 场景性能最高
* 普通 `def` 路由：FastAPI 自动提交到后台线程池执行，不会阻塞事件循环，兼容同步代码

**规则：**

* 只要函数内部用了 `await`，这个函数就必须用 `async def` 定义；
* 反过来，调用一个 `async def` 的异步函数，就必须加 `await`。

```python
from fastapi import Depends

async def get_async_db():
    db = AsyncSession()
    try:
        yield db
    finally:
        await db.close()

@app.get("/user/{uid}")
async def get_user(uid: int, db = Depends(get_async_db)):
    user = await db.query(User).where(User.id == uid).first()
    return user

```

异步编程注意事项：

* 异步函数中的同步阻塞代码会卡死整个事件循环，期间所有请求都会排队等待，吞吐量直接暴跌。
* 不要每次请求都新建异步客户端，可在 `lifespan` 生命周期中初始化 。
* 不需要手动管理事件循环。

## REST API设计原则

| 方法 | 语义 | 幂等性 | 典型场景 | FastAPI 写法 |
| --- | --- | --- | --- | --- |
| GET | 查询资源 | ✅ 幂等、安全 | 列表查询、单条详情 | `@app.get()` |
| POST | 创建新资源 | ❌ 非幂等 | 新建订单、新增用户 | `@app.post()` |
| PUT | 全量更新资源 | ✅ 幂等 | 完整替换一条数据 | `@app.put()` |
| PATCH | 局部更新资源 | ❌ 非幂等 | 修改单个字段（如状态、昵称） | `@app.patch()` |
| DELETE | 删除资源 | ✅ 幂等 | 删除一条记录 | `@app.delete()` |

```python
# 资源集合和单个资源
@app.get("/users")  # GET /users - 获取用户列表
async def get_users():
    return users_db

@app.get("/users/{user_id}")  # GET /users/123 - 获取特定用户
async def get_user(user_id: int):
    return find_user(user_id)

@app.post("/users")  # POST /users - 创建新用户
async def create_user(user: UserCreate):
    return create_new_user(user)

@app.put("/users/{user_id}")  # PUT /users/123 - 完整更新用户
async def update_user(user_id: int, user: UserUpdate):
    return update_existing_user(user_id, user)

@app.patch("/users/{user_id}")  # PATCH /users/123 - 部分更新用户
async def patch_user(user_id: int, user: UserPatch):
    return patch_existing_user(user_id, user)

@app.delete("/users/{user_id}")  # DELETE /users/123 - 删除用户
async def delete_user(user_id: int):
    return delete_existing_user(user_id)
```
