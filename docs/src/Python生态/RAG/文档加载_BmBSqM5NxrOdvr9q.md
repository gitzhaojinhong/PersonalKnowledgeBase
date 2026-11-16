# 文档加载

## MinerU SDK
前提：.env配置TOKEN

```properties
# MinerU
MINERU_TOKEN=sk-xxxxxxxxxxxxxxxxxx
```

### 依赖
```powershell
uv add mineru-open-sdk
```

### 使用
**初始化客户端：**

```python
from mineru import MinerU
import os
from dotenv import load_dotenv
load_dotenv()

# 1.创建客户端
client = MinerU(token = os.getenv("MINERU_TOKEN"))
```

**解析文档：**

两种解析模式：1.快速模式；2.精准模式。

Flash（快速模式）：

```python
# 解析文件
result = client.flash_extract("./resources/sample.pdf")

# 获取markdown
print(result.markdown)
```

Precision（精确模式）：

```python
# 解析文件
result = client.extract("./resources/sample.pdf")

# 获取markdown
print(result.markdown)

# 保存数据到本地
result.save_all("resources/output")
```

### OCR功能
对于扫描件类型的PDF，MinerU处理起来也毫不费力，只需要把OCR参数改为True即可：

```python
# 解析文件，支持各种自定义参数，例如：ocr、
result = client.extract('./resources/small_ocr.pdf', ocr=True)

# 获取markdown
print(result.markdown)
# 输出到本地
result.save_markdown('./resources/output/ocr.md')
```



## LangChain API
前提：.env配置TOKEN

```properties
# MinerU Key名字必须是MINERU_TOKEN
MINERU_TOKEN=sk-xxxxxxxxxxxxxxxxxx
```

### 依赖
```powershell
uv add langchain-mineru
```

### 使用
```python
from langchain_mineru import MinerULoader

# 初始化客户端
loader = MinerULoader(
    source="./resources/贵州茅台研报.pdf",
    mode="flash" # 可选: flash 、 precision
)
# 解析文档，返回值直接是LangChain的 Document集合
docs = loader.load()

print(docs[0].metadata) # 元数据
print(docs[0].page_content) # 文档内容

# 写到本地看看
with open("./resources/output/r1.md", "w", encoding="utf-8") as f:
    f.write(docs[0].page_content)
```

### OCR功能
对于扫描件类型的PDF，MinerU处理起来也毫不费力，只需要把OCR参数改为True即可：

```python
from langchain_mineru import MinerULoader

# 初始化客户端
loader = MinerULoader(
    source="./resources/small_ocr.pdf",
    mode="precision",
    ocr= True
)
# 解析文档，返回值直接是LangChain的 Document集合
docs = loader.load()

print(docs[0].metadata) # 元数据
print(docs[0].page_content) # 文档内容

# 写到本地看看
with open("./resources/output/r2.md", "w", encoding="utf-8") as f:
    f.write(docs[0].page_content)
```

