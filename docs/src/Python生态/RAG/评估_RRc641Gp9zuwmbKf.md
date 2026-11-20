# 评估

## 评估工具
| 工具 | 特点 | 适用场景 |
| --- | --- | --- |
| RAGAS | 开源标准，指标最全 | RAG系统日常评估 |
| LangSmith | LangChain官方平台 | 追踪+评估一体化 |
| DeepEval | 语法简洁，CI/CD友好 | 自动化测试流水线 |
| TruLens | 可视化反馈闭环 | 调试和迭代优化 |


### RAGAS安装
```powershell
uv add ragas
```

## RAGAS评估数据
> 新版 RAGAS 使用 ragas.Dataset（替代旧的 HuggingFace Dataset）。
>

| **字段名** | **含义** | **来源** | **需要 Ground Truth 的指标** |
| --- | --- | --- | --- |
| user_input | 用户问题 | 人工或自动生成 | Context Recall / Entities Recall / Noise Sensitivity |
| retrieved_contexts | RAG 系统召回的文档列表 | RAG 检索阶段输出 | 所有检索指标 |
| response | RAG 系统生成的回答 | RAG 生成阶段输出 | Faithfulness / Answer Relevancy / Noise Sensitivity |
| reference | 标准答案 | 人工标注 | Context Recall / Entities Recall / Noise Sensitivity |


**数据集示例（ragas.Dataset 单行）：**

```json
{
    "user_input": "孔子的教育思想有哪些？",
    "retrieved_contexts": [
        "孔子主张有教无类，认为人人都应该接受教育...",
        "孔子提出因材施教、启发诱导等教学原则..."
    ],
    "response": "孔子主张有教无类，提出因材施教、启发诱导、学思结合等教学原则。",
    "reference": "孔子主张有教无类，提出因材施教、启发诱导、学思结合、谦虚笃实四大教学原则。教育目的是培养士和君子。"
}
```

## RAGAS 核心指标
RAGAS 在"RAG评估"类别下提供8个指标（6个文本 + 2个多模态）。下面逐一说明 **6个核心文本指标**。

```plain
用户问题 ──→ 检索阶段 ──────────────→ 生成阶段 ──────────→ 回答
              │                           │
              ├─ Context Precision        ├─ Faithfulness
              ├─ Context Recall           ├─ Response Relevancy
              ├─ Context Entities Recall  └─ Noise Sensitivity
              └─ (检索质量)
```

### Context Precision（上下文精度）
测什么：检索返回的文档中，有多少是真正和问题相关的？同时考虑排名——相关文档排得越靠前，分数越高。

公式：

$ \text{Context Precision}@K = \frac{\sum_{i=1}^{K} \bigl( \text{relevant}_i \times \frac{|\{\text{relevant in top }i\}|}{i} \bigr)} {|\{\text{total relevant documents}\}|} $

简化理解：前 K 个结果中，相关文档排得越靠前贡献越大（排第1位权重1，排第3位权重1/3）。

举例：

+ 用户问："孔子的教育思想有哪些？"
+ 检索返回：① 孔子：有教无类、因材施教 ✓ ② 孟子：性善论 ✗ ③ 荀子：性恶论 ✗
+ 只有①相关且排在第一位 → Context Precision ≈ 1.0（高）
+ 若顺序为：① 孟子 ✗ ② 荀子 ✗ ③ 孔子 ✓，则相关文档排在第3位 → 分数低

目标：>= 0.85



### Context Recall（上下文召回率）
测什么：Ground Truth 中包含的信息，检索回来的文档覆盖了多少？有没有漏掉关键信息？

公式：

$ \text{Context Recall} = \frac{|\text{检索文档能支持的 GT 陈述数}|}{|\text{GT 中总陈述数}|} $

RAGAS 将 Ground Truth（标准答案） 拆解为原子陈述，逐一判断能否从检索文档中推断出来。

举例：

+ 问题："《学记》提出了哪些教学原则？"
+ Ground Truth："教学相长、豫时孙摩、长善救失、启发诱导"（4条）
+ 检索只返回了"教学相长"和"启发诱导"相关内容 → Context Recall ≈ 2/4 = 0.5（低）  
目标：>= 0.70

