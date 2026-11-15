# MCP 模型上下文协议

## MCP 核心概念

Model Context Protocol（MCP）是一套开放协议，标准化了应用向大模型提供工具与上下文的方式。

> LangChain 通过 `MCPAdapter`  桥接 MCP 服务器与 LangChain Agent：自动发现服务器工具，转换为标准 LangChain 工具格式，可直接传入 `create_agent` 使用。

| 概念 | 说明 |
| --- | --- |
| MCP Server | 提供MCP服务的应用，可以是远程服务，也可以是本地服务 |
| MCP Client | 连接到MCP服务器，读取MCP信息（特别是Tool信息），供Host使用 |
| MCP Host | 协调和管理多个MCP Client的AI应用，比如LangChain的Agent |

**通信协议：**

## 工具使用

### 连接MCP服务

通过 `adapter.list_tools()` 获取工具列表后，直接传给 `create_agent` 即可。从 Agent 视角看，MCP 工具与原生 LangChain 工具行为完全一致：模型选择工具 → LangChain 执行 → 返回 `ToolMessage` 给模型。

```python
from langchain.agents import create_agent
from langchain.mcp import MCPAdapter

# server 参数支持多种连接类型
async def run_agent(server) -> dict:
    async with MCPAdapter(server) as adapter:          # ① 建立连接
        tools = await adapter.list_tools()             # ② 发现工具
        agent = create_agent("claude-sonnet-5", tools) # ③ 创建 Agent
        return await agent.ainvoke(                    # ④ 运行并返回
            {"messages": [{"role": "user", "content": "What is the forecast for Oslo?"}]}
        )                                              # ⑤ 退出 with，连接关闭
```

### 工具输出处理

MCP 工具的返回结果会被转换为标准 `ToolMessage`，包含模型可见内容、应用侧结构化数据、执行状态三类信息。

**（1）多模态内容**

适配器会把 MCP 的多模态内容块（图片、文件等）转换为 LangChain 标准内容块，和文本一起传递给模型。可通过 `ToolMessage.content_blocks` 遍历读取。

**（2）结构化内容**

工具返回的 `structuredContent` 不会暴露给模型，而是挂载在 `ToolMessage.artifact` 字段中，仅供应用侧读取。

* 字段路径：`message.artifact["structured_content"]`
* 无结构化内容时，`artifact` 为 `None`

**（3）错误处理**

* 服务器返回 `isError=True`：适配器转换为 `status="error"` 的 ToolMessage，携带错误文本，模型可自行纠错重试
* 传输 / 连接层失败：直接抛出异常（模型无法处理这类底层错误）

### 工具元数据

MCP 服务器会给每个工具“贴标签”，适配成 LangChain 工具后，这些标签挂在 tool.metadata\["mcp"] 下面。可以读这些标签，来决定怎么对待这个工具。

每个转换后的工具会在 `tool.metadata["mcp"]` 下携带来源元数据，全部为可选字段：

* `tool.annotations`：MCP 工具注解，如 `destructive_hint`（破坏性操作标记）、`read_only_hint`（只读标记）
* `tool._meta`：服务器自定义不透明元数据
* `server.name` / `server.version`：MCP 服务器标识与版本

读取时建议用链式 `.get()` 加默认值，避免字段缺失报错。

> 主要用它们做运行时决策（要不要审批、能不能自动跑）或 UI 展示（工具来自哪、是不是只读）。 读的时候永远假设字段可能不存在，给默认值兜底。

### 人工干预

可基于工具元数据的 `destructive_hint` 注解，动态生成人工干预规则，无需硬编码工具名：

1. 工具发现阶段读取所有破坏性工具
2. 为 `HumanInTheLoopMiddleware` 配置 `when` 判断谓词，命中则暂停执行等待审批
3. 支持进一步检查工具参数，实现更细粒度的管控（如删除路径是否为受保护目录）

示例：

