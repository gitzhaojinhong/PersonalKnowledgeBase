# Messages 消息

## Messages核心

每一个 Message 对象包含三个核心部分：

* Role（角色）：标识消息类型，如 `system`、`user`、`assistant` 等
* Content（内容）：消息的实际载荷，支持文本、图像、音频、文档等多种形式
* Metadata（元数据）：可选字段，包含响应信息、消息 ID、Token 用量等附加数据

## 基础用法

### Text prompts

文本提示：

```python
response = model.invoke("Write a haiku about spring")
```

### Message prompts

消息提示 (几乎所有场景的推荐使用方式)：

```python
from langchain.messages import SystemMessage, HumanMessage, AIMessage

messages = [
    SystemMessage("You are a poetry expert"),
    HumanMessage("Write a haiku about spring"),
    AIMessage("Cherry blossoms bloom...")
]
response = model.invoke(messages)
```

> 适用场景：
>
> * 管理多轮对话历史
> * 传入多模态内容（图像、音频、文件）
> * 需要设置系统指令约束模型行为

### Dictionary format

OpenAI 原生的 字典格式：

```python
messages = [
    {"role": "system", "content": "You are a poetry expert"},
    {"role": "user", "content": "Write a haiku about spring"},
    {"role": "assistant", "content": "Cherry blossoms bloom..."}
]
response = model.invoke(messages)
```

### 友好打印

```python
# 通过遍历Messages数组，更友好的打印结果：
for message in response['messages']:
    message.pretty_print()
```

## 消息类型

### System message  系统消息

系统消息用于预设模型的行为模式，可以设定语气、角色、回复规则等，是对话的初始指令。

```python
from langchain.messages import SystemMessage, HumanMessage

system_msg = SystemMessage("""
You are a senior Python developer with expertise in web frameworks.
Always provide code examples and explain your reasoning.
Be concise but thorough in your explanations.
""")

messages = [
    system_msg,
    HumanMessage("How do I create a REST API?")
]
response = model.invoke(messages)
```

### Human message  用户消息

代表用户的输入与交互，支持文本、图像、音频、文件等多模态内容。

```python
# 方式一
response = model.invoke([
  HumanMessage("What is machine learning?")
])

# 方式二
# 字符串快捷写法（模型会自动转换为 HumanMessage）
response = model.invoke("What is machine learning?")
```

### AI message  AI消息

AI 消息是模型调用后的返回结果，包含文本内容、工具调用、提供商专属元数据等信息。

```python
response = model.invoke("Explain AI")
print(type(response))  # <class 'langchain.messages.AIMessage'>
```

核心属性：

* text： 消息的文本内容
* content： 原始内容，支持字符串或内容块列表
* content_blocks： 标准化解析后的内容块
* tool_calls： 模型发起的工具调用列表，无工具调用时为空
* id： 消息唯一标识
* usage_metadata： Token 用量元数据
* response_metadata： 模型响应的原始元数据

***

1. **Tool calls（工具调用）**

当模型绑定工具后，工具调用信息会包含在返回的 `AIMessage` 中：

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-5-nano")

def get_weather(location: str) -> str:
    """Get the weather at a location."""
    ...

model_with_tools = model.bind_tools([get_weather])
response = model_with_tools.invoke("What's the weather in Paris?")

# 遍历工具调用信息
for tool_call in response.tool_calls:
    print(f"Tool: {tool_call['name']}")
    print(f"Args: {tool_call['args']}")
    print(f"ID: {tool_call['id']}")
```

> 除了工具调用，推理过程、引用来源等结构化数据也会出现在消息内容中。

2. **Token usage（Token 用量）**

`usage_metadata` 字段存储 Token 计数与用量明细：

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-5-nano")

response = model.invoke("Hello!")
response.usage_metadata
```

````

返回示例：

```python
{
 'input_tokens': 8,
 'output_tokens': 304,
 'total_tokens': 312,
 'input_token_details': {'audio': 0, 'cache_read': 0},
 'output_token_details': {'audio': 0, 'reasoning': 256}
}
````

3. **Streaming and chunks（流式与分片）**

流式调用时，会逐块返回 `AIMessageChunk` 对象，可以通过累加合并为完整消息：

```python
chunks = []
full_message = None
for chunk in model.stream("Hi"):
    chunks.append(chunk)
    print(chunk.text)
    # 累加分片得到完整消息
    full_message = chunk if full_message is None else full_message + chunk
```

### Tool message 工具消息

工具消息用于将工具的执行结果传回模型，对应 AI 消息中的每一次工具调用。

```python
from langchain.messages import AIMessage
from langchain.messages import ToolMessage

# 模拟模型返回的工具调用消息
ai_message = AIMessage(
    content=[],
    tool_calls=[{
        "name": "get_weather",
        "args": {"location": "San Francisco"},
        "id": "call_123"
    }]
)

# 执行工具后，构造工具结果消息
weather_result = "Sunny, 72°F"
tool_message = ToolMessage(
    content=weather_result,
    tool_call_id="call_123"  # 必须与对应工具调用的 ID 完全匹配
)

