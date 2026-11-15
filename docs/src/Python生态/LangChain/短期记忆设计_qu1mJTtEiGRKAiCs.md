# 短期记忆设计

## 概念

短期记忆就是临时记忆，断电就没了；长期记忆就是永久记忆，持久保存。切勿被名字误导！！！

真实含义简单概括：

* 短期记忆：当前任务或会话的上下文（Working Memory 或 Session Memory）
* 长期记忆：跨任务或会话的经验与知识（Persistent Memory）

LangChain提供了自动化的记忆管理方案：

* 首先，LangChain把会话记忆（也就是Messages列表）记录为AgentState的一部分
* AgentState通过Checkpointer对象来保存，每一次与AI的交互都会生成一个快照，记录为一个StateSnapshot，把同一会话的所有StateSnapshot组合在一起，就是完整的会话历史了。
* 为了区分不同的会话记忆，不同会话需要设定各自的thread_id，相同会话则使用相同thread_id
* 向Agent发起会话时必须指定自己的thread_id以唤起对应的会话记忆

## 基础用法

### 开发环境 InMemorySaver

```python
from langchain.agents import create_agent
from langgraph.checkpoint.memory import InMemorySaver  


def get_user_info() -> str:
    """Look up information about the current user."""
    return "No user profile on file."


agent = create_agent(
    model="openai:gpt-5.5",
    tools=[get_user_info],
    checkpointer=InMemorySaver(),
)

thread_config = {"configurable": {"thread_id": "1"}}
response = agent.invoke(
    {"messages": [{"role": "user", "content": "Hi! My name is Bob."}]},
    config=thread_config,
)["messages"][-1].content

print(response)  # "Hi Bob! Nice to see you here. How are you doing?"

response = agent.invoke(
    {"messages": [{"role": "user", "content": "What's my name?"}]},
    config=thread_config,
)["messages"][-1].content

print(response)  # "You are Bob!"
```

### 生产环境 数据库

```powershell
uv add langgraph-checkpoint-postgres
```

```python
from langchain.agents import create_agent
from langgraph.checkpoint.postgres import PostgresSaver  

def get_user_info() -> str:
    """Look up information about the current user."""
    return "No user profile on file."

DB_URI = "postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
with PostgresSaver.from_conn_string(DB_URI) as checkpointer:
    checkpointer.setup() # auto create tables in PostgreSQL
    agent = create_agent(
        "gpt-5.5",
        tools=[get_user_info],
        checkpointer=checkpointer,
    )
```

## 自定义memory（记忆）

默认 Agent 使用 `AgentState` 管理短期记忆，核心是 `messages` 字段存储对话历史。可以扩展 `AgentState` 添加业务自定义字段。

自定义状态字段会和 `messages` 一起被 checkpointer 持久化，全程跟随当前线程。

```powershell
from langchain.agents import create_agent, AgentState
from langgraph.checkpoint.memory import InMemorySaver


class CustomAgentState(AgentState):
    user_id: str
    preferences: dict

agent = create_agent(
    "gpt-5.5",
    tools=[get_user_info],
    state_schema=CustomAgentState,
    checkpointer=InMemorySaver(),
)

# 调用时传入自定义状态字段
result = agent.invoke(
    {
        "messages": [{"role": "user", "content": "Hello"}],
        "user_id": "user_123",
        "preferences": {"theme": "dark"}
    },
    {"configurable": {"thread_id": "1"}})
```

## 记忆上下文处理策略

开启短期记忆后，长对话容易超出上下文窗口，官方提供三种主流解决方案：

1. 裁剪消息：保留最新 N 条消息，丢弃早期内容
2. 删除消息：永久移除指定或全部消息
3. 总结消息：用模型压缩早期对话为摘要，兼顾信息留存与 Token 效率

### 修剪消息

按规则保留最新消息，最常用的是按 Token 数裁剪，确保不超出模型上下文窗口。

* 实现方式：使用 `@before_model` 中间件，在模型调用前处理消息列表。

