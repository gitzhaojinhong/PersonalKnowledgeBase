# stream_events事件流

* `version="v2"` 是 `agent.stream()` 基础流式接口的格式版本，是 LangGraph 原生流式能力的直接透传，返回底层原始事件分片，更偏底层。
* `version="v3"` 是 `agent.stream_events()` 事件流接口的版本，是在底层流式能力之上，专门面向 Agent 场景做的一层强类型封装，提供了各类标准化投影（messages、tool_calls、subgraphs 等），更偏应用层。

简单理解：v3 是 v2 基础流的上层封装，做了标准化、易用性增强，但同时也屏蔽了部分底层细节。

## stream_events(..., version="v3")

特点：

1. 返回结构化的 run 流对象，提供各类**投影 (projection)**，可以独立消费不同数据流；
2. 不再需要手动解析原始流式元组；
3. 同步：`stream_events`；异步：`astream_events`。

```powershell
from langchain.agents import create_agent

def get_weather(city: str) -> str:
    """Get weather for a city."""
    return f"It's always sunny in {city}!"

agent = create_agent(
    model="gpt-5-nano",
    tools=[get_weather],
)

stream = agent.stream_events(
    {"messages": [{"role": "user", "content": "What is the weather in SF?"}]},
    version="v3"
)

# 流式打印LLM输出文本
for message in stream.messages:
    for delta in message.text:
        print(delta, end="", flush=True)

final_state = stream.output # 获取最终完整状态
```

## 全部投影对照表

| 投影对象 | 作用说明 |
| --- | --- |
| `for event in stream` | 原始协议事件，完整信封，可以访问全部通道 |
| `stream.messages` | 模型消息流，每一次 LLM 调用对应一个对象 |
| `message.text` | 消息文本增量、完整最终文本 |
| `message.reasoning` | 模型思考过程增量（仅支持输出思考块的模型） |
| `message.tool_calls` | 模型生成工具调用时的参数分片 + 完整工具调用对象 |
| `message.output` | LLM 调用结束后完整的 AI Message 对象 |
| `stream.values` | Agent Graph 每一步的状态快照 |
| `stream.output` | Agent 执行结束，最终完整状态 |
| `stream.subgraphs` | 所有嵌套子图运行（子 Agent、普通子图） |
| `stream.extensions` | 自定义 transformer 输出的自定义投影 |
| `stream.tool_calls` | 工具执行完整生命周期：入参、输出分片、最终输出、异常 |

## 使用实例

### 获取每轮 LLM 调用输出

`stream.messages`专门用来拿到每一次大模型调用输出内容。

```powershell
stream = agent.stream_events(input, version="v3")
for message in stream.messages:
    print(f"[{message.node}] ", end="")
    for delta in message.text:
        print(delta, end="", flush=True)

    full_message = message.output
    usage = full_message.usage_metadata # python中token消耗在这里读取
    if usage:
        print(usage)
```

### 流式输出模型思考过程

只有模型支持输出 reasoning 思考块才会有数据，格式和普通文本 delta 完全一致。

```powershell
stream = agent.stream_events(input, version="v3")
for message in stream.messages:
    # 打印思考片段
    for delta in message.reasoning:
        print(f"[thinking] {delta}", end="", flush=True)
    # 打印回答文本片段
    for delta in message.text:
        print(delta, end="", flush=True)
```

### 工具调用流

1. `message.tool_calls`：模型正在生成工具调用时，工具参数分片；
2. `stream.tool_calls`：工具已经开始执行后，工具运行生命周期（入参、输出分片、报错）。

```powershell
stream = agent.stream_events(input, version="v3")

for message in stream.messages:
    # 模型生成工具调用的分片
    for chunk in message.tool_calls:
        print(f"tool call chunk: {chunk}")
    # 获取完整解析后的工具调用
    finalized = message.tool_calls.get()
    if finalized:
        print(f"finalized tool calls: {finalized}")

# ========== 此处需消费新的stream才能有输出 =============
# 工具执行生命周期流
for call in stream.tool_calls:
    print(f"{call.tool_name}({call.input})")
    for delta in call.output_deltas:
        print(delta, end="", flush=True)
    print(call.output, call.error)

```

### 子 Agent 流式

当主 Agent 调用另一个使用`create_agent`创建、带`name`命名的子 Agent：