```python

from langchain.agents.middleware import HumanInTheLoopMiddleware
from langchain.agents.middleware.human_in_the_loop import InterruptOnConfig
from langchain.tools import BaseTool
from langchain.tools.tool_node import ToolCallRequest

# ============ 工具元数据读取 ============

def is_destructive(tool: BaseTool) -> bool:
    """Read the MCP destructive hint off the adapter's tool metadata."""
    # 从 MCP 适配器塞进 metadata 的嵌套结构中，读取"破坏性操作"提示
    # 逐层 .get + 默认空字典，保证任何一层缺失都不会 KeyError，最坏返回 {}
    annotations = (
        (tool.metadata or {}).get("mcp", {}).get("tool", {}).get("annotations", {})
    )
    # 从注释里读 destructive_hint；服务器没给这个提示就默认 False（即"当作不危险"）
    return annotations.get("destructive_hint", False)


# ============ 主流程：发现工具 → 打标记 → 配置审批 → 组装 Agent ============

async def gate_destructive_tools(server):
    # 建立 MCP 连接（生命周期绑定在这个 async with 块内）
    async with MCPAdapter(server) as adapter:

        # 从 MCP 服务器拉取所有工具（此时每个工具的 metadata 里已带好 MCP 注释）
        tools = await adapter.list_tools()

        # 关键一步：在"工具发现阶段"就把破坏性工具筛出来，存成一个名字集合
        # 好处：后续每次调用时只做一次 O(1) 的集合查找，不用重复解析元数据
        # 而且"哪些工具危险"完全由服务器声明决定，不硬编码工具名
        destructive = {tool.name for tool in tools if is_destructive(tool)}

        # 谓词函数：每次工具调用前都会被问一次"这次调用要不要审批？"
        # request.tool_call["name"] 是模型决定要调用的工具名
        def needs_approval(request: ToolCallRequest) -> bool:
            # 只有被标记为破坏性的工具才需要审批，其余直接放行
            return request.tool_call["name"] in destructive

        # 配置审批规则：
        # - allowed_decisions：中断时允许用户做的决策（批准 / 拒绝）
        # - when：用上面的谓词动态决定"这次调用要不要中断"
        gate = InterruptOnConfig(
            allowed_decisions=["approve", "reject"], when=needs_approval
        )

        # 构造 interrupt_on 字典：{工具名: 配置}
        # 注意：这里给"每个工具"都挂了同一个 gate 配置，
        # 但真正是否中断由 gate 内部的 when 谓词决定
        # 所以虽然字典里每个工具都有配置，实际只有破坏性工具会触发中断
        interrupt_on: dict[str, bool | InterruptOnConfig] = {
            tool.name: gate for tool in tools
        }

        # 组装 Agent：MCP 工具 + 人在回路中间件 + 内存检查点
        # checkpointer 是必须的：中断后要能"恢复"状态，否则 resume 无法继续
        return create_agent(
            "claude-sonnet-5",
            tools,
            middleware=[HumanInTheLoopMiddleware(interrupt_on=interrupt_on)],
            checkpointer=InMemorySaver(),
        )


# ============ 中断后恢复：批准 / 拒绝 ============

from langgraph.types import Command

# 当 Agent 调用被谓词门控的工具时，运行会暂停（抛出中断）
# 这里模拟用户"批准"这次破坏性调用，然后从断点继续运行
# config 里必须带上相同的 thread_id，才能找到之前被挂起的那个状态
resumed = await agent.ainvoke(
    Command(resume={"decisions": [{"type": "approve"}]}), config
)
# 如果是拒绝，就改成 {"type": "reject"}，工具会被跳过，并把拒绝结果告诉模型
```

## 连接架构

### 选择适配模式

MCP 连接的选型分为两个独立维度：**服务器形态**和**连接生命周期**，两个维度可自由组合搭配。

1. **服务器形态（Server shape）**

根据你要对接的服务器数量和隔离需求选择：

| 需求场景 | 选用方案 | 对应章节 |
| --- | --- | --- |
| 只对接 1 台 MCP 服务器 | 直接传入 URL、脚本路径或进程内服务器对象 | 单服务端直连模式 |
| 多台服务器，通过一个聚合连接统一访问 | 传入 `MCPConfig`<br/> 字典 | 聚合连接 MCPConfig |
| 多台服务器，需要各自独立的认证、协议版本或连接池 | 传入 `ClientGroup`<br/> 客户端组 | 独立连接 ClientGroup |

2. **连接生命周期（Connection lifetime）**

根据你的应用形态选择连接保持时长：

| 场景 | 模式 | 对应章节 |
| --- | --- | --- |
| 脚本、Notebook、绝大多数普通代理 | 在 `async with`<br/> 内完成工具发现，退出上下文即可 | 单次调用一次连接 |
| 单次代理运行中，多次工具调用要共享同一个会话 | 调用代理的全程保持适配器上下文打开 | 单次运行复用连接 |
| 生产部署、大量并发运行实例 | 每次运行都做工具发现，底层复用共享连接池 + 缓存 | 连接池 + 缓存规模化扩展 |

