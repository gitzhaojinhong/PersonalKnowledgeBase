# Models

## 模型定义

```powershell
# langchain-deepseek依赖
uv add langchain-deepseek

# .env
DEEPSEEK_API_KEY=sk-xxx
```

```python
# init_chat_model
model = init_chat_model("deepseek-flash")

# Model Class
model = ChatOpenAI(model="deepseek-flash")
```

> 参数：
>
> * model 模型名称
> * api-key 密钥，一般不用填，通过`load_dotenv()`读取并注入
> * temperature 温度，值越小越稳定
> * max_tokens 限制响应中的token数
> * timeout 等待模型响应的超时时间
> * max_retries 最大重试次数，默认值为'6'
>
> 不同的模型可能有额外的参数来控制特定提供者的功能。参考官网模型集成页

***

额外了解：关闭模型思考模式（以deepseek为例，不同厂商的关闭方式不一样）：

```powershell
model = init_chat_model(
    model="deepseek-flash",
    extra_body={"thinking": {"type": "disabled"}}
)
```

## 调用

### invoke

```python
# =================================单条消息=================================
response = model.invoke("Why do parrots have colorful feathers?")
print(response)


# =================================字典消息=================================
conversation = [
    {"role": "system", "content": "You are a helpful assistant that translates English to French."},
    {"role": "user", "content": "Translate: I love programming."},
    {"role": "assistant", "content": "J'adore la programmation."},
    {"role": "user", "content": "Translate: I love building applications."}
]

response = model.invoke(conversation)
print(response)  # AIMessage("J'adore créer des applications.")


# =================================消息对象=================================
from langchain.messages import HumanMessage, AIMessage, SystemMessage

conversation = [
    SystemMessage("You are a helpful assistant that translates English to French."),
    HumanMessage("Translate: I love programming."),
    AIMessage("J'adore la programmation."),
    HumanMessage("Translate: I love building applications.")
]

response = model.invoke(conversation)
print(response)  # AIMessage("J'adore créer des applications.")
```

### stream

```python
# =================================文本流=================================
for chunk in model.stream("Why do parrots have colorful feathers?"):
    print(chunk.text, end="|", flush=True)
    
# =================================其他流式=================================
for chunk in model.stream("What color is the sky?"):
    for block in chunk.content_blocks:
        if block["type"] == "reasoning" and (reasoning := block.get("reasoning")):
            print(f"Reasoning: {reasoning}")
        elif block["type"] == "tool_call_chunk":
            print(f"Tool call chunk: {block}")
        elif block["type"] == "text":
            print(block["text"])
        else:
            ...
```

### batch

将一批独立的请求批量发送到模型上可以大幅提升性能并降低成本，因为处理过程可以并行执行：

```python
# 返回整个批次的最终输出
responses = model.batch([
    "Why do parrots have colorful feathers?",
    "How do airplanes fly?",
    "What is quantum computing?"
    ],
    config={
        'max_concurrency': 5,  # “最大并发批处理数量”
    })
for response in responses:
    print(response)
    
# 逐个接收每个输入的输出
for response in model.batch_as_completed([
    "Why do parrots have colorful feathers?",
    "How do airplanes fly?",
    "What is quantum computing?"
]):
    print(response)
```

## 绑定Tools

给模型绑定自定义工具之后，模型输出里会带上调用工具的请求（tool call）。

* 如果自己直接调用模型（不通过 LangChain Agent）：

模型只负责告诉你 “我要调用这个工具、参数是什么”，而执行工具、拿到结果、再把结果塞回模型，全部代码逻辑都要自己写。

* 如果用 LangChain Agent：

Agent 自带循环（agent loop），它自动跑这套流程：识别模型要调用工具 → 执行工具 → 把工具返回结果丢回模型 → 让模型继续思考，自动往复。

```python
from langchain.tools import tool

@tool
def get_weather(location: str) -> str:
    """Get the weather at a location."""
    return f"It's sunny in {location}."


model_with_tools = model.bind_tools([get_weather])

response = model_with_tools.invoke("What's the weather like in Boston?")
for tool_call in response.tool_calls:
    # View tool calls made by the model
    print(f"Tool: {tool_call['name']}")
    print(f"Args: {tool_call['args']}")
```

