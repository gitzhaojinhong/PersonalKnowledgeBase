# 表单或文件上传

## Content-Type请求头

| 对比项 | JSON | 表单数据 |
| --- | --- | --- |
| Content-Type | | |
| 声明方式 | | |
| 数据结构 | | |
| 适用场景 | | |

## 安装依赖

使用表单或文件上传功能前，需要先安装 python-multipart：

```powershell
pip install python-multipart
```

## 表单

请求头为`'Content-Type: application/x-www-form-urlencoded'`

```python
from fastapi import FastAPI, Form

app = FastAPI()

@app.post("/login/")
async def login(
    username: str = Form(),      # 必填表单字段
    password: str = Form(),      # 必填表单字段
    description: str | None = Form(None),     # 可选，默认 None
):
    return {"username": username}
```

## 文件上传

### <font style="color:rgb(51, 51, 51);background-color:rgb(248, 251, 245);">UploadFile接收文件</font>

UploadFile 是推荐的方式，它提供了更丰富的文件信息访问接口：

请求头为`Content-Type: multipart/form-data`

```python
from fastapi import FastAPI, UploadFile

app = FastAPI()


@app.post("/uploadfile/")
// 多文件上传使用  ->  file:list[UploadFile]
async def create_upload_file(file: UploadFile):
    # UploadFile 提供的属性和方法
    return {
        "filename": file.filename,          # 文件名
        "content_type": file.content_type,  # 文件 MIME 类型
        "size": file.size,                  # 文件大小（字节）
    }
```

UploadFile的属性和方法：

| 属性/方法 | 类型 | 说明 |
| --- | --- | --- |
| filename | str | None | 上传文件的原始文件名 |
| content_type | str | None | 文件的MIME类型（如image/png） |
| file | spooledTemporaryFile | 类似文件的对象，可读取文件的内容 |
| size | int | None | 文件字节大小 |
| read() | 方法 | 读取文件内容为bytes |
| write() | 方法 | 向文件中写入内容 |
| seek() | 方法 | 移动文件指针位置 |
| close | 方法 | 关闭文件 |

### 使用File接收文件

File 直接将文件内容读取为 bytes，适合小文件：

```python
from fastapi import FastAPI, File

app = FastAPI()

@app.post("/files/")
async def create_file(file: bytes = File()):
    # file 是文件的原始字节数据
    return {"file_size": len(file)}
```

### 保存上传的文件

```python
import shutil
from fastapi import FastAPI, UploadFile

app = FastAPI()


@app.post("/uploadfile/")
async def create_upload_file(file: UploadFile):
    # 将上传的文件保存到指定路径
    with open(f"uploads/{file.filename}", "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    return {"filename": file.filename, "message": "文件上传成功"}
```
