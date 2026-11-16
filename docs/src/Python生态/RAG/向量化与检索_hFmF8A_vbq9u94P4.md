# 向量化与检索

## 向量相似度
衡量向量相似度的计算方法

+ 余弦相似度（Cosine similarity）：两个向量之间的夹角。
+ 欧氏距离（Euclidean distance ）：两点之间的直线距离。
+ 点积（Dot product）：一个向量在另一个向量上的投影量

**余弦相似度优势：**

+ 语义方向相似，不受向量模长影响，非常适合**文本 Embedding**。比如一句话长、一句话短，但语义相近，余弦依然能匹配上；点积、欧氏距离会被长度干扰。
+ 适合 NLP、检索、RAG

**欧氏距离优势：**

+ 直观几何意义：位置有多靠近；同时兼顾方向 + 向量长度
+ 适合向量幅值本身有物理含义的数据：图像像素、用户特征、坐标点、传感器数值

**点积优势：**

+ 同时编码方向相似度 + 向量模长信息
+ 如果向量模长代表置信度 / 重要性，点积很合适

## LangChain 向量化 API
**核心：Embeddings 接口**

+ **embed_query 方法**：问题向量化函数，一次处理一个字符串
    - 参数：接收一个字符串（一个问题）
    - 返回值：一个浮点数数组（多维向量）
+ **embed_documents 方法**：是文档向量化函数，一次处理多个字符串
    - 参数：接收一个字符串列表（一批文档片段）
    - 返回值：一个浮点数数组的列表（多个多维向量）

**示例：**

```python
from langchain_ollama import OllamaEmbeddings

# 创建Embedding模型
ollama_embeddings = OllamaEmbeddings(
    model="qwen3-embedding:0.6b",  # 性价比高的模型
    dimensions=1024  # 可选：减少维度以节省存储
)

# 向量化单条文本
text = "我爱上班"
vector = ollama_embeddings.embed_query(text)


# 批量向量化
texts = ["我要躺平", "我爱工作", "拒绝加班"]
vectors = ollama_embeddings.embed_documents(texts)
print(f"\n批量向量化: {len(vectors)} 条, 维度: {len(vectors[0])}")


print('==============衡量相似度===============')
import numpy as np


def cosine_similarity(vec1, vec2):
    """余弦相似度函数"""
    dot = np.dot(vec1, vec2)
    return dot / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# 比较向量相似度
for i, v in enumerate(vectors):
    similarity = cosine_similarity(vector, v)
    print(f"{texts[i]}:", similarity)
```

## VectorStore 接口对接向量库
LangChain提供了统一的VectorStore接口，可以用统一的方式调用任意向量库：

+ add_documents : 添加文档到向量库（不用自己做文本向量化，只要提供好向量模型即可）
+ delete : 根据id删除某个文档
+ similarity_search : 基于相似度检索与用户问题有关的文档

### 初始化VectorStore
以用于测试的轻量级内存向量库为例，InMemoryVectorStore

> InMemoryVectorStore 只有一个embedding 参数，不能使用Schema指定 Collection 结构。只适用于测试。
>

```python
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama import OllamaEmbeddings

# 1.初始化向量模型
ollama_embeddings = OllamaEmbeddings(
    model="qwen3-embedding:0.6b",  # 性价比高的模型
    dimensions=1024  # 可选：减少维度以节省存储
)

# 2.初始化向量数据库
vectorstore = InMemoryVectorStore(ollama_embeddings)
```

### 添加 / 删除文档
添加和删除方法：

+ add_documents：接收list[Document]，可以批量添加文档
+ delete：接收list[str]，也就是id集合，可以根据id批量删除文档

添加：

```python
# 保存文档到向量数据库
ids = vectorstore.add_documents(docs)

print(ids)
```

删除：

```python
# 删除旧文档
vectorstore.delete(["doc_1", "doc_2"])
```

 

### 检索文档
VectorStore提供了多个检索文档的方法，例如：

+ search 方法 : 通用搜索方法，支持最多样化的参数
+ similarity_search 方法 : 基于相似度的搜索
+ similarity_search_with_relevance_scores 方法 : 基于相似度搜索，并且会返回相似度得分
+ ...

> 大多数情况下都希望使用相似度搜索，也就是similarity_search，而且similarity_search与similarity_search_with_relevance_scores的参数基本一致。
>



similarity_search方法实现文档相似度检索，其核心参数为：

+ query: 查询条件（用户的问题）
+ k: 要返回的文档最大数量（默认值：4）
+ score_threshold: 相似度打分的最小阈值，低于这个分值的文档会被丢弃
+ filter: 按文档元数据（metadata）筛选

> VectorStore提供as_retriever()方法将其转换为检索器，可以把调用VectorStore时的参数提前固化，简化后期的查询。
>
> Retriever 是把检索配置预先绑定到检索实例，上层调用接口被简化；可以理解成「检索配置预绑定」
>
> 检索器参考：[Retriever](https://docs.langchain.com/oss/python/integrations/retrievers)
>

#### 相似度检索
```python
# 用户问题
query = "论语中教育的目的是什么"

# 相似度检索，返回值是list[Document]
results = vectorstore.similarity_search(
    query=query,
    k = 5,
)

# 打印结果
for doc in results:
    print(doc.model_dump_json(indent=2))
```

#### 带相似度的得分检索
```python
# 相似度搜索并返回分数，结果是list[tuple[Document, float]]
results = vector_store.similarity_search_with_score(
    query,
    k = 5,
)

# 遍历结果，
for doc, score in results:
    print(f"==========score: {score}=============")
    print(doc.model_dump_json(indent=2))
```



