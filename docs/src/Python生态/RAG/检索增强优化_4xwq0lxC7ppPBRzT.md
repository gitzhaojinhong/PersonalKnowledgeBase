# 检索增强优化

## 知识检索 Agent 架构

| 架构 | 介绍 | 可控性 | 拓展性 | 延迟 | 场景 |
| --- | --- | --- | --- | --- | --- |
| 2-Step RAG | 每次调用模型前都做知识检索，流程简单、可控 | ✅ High | ❌ Low | ⚡ Fast | FAQs, 文档问答机器人 |
| Agentic RAG | 由 LLM 来思考何时进行知识检索 | ❌ Low | ✅ High | ⏳ Variable | 绑定了很多工具的研究助手 |
| Hybrid | 结合两种方式的特点，并加入答案验证环节 | ⚖️ Medium | ⚖️ Medium | ⏳ Variable | 对回答质量要求非常高的特殊领域 |

### 2-Step RAG

![1794816373906-0203e2f4-fad8-437e-95a1-da508579f8be.png](./img/4xwq0lxC7ppPBRzT/1794816373906-0203e2f4-fad8-437e-95a1-da508579f8be-144089.png)

把RAG的流程固化为两步：

1. Retrieve：检索知识库，返回知识片段
2. Generate：增强生成，基于知识片段增强Prompt和用户问题，调用模型生成答案

简单来说：就是每次发送请求给LLM之前，都修改提示词，拼接检索到的知识片段。

> 在LangChain中，提供了一个@dynamic_prompt装饰器，用来实现动态修改提示词。

```python
from langchain.agents.middleware import dynamic_prompt, ModelRequest
from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
load_dotenv()

# 0.定义动态提示词中间件
@dynamic_prompt
def rag_prompt(request: ModelRequest):
    # 1.拿到用户问题，也就是消息列表中的最后一条消息
    print("================User Message================")
    user_input = request.state['messages'][-1].text
    print(user_input, "\n")

    # 2.检索知识片段, list[Document], 拼接为字符串
    docs = vector_store.similarity_search(user_input, k=2)
    context = "\n\n".join(doc.page_content for doc in docs)
    print('=============== Context ====================')
    print(context, "\n")

    # 3.拼接新系统提示词
    return f'''
    你是一个教资考试专家，你根据上下文回答用户问题，不能自己编造答案。答案要简短，直接引用原文。
    Context: {context}
    '''
# 1.初始化模型
model = init_chat_model(
    "deepseek-v4-flash",
    extra_body={'thinking': {'type': 'disabled'}}
)

# 2.定义Agent
agent = create_agent(
    model,
    middleware=[rag_prompt],
)
```

### Agentic RAG

Agent自主决定何时检索、检索什么、用不用其他工具。实现方式就是将检索器包装为Tool，Agent可以自主判合适调用工具来获取文档，甚至是多次检索，多轮迭代。

| \*\*\*\***好处** | \*\*\*\***缺点** |
| --- | --- |
| 只在需要时搜索 —LLM 可以处理问候、跟进和简单查询，而不会触发不必要的搜索。 | 两次 LLM 调用 —— 在执行搜索时，需要一个调用生成查询，另一个调用生成最终响应。 |
| 上下文搜索查询 - 通过将检索作为 “查询” 的工具，LLM 可以根据会话上下文的自定义查询。 | 可能失控 - LLM 可能在实际需要时跳过搜索，或者在不必要时发出额外的搜索。 |
| 允许多次搜索 - LLM 可以执行多个搜索来寻找答案。 | |