## 绑定结构化输出

```python
from pydantic import BaseModel, Field

class Movie(BaseModel):
    """A movie with details."""
    title: str = Field(description="The title of the movie")
    year: int = Field(description="The year the movie was released")
    director: str = Field(description="The director of the movie")
    rating: float = Field(description="The movie's rating out of 10")
    
# include_raw=True包含原始响应AIMessage
# 用 `with_structured_output`（强制按 Schema 输出 / Pydantic）：
#    它不会当成普通解析失败（不会抛普通解析异常），而是专门抛出 `ModelRefusalError`；
#    异常对象上的 `.raw_message` 存着这次模型返回的原始拒绝消息，你可以拿到看拒绝理由
# 注意：
# 	 当 include_raw=True 时，with_structured_output 会将错误作为 parsing_error 返回，而不是抛出异常
model_with_structure = model.with_structured_output(Movie, include_raw=True)

try:
    response = model_with_structure.invoke("Provide details about the movie Inception")
except ModelRefusalError as error:
    print(error) 
    refused = error.raw_message
    
print(response) 
# {
#     "raw": AIMessage(...),
#     "parsed": Movie(title=..., year=..., ...),
#     "parsing_error": None,
# }
```

## 高级功能

### Model能力动态获取

```python
# 示例
print(model.profile)

# 响应示例
{
  "max_input_tokens": 400000,
  "image_inputs": True,        # 是否支持图片输入（多模态）
  "reasoning_output": True,    # 是否支持思考输出（思维链/原生reasoning）
  "tool_calling": True,        # 是否原生支持工具调用
  ...
}

```

### 推理思考过程

推理/思考过程输出：

```python
# 流式
for chunk in model.stream("Why do parrots have colorful feathers?"):
    reasoning_steps = [r for r in chunk.content_blocks if r["type"] == "reasoning"]
    print(reasoning_steps if reasoning_steps else chunk.text)

# invoke
response = model.invoke("Why do parrots have colorful feathers?")
reasoning_steps = [b for b in response.content_blocks if b["type"] == "reasoning"]
print(" ".join(step["reasoning"] for step in reasoning_steps))
```

推理/思考挡位：

```python
# 部分模块profile可能不包含这些属性。可使用get获取，并提供默认值，防止报错
# 该模型支持哪些推理档位
model.profile["reasoning_effort_levels"]  # ['low', 'medium', 'high']
# 默认档位是什么
model.profile["reasoning_effort_default"] # 'high'

# 指定推理挡位
response = model.invoke(
    "Why do parrots have colorful feathers?",
    reasoning_effort="high",
)
```

### 速率限制

服务商都有调用配额（QPS），超了返回 `ModelRateLimitError`。

LangChain 提供 `InMemoryRateLimiter`，**客户端本地限流**，在发请求前排队等待，主动控制发请求频率，减少触发 429。

```python
from langchain.rate_limiters import InMemoryRateLimiter

rate_limiter = InMemoryRateLimiter(
    requests_per_second=0.1,        # 每10秒1次请求
    check_every_n_seconds=0.1,      # 每100ms检查一次能不能放行
    max_bucket_size=10,              # 令牌桶最大容量，控制突发流量
)
model = init_chat_model(
    model="deepseek-flash",
    rate_limiter=rate_limiter
)

```

### token用量