* `stream.subagents`：只捕获命名`create_agent`子 Agent，直接拿到子 agent 自己的`.messages`/`.tool_calls`等；
* `stream.subgraphs`：捕获**所有嵌套子图**（普通 StateGraph 子图也在这里）。

```powershell
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model

def get_weather(city: str) -> str:
    """Get weather for a given city."""
    return f"It's always sunny in {city}!"

# 子agent，必须设置name
weather_agent = create_agent(
    model=init_chat_model("openai:gpt-5.5"),
    tools=[get_weather],
    name="weather_agent",
)

def call_weather(query: str) -> str:
    """Query the weather agent."""
    result = weather_agent.invoke({"messages": [{"role": "user", "content": query}]})
    return result["messages"][-1].text

# 父supervisor agent
supervisor = create_agent(
    model=init_chat_model("openai:gpt-5.5"),
    tools=[call_weather],
    name="supervisor",
)

stream = supervisor.stream_events(
    {"messages": [{"role": "user", "content": "What's the weather in Boston?"}]},
    version="v3",
)

# 遍历子agent流
for subagent in stream.subagents:
    print(f"{subagent.name}: ", end="")
    for message in subagent.messages:
        for token in message.text:
            print(token, end="", flush=True)
    print()

```

> 普通`StateGraph`子图：在`.compile(name="xxx")`设置名字，会出现在`stream.subgraphs`；
>
> * `subagents`：只看命名 create_agent；
> * `subgraphs`：全部嵌套子图，根据 UI 业务场景二选一。

### 状态快照和最终输出

* `stream.values`：迭代每一步 Graph 状态快照；
* `stream.output`：阻塞拿到执行完成后的最终完整状态。

```powershell
stream = agent.stream_events(input, version="v3")
for snapshot in stream.values:
    print(snapshot)

final_state = stream.output
```

### 同时消费多个流投影

```python
# 异步场景：`astream_events` + `asyncio.gather`
import asyncio

stream = await agent.astream_events(input, version="v3")

async def consume_messages():
    async for message in stream.messages:
        print(await message.text)

async def consume_tool_calls():
    async for call in stream.tool_calls:
        print(call.tool_name, call.input)

await asyncio.gather(consume_messages(), consume_tool_calls())

# =======================================================================
# 同步场景：`stream.interleave()`交错输出多个流
stream = agent.stream_events(input, version="v3")
for name, item in stream.interleave("messages", "tool_calls", "values"):
    if name == "messages":
        print(item.text)
    elif name == "tool_calls":
        print(item.tool_name, item.input)
    elif name == "values":
        print(item)
```

### 自定义流 transformers

在 LangChain Agent 的流式输出里，添加“自定义更新/自定义投影”。

把 stream_events 输出的原始事件流想象成一条水管，transformer 就是装在水管上的“过滤器/分拣器”，它把原始事件加工成要关心的数据，比如“工具调用进度”“检索进度”“领域事件”等，然后放到 stream.extensions\[...] 这个自定义出口里。

**前提：自定义Transformer示例，实现 StreamTransformer 接口**