```python
from langchain_core.tools import tool
from langchain.chat_models import init_chat_model
from langchain.agents import create_agent
# ================Agentic RAG===================

# 1.加载环境变量
from dotenv import load_dotenv
load_dotenv()

# 2.初始化模型
model = init_chat_model(
    "deepseek-flash",
    extra_body = {"thinking": {"type": "disabled"}}
)

# 3.定义工具
@tool
def retrieve_docs(query: str):
    """检索知识库，获取与用户提问相关的知识片段"""

    # 1.根据问题检索知识片段
    documents = vector_store.similarity_search(query)

    # 2.拼接知识片段
    context = "\n".join([doc.page_content for doc in documents])

    return context

# 4.定义Agent，绑定model和Tool
agent = create_agent(
    model,
    tools=[retrieve_docs],
    system_prompt="你是一个教资考试专家，回答与教资相关问题时，必须调用工具检索文档，根据文档回答用户的问题，不能自己编造答案。答案要简短，直接引用原文。"
)
```

## 检索优化

### 查询优化

#### 查询重写

查询重写，用LLM将用户口语化问题改写成更规范、更易于检索的查询（多视角重写）

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("deepseek-flash")
query = "什么是python"  # 先定义！

rewrite_prompt = f"""
提取问题的核心检索关键词，多个关键词使用英文空格分隔，只输出关键词，禁止额外解释、标点、换行。
问题：{query}
关键词："""

response = model.invoke(rewrite_prompt)
rewrite_query = response.content.strip()
print(f"问题重写：'{query}' -> '{rewrite_query}'")
```

#### 虚构文档嵌入

HyDE 的全称是 Hypothetical Document Embeddings，中文通常翻译为虚构文档嵌入。

核心思想：先假装回答用户的问题，生成一个虚构的答案文档，然后用这个虚构答案去检索真正相关的文档。

为什么需要HyDE?

因为有的时候用户的问题（Query）与答案所在的真实文档（Document）之间，在向量空间里可能距离很远。

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("deepseek-flash")
query = "什么是python"
rewrite_prompt = f"""
请根据你的知识，生成一个对以下问题的可能答案（简短但要关键，50字左右可）：
问题: {query}
答案:
"""
response = model.invoke(rewrite_prompt)
fake_answer = response.content
print(f"虚构答案：'{query}' -> '{fake_answer}'")
```

#### 问题拆分

```python
from langchain.chat_models import init_chat_model
import json

model = init_chat_model("deepseek-flash")

query = "孔子和孟子的教育思想有什么不同？"

rewrite_prompt = f"""
你是一个RAG专家，请将用户问题拆分为多个子问题，问题数量适当，不要过分拆解导致过渡检索引入噪音。不要任何解释，直接返回JSON数组。
问题: {query}
子问题:
"""
response = model.invoke(rewrite_prompt)
sub_queries = json.loads(response.content)
print(f"问题重写：'{query}' -> '{sub_queries}'")
```

#### Middleware中间件的方式实现

```python
from langchain.chat_models import init_chat_model
from langchain.agents import AgentState
from langchain_core.vectorstores import VectorStore

# 定义一个用于重写用户问题的模型，可以使用便宜的小模型
rewrite_llm = init_chat_model("deepseek-chat")


# 定义重写用户问题的Middleware
class QueryRewriteMiddleware(AgentMiddleware):
    """先改写查询再检索"""

    def __init__(self, vector_store: VectorStore, llm, top_k: int = 3):
        super().__init__()
        self.vector_store = vector_store
        self.llm = llm
        self.top_k = top_k

    def before_model(self, state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
        messages = state.get("messages", [])
        if not messages:
            return None

        last_message = messages[-1]
        query = last_message.content if hasattr(last_message, 'content') else str(last_message)

        # Step 1: 重写查询

        ## 1.1.编写提示词
        rewrite_prompt = f"""
将以下问题改写为适合检索的关键词形式。提取核心概念，用空格分隔。只输出关键词不要解释。

问题: {query}
关键词:
"""
        ## 1.2.调用模型，重写用户问题
        rewritten = self.llm.invoke(rewrite_prompt).content.strip()
        print(f"[Rewrite] '{query[:40]}...' -> '{rewritten}'")
        print("=" * 60)

        # Step 2: 用改写后的查询检索
        ## 2.1.检索文档
        retrieved_docs = self.vector_store.similarity_search(query=rewritten, k=self.top_k)
        if not retrieved_docs:
            return None

        docs_content = "\n\n".join(
            f"[{d.metadata.get('source', '?')}] {d.page_content}" for d in retrieved_docs
        )

        print(f"检索到文档：{docs_content}")
        print("=" * 60)
        ## 2.2.拼接为新提示词并返回
        augmented = f"{query}\n\n请根据以下上下文回答：\n{docs_content}"

        return {
            "messages": [last_message.model_copy(update={"content": augmented})]
        }

rewrite_middleware = QueryRewriteMiddleware(vectorstore, rewrite_llm)
```

