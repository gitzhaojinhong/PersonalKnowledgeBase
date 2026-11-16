# 文档分块

## 文档切分策略

LLM的上下文窗口有限，不能将加载的整个文档扔进去，需要将文档切分成合适大小的块（chunk）。

切块考虑因素：

* 检索精准度：能精准找到与问题最相关的chunk（知识片段）
* 语义完整度：检索到的chunk必须能覆盖回答用户问题的所有信息

而这两点是矛盾的，RAG是根据整个chunk的语义生成一个向量

* chunk越大，噪音越多，语义越不精准，检索精度就低；但同时语义完整度就越高
* chunk越小，噪音越少，语义越精准，检索精度就高；但同时语义完整度就越低

总结：

* 太大: 包含过多无关信息，检索精度下降
* 太小: 丢失上下文，语义不完整

常见策略如下：

| 策略名称 | 核心原理 | ✅ 优点 | ❌ 缺点 | 适用场景 |
| --- | --- | --- | --- | --- |
| **语义切分** | 用嵌入模型计算相邻句子相似度，在低于阈值时切分，识别主题转折点。 | 最大限度保持语义连贯性，分块质量高。 | 计算成本高，依赖嵌入模型精度。 | 对语义完整性要求极高的场景，如学术论文、法律文件。 |
| **固定长度切分** | 按预设字符数或 Token 数切分 | 实现简单，速度快，可预测。 | 易在句子中间截断，严重破坏语义完整性。或者出现超大块。 | 日志、代码等结构不敏感文本；或作为性能基线。 |
| **递归切分** | 按优先级分隔符（如段落`\n\n`<br/> > 句子`。`<br/>）逐级递归分割，直至满足大小要求。 | 尊重文档结构，语义完整性好，能动态调整。 | 对无标准分隔符的文本效果下降。 | 通用首选，适用于报告、文章等大多数规范文档。 |
| **滑动窗口切分** | 固定窗口，通过高重叠率（如 20%）滑动生成连续分块，保留上下文。 | 上下文连接紧密，避免信息断裂。 | 冗余度高，存储和计算开销大。 | 可以与其它策略结合 |
| **结构感知切分** | 利用文档元数据（如 Markdown/HTML 标题）识别逻辑区块进行切分。 | 天然符合文档组织逻辑，结构清晰准确。 | 需要格式良好的文档，灵活性受限。 | Markdown、网页等有清晰原生结构的文档。 |

## LangChain API

### 依赖与核心接口

**依赖：**

```powershell
uv add langchain-text-splitters
```

**核心接口：**

核心接口TextSplitter

* split_text 方法：接收字符串，返回字符串列表
* split_documents 方法：接收 Iterable\[Document]，返回 Document 列表

### 固定长度切分

最简单的切分方式，属于固定长度切分策略的一种，常见的三个参数：

* separator : 分隔符，以此作为分隔的基本单元
* chunk_size : 每一块的理想大小
* chunk_overlap : 下一块与上一块重叠的大小，也就是滑动窗口切分

1. **按字符切分**

```python
from langchain_text_splitters import CharacterTextSplitter

# 创建字符切分器
text_splitter = CharacterTextSplitter(
    separator="",        # 分隔符，空就是任意位置都可分隔
    chunk_size=200,     # 每块最大200字符
    chunk_overlap=40,   # 块之间重叠40字符
)


# 切分文本
chunks = text_splitter.split_text(doc)

print(f"原始文本长度: {len(doc)} 字符")
print(f"切分为 {len(chunks)} 个块:\n")
for i, chunk in enumerate(chunks):
    print(f"--- Chunk {i+1} ({len(chunk)}字符) ---")
    print(chunk)
    print()
```

2. **按Token切分**