### 服务器形态选择

#### 单服务端直连模式

MCPAdapter 会根据所提供的目标自动推断传输方式。

```python
from pathlib import Path

from langchain.mcp import MCPAdapter

# 一个进程内的 FastMCP 服务器：无需子进程，无需套接字。非常适合测试。
in_memory = MCPAdapter(server)  # 一个 FastMCP 实例

# 脚本路径通过 stdio 启动，每个适配器对应一个子进程。
stdio = MCPAdapter(Path("weather_server.py"))

# 字符串必须是 http(s) URL，通过可流式 HTTP 访问。
http = MCPAdapter("https://example.com/mcp")
```

#### MCPConfig 聚合连接

给适配器传入一个 `MCPConfig` 格式的字典，即可通过一个聚合端点对接多台服务器。FastMCP 会自动用配置的 key 作为前缀给工具命名，避免不同服务器同名工具冲突。

```python
from langchain.agents import create_agent
from langchain.mcp import MCPAdapter

CONFIG = {
    "mcpServers": {
        "weather": {"command": "python", "args": ["/path/to/weather_server.py"]},
        "calc": {"command": "python", "args": ["/path/to/calc_server.py"]},
    }
}

async def fleet_agent(config):
    async with MCPAdapter(config) as adapter:
        # 所有工具自动加前缀：weather_xxx、calc_xxx
        # 同名工具不会混淆
        tools = await adapter.list_tools()
        return create_agent("claude-sonnet-5", tools)

```

> 特点
>
> * 每个后端独立寻址，支持混合传输方式（比如一台走 stdio、一台走 HTTP）
> * **重要限制**：整个配置内的所有后端共享同一个协商后的协议版本。只要有一台服务器只支持旧版协议，整个集群都会降级到 legacy 模式。

#### ClientGroup 独立连接

如果每台服务器需要独立的认证、不同的协议版本、或独立的连接池配置，就使用 `ClientGroup`。每个成员客户端保持独立的协议协商、认证、处理器，群组会自动把工具调用路由到对应的原始客户端。

```python
from fastmcp.client import Client
from fastmcp.client.group import ClientGroup
from langchain.agents import create_agent
from langchain.mcp import MCPAdapter

async def agent_from_group(legacy_url: str, modern_url: str):
    # 每台服务器一个独立连接
    # legacy 服务器强制旧协议，modern 服务器自动协商最新协议
    # 工具同样自动加 {服务器名}_{工具名} 前缀，避免重名
    group = ClientGroup(
        {
            "weather": Client(legacy_url, mode="legacy"),
            "calc": Client(modern_url, mode="auto"),
        }
    )
    async with MCPAdapter(group) as adapter:
        tools = await adapter.list_tools()
        return create_agent("claude-sonnet-5", tools)

```

> mode参数：
>
> * legacy 服务器：mode="legacy" 强制使用旧版 initialize 握手。适用于明确只支持旧协议的服务器。
> * modern 服务器：mode="auto"（默认值）会探测服务器支持的最新协议。如果服务器明确支持现代协议，就使用现代协议；否则安全地回退到 legacy 握手。这对混合了新老服务器的环境非常安全。

### 连接生命周期

#### 单次调用一次连接

`MCPAdapter` 本身是一个异步上下文管理器：

* 进入上下文（`async with`）：初始化底层客户端、建立连接
* 退出上下文：释放连接
* 工具发现（`list_tools`）必须在上下文内执行，但返回的工具对象会持有客户端引用，因此上下文退出后工具依然可以正常调用

```python
from langchain.agents import create_agent
from langchain.mcp import MCPAdapter

async def build_agent(target):
    # 在适配器上下文内发现工具、构建代理
    # 返回的工具持有客户端，上下文退出后代理解仍然可用
    async with MCPAdapter(target) as adapter:
        tools = await adapter.list_tools()
        return create_agent("claude-sonnet-5", tools)  # 在上下文内构建
    # 上下文退出，连接释放，但 agent 和 tools 依然可用
```

> 注意：不需要在代理的整个生命周期里都保持适配器打开。绝大多数场景用这个模式就足够，只有需要保持长会话、或做生产部署扩展时才需要调整。

#### 单次运行复用连接