### Context Entities Recall（事实上下文召回）
测什么：Ground Truth 中出现的实体（人名、地名、术语、数字等），检索回来的文档覆盖了多少？适用于事实密集型场景。

公式：

$ \text{Context Entities Recall} = \frac{|\text{RE} \cap \text{RCE}|}{|\text{RE}|} $

其中 RE = Ground Truth 中的实体集合，RCE = 检索文档中的实体集合。

举例：

+ 问题："夸美纽斯有什么贡献？"
+ Ground Truth 实体：{夸美纽斯, 大教学论, 班级授课制, 泛智教育, 学年制}
+ 检索文档实体：{夸美纽斯, 大教学论, 班级授课制} → 命中3个
+ Context Entities Recall = 3/5 = 0.6  
目标：>= 0.70



---

### Faithfulness（忠实度 / 反幻觉）
测什么：模型回答中每一个事实陈述是否都能从检索文档中找到依据？检测"幻觉"的核心指标。

公式：

$ \text{Faithfulness} = \frac{|\text{检索文档能支持的陈述数}|}{|\text{回答中的总陈述数}|} $

RAGAS 将回答拆解为原子级事实陈述，逐一用检索文档验证。

举例：

+ 检索文档："夸美纽斯在《大教学论》中提出班级授课制。"
+ 模型回答："夸美纽斯提出了班级授课制和泛智教育，被称为教育学之父。"
+ 拆解：①"班级授课制" ✓ ②"泛智教育" ✗（文档无） ③"教育学之父" ✗（文档无）
+ Faithfulness = 1/3 ≈ 0.33 —— 编造了2个事实  
目标：>= 0.90



### Response Relevancy（回答相关性 / 切题度）
测什么：模型的回答是否紧扣用户问题？有没有答非所问或跑题？

注：Python 类名为 AnswerRelevancy，文档中称为 Response Relevancy。

公式：

$ \text{Response Relevancy} = \frac{1}{N} \sum_{i=1}^{N} \cos(E_{\text{original\_question}},\  E_{\text{generated\_question}_i}) $

RAGAS 从模型回答反向生成 N 个问题，计算每个生成问题与原始问题的余弦相似度后取平均。

举例：

+ 用户问："教育的本质属性是什么？"
+ 回答A："教育是有目的地培养人的社会活动。" → 反向问题 = "教育的本质属性是什么？" → 相似度高
+ 回答B："教育经历了原始、古代、现代三个阶段……" → 反向问题 = "教育经历了哪些阶段？" → 相似度低  
目标：>= 0.88



### Noise Sensitivity（噪声敏感度）
测什么：系统在利用检索文档时，产生错误回答的频率有多高？噪声敏感度越低，系统越鲁棒。

公式：

$ \text{Noise Sensitivity}_{\text{relevant}} = \frac{|\text{回答中的错误陈述数}|}{|\text{回答的总陈述数}|} $

其中"错误陈述" = 不符合 Ground Truth 或无法归因于相关上下文的陈述。得分越低越好（0 = 完美）。

举例：

+ 问题："LIC 以什么著称？"
+ Ground Truth："LIC 是印度最大的保险公司，1956年成立，管理大规模投资组合。"
+ 模型回答："LIC是最佳保险公司，拥有庞大投资组合，对金融稳定有贡献。"
+ 拆解：①"最大保险公司" ✓ ②"投资组合" ✓ ③"对金融稳定有贡献" ✗（Ground Truth 未提及）
+ Noise Sensitivity = 1/3 ≈ 0.333  
目标：<= 0.10（越低越好）



## 评估示例
### 准备知识库和检索组件
加载文档并切块：

