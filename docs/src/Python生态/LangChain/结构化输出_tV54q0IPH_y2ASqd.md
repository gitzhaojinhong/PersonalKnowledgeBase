# 结构化输出

## 结构化模型定义

### Pydantic模型

```powershell
from pydantic import BaseModel, Field
from typing import Annotated, Literal

class ProductReview(BaseModel):
    """Analysis of a product review."""
    rating: Annotated[int | None, Field(description="The rating of the product", ge=1, le=5)] = None
    sentiment: Annotated[Literal["positive", "negative"], Field(description="The sentiment of the review")]
    key_points: Annotated[list[str], Field(description="The key points of the review. Lowercase, 1-3 words each.")]

```

> Annotated 写法：类型 + 元数据 放在类型注解位，默认值单独放在赋值位，语义更清晰，符合 Python 类型系统规范

| 参数 | 作用 | 结构化输出场景必要性 |
| --- | --- | --- |
| `description` | 字段语义描述文本 | 极高，会传给 LLM 指导生成 |
| `default`<br/> / `default_factory` | 字段默认值 | 中，标记可选字段 |
| `ge`<br/> / `le`<br/> / `gt`<br/> / `lt` | 数值范围校验 | 高，约束数字字段边界 |
| `min_length`<br/> / `max_length` | 字符串 / 列表长度校验 | 中，控制输出长度 |
| `pattern` | 正则格式校验 | 中，约束固定格式字段 |
| `examples` | 字段示例值 | 低，辅助模型理解格式 |

### TypedDict

```powershell
from typing import TypedDict

class EventDetails(TypedDict):
    event_name: str
    date: str
    location: str
```

### JSON Schema

```powershell
contact_info_schema = {
    "title": "ContactInfo",
    "description": "Contact information for a person.",
    "type": "object",
    "properties": {
        "name": {"type": "string", "description": "The name of the person"},
        "email": {"type": "string", "description": "The email address of the person"},
        "phone": {"type": "string", "description": "The phone number of the person"}
    },
    "required": ["name", "email", "phone"]
}

```

## 响应格式

`response_format` 控制 Agent 返回结构化数据的底层实现策略，支持四类取值：

| 取值类型 | 说明 |
| --- | --- |
| `ToolStrategy[StructuredResponseT]` | 通过工具调用机制实现结构化输出 |
| `ProviderStrategy[StructuredResponseT]` | 使用模型服务商原生的结构化输出能力 |
| `type[StructuredResponseT]` | 直接传入 Schema 类型，LangChain 自动选择最优策略 |
| `None` | 不使用结构化输出（默认） |

## 结构化输出实现策略

### Provider 原生策略

（模型原生支持结构化输出）

`ProviderStrategy` 核心参数：`schema`：必填，定义结构化输出的格式，支持四种 Schema 类型：

* Pydantic 模型（`BaseModel` 子类，支持字段校验）
* Python dataclass（带类型注解）
* TypedDict
* 原生 JSON Schema 字典

```powershell
from pydantic import BaseModel, Field
from langchain.agents import create_agent

class ContactInfo(BaseModel):
    """Contact information for a person."""
    name: str = Field(description="The name of the person")
    email: str = Field(description="The email address of the person")
    phone: str = Field(description="The phone number of the person")

agent = create_agent(
    model="gpt-5",
    response_format=ContactInfo  # 自动选择 ProviderStrategy
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Extract contact info from: John Doe, john@example.com, (555) 123-4567"}]
})

print(result["structured_response"])
# ContactInfo(name='John Doe', email='john@example.com', phone='(555) 123-4567')

```

> * 如果模型支持原生结构化输出，`response_format=ProductReview` 和 `response_format=ProviderStrategy(ProductReview)` 效果完全一致；
> * 若模型不支持原生能力，Agent 会自动回退到工具调用策略。

### 工具调用策略

#### ToolStrategy

对于不支持原生结构化输出的模型，LangChain 通过工具调用机制模拟结构化输出 —— 将目标 Schema 包装成一个虚拟工具，让模型调用该工具来输出结构化数据。所有支持工具调用的现代模型都可以使用该方案，兼容性最广。

`ToolStrategy` 核心参数：

* `schema`：必填，结构化输出格式，支持 Pydantic 模型、dataclass、TypedDict、JSON Schema、Union 联合类型
* `tool_message_content`：自定义生成结构化输出后，写入对话历史的工具消息内容
* `handle_errors`：结构化输出校验失败时的错误处理策略，默认为 `True`

```powershell
from pydantic import BaseModel, Field
from typing import Literal
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

class ProductReview(BaseModel):
    """Analysis of a product review."""
    rating: int | None = Field(description="The rating of the product", ge=1, le=5)
    sentiment: Literal["positive", "negative"] = Field(description="The sentiment of the review")
    key_points: list[str] = Field(description="The key points of the review. Lowercase, 1-3 words each.")

agent = create_agent(
    model="gpt-5",
    tools=tools,
    response_format=ToolStrategy(ProductReview)
)

result = agent.invoke({
    "messages": [{"role": "user", "content": "Analyze this review: 'Great product: 5 out of 5 stars. Fast shipping, but expensive'"}]
})

result["structured_response"]
# ProductReview(rating=5, sentiment='positive', key_points=['fast shipping', 'expensive'])

```

#### 自定义工具消息内容

默认情况下，生成结构化输出后，工具消息会展示完整的结构化数据。通过 `tool_message_content` 可以自定义这条消息的文本，优化对话历史的可读性：

```powershell
agent = create_agent(
    model="gpt-5",
    tools=[],
    response_format=ToolStrategy(
        schema=MeetingAction,
        tool_message_content="Action item captured and added to meeting notes!"
    )
)
```

> * 自定义后，工具消息仅显示指定文本
> * 不设置时，默认消息为结构化数据的完整序列化内容

#### 错误处理

通过工具调用实现结构化输出时，模型可能生成不符合 Schema 的结果。LangChain 内置了智能重试机制，自动将错误信息反馈给模型并引导修正。

LangChain 结构化输出的 `handle_errors` 默认为 `True`，框架会自动完成全流程容错：

1. 自动捕获两类常见错误：Schema 校验失败、模型误返回多个结构化结果
2. 自动把具体错误信息（字段名、错误原因、约束规则）拼装成工具消息，回传给大模型
3. 引导模型自动修正参数、重新生成结构化输出，直到输出符合 Schema 规范
4. 受 Agent 最大执行步数限制，不会无限重试，不会出现死循环