### 检索优化

常见的检索手段有两种：

* 语义检索，也叫稠密检索，就是基于向量检索语义最接近的
* 关键词检索，也叫稀疏检索，就是基于关键词的检索，关注关键词在文档中的权重

| 特性 | 稀疏检索（BM25/全文） | 稠密检索（向量） |
| --- | --- | --- |
| 长处 | 精确匹配关键词、ID、代码、专有名词；速度快；可解释 | 理解同义词、近义词、上下文；跨语言；模糊表达鲁棒 |
| 短处 | 词汇鸿沟（“汽车”≠“轿车”）；对拼写/形态敏感 | 对罕见词、专有名词不敏感（可能当成普通语义）；可解释性差 |
| 失败例子 | 查“笔记本”想找“laptop”，但文档只用“便携电脑” → 召回失败 | 查“错误码E-4213”，模型可能召回一堆关于“错误”的文档，但精确码不匹配 → 精准度低 |

#### 稠密检索

稠密检索，就是基于向量检索。

语义检索这一块，由于是让模型来根据向量理解，哪怕你写错字AI也能理解你的意思：

```python
query = "教育的隐形作用是什么"
vector_results = vectorstore.similarity_search_with_score(query, k=3)
for doc, score in vector_results:
    print(doc.model_dump_json(indent=2))
    print(f"=========score: {score}============")
```

#### 稀疏检索

稀疏检索也就是关键词检索，在查询专有名词、代码、ID时准确度特别高。常见的实现方案有:

* 统计式：BM25算法、TF/IDF算法等都是基于词频统计的稀疏检索算法，需要的计算资源较少，速度快
* 学习式：BGE-M3、SPLADE，是基于神经网络模型训练实现稀疏检索，需要的计算资源多（GPU），速度慢但准确度高

> 稀疏检索会生成一个与词表长度一样的高维向量（例如10万维），而一个文档通常只包含几百个不同的词，词表向量中对应词的位置有数值，其它位置值为0，例如要词表含词条10万，文档的词只有100个。那么10万大小的词表向量中仅仅只有100个词有值，向量值比较稀疏，因此称为稀疏检索。

虽然学习式稀疏检索效果更好，但 BM25 凭借以下优势仍是工业界标配：

* 零训练成本：开箱即用，不需要标注数据
* 极快速度：纯倒排索引 + 整数运算
* 可解释性强：知道为什么一个文档被匹配
* 稳定性高：不会因为领域变化而崩溃

稀疏索引检索通常使用 Elasticsearch、Milvus 数据库实现。

BM25 python代码示例：

pyproject.toml：

```toml
[tool.uv.extra-build-dependencies]
pkuseg = ["numpy"]
```

安装依赖：

```powershell
uv add pkuseg bm25s
```

> pkuseg 包含 **Cython (.pyx) 源码**，安装时需要本地 C++ 编译器编译扩展，Windows 默认没有，所以装不上。
>
> 可以替换为`uv add jieba bm25s`；jieba 是 Python 最流行、开箱即用的中文分词库

代码：