> 默认行为：工具可重入
>
> `MCPAdapter` 返回的工具是可重入（reentrant）的：每一次工具被调用时，都会独立打开客户端、执行 MCP 请求、执行完就释放连接 —— 无论其他地方是否已经持有连接。
>
> 带来的效果：
>
> * 一次代理运行中，每调用一次工具就开一个会话，调用结束立即关闭
> * 避免长时间运行的代理在两次工具调用之间空占连接资源
> * 这也是为什么「发现工具的上下文退出后，工具仍然能调用」的底层原因

**跨多次调用保持同一会话**

如果希望一次代理运行内的所有工具调用复用同一个连接会话，只需要把代理调用也放在 `MCPAdapter` 的上下文内部即可。可重入的客户端会自动复用已有连接，不会重复建立新连接。

```python
async with MCPAdapter(target) as adapter:
    tools = await adapter.list_tools()
    agent = create_agent("claude-sonnet-5", tools)
    result = await agent.ainvoke(...)   # 在上下文内运行
# 退出后连接释放
```

#### 连接池 + 缓存规模化扩展

在“每次运行都重新走一遍发现流程”的前提下，通过缓存 + 连接池，让这件事在高并发/多副本下依然可用。

核心思路：

* 工具目录每次运行都重新发现（保证最新），但发现和连接的重复成本由缓存 + 连接池吸收。

通常配合 LangGraph 的 graph 工厂模式使用：每次运行调用工厂函数，动态构建代理、拉取最新工具目录，共享连接池和响应缓存吸收重复发现的成本。

```python
import contextlib
import httpx2
from fastmcp.client import Client
from fastmcp.client.group import ClientGroup
from fastmcp.client.transports import StreamableHttpTransport
from langchain.agents import create_agent
from langchain.mcp import MCPAdapter
from langgraph_sdk.runtime import ServerRuntime

# ---------------------------------------------------------------------------
# 1. 全局共享 HTTP 连接池（进程级单例）
# ---------------------------------------------------------------------------
# 整个进程内所有 MCP 客户端共用同一个底层连接池
# 核心作用：避免每台服务器、每次请求都创建独立连接池，大幅减少TCP握手开销
_POOL = httpx2.AsyncHTTPTransport()


class _SharedPoolTransport(httpx2.AsyncBaseTransport):
    """
    包装全局连接池的防护层，核心目的：
    1. 让每个 FastMCP 客户端都从全局池借用 HTTP 连接
    2. 屏蔽 aclose 方法，防止单个客户端退出时销毁全局连接池
    """
    # 直接复用全局池的请求处理逻辑
    handle_async_request = _POOL.handle_async_request

    async def aclose(self) -> None:
        # 空实现：不执行任何关闭操作，保护全局连接池
        ...


def _httpx_client_factory(**kwargs) -> httpx2.AsyncClient:
    """
    httpx 客户端工厂：统一注入共享连接池
    所有 MCP 服务端的 HTTP 请求都会走同一个连接池
    """
    return httpx2.AsyncClient(transport=_SharedPoolTransport(), **kwargs)


# ---------------------------------------------------------------------------
# 2. MCP 服务端配置与客户端组构建
# ---------------------------------------------------------------------------
# 你的所有 MCP 服务端地址，key 会自动作为工具名前缀（如 weather_get_forecast）
MCP_SERVERS = {
    "weather": "http://localhost:8001/mcp",
    "calc": "http://localhost:8002/mcp",
    "docs": "https://docs.langchain.com/mcp",
}


def _build_mcp_client_group() -> ClientGroup:
    """
    构建 MCP 客户端组，同时注入两大优化：
    - 连接层：所有客户端共用全局 HTTP 连接池
    - 缓存层：每个客户端开启内存缓存，缓存工具/资源/提示词列表
    - 隔离性：每个服务端独立协商协议版本、独立认证，互不影响
    """
    return ClientGroup(
        {
            name: Client(
                # 使用流式 HTTP 传输，并注入我们的共享连接池工厂
                StreamableHttpTransport(url, httpx_client_factory=_httpx_client_factory),
                # 开启客户端响应缓存（仅现代协议 2026-07-28+ 生效）
                # 自动缓存 list_tools / list_resources / list_prompts 的结果
                cache=True,
                # 协议模式：auto 自动协商服务端支持的最高版本
                mode="auto",
            )
            for name, url in MCP_SERVERS.items()
        }
    )


# ---------------------------------------------------------------------------
# 3. LangGraph 图工厂（Agent Server 部署入口）
# ---------------------------------------------------------------------------
@contextlib.asynccontextmanager
async def make_graph(runtime: ServerRuntime):
    """
    LangGraph Agent Server 工厂函数，每次运行都会被调用
    完全遵循官方部署最佳实践：
    1. 每次运行重新发现工具，保证工具列表实时性
    2. 底层复用全局连接池，无重复建连开销
    3. 配合缓存命中，绝大多数运行无需发起真实的工具发现网络请求
    4. 内省场景（读 schema、查状态、可视化）跳过 MCP 连接，节省资源
    """
    # execution_runtime 仅在真实执行运行时存在
    # 读 schema、读状态、Studio 可视化等操作直接跳过，避免无效建连
    if runtime.execution_runtime:
        # 构建客户端组（仅包装层，连接池全局共享，此处开销极低）
        client_group = _build_mcp_client_group()

        async with MCPAdapter(client_group) as adapter:
            # cache_mode="use"：优先读取缓存，TTL 有效期内直接返回
            # 缓存失效时才重新拉取并更新缓存
            tools = await adapter.list_tools(cache_mode="use")

            # 构建代理图并返回
            agent_graph = create_agent("claude-sonnet-5", tools)
            yield agent_graph

            # 退出上下文自动释放适配器资源，全局连接池不受影响
    else:
        # 非执行场景：返回空工具的图，保持拓扑结构一致
        # 避免内省路径也建立 MCP 连接，大幅降低部署资源消耗
        agent_graph = create_agent("claude-sonnet-5", tools=[])
        yield agent_graph

```