```python
class ToolActivityTransformer(StreamTransformer):
    """将 LangGraph 的 ``tools`` 协议事件投影为「工具活动」自定义频道。

    该转换器监听工具生命周期事件（``tool-started`` / ``tool-finished`` /
    ``tool-error``），把每次工具调用的名称、状态和 ``tool_call_id`` 推送到名为
    ``tool_activity`` 的命名频道。消费端可通过
    ``stream.extensions["tool_activity"]`` 读取这些活动记录。

    由于 ``tool-finished`` / ``tool-error`` 事件本身不携带工具名，转换器会在
    ``tool-started`` 时用 ``tool_call_id -> tool_name`` 做一次缓存，供后续事件
    反查，保证每条活动记录都能带上工具名。
    """

    # 声明本转换器只关心 "tools" 模式的事件；
    # 运行时据此决定是否把 tools 事件喂给 process()。
    required_stream_modes = ("tools",)

    # 频道名在此集中定义，避免 init() 与消费端硬编码不一致。
    CHANNEL_NAME = "tool_activity"

    def __init__(self, scope: tuple[str, ...] = ()) -> None:
        """初始化转换器。

        Args:
            scope: mini-mux 作用域元组。根图为 ``()``，子图为非空元组。
                由框架以 ``factory(scope)`` 的形式传入，用于隔离不同子图。
        """
        super().__init__(scope)

        # 命名频道：数据会自动转发到 stream.extensions[CHANNEL_NAME]，
        # 客户端可通过 custom:<name> 订阅。
        self.activity_channel = StreamChannel(self.CHANNEL_NAME)

        # tool_call_id -> tool_name 的临时缓存。
        # 因为 tool-finished / tool-error 事件不含工具名，需要靠它反查。
        self._pending_names: dict[str, str] = {}

    def init(self) -> dict[str, StreamChannel]:
        """向框架注册本转换器对外暴露的投影频道。

        Returns:
            投影字典。键即消费端 ``stream.extensions`` 上使用的键，
            值必须是 ``StreamChannel`` 实例。
        """
        return {self.CHANNEL_NAME: self.activity_channel}

    def process(self, event: ProtocolEvent) -> bool:
        """处理单个协议事件。

        Args:
            event: 流经的协议事件。结构形如
                ``{"method": "tools", "params": {"data": {...}}}``。

        Returns:
            ``True`` 表示放行事件，继续留在主事件流中供其他消费者使用；
            ``False`` 表示拦截。本转换器只做旁路投影，始终返回 ``True``。
        """
        # 只处理 tools 事件，其余直接放行，避免无谓解析。
        if event["method"] != "tools":
            return True

        # 真实字段都嵌套在 params.data 下。
        data = event.get("params", {}).get("data", {}) or {}
        event_type = data.get("event")
        tool_call_id = data.get("tool_call_id")
        tool_name = data.get("tool_name")

        if event_type == "tool-started":
            # 首次出现该 tool_call_id，缓存工具名供后续事件反查。
            if tool_call_id and tool_name:
                self._pending_names[tool_call_id] = tool_name
            self._emit(tool_name, "started", tool_call_id)

        elif event_type == "tool-finished":
            # 完成后从缓存取出并清除，防止内存无限增长。
            self._emit(self._resolve_name(tool_name, tool_call_id), "completed", tool_call_id)

        elif event_type in ("tool-error", "tool-failed"):
            # 失败事件同样需要反查工具名，并从缓存中清理。
            self._emit(self._resolve_name(tool_name, tool_call_id), "failed", tool_call_id)

        # 始终放行，主事件流（如 stream.messages）不受影响。
        return True

    # ------------------------------------------------------------------
    # 内部辅助方法
    # ------------------------------------------------------------------

    def _resolve_name(self, tool_name: str | None, tool_call_id: str | None) -> str | None:
        """优先使用事件自带的工具名；没有则从缓存按 tool_call_id 反查并弹出。

        弹出（pop）而非 get，是为了在工具结束时清理缓存，避免泄漏。
        """
        if tool_name:
            return tool_name
        if tool_call_id:
            return self._pending_names.pop(tool_call_id, None)
        return None

    def _emit(self, name: str | None, status: str, tool_call_id: str | None) -> None:
        """把一条工具活动推送到 ``tool_activity`` 频道。

        统一构造负载结构，保证消费端拿到的字段形态一致。
        """
        self.activity_channel.push({
            "name": name,
            "status": status,
            "tool_call_id": tool_call_id,
        })
```

**方式A：单次调用注入transformers**

```python
stream = agent.stream_events(
    input,
    version="v3",
    transformers=[ToolActivityTransformer],
)

for activity in stream.extensions["tool_activity"]:
    print(activity)
```

**方式 B：中间件全局注册版本**

```python
from langchain.agents import create_agent
from langchain.agents.middleware import AgentMiddleware


class ToolActivityMiddleware(AgentMiddleware):
    transformers = (ToolActivityTransformer,)


agent = create_agent(
    model="gpt-5-nano",
    tools=[get_weather],
    middleware=[ToolActivityMiddleware()],
)
#  调用 stream_events，必须指定 version="v3"
stream = agent.stream_events(
    {"messages": [{"role": "user", "content": "查一下郑州天气"}]},
    version="v3",
)

#  从 stream.extensions 中消费自定义投影
#    频道名必须与 Transformer 内部 StreamChannel 的名称一致
for activity in stream.extensions["tool_activity"]:
    print(activity)
```

**官方实现参考示例：**

```python
from langchain.agents import create_agent
from langchain.agents.middleware import PIIMiddleware

agent = create_agent(
    model="gpt-5-nano",
    tools=[],
    middleware=[
        PIIMiddleware("email", strategy="redact", apply_to_output=True),
    ],
)
```