```python
from langchain_text_splitters import CharacterTextSplitter

# 创建字符切分器
# 使用from_tiktoken_encoder，LangChain自带，无需额外安装tiktoken
token_splitter = CharacterTextSplitter.from_tiktoken_encoder(
    encoding_name="cl100k_base",    # token分词器编码名
    chunk_size=200,                # 每块最多200 token
    chunk_overlap=40,              # 块之间重叠40 token
)

chunks = token_splitter.split_text(doc)

print(f"原始文本长度: {len(doc)} 字符")
print(f"切分为 {len(chunks)} 个块:\n")
for i, chunk in enumerate(chunks):
    print(f"--- Chunk {i+1} ({len(chunk)}字符) ---")
    print(chunk)
    print()
```

### 递归字符切分

参数：

* `chunk_size`：目标块大小（以字符 /token 计）。分割器努力让每个块的文本长度不超过这个值。默认值：4000
* `chunk_overlap`：块间重叠长度。为了让块与块之间保留一些共同上下文，避免在关键信息处被切断。默认值：200
* `separators`：自定义分隔符优先级列表。这是控制分割行为的核心，你可以根据文档格式（如代码、Markdown）调整顺序。默认值：`["\n\n", "\n", "。", ""]`
* `length_function`：长度计算函数。决定用何种方式测量文本长度（例如 len 计字符数，或 tiktoken 计 token 数）。默认值：`len`

> 用最高级分隔符尝试：使用当前优先级最高的分隔符（例如段落分隔符 \n\n）尝试将 T 分割成若干块。
>
> 检查与判断：
>
> * 遍历刚分割出的每一个块。
>
> * 如果这个块的长度小于等于 chunk_size，则将其保留为一个最终的文本块。
>
> * 如果这个块的长度大于 chunk_size，则不能接受它。
>
> 递归降级：对于所有大于 chunk_size 的“超大块”，放弃使用当前分隔符，改用下一个优先级更低的分隔符（例如换行符 \n）来对这个“超大块”再次进行分割。

```python
from langchain_text_splitters import RecursiveCharacterTextSplitter

# 创建递归切分器
recursive_splitter = RecursiveCharacterTextSplitter(
    chunk_size=200,
    chunk_overlap=40,
    separators=["\n\n", "\n", "。"]  # 优先级从高到低
)

# 切分文档
chunks = recursive_splitter.split_text(doc)

print(f"切分为 {len(chunks)} 个块:\n")
for i, chunk in enumerate(chunks):
    print(f"--- Chunk {i+1} ({len(chunk)}字符) ---")
    print(chunk)
    print()

```

### 结构感知切分

所谓结构感知切分，就是利用文档元数据识别文档本身的逻辑区块进行切分。

例如：markdown中的多级标题、JSON结构中的字段、Html中的标签等等。

LangChain都提供了对应不同文档类型的结构感知切分器，例如：

* MarkdownHeaderTextSplitter
* RecursiveJsonSplitter
* HTMLHeaderTextSplitter
* RecursiveCharacterTextSplitter.from_language()
* ...

此处，我们以markdown为例来演示。

```python
from langchain_text_splitters import MarkdownHeaderTextSplitter

# 准备一段较长的文本
with open('./resources/评估.md', 'r', encoding='utf-8') as f:
    doc = f.read()

# 切分依据，这里是按照三级标题
headers_to_split_on = [
    ("#", "Header 1"),
    ("##", "Header 2"),
    ("###", "Header 3"),
]

# 创建切分器
markdown_splitter = MarkdownHeaderTextSplitter(
    headers_to_split_on,
    strip_headers=False # 文本中是否携带标题
)

# 切分文档，接收str，返回值是list[Document]
chunks = markdown_splitter.split_text(doc)

for chunk in chunks:
    print(chunk.model_dump_json(indent=2))
```

> * 由于MarkdownHeaderTextSplitter并未实现TextSpliter接口，它与前面的切分器不一样。只有一个split_text方法。
> * split_text方法只接收字符串，返回值一定是list\[Document]。