## 认证体系

### Bearer 令牌认证

服务端校验你预先获取的令牌，客户端自动在所有请求中添加 `Authorization: Bearer <token>` 请求头。整个过程无需授权发现、浏览器跳转或令牌刷新逻辑。

```python
from fastmcp.client import Client
from langchain.mcp import MCPAdapter

async def load_tools_with_bearer(url: str, token: str) -> list:
    # 直接将令牌字符串传入 Client 的 auth 参数
    # auth 支持三种形式：bearer 令牌字符串、字面量 "oauth"、任意 httpx.Auth 实例
    async with MCPAdapter(Client(url, auth=token)) as adapter:
        return await adapter.list_tools()

# 语义更清晰的方式：使用显式的 `BearerAuth` 类.
from fastmcp.client.auth import BearerAuth
client = Client(url, auth=BearerAuth(token="your-token"))
```

关键注意点

1. 传入字符串令牌时**不需要手动添加 `Bearer ` 前缀**，FastMCP 会自动按照标准格式补全。
2. 在 `MCPConfig` 聚合配置中，每台服务器通过相同的 `auth` 字段配置自身的令牌凭证。
3. 除了直接传字符串，也可以使用显式的 `BearerAuth` 类，语义更清晰.

### OAuth 2.1 认证

FastMCP 自动完成全链路处理：授权服务器发现、动态客户端注册、本地回调服务启动、浏览器跳转授权、令牌交换、自动刷新。动态客户端注册意味着无需提前在服务端配置 client_id，客户端运行时自动完成注册。

1. **最简用法**

直接传入字面量字符串 `"oauth"`，使用默认配置启动完整 OAuth 流程：

```python
async def load_tools_with_oauth(url: str) -> list:
    # "oauth" 触发完整 OAuth 2.1 流程：发现→注册→浏览器授权→换令牌
    # 默认令牌存在内存中，程序重启后失效，每次运行都要重新走浏览器授权
    async with MCPAdapter(Client(url, auth="oauth")) as adapter:
        return await adapter.list_tools()
```

2. **持久化令牌配置**

默认令牌仅保存在内存中，重启后丢失。如需跨运行复用令牌、避免重复浏览器授权，使用 `OAuth` 类配置持久化存储：

```python
from fastmcp.client import Client
from fastmcp.client.auth import OAuth

# 配置 OAuth 提供者，指定令牌持久化存储
oauth = OAuth(
    mcp_url="https://example.com/mcp",
    scopes=["read", "write"],  # 请求的权限范围
    token_storage=...  # 接入磁盘/Redis 等持久化存储
)

client = Client("https://example.com/mcp", auth=oauth)
```

### 按服务器独立认证

适用于单个代理同时对接多台 MCP 服务器，且每台服务器使用不同凭证、不同认证方式的场景。