```python
# 方式一： callback handler
from langchain.chat_models import init_chat_model
from langchain_core.callbacks import UsageMetadataCallbackHandler

model_1 = init_chat_model(model="gpt-5.4-mini")
model_2 = init_chat_model(model="claude-haiku-4-5-20251001")

callback = UsageMetadataCallbackHandler()
result_1 = model_1.invoke("Hello", config={"callbacks": [callback]})
result_2 = model_2.invoke("Hello", config={"callbacks": [callback]})
print(callback.usage_metadata)


# 方式二： context metadata
from langchain.chat_models import init_chat_model
from langchain_core.callbacks import get_usage_metadata_callback

model_1 = init_chat_model(model="gpt-5.4-mini")
model_2 = init_chat_model(model="claude-haiku-4-5-20251001")

with get_usage_metadata_callback() as cb:
    model_1.invoke("Hello")
    model_2.invoke("Hello")
    print(cb.usage_metadata)

# 输出示例
{
    'gpt-5.4-mini': {
        'input_tokens': 8,
        'output_tokens': 10,
        'total_tokens': 18,
        'input_token_details': {'audio': 0, 'cache_read': 0},
        'output_token_details': {'audio': 0, 'reasoning': 0}
    },
    'claude-haiku-4-5-20251001': {
        'input_tokens': 8,
        'output_tokens': 21,
        'total_tokens': 29,
        'input_token_details': {'cache_read': 0, 'cache_creation': 0}
    }
}
```

### Model运行时配置

`config` 是 \*\*Runnable 通用运行时配置（model、chain、agent 全都能用），不是发给大模型 API 的参（不是 temperature、max_tokens 这类），而是用来控制 LangChain 框架内部的执行、追踪、回调、并发。

```python
response = model.invoke(
    "Tell me a joke",
    config={
        "run_name": "joke_generation",      # 这次运行的名字
        "tags": ["humor", "demo"],           # 标签，用于筛选分组
        "metadata": {"user_id": "123"},      # 自定义业务元数据
        "callbacks": [my_callback_handler],  # 回调处理器
    }
)
```

> run_name
>
> * 给本次运行起一个名字，LangSmith 链路追踪里展示，方便检索、区分不同业务场景。
>
> tags（标签，字符串数组）
>
> * 用于分类打标，做过滤。比如按功能、模块标记，在 LangSmith 里按标签筛选 trace。
>
> metadata（自定义元数据，字典）
>
> * 放业务信息：`user_id`、session_id、request_id、channel 等，只做埋点追踪，不会传给模型。
>
> callbacks（回调列表）
>
> * 挂载回调实例：token 用量统计、日志、告警、自定义埋点（前面 `UsageMetadataCallbackHandler` 就是放这里）。
>
> max_concurrency
>
> * 控制这个 Runnable 同时允许多少并发执行，防止瞬间爆并发。
>
> recursion_limit
>
> * 递归深度上限，**专门给 Agent**。Agent 循环调用工具容易无限递归，这个参数用来防死循环栈溢出。

### 可配置模型

\*\*核心思想：\*\*提前声明哪些参数允许在调用时覆盖，在 `config["configurable"]` 里传新值，只是参数覆盖，没有自定义判断逻辑。

使用场景：调用方自己主动指定模型；路由逻辑在外部，不是框架内部自动判断。

```python
model = init_chat_model(temperature=0)
model_with_tools = model.bind_tools([GetWeather, GetPopulation])

# 同一套绑定的工具，底层轮流切不同模型
model_with_tools.invoke(
    "what's bigger in 2024 LA or NYC",
    config={"configurable": {"model": "gpt-5.4-mini"}}
)
model_with_tools.invoke(
    "what's bigger in 2024 LA or NYC",
    config={"configurable": {"model": "claude-sonnet-4-6"}}
)
```

### 动态模型选择

\*\*核心思想：\*\*在 Agent 中间件里写 Python 判断逻辑，自动选模型，不需要调用方手动传 model 参数。

中间件拿到 `request.state["messages"]` 对话状态，自己决定用哪个模型。

```python
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from langchain.agents.middleware import wrap_model_call, ModelRequest, ModelResponse

basic_model = ChatOpenAI(model="gpt-5.4-mini")
advanced_model = ChatOpenAI(model="gpt-5.5")

@wrap_model_call
def dynamic_model_selection(request: ModelRequest, handler) -> ModelResponse:
    # 读取当前对话消息数量做判断
    message_count = len(request.state["messages"])
    if message_count > 10:
        model = advanced_model
    else:
        model = basic_model
    # 替换本次请求使用的模型
    return handler(request.override(model=model))

agent = create_agent(
    model=basic_model,  # 默认模型
    tools=[],
    middleware=[dynamic_model_selection]
)

```