```powershell
from langchain.messages import RemoveMessage
from langgraph.graph.message import REMOVE_ALL_MESSAGES
from langgraph.checkpoint.memory import InMemorySaver
from langchain.agents import create_agent, AgentState
from langchain.agents.middleware import before_model
from langgraph.runtime import Runtime
from langchain_core.runnables import RunnableConfig
from typing import Any

@before_model
def trim_messages(state: AgentState, runtime: Runtime) -> dict[str, Any] | None:
    """仅保留最近几条消息，适配上下文窗口。"""
    messages = state["messages"]
    if len(messages) <= 3:
        return None  # 消息量少，无需修改

    first_msg = messages[0]  # 保留第一条（通常是系统提示）
    # 保留最后 3-4 条消息，保证对话连贯性
    recent_messages = messages[-3:] if len(messages) % 2 == 0 else messages[-4:]
    new_messages = [first_msg] + recent_messages

    return {
        "messages": [
            RemoveMessage(id=REMOVE_ALL_MESSAGES),  # 先清空所有消息
            *new_messages  # 再写入保留的消息
        ]
    }

agent = create_agent(
    model,
    tools=tools,
    middleware=[trim_messages],
    checkpointer=InMemorySaver(),
)

# 测试多轮对话
config: RunnableConfig = {"configurable": {"thread_id": "1"}}
agent.invoke({"messages": "hi, my name is bob"}, config)
agent.invoke({"messages": "write a short poem about cats"}, config)
agent.invoke({"messages": "now do the same but for dogs"}, config)
final_response = agent.invoke({"messages": "what's my name?"}, config)
final_response["messages"][-1].pretty_print()

```

### 删除消息

永久从图状态中移除消息，适合清理特定内容或清空整个对话历史。

* 使用 `RemoveMessage` 对象执行删除，要求状态的 `messages` 字段使用 `add_messages` 归约器（默认 `AgentState` 已内置支持）。

删除指定消息:

```powershell
from langchain.messages import RemoveMessage

def delete_messages(state):
    messages = state["messages"]
    if len(messages) > 5:
        # 删除最早的两条消息
        return {"messages": [RemoveMessage(id=m.id) for m in messages[:2]]}
```

删除全部消息:

```powershell
from langgraph.graph.message import REMOVE_ALL_MESSAGES

def delete_messages(state):
    return {"messages": [RemoveMessage(id=REMOVE_ALL_MESSAGES)]}
```

结合 after_model 中间件示例，模型回复后清理旧消息:

```powershell
from langchain.messages import RemoveMessage
from langchain.agents import create_agent, AgentState
from langchain.agents.middleware import after_model
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.runtime import Runtime
from langchain_core.runnables import RunnableConfig

@after_model
def delete_old_messages(state: AgentState, runtime: Runtime) -> dict | None:
    """删除最早的两条消息，保持对话简洁。"""
    messages = state["messages"]
    if len(messages) > 5:
        return {"messages": [RemoveMessage(id=m.id) for m in messages[:2]]}
    return None

agent = create_agent(
    "gpt-5-nano",
    tools=[],
    system_prompt="Please be concise and to the point.",
    middleware=[delete_old_messages],
    checkpointer=InMemorySaver(),
)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}
# 多轮调用后，历史消息会被逐步清理
for event in agent.stream(
    {"messages": [{"role": "user", "content": "hi! I'm bob"}]},
    config,
    stream_mode="values",
):
    print([(message.type, message.content) for message in event["messages"]])
```

### 总结消息

裁剪 / 删除会直接丢失早期信息，总结模式则用模型将早期对话压缩为摘要，在节省 Token 的同时保留关键信息。

* 官方提供SummarizationMiddleware
* 工作流程：消息总 Token 达到阈值 → 用总结模型压缩早期对话 → 保留摘要 + 最新 N 条原始消息 → 传给主模型推理。

```powershell
from langchain.agents import create_agent
from langchain.agents.middleware import SummarizationMiddleware
from langgraph.checkpoint.memory import InMemorySaver
from langchain_core.runnables import RunnableConfig

checkpointer = InMemorySaver()
agent = create_agent(
    model="gpt-4o",
    tools=[],
    middleware=[
        SummarizationMiddleware(
            model="gpt-4o-mini",  # 用于总结的模型，通常用低成本小模型
            max_tokens_before_summary=4000,  # 达到 4000 token 时触发总结
            messages_to_keep=20,  # 总结后保留最后 20 条原始消息
        )
    ],
    checkpointer=checkpointer,
)

config: RunnableConfig = {"configurable": {"thread_id": "1"}}
agent.invoke({"messages": "hi, my name is bob"}, config)
agent.invoke({"messages": "write a short poem about cats"}, config)
agent.invoke({"messages": "now do the same but for dogs"}, config)
final_response = agent.invoke({"messages": "what's my name?"}, config)

```