```python
# =============================== 初始化BM25索引库 ====================================
import os
import bm25s
import pkuseg  # 如果需要对中文分词

# 0.准备一个初始化BM25库的工具
seg = pkuseg.pkuseg()
def create_bm25_index(metadata_corpus, index_path="./db/my_index.bm25", k1=1.5, b=0.75):
    if os.path.exists(index_path):
        print(f"索引文件已存在，正在加载: {index_path}")
        retriever = bm25s.BM25.load(index_path, load_corpus=True)
    else:
        print(f"未找到索引文件，正在创建新索引...")
        # 对语料进行分词
        corpus_tokens = [seg.cut(doc["content"]) for doc in metadata_corpus]
        # 基于原始文档创建索引库，将来检索出来的也是原始文档
        retriever = bm25s.BM25(k1 = k1, b = b, corpus=metadata_corpus)
        # 创建索引
        retriever.index(corpus_tokens)
        # 保存到本地
        retriever.save(index_path)
        print(f"索引已保存至: {index_path}")

    return retriever
    
# 1.把之前切分的文档处理成dict，与doc_id一一映射
metadata_corpus = [
    {"id": doc.id, "content": doc.page_content} for doc in ds
]

# 2.创建BM25索引库
bm25_retriever = create_bm25_index(metadata_corpus)

# ================================== 检索文档 =======================================
from typing import List, Tuple, Dict
# 3.封装查询方法
def bm25_search(query: str, k: int = 3) -> List[Tuple[Dict, float]]:
    # 查询分词
    query_tokens = [seg.cut(query)]
    # 检索,返回top-k结果，形式为(docs, scores). docs和scores都是二维数组 shape (n_queries, k).
    results, scores = bm25_retriever.retrieve(query_tokens, k=k)
    # 封装结果
    return [(results[0, i], scores[0, i]) for i in range(results.shape[1])]

# 4.测试
query = "给教师的建议是谁写的"
# 调用工具
ranked_docs = bm25_search(query, k = 3)

for i, (doc, score) in enumerate(ranked_docs):
    print(f"======================Rank {i+1} (score: {score:.2f})=================")
    print(f"doc: {doc}")

```

#### 混合检索

单一采用稀疏或稠密检索都会存在问题:

* 稀疏检索: 可以精确匹配专业名词，但会漏掉同义词或语义接近的内容
* 稠密检索: 擅长检索语义接近的内容，但可能错过专业名词，甚至错过关键词

最佳的方案就是把两种方案结合。比较常见的手段有：

* 多路召回 + 融合排序 （最常用）
  * 通过稀疏、稠密等多种方式查询文档列表
  * 再将所有文档融合为一个列表
  * 最终将所有文档重新打分排序
* 级联检索:
  * 先用稀疏检索快速筛选候选文档列表，比如Top200
  * 再用稠密检索重新筛选这200个候选文档，比如取Top10

混合检索后，常见的文档结合方式有：

* 分数归一化：不同的检索体系打分方式不同，直接做加权求和没有意义，通常会把分数归一化
* 加权求和: 首先需要对分数归一化，然后给不同的召回方案设置不同权重，然后合并分数
* RRF：基于倒数排名求和，只与排名有关，与分数无关。公式：1/(k + rank)

##### 分数归一化

由于不同的检索体系打分方式不同，分值差异可能较大：

| 检索器 | 分数范围 | 典型值 |
| --- | --- | --- |
| BM25 | 通常 0 ~ 10+ | 0.5, 1.2, 5.0 |
| 向量余弦相似度 | 0 ~ 1（或 -1~1） | 0.85, 0.92 |
| Cross-Encoder | 变化，有的 0~1，有的无界 | -2.5 ~ 5.0 |

常见的归一化方法有：

* Min-Max: 计算简单，值范围固定为\[0,1]，为公式为 score - min / (max - min)
* Z-Score: 转为均值为0，标准差为1的正态分布。公式是 (s - avg) / 标准差
* Softmax: 将分数转为概率分布，所有值在 0~1 之间，且总和为 1，分布均匀程度取决于temperature

**min-max算法：**

```python
from typing import Dict, List

def min_max_normalize(scores_dict: Dict[str, float]):
    """对字典值进行 Min-Max 归一化"""
    if not scores_dict:
        return {}
    scores = list(scores_dict.values())
    min_s = min(scores)
    max_s = max(scores)
    if max_s == min_s:
        return {k: 0.5 for k in scores_dict}
    return {k: (v - min_s) / (max_s - min_s) for k, v in scores_dict.items()}
```