```python
# 加载知识库 —— 与上一节的完整示例相同
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
import os

# 1. 加载并切分中二知识笔记
with open("./resources/output/r1.md", "r", encoding="utf-8") as f:
    docs = f.read()

# 先用md结构切分
headers_to_split_on = [
    ("#", "Header 1"),
    ("##", "Header 2"),
    ("###", "Header 3"),
]
markdown_splitter = MarkdownHeaderTextSplitter(headers_to_split_on)
chunks = markdown_splitter.split_text(docs)

# 创建递归切分器
recursive_splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=0,
    separators=["\n\n", "\n", "。"]  # 优先级从高到低
)

ds = []
idx = 1
# 定义方法，作用是给文档内容拼上三级标题和id
def handle_doc_header(doc: Document):
    global idx
    m = doc.metadata

    # 安全获取各级标题，不存在返回空
    h1 = m.get("Header 1", "").strip()
    h2 = m.get("Header 2", "").strip()
    h3 = m.get("Header 3", "").strip()

    prefix_parts = []
    if h1:
        prefix_parts.append(f"# {h1}")
    if h2:
        prefix_parts.append(f"## {h2}")
    if h3:
        prefix_parts.append(f"### {h3}")

    prefix = "\n".join(prefix_parts)
    if prefix:
        doc.page_content = f"{prefix}\n{doc.page_content}"

    doc.id = f"doc_{idx}"
    idx += 1
    return doc

# 遍历文档，判断大小，如果超过了200，再用递归大小切分
for doc in chunks:
    m = doc.metadata
    content = doc.page_content
    if len(content) > 200:
        sub_docs = recursive_splitter.split_documents([doc])
        ds.extend(handle_doc_header(d) for d in sub_docs)
    else:
        ds.append(handle_doc_header(doc))

for chunk in ds:
    print(len(chunk.page_content))
    print(chunk.id)
    print(chunk)
    print("=" * 60)
```

准备知识库和工具：

```python
# ====================== 向量化（Ollama Embedding）+ BM25稀疏检索 + RRF + CrossEncoder重排 ======================
from langchain_ollama import OllamaEmbeddings
from langchain_core.vectorstores import InMemoryVectorStore
from sentence_transformers import CrossEncoder
import torch
import jieba
import bm25s
from typing import List, Tuple, Dict
from langchain_core.documents import Document
import os

os.environ["HF_ENDPOINT"] = "https://hf-mirror.com"

# 1.初始化向量模型 & 向量库
ollama_embeddings = OllamaEmbeddings(
    model="qwen3-embedding:0.6b",
    dimensions=1024
)
vectorstore = InMemoryVectorStore(ollama_embeddings)
vectorstore.add_documents(ds)
retriever = vectorstore.as_retriever(kw_args={"k": 3})
print(f"知识库已就绪: {len(ds)} 个文档切片")

# 2. BM25 稀疏检索
bm25_retriever: bm25s.BM25 | None = None
bm25_id_map: Dict[int, Dict] = {}

def tokenize_cn(text: str) -> List[str]:
    return jieba.lcut_for_search(text)

def build_bm25_index(doc_list: List[Document]):
    global bm25_retriever, bm25_id_map
    corpus_tokens = []
    bm25_id_map = {}
    for inner_idx, d in enumerate(doc_list):
        tokens = tokenize_cn(d.page_content)
        corpus_tokens.append(tokens)
        bm25_id_map[inner_idx] = {"id": d.id, "content": d.page_content}
    bm25_retriever = bm25s.BM25()
    bm25_retriever.index(corpus_tokens)
    print("BM25索引构建完成")

def bm25_search(query: str, k: int = 3) -> List[Tuple[Dict, float]]:
    if bm25_retriever is None:
        return []
    query_tokens = [tokenize_cn(query)]
    results, scores = bm25_retriever.retrieve(query_tokens, k=k)
    out = []
    for i in range(results.shape[1]):
        inner_idx = results[0, i]
        score = scores[0, i]
        doc_item = bm25_id_map.get(inner_idx)
        if doc_item:
            out.append((doc_item, score))
    return out

# 3. RRF 融合
def reciprocal_rank_fusion(ranked_lists: List[List[Dict]], k=60):
    rrf_scores = {}
    results = {}
    for rank_list in ranked_lists:
        for rank, doc in enumerate(rank_list, start=1):
            doc_id = doc["id"]
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0) + 1.0 / (k + rank)
            results[doc_id] = doc
    sorted_docs = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
    return [results[doc_id] for doc_id, score in sorted_docs]

# 4. Cross-Encoder 重排序
cross_model = CrossEncoder(
    "./Qwen3-Reranker-0.6B",
    device="cuda" if torch.cuda.is_available() else "cpu"
)

def cross_encoder_rerank(query: str, docs: List[Dict], top_k: int = 3):
    scores = cross_model.predict([(query, doc["content"]) for doc in docs])
    for i, s in enumerate(scores):
        docs[i]["score"] = float(s)
    sorted_docs = sorted(docs, key=lambda x: x["score"], reverse=True)
    positive_docs = [doc for doc in sorted_docs if doc["score"] > 0]
    return positive_docs[0: min(top_k, len(positive_docs))]

print("Cross-Encoder 已就绪")
print("\n所有检索组件准备完成！")

# 提前构建BM25索引（必须在Agent之前执行）
build_bm25_index(ds)
```