使用 `ClientGroup` 为每台服务器创建独立的客户端连接，分别配置各自的 `auth` 参数，实现认证逻辑完全隔离。每台服务器独立协商协议版本、独立维护连接与认证状态。

```python
from fastmcp.client import Client
from fastmcp.client.group import ClientGroup
from langchain.mcp import MCPAdapter

async def load_with_per_server_auth(
    billing_url: str,
    docs_token: str,
    docs_url: str
) -> list:
    # billing 服务器走 OAuth 交互式认证
    # docs 服务器走静态 Bearer 令牌认证
    # ClientGroup 保证两台服务器的连接、认证、协议版本完全独立
    group = ClientGroup(
        {
            "billing": Client(billing_url, auth="oauth"),
            "docs": Client(docs_url, auth=docs_token),
        }
    )
    async with MCPAdapter(group) as adapter:
        return await adapter.list_tools()
```

### 按用户身份认证（部署级）

适用于生产多用户部署场景，确保每次代理运行都以发起请求的真实用户身份访问 MCP 服务器，而非使用全局共享的服务凭证。

1. **调用者身份认证**：在 LangGraph Agent Server 层，通过自定义认证中间件解析入站请求，得到当前用户的身份信息。
2. **用户专属 MCP 凭证**：在图工厂函数中，读取当前运行时的用户身份，为该用户生成 / 兑换专属令牌，构建带用户认证的 MCP 客户端。

```python
from fastmcp.client import Client
from fastmcp.client.auth import BearerAuth
from langchain.agents import create_agent
from langchain.mcp import MCPAdapter

# MCP 服务器配置
CONFIG = {
    "mcpServers": {
        "docs": {"url": "https://example.com/mcp"}
    }
}

async def make_graph(runtime):
    # 1. 从运行时读取当前用户身份，未认证则标记为匿名
    user = runtime.user.identity if runtime.user is not None else "anonymous"
    
    # 2. 为当前用户兑换专属令牌（生产环境对接内部令牌服务/OAuth 网关）
    user_auth = BearerAuth(token_for(user))
    
    # 3. 构建带用户认证的 MCP 客户端，发现工具并生成代理
    async with MCPAdapter(Client(CONFIG, auth=user_auth)) as adapter:
        tools = await adapter.list_tools()
        return create_agent("claude-sonnet-5", tools)
```

生产实践说明

1. `token_for(user)` 是占位逻辑，实际生产中可对接：

* 内部 OAuth 网关，将用户会话兑换为 MCP 访问令牌
* 身份提供商的授权码流程，按用户身份完成授权
* 内部令牌服务，签发用户专属 JWT

2. 缓存必须按用户隔离：以验证后的用户身份作为缓存分区键，确保不同用户的工具列表、响应缓存完全隔离，避免数据串权。
3. 可与「共享连接池 + 工具发现缓存」的部署扩展方案结合使用，底层连接复用，上层认证与缓存按用户隔离。

## 创建mcp服务器

自定义MCP最简单的方式就是使用FastMCP了。

首先，需要安装依赖：

```python
uv add fastmcp
```

接着，只需要定义几个方法，然后利用FastMCP提供的装饰器即可：

* @mcp.tool : 作为MCP中的工具
* @mcp.resources : 返回MCP需要的resources，类似拓展知识库
* @mcp.prompt : 返回MCP预定义的Prompt，预设的提示词

说明：MCP server端不仅可以提供tool，还可以提供resource、prompt，但通常不太常用，一般只需要提供tool即可。

通常我们只需要定义带有tool的MCP Server就可以了。

例如，我们定义一个数学运算的MCP服务，这个需要写到单独的py文件中，比如math_mcp_server.py：

```python
from fastmcp import FastMCP

# 初始化mcp
mcp = FastMCP("Math")


# mcp tools
@mcp.tool()
def add(a: float, b: float) -> float:
    """Add two numbers"""
    return a + b


@mcp.tool()
def multiply(a: float, b: float) -> float:
    """Multiply two numbers"""
    return a * b


@mcp.tool
def square_root(x: float) -> float:
    """Calculate the square root of a number"""
    return x ** 0.5


# 启动mcp服务，通信方式设置为stdio
if __name__ == "__main__":
    mcp.run(transport="stdio")
```

一个自定义MCP server就准备好了。

注意，由于我们是采用stdio方式，因此这个文件写好放在那里，不需要启动，将来MCP Client会自己启动并加载为子进程。