## 访问短期记忆

AgentState 是访问线程内短期记忆的核心入口；messages 是其预置字段。使用 create_agent 时，自定义 State 必须继承 AgentState。

> 直接构建原始 StateGraph 时则无需继承AgentState。

### Tools

详细解释与示例：参考Tools中的 `Access context（访问运行时上下文）` 章节

工具中通过 `ToolRuntime` 参数访问状态，该参数对 LLM 不可见，不会出现在工具 Schema 中

读取：

```powershell
from langchain.agents import create_agent, AgentState
from langchain.tools import tool, ToolRuntime

class CustomState(AgentState):
    user_id: str

@tool
def get_user_info(runtime: ToolRuntime) -> str:
    """查询用户信息。"""
    user_id = runtime.state["user_id"]
    return "User is John Smith" if user_id == "user_123" else "Unknown user"

agent = create_agent(
    model="gpt-5-nano",
    tools=[get_user_info],
    state_schema=CustomState,
)

result = agent.invoke({
    "messages": "look up user information",
    "user_id": "user_123"
})

```

写入/修改

```powershell
from langchain.tools import tool, ToolRuntime
from langchain.messages import ToolMessage
from langchain.agents import create_agent, AgentState
from langgraph.types import Command
from pydantic import BaseModel

class CustomState(AgentState):
    user_name: str

class CustomContext(BaseModel):
    user_id: str

@tool
def update_user_info(runtime: ToolRuntime[CustomContext, CustomState]) -> Command:
    """查询并更新用户信息。"""
    user_id = runtime.context.user_id
    name = "John Smith" if user_id == "user_123" else "Unknown user"
    return Command(update={
        "user_name": name,
        "messages": [
            ToolMessage(
                "Successfully looked up user information",
                tool_call_id=runtime.tool_call_id
            )
        ]
    })

@tool
def greet(runtime: ToolRuntime[CustomContext, CustomState]) -> str:
    """获取用户信息后向用户问候。"""
    user_name = runtime.state.get("user_name", None)
    if user_name is None:
        return Command(update={
                "messages": [
                    ToolMessage(
                        "Please call the 'update_user_info' tool it will get and update the user's name.",
                        tool_call_id=runtime.tool_call_id
                    )
                ]
        })
    return f"Hello {user_name}!"

agent = create_agent(
    model="gpt-5-nano",
    tools=[update_user_info, greet],
    state_schema=CustomState,
    context_schema=CustomContext,
)

agent.invoke(
    {"messages": [{"role": "user", "content": "greet the user"}]},
    context=CustomContext(user_id="user_123"),
)

```

### Prompt

提示词中访问记忆，通过 `@dynamic_prompt` 中间件，基于状态 / 上下文动态生成系统提示词：

```powershell
from langchain.agents import create_agent
from typing import TypedDict
from langchain.agents.middleware import dynamic_prompt, ModelRequest

class CustomContext(TypedDict):
    user_name: str

def get_weather(city: str) -> str:
    """查询城市天气。"""
    return f"The weather in {city} is always sunny!"

@dynamic_prompt
def dynamic_system_prompt(request: ModelRequest) -> str:
    user_name = request.runtime.context["user_name"]
    return f"You are a helpful assistant. Address the user as {user_name}."

agent = create_agent(
    model="gpt-5-nano",
    tools=[get_weather],
    middleware=[dynamic_system_prompt],
    context_schema=CustomContext,
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "What is the weather in SF?"}]},
    context=CustomContext(user_name="John Smith"),
)
```

### Before model

`@before_model` 装饰的中间件会在模型调用之前执行，适合在消息送入模型前做预处理（如裁剪、过滤、注入信息）。

执行链路：`__start__` → `before_model` → `model` → `tools` → `__end__`

完整示例见前文「裁剪消息」章节，核心是读取 `state` 并返回更新后的状态字典（返回None表示不更新）。

### After model

`@after_model` 装饰的中间件会在模型生成回复之后、工具执行之前执行，适合校验输出、清理敏感内容、格式化回复。

执行链路：`__start__` → `model` → `after_model` → `tools` → `__end__`

完整示例见前文「删除消息」章节，核心是读取 `state` 并返回更新后的状态字典（返回None表示不更新）。