### 创建agent
```python
# ====================== 构建 Agent & 检索Tool ======================
from langchain.tools import tool, ToolRuntime
from langchain.agents import create_agent, AgentState

def retrieve_docs(query: str, top_k: int):
    """混合检索：稠密 + 稀疏 + RRF + CrossEncoder"""
    # 1. 稠密检索
    vector_results = vectorstore.similarity_search(query, k=top_k)
    # 2. 稀疏检索 BM25
    bm25_results_list = bm25_search(query, k=top_k)
    if not vector_results or not bm25_results_list:
        return []
    # 3. RRF 融合
    vector_rs = [{"id": doc.id, "content": doc.page_content} for doc in vector_results]
    bm25_rs = [doc for doc, _ in bm25_results_list]
    rrf_results = reciprocal_rank_fusion([vector_rs, bm25_rs])
    # 4. Cross-Encoder 重排序
    return cross_encoder_rerank(query, rrf_results, top_k)

# tool 内部顺手把检索结果存下来，供评估时提取 context，避免检索两次
contexts_store = {}

@tool
def search_knowledge_base(query: str, runtime: ToolRuntime[AgentState]) -> str:
    """搜索知识库，获取教育学、名人等的知识。需要查找资料时使用。"""
    final_docs = retrieve_docs(query, 5)
    if not final_docs:
        return "未找到相关文档"

    # 顺手存 context，评估取用
    msg = runtime.state['messages'][0].content
    cs = contexts_store.get(msg, [])
    cs.extend([doc["content"] for doc in final_docs])
    contexts_store[msg] = list(set(cs))

    return "\n\n".join(doc["content"] for doc in final_docs)


rag_agent = create_agent(
    model="deepseek-chat",
    tools=[search_knowledge_base],
    system_prompt="""
你是一个教资考试答题助手。你必须严格遵守以下规则：
1. 有关教资的问题**只能**调用`search_knowledge_base`工具来查阅相关文档，根据文档信息回答问题
2. **禁止**添加任何你自己的知识、理解或推断
3. **禁止**扩展、举例或给出建议
4. 如果参考文档中没有相关信息，直接回复"根据提供的资料，无法回答此问题"
5. 回答要简洁，直接引用原文，不要改写或总结
""",
)

print("RAG Agent 创建完成！（混合检索：稠密+BM25+RRF+CrossEncoder）")

```

### 准备数据集
```python
# 收集 Agent 回答和检索上下文，构建 ragas.Dataset
import json
import time
from ragas import Dataset
import os


def create_dataset():
    """创建dataset，先尝试本地加载，如果没有则重新生成"""

    # 1. 创建 ragas Dataset
    dataset = Dataset(name="rag_eval", backend="local/csv", root_dir="./experiments")
    if os.path.exists("./experiments/datasets/rag_eval.csv"):
        # 尝试读取本地数据
        dataset.reload()
    # 如果有数据，直接返回，没有则重新生成数据集
    if len(dataset) > 0:
        print(f"加载了 {len(dataset)} 个测试数据集，不再重新生成")
        return dataset

    # 2. 加载评估问题
    with open("./resources/ragas_eval_dataset.json", "r", encoding="utf-8") as f:
        eval_data = json.load(f)

    print(f"加载了 {len(eval_data)} 个评估问题")

    # 3.调用Agent，生成response和context

    # 每次 Agent 调用后的等待时间（秒），避免触发模型提供商限流
    # DeepSeek 免费版建议 1~2s，付费版可适当降低，根据实际报错调整
    REQUEST_DELAY = 1

    print(f"开始收集回答和上下文（共 {len(eval_data)} 题，间隔 {REQUEST_DELAY}s）...")
    print("-" * 50)

    for i, item in enumerate(eval_data):
        query = item["question"]

        # 调用 Agent —— 内部 search_knowledge_base tool 会将检索结果存入 contexts_store
        response = rag_agent.invoke(
            {"messages": [{"role": "user", "content": query}]},
            {"configurable": {"thread_id": f"eval-{i}"}}
        )
        answer = response["messages"][-1].content

        # 从 tool 的 store 中取 context（一次检索，不重复）
        contexts = contexts_store.get(query, [])

        # 写入数据集
        dataset.append({
            "user_input": query,
            "response": answer,
            "retrieved_contexts": contexts,
            "reference": item["ground_truth"],
        })

        print(f"[{i + 1}/{len(eval_data)}] {query[:40]}... ✓ (contexts: {len(contexts)}条)")

        # 等待一会儿再发下一个请求，避免触发限流
        if i < len(eval_data) - 1:  # 最后一条不用等
            time.sleep(REQUEST_DELAY)

    dataset.save()
    print(f"\n评估数据集已保存: {len(eval_data)} 个样本 -> ./experiments/rag_eval/")
    return dataset


# 调用函数，创建dataset
dataset = create_dataset()
```

