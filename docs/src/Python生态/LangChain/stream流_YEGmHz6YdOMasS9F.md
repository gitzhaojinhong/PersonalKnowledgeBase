# stream流

* `version="v2"` 是 `agent.stream()` 基础流式接口的格式版本，是 LangGraph 原生流式能力的直接透传，返回底层原始事件分片，更偏底层。
* `version="v3"` 是 `agent.stream_events()` 事件流接口的版本，是在底层流式能力之上，专门面向 Agent 场景做的一层强类型封装，提供了各类标准化投影（messages、tool_calls、subgraphs 等），更偏应用层。

简单理解：v3 是 v2 基础流的上层封装，做了标准化、易用性增强，但同时也屏蔽了部分底层细节。

***

流式输出是提升 LLM 应用响应速度、优化用户体验的核心能力 —— 在完整结果生成前逐段展示内容，抵消大模型推理延迟。

LangChain 流式系统支持四类能力：

1. **Agent 进度流**：每执行完一个 Agent 步骤推送一次状态更新
2. **LLM Token 流**：模型生成逐字 / 逐 Token 推送
3. **自定义更新流**：从工具内部发射任意自定义业务事件
4. **多模式组合**：同时开启多种流式模式

## Agent 进度流

使用 `stream_mode="updates"`，每完成一个图节点（Node）就推送一次完整状态快照，适合展示 Agent 执行进度、当前走到哪一步。

典型执行流程输出。一次「调用工具 → 返回结果 → 生成回答」的流程会产生 3 次更新：

1. `model` 节点：输出包含工具调用请求的 `AIMessage`
2. `tools` 节点：输出包含工具执行结果的 `ToolMessage`
3. `model` 节点：输出最终 AI 回答文本

```python
from langchain.agents import create_agent
from langchain_core.utils.uuid import uuid7
from langgraph.checkpoint.memory import InMemorySaver

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_weather],
    checkpointer=InMemorySaver()
)
config = {"configurable": {"thread_id": str(uuid7())}}
stream = agent.stream_events(
    {"messages": [{"role": "user", "content": "What is the weather in SF?"}]},
    config=config,
    version="v3",
)
for kind, item in stream.interleave("messages", "tool_calls"):
    if kind == "messages":
        for token in item.text:
            print(token, end="", flush=True)
    elif kind == "tool_calls":
        print(f"\nTool call: {item.tool_name}({item.input})")
        for delta in item.output_deltas:
            print(delta, end="", flush=True)
        print(f"\nTool result: {item.output}")

final_state = stream.output

# 输出示例：
# step: model
# content: [{'type': 'tool_call', 'name': 'get_weather', 'args': {'city': 'San Francisco'}, 'id': 'call_xxx'}]

# step: tools
# content: [{'type': 'text', 'text': "It's always sunny in San Francisco!"}]

# step: model
# content: [{'type': 'text', 'text': "It's always sunny in San Francisco!"}]
```

> 该模式按「步」输出，粒度较粗，没有逐字效果，适合后台监控、进度条展示。

## LLM Token 逐字流

使用 `stream_mode="messages"`，模型每生成一个 Token / 分片就推送一次，是实现打字机效果的标准模式。

```python
from langchain.agents import create_agent  

def get_weather(city: str) -> str:
    """Get weather for a given city."""  
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="gpt-5-nano",
    tools=[get_weather],
)

for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "What is the weather in SF?"}]},
    stream_mode="messages",
    version="v2",
):
    if chunk["type"] == "messages":
        token, metadata = chunk["data"]
        print(f"node: {metadata['langgraph_node']}")
        print(f"content: {token.content_blocks}")
        print("\n")

```

输出特点:

1. 每条输出附带 `metadata`，`langgraph_node` 标识当前分片来自哪个节点（`model` / `tools`）
2. 工具调用会以 `tool_call_chunk` 形式逐段生成参数
3. 节点切换时可能出现空内容分片（`content: []`），作为节点结束标记
4. 最终回答以 `text` 类型分片逐字输出

> 工具执行结果是完整返回的，不会逐字分片；只有 LLM 生成的内容（文本 + 工具调用参数）会流式输出。

## 自定义流式更新

使用 `stream_mode="custom"`，配合 `langgraph.config.get_stream_writer()` 可以在工具函数内部主动推送任意自定义数据，适合上报检索进度、处理步骤、中间产物等业务信息。

```python
from langchain.agents import create_agent
from langgraph.config import get_stream_writer   

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    writer = get_stream_writer()
    # 推送任意自定义数据
    writer(f"Looking up data for city: {city}")
    writer(f"Acquired data for city: {city}")
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="claude-sonnet-4-6",
    tools=[get_weather],
)

for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "What is the weather in SF?"}]},
    stream_mode="custom",
    version="v2",
):
    if chunk["type"] == "custom":
        print(chunk["data"])
    
# 输出示例
# Looking up data for city: 北京
# Acquired data for city: 北京
```

> `get_stream_writer()` 依赖 LangGraph 执行上下文，**脱离 LangGraph 运行时直接调用工具会报错**，因此添加了该逻辑的工具不适合独立于 Agent 之外调用。

## 多模式组合流式

```python
from langchain.agents import create_agent
from langgraph.config import get_stream_writer

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    writer = get_stream_writer()
    writer(f"Looking up data for city: {city}")
    writer(f"Acquired data for city: {city}")
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="gpt-5-nano",
    tools=[get_weather],
)

for chunk in agent.stream(
    {"messages": [{"role": "user", "content": "What is the weather in SF?"}]},
    stream_mode=["updates", "custom"],
    version="v2",
):
    print(f"stream_mode: {chunk['type']}")
    print(f"content: {chunk['data']}")
    print("\n")

# 输出示例
"""
stream_mode: updates
content: {
  'model': {
    'messages': [AIMessage(
      content='',
      tool_calls=[{'name': 'get_weather', 'args': {'city': '北京'}, 'id': 'call_00_...'}],
      finish_reason='tool_calls'
    )]
  }
}

stream_mode: custom
content: Looking up data for city: 北京

stream_mode: custom
content: Acquired data for city: 北京

stream_mode: updates
content: {
  'tools': {
    'messages': [ToolMessage(
      content="It's always sunny in 北京!",
      name='get_weather',
      tool_call_id='call_00_...'
    )]
  }
}
。。。。。。。。。。
"""
```

## 关闭流式输出

部分场景下需要关闭特定模型的 Token 流式输出，常见于多 Agent 系统中，只让主 Agent 流式输出、子 Agent 静默执行。

```python
# 方式1：模型原生参数（支持的厂商）
from langchain_openai import ChatOpenAI
model = ChatOpenAI(model="gpt-5.5", streaming=False)

# 方式2：通用基类参数（所有模型通用）
model = init_chat_model("some-model", disable_streaming=True)
```

## 官方列举的流式输出常见使用模式

1. 流式输出思考 / 推理令牌
2. 流式输出工具调用
3. 获取完整已生成消息
4. 人机回环流式交互
5. 子 Agent 流式输出