##### 加权求和

加权求和的前提是要**先对分数归一化**

```python
def weighted_sum_fusion(
    results_list: List[dict[str, float]],
    weights: List[float],
    normalized: List[bool]
) -> List[Tuple[str, float]]:
    """
    加权求和融合多个检索结果
    results_list: [检索器1的{doc_id: score}, 检索器2的{doc_id: score}, ...]
    weights: 对应权重，应总和为1
    normalized: 对应结果集是否需要归一化
    返回: [(doc_id, final_score), ...] 按分数降序
    """
    assert len(results_list) == len(weights)
    assert len(normalized) == len(weights)

    # 1. 收集所有文档 ID
    all_doc_ids = set()
    for results in results_list:
        all_doc_ids.update(results.keys())

    # 2. 可选：归一化每个检索器的分数
    normalized_results = []
    for i, results in enumerate(results_list):
        normalized_results.append(
            min_max_normalize(results) if normalized[i] else results
        )

    # 3. 加权求和
    final_scores = {}
    for doc_id in all_doc_ids:
        total = 0.0
        for i, norm_results in enumerate(normalized_results):
            score = norm_results.get(doc_id, 0.0)  # 未出现得0分
            total += weights[i] * score
        final_scores[doc_id] = total

    # 4. 重新排序并返回
    sorted_docs = sorted(final_scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_docs
```

##### RRF

RRF（Reciprocal Rank Fusion，倒数排名融合） 是一种用于融合多个检索结果列表的算法，它与多路召回的文档得分无关，只关心排名。

核心公式:     $ {RRF}(d) = \sum\_{r=1}^{n}\frac{1}{k + \text{rank}\_r(d)} $

| **符号** | **含义** |
| --- | --- |
| $ d $ | 某个文档 |
| $ k $ | 常量，通常是60 |
| $ \text{rank}\_r(d) $ | 文档 $ d $ 在第 $ r $ 个检索结果列表中的排名位置（从1开始） |
| $ \text{RRF}(d) $ | 文档 $ d $ 的最终融合得分 |

特点：

| **优点** | **缺点** |
| --- | --- |
| 无需归一化（排名天然可比） | 对排名靠后的文档不敏感 |
| 对离群值不敏感 | 无法处理得分/置信度信息 |
| 计算简单、效率高 | 默认 $ k=60 $ 不总是最优 |
| 可融合任意数量的检索列表 | 所有检索源权重相同 |

示例：

```python
def reciprocal_rank_fusion(ranked_lists: List[List[Dict]], k=60):
    """
    ranked_lists: List[List[Dict]]
                  每个检索器返回的文档dict列表，包含id和content，按排名从高到低。
                  注意：这里不需要score，在 RRF 中只使用排名位置。
    """
    rrf_scores = {}  # 字典，key=doc_id, value=累加的 RRF 贡献
    results = {}  # 字典，key=doc_id, value=doc
    for rank_list in ranked_lists:
        for rank, doc in enumerate(rank_list, start=1):
            # 每个文档在每个列表中独立贡献
            doc_id = doc["id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (k + rank)
            results[doc_id] = doc

    # 按 RRF 总分降序排序
    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)

    return [results[doc_id] for doc_id, score in sorted_docs]
```

### 重排序

常用的重排序方式有：

* **得分排序**: 如果使用了加权融合或RRF，则每个文档都有新的打分，可以直接按得分排序
* **MMR**: 全称是Maximum Marginal Relevance，最大边际相关性，尽可能使结果多样性
* **Cross Encoder**: 交叉编码，把用户问题和每个文档一起输入模型，精确打分

#### MMR

> MMR在实际场景中使用较少

LangChain的retriever天然支持MMR，其中有一个关键参数是lambda_mult，效果如下：

* lambda_mult=1：最大相关性（等同Similarity）
* lambda_mult=0：最大多样性
* lambda_mult=0.5：平衡（推荐）