## RAGAS评估
### 准备模型
> 由于RAGAS默认支持OpenAI的客户端协议，所以我们不能用LangChain来初始化。而是改用OpenAI的客户端。
>

```python
# 新 API：@experiment 装饰器 + 标准指标
from ragas.llms import llm_factory
from ragas.embeddings.base import embedding_factory
from openai import AsyncOpenAI

# 评估模型客户端
llm_client = AsyncOpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url=os.getenv("DEEPSEEK_BASE_URL")

)
# 向量模型客户端
embedding_client = AsyncOpenAI(
    api_key="ollama",
    base_url="http://localhost:11434/v1"
)


# 文本推理模型
evaluator_llm = llm_factory(
    model="deepseek-flash", client=llm_client, max_tokens=384000)
# 向量模型
evaluator_embeddings = embedding_factory(
    model="qwen3-embedding:0.6b", client=embedding_client)
```

### 指标评估
随意获取一条数据集：

```python
print(dataset.__getitem__(3))
```

提取出其中的字段：

```python
row = dataset.__getitem__(3)
user_input = row.get("user_input")
response = row.get("response")
reference = row.get("reference")

retrieved_contexts = row.get("retrieved_contexts")
# 判读如果是str，就转为list，防止重新加载时list 被压平成了字符串
if isinstance(retrieved_contexts, str):
    # `ast.literal_eval` 是 Python 内置的一个“安全版字符串转对象” 工具
    # 把长得像 Python 字面量的字符串，还原成真正的 list /dict/int 等对象。
    retrieved_contexts = ast.literal_eval(retrieved_contexts)
```

测试：

> 在 Python 中，await 只能出现在 async def 定义的异步函数内部，使用的时候封装为一个异步函数。
>

```python
# 6个核心指标（从 collections 导入）
from ragas.metrics.collections import (
    Faithfulness,  # 忠实度
    AnswerRelevancy,  # 回答相关性
    ContextPrecision,  # 上下文精度
    ContextEntityRecall,  # 上下文实体召回
    NoiseSensitivity,  # 噪声敏感度
    ContextRecall  # 上下文召回
)

print(f"========开始评估：input:{user_input}===========")
# ---- 检索阶段指标 ----
cp = ContextPrecision(llm=evaluator_llm)

cp_result = await cp.ascore(
    user_input=user_input,
    reference=reference,
    retrieved_contexts=retrieved_contexts,
)
print(f"运行完成context precision评估,score: {cp_result},进度1/6\n")

cr = ContextRecall(llm=evaluator_llm)
cr_result = await cr.ascore(
    user_input=user_input,
    reference=reference,
    retrieved_contexts=retrieved_contexts,
)
print(f"运行完成context recall评估,score: {cr_result},进度2/6\n")

cer = ContextEntityRecall(llm=evaluator_llm)
cer_result = await cer.ascore(
    reference=reference,
    retrieved_contexts=retrieved_contexts,
)
print(f"运行完成ContextEntityRecall评估,score: {cer_result},进度3/6\n")
# ---- 生成阶段指标 ----
faith = Faithfulness(llm=evaluator_llm)

faith_result = await faith.ascore(
    user_input=user_input,
    response=response,
    retrieved_contexts=retrieved_contexts,
)
print(f"运行完成Faithfulness评估,score: {faith_result},进度4/6\n")

ar = AnswerRelevancy(llm=evaluator_llm, embeddings=evaluator_embeddings)
ar_result = await ar.ascore(
    user_input=user_input,
    response=response,
)
print(f"运行完成AnswerRelevancy评估,score: {ar_result},进度5/6\n")

ns = NoiseSensitivity(llm=evaluator_llm)
ns_result = await ns.ascore(
    user_input=user_input,
    response=response,
    reference=reference,
    retrieved_contexts=retrieved_contexts,
)
print(f"运行完成NoiseSensitivity评估,score: {ns_result},进度6/6\n")
print(f"========================评估完成==========================")
```