# 继续对话，模型会基于工具结果生成最终回复
messages = [
    HumanMessage("What's the weather in San Francisco?"),
    ai_message,  # 模型的工具调用
    tool_message,  # 工具执行结果
]
response = model.invoke(messages)

```

核心属性

* `content`（必填）：工具调用的字符串化输出，会发送给模型
* `tool_call_id`（必填）：对应工具调用的 ID，必须与 AI 消息中的调用 ID 一致
* `name`（必填）：被调用工具的名称
* `artifact`（可选）：不会发送给模型、仅用于程序侧访问的附加数据

## 消息内容

消息的 `content` 属性是发送给模型的核心载荷，类型设计宽松，支持三种格式：

```python
from langchain.messages import HumanMessage

# 1. 字符串格式（推荐）
human_message = HumanMessage("Hello, how are you?")

# 2. 提供商原生格式（以 OpenAI 为例）
human_message = HumanMessage(content=[
    {"type": "text", "text": "Hello, how are you?"},
    {"type": "image_url", "image_url": {"url": "https://example.com/image.jpg"}}
])

# 3. LangChain 标准内容块格式（推荐）
human_message = HumanMessage(content_blocks=[
    {"type": "text", "text": "Hello, how are you?"},
    {"type": "image", "url": "https://example.com/image.jpg"},
])

```

### 标准内容块

LangChain 提供了跨提供商的标准内容表示，`content_blocks` 属性会**惰性解析**原始 `content`，把不同提供商的私有格式统一成标准结构。

将原生格式转换为标准格式：

```python
# ==================================Anthropic 原生格式 → 标准格式==========================
from langchain.messages import AIMessage

message = AIMessage(
    content=[
        {"type": "thinking", "thinking": "...", "signature": "WaUjzkyp..."},
        {"type": "text", "text": "..."},
    ],
    response_metadata={"model_provider": "anthropic"}
)
message.content_blocks


# ==================================OpenAI 原生格式 → 标准格式=============================
from langchain.messages import AIMessage

message = AIMessage(
    content=[
        {
            "type": "reasoning",
            "id": "rs_abc123",
            "summary": [
                {"type": "summary_text", "text": "summary 1"},
                {"type": "summary_text", "text": "summary 2"},
            ],
        },
        {"type": "text", "text": "...", "id": "msg_abc123"},
    ],
    response_metadata={"model_provider": "openai"}
)
message.content_blocks

```

**序列化标准内容**

如果外部应用需要直接使用标准内容块格式，可以开启 v1 输出模式：

* 设置环境变量 `LC_OUTPUT_VERSION=v1`
* 或初始化模型时指定参数 `output_version="v1"`

```python
from langchain.chat_models import init_chat_model

model = init_chat_model("gpt-5-nano", output_version="v1")
```

### 多模态内容

多模态指模型可以处理文本、图像、音频、视频等不同形式的数据。LangChain 提供了跨提供商的标准多模态类型。

```python
# 1. 通过 URL 传入
message = {
    "role": "user",
    "content": [
        {"type": "text", "text": "Describe the content of this image."},
        {"type": "image", "url": "https://example.com/path/to/image.jpg"},
    ]
}

# 2. 通过 base64 编码数据传入
message = {
    "role": "user",
    "content": [
        {"type": "text", "text": "Describe the content of this image."},
        {
            "type": "image",
            "base64": "AAAAIGZ0eXBtcDQyAAAAAGlzb21tcDQyAAACAGlzb2...",
            "mime_type": "image/jpeg",
        },
    ]
}

# 3. 通过提供商托管的文件 ID 传入
message = {
    "role": "user",
    "content": [
        {"type": "text", "text": "Describe the content of this image."},
        {"type": "image", "file_id": "file-abc123"},
    ]
}

```

> 除图像外，还支持 PDF、音频、视频等输入类型。注意：并非所有模型都支持全部文件类型，具体需参考对应模型提供商的文档。

### 内容块参考

内容块以带类型的字典表示，分为以下几大类：

核心类型

1. TextContentBlock：标准文本内容-固定 `type: "text"`

* 固定 `type: "text"`
* 包含 `text`（文本内容）、`annotations`（文本注解）、`extras`（提供商扩展数据）

2. ReasoningContentBlock：模型推理过程内容 固定 `type: "reasoning"`

* 固定 `type: "reasoning"`
* 包含 `reasoning`（推理文本）、`extras`（扩展数据，如签名）

多模态类型

* ImageContentBlock：图像数据，支持 `url`、`base64`、`file_id` 三种传入方式，base64 需指定 `mime_type`
* AudioContentBlock：音频数据
* VideoContentBlock：视频数据
* FileContentBlock：通用文件（如 PDF）
* PlainTextContentBlock：纯文本文档（txt、md 等），带 `mime_type` 标识

工具调用类型

* ToolCall：完整的函数调用，包含 `name`、`args`、`id`
* ToolCallChunk：流式传输的工具调用分片
* InvalidToolCall：解析失败的工具调用，携带错误信息

服务端工具执行类型

* ServerToolCall：服务端执行的工具调用
* ServerToolCallChunk：服务端工具调用的流式分片
* ServerToolResult：服务端工具执行结果，包含状态与输出