```python
# 创建MMR检索器
mmr_retriever = vectorstore.as_retriever(
    search_type="mmr",   # 指定 MMR 检索器
    search_kwargs={"k": 3, "fetch_k": 6, "lambda_mult": 0.5}
)

query = "教育是什么？"

print("普通Similarity检索:")
for i, doc in enumerate(retriever.invoke(query)):
    print(f"  {i + 1}. [{doc.id}] {doc.page_content}...")

print("\nMMR检索 (lambda=0.5):")
for i, doc in enumerate(mmr_retriever.invoke(query)):
    print(f"  {i + 1}. [{doc.id}] {doc.page_content}...")
```

算法流程（贪心迭代）

1. 先选出和 query 相关性最高的文档，放入选中集 S
2. 剩下所有候选，计算 MMR 分数：和 query 的相似度，减去【和已经选中文档里最相似那一条】的惩罚分
3. 选 MMR 最高分文档加入 S
4. 循环，直到凑够目标 topN

解决什么痛点

* 向量召回经常出现：top5 全部是内容高度近似、重复的 chunk，只是 embedding 挨在一起；LLM 上下文窗口被重复信息挤占，缺少多角度信息。
* MMR 强制选出既相关、又尽量不重复的文档，提升信息覆盖度。

算法示例：

```python
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

def mmr(query_emb, doc_embs, lambda_val=0.7, top_k=5):
    """
    query_emb: 查询向量 (1, d)
    doc_embs: 文档向量 (n, d)
    """
    sim_query = cosine_similarity(query_emb, doc_embs)[0]  # 相关性
    sim_doc = cosine_similarity(doc_embs, doc_embs)        # 文档间相似度
    
    selected = []
    remaining = list(range(len(doc_embs)))
    
    for _ in range(top_k):
        mmr_scores = []
        for i in remaining:
            # 与已选文档的最大相似度
            if selected:
                max_sim = max(sim_doc[i][j] for j in selected)
            else:
                max_sim = 0
            score = lambda_val * sim_query[i] - (1 - lambda_val) * max_sim
            mmr_scores.append(score)
        
        best_idx = remaining[np.argmax(mmr_scores)]
        selected.append(best_idx)
        remaining.remove(best_idx)
    
    return selected
```

#### Cross-Encoder

Cross-Encoder，交叉编码，把用户问题和每个文档一起输入Transformer模型，精确打分。

前提镜像源`HF_ENDPOINT=https://hf-mirror.com`

依赖：

```powershell
# `sentence-transformers` 自带依赖 `huggingface_hub`（Python 包）不需要安装HuggingFace
uv add torch sentence-transformers
```

> 如果拉取不到模型Qwen/Qwen3-Reranker-0.6B
>
> 到modelscope里面下载：
>
> * git lfs install
> * git clone https://www.modelscope.cn/Qwen/Qwen3-Reranker-0.6B.git
> * "Qwen/Qwen3-Reranker-0.6B"使用下载下来的模型路径

使用：

```python
import torch
from sentence_transformers import CrossEncoder

# 首次运行会从镜像源自动下载模型到本地缓存（默认路径：~/.cache/huggingface/hub/）
# 后续运行直接读取缓存，无需重复下载
model = CrossEncoder(
    "Qwen/Qwen3-Reranker-0.6B",
    device="cuda" if torch.cuda.is_available() else "cpu"
)

# =============== 测试 =================
query = "哪个星球被称为红色星球?"
passages = [
    "金星通常被称为地球的孪生兄弟，因为它的大小和距离相似。",
    "火星以其红色的外观而闻名，通常被称为红色星球。",
    "木星，太阳系中最大的行星，有一个突出的红斑。",
    "以其光环而闻名的土星，有时被误认为是红色星球。"
]

scores = model.predict([(query, passage) for passage in passages])
print(scores)
# ============ 输出示例 ===============
# [-1.      9.9375      3.      7.0625]
```

### 综合示例

**稠密稀疏+混合检索RRF+Cross-Encoder**

封装cross-encoder rerank工具:

```python
from typing import List, Dict
# 封装一个cross-encoder函数
def cross_encoder_rerank(query: str, docs: List[Dict], top_k: int = 3):
    # 打分
    scores = model.predict([(query, doc["content"]) for doc in docs])

    # 分数写入文档dict
    for i, s in enumerate(scores):
        docs[i]["score"] = s

    # 排序
    sorted_docs = sorted(docs, key=lambda x: x["score"], reverse=True)

    # 去掉0分以下的
    positive_docs = [doc for doc in sorted_docs if doc["score"] > 0]

    return positive_docs[0: min(top_k, len(positive_docs))]
```

定义检索工具:

*这个检索工具包含了：稠密检索、稀疏检索、RRF融合、cross-encoder rerank的完整流程。*

```python
from langchain.tools import tool
from langchain.agents import create_agent
import time

# 将检索器包装为Tool，Agent自主决定调用
@tool
def search_knowledge_base(query: str) -> str:
    """搜索知识库，获取技术概念、框架说明等知识。需要查找资料时调用。"""
    top_k = 3
    start = time.perf_counter()
    # 1.稠密检索（向量）
    vector_results = vectorstore.similarity_search(query, k=top_k)
    end = time.perf_counter()
    print(f"稠密检索完成,耗时:{(end - start) * 1000}ms~")
    start = end
    # 2.稀疏检索（bm25）
    bm25_results = bm25_search(query, k=top_k)
    end = time.perf_counter()
    print(f"稀疏检索完成,耗时:{(end - start) * 1000}ms~")
    start = end

    if not vector_results or not bm25_results:
        return "未找到相关文档"

    # 3.RRF
    # 3.1.处理成List[dict], dict包含id和content
    vector_rs = [
        {"id": doc.id, "content": doc.page_content} for doc in vector_results
    ]
    bm25_rs = [doc for doc, _ in bm25_results]
    end = time.perf_counter()
    print(f"rrf前置文档处理完成,耗时:{(end - start) * 1000}ms~")
    start = end

    # 3.2.rrf
    rrf_results = reciprocal_rank_fusion([vector_rs, bm25_rs])
    end = time.perf_counter()
    print(f"rrf完成,耗时:{(end - start) * 1000}ms~")
    start = end

    # 4.cross-encoder精排
    final_docs = cross_encoder_rerank(query, rrf_results, top_k)
    end = time.perf_counter()
    print(f"cross-encoder完成,耗时:{(end - start) * 1000}ms~")

    # 5.拼接文档
    docs_content = "\n\n".join(doc["content"] for doc in final_docs)

    # 6.输出日志
    print(f"\n\n{"=" * 30}Tool Message{"=" * 30}")
    print(f"检索到与问题'{query}'相关文档：")
    print(f"\n\n".join([f"=====score: {doc["score"]}=======\n\n{doc["content"]}" for doc in final_docs]))
    print("=" * 30 + "AI Message" + "=" * 30)

    return docs_content
```

定义Agent：

```python
rag_agent = create_agent(
    model="deepseek-chat",
    tools=[search_knowledge_base],
    system_prompt="""
    你是一个专业的教师资格证考试辅导专家。您的主要职责是帮助用户解决有关教资考试的相关问题。产品说明:
    1。如果用户问了一个你不确定的问题，或者涉及教资专业知识的问题，你必须使用`search_knowledge_base`工具来查阅相关文档。
    2. 在引用文档时，要清楚地总结包括内容中的相关上下文。
    3. 如果获取文档失败，请告诉用户，并以您最好的专家理解继续进行。
    在回答用户关于教资考试知识的问题之前，您必须查阅工具以获取最新信息。你的回答应该清晰、简洁、准确。不要有过多解释除非用户询问。
    """,
)

print("Agentic RAG Agent 创建完成")
```

使用：

```python
from langchain.messages import AIMessage
# 检索
response = rag_agent.stream(
    {"messages": [{"role": "user", "content": "你好"}]},
    stream_mode="messages"
)

for chunk, metadata in response:
    if isinstance(chunk, AIMessage) and chunk.content:
        print(chunk.content, end="")
```