### 定义experiment
新版的RAGAS中，把评估任务称为experiment，也就是实验。之所以叫这个名字，是因为所有的实验数据都是留痕的，可追溯的，不像之前老版本中是黑盒打分。

创建实验其实就是定义函数，但要用@experiment装饰器。

```python
# 新 API：@experiment 装饰器 + 标准指标
from ragas import experiment
from pydantic import BaseModel


# 定义实验结果模型
class EvalResult(BaseModel):
    context_recall: float
    faithfulness: float


# 定义实验：逐行评分
@experiment(experiment_model=EvalResult)
async def run_rag_eval(row):
    # 先把评估的数据准备好
    user_input = row.get("user_input")
    reference = row.get("reference")
    retrieved_contexts = row.get("retrieved_contexts")
    response = row.get("response")

    print(f"开始评估：input:{user_input} , 进度0/2")
    # ---- 检索阶段指标 ----
    cr = ContextRecall(llm=evaluator_llm)
    cr_result = await cr.ascore(
        user_input=user_input,
        reference=reference,
        retrieved_contexts=retrieved_contexts,
    )
    print(f"完成cr_result评估 , 进度1/2")
    # ---- 生产阶段指标 ----
    faith = Faithfulness(llm=evaluator_llm)
    faith_result = await faith.ascore(
        user_input=user_input,
        response=response,
        retrieved_contexts=retrieved_contexts,
    )
    print(f"完成faith_result评估 , 进度2/2")
    # 封装所有结果
    return EvalResult(
        context_recall=cr_result.value,
        faithfulness=faith_result.value
    )


print("实验函数已定义")
print(f"结果模型字段: {list(EvalResult.model_fields.keys())}")
```

### 批量评估
接下来就是跑评估实验了，这个过程非常长，需要耐心等待。

为了节省时间，我们从dataset中随机抽取 10%作为测试的数据集

```python
# 为了节省时间，我们从dataset中随机抽取 10%作为测试的数据集
train_dataset, test_dataset = dataset.train_test_split(test_size=0.1)
print(test_dataset) # Dataset(name=rag_eval_test,  len=4)
```

开始测试：

```python
# 把数据集的评估name设定与原来一致，这样就会保存到dataset一样的目录，方便查看
tds = Dataset.from_pandas(test_dataset.to_pandas(), name="rag_eval", backend="local/csv", root_dir="./experiments")

# 开始评估
results = await run_rag_eval.arun(tds, name="rag_baseline")

# 查看结果
print("=" * 60)
print("RAGAS 评估报告")
print("=" * 60)
print()

print(f"\n实验记录已保存至: ./experiments/rag_baseline/")
```

### 评估结果解读
| 指标 | 发现问题 | 优化方向 |
| --- | --- | --- |
| Faithfulness 低 | 模型在编造，没有基于文档回答 | 加强系统提示、降低 temperature |
| Context Precision 低 | 检索返回了无关内容（噪声多） | 优化 chunk_size、加入 Query Rewriting |
| Context Recall 低 | 需要的信息没有检索到（缺信息） | 调整 embedding 模型、增大 k、加入 Hybrid Search |
| Context Entities Recall 低 | 关键实体（人名、术语、数字）未覆盖 | 加入 BM25 关键词检索、优化 chunk 策略 |
| Answer Relevancy 低 | 模型回答跑题了 | 优化 Prompt、限制回答范围 |
| Noise Sensitivity 高 | 噪声文档导致回答出错 | 加入 Cross-Encoder 重排序、提升检索精度 |


> 注意：Noise Sensitivity 是唯一"越低越好"的指标。0表示完美（没有因噪声产生错误），接近1表示几乎所有回答都有错误。
>

