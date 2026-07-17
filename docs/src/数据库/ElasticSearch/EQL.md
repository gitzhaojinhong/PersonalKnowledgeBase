

## 目录

1. [EQL 概述](#eql-概述)
   - [设计目标与适用场景](#设计目标与适用场景)
   - [与 DSL 对比](#与-dsl-对比)
   - [事件数据模型](#事件数据模型)
2. [基本语法](#基本语法)
   - [事件查询](#事件查询)
   - [字段过滤](#字段过滤)
   - [管道操作符](#管道操作符)
3. [序列匹配](#序列匹配)
   - [sequence 语法](#sequence-语法)
   - [by 关键字](#by-关键字)
   - [until 时间窗口](#until-时间窗口)
   - [maxspan 最大跨度](#maxspan-最大跨度)
   - [with runs 连续匹配](#with-runs-连续匹配)
4. [跨事件关联](#跨事件关联)
   - [公共字段关联](#公共字段关联)
   - [多事件条件组合](#多事件条件组合)
   - [异常行为检测示例](#异常行为检测示例)
5. [缺失事件检测](#缺失事件检测)
   - [预期事件未发生](#预期事件未发生)
   - [安全分析场景](#安全分析场景)
6. [结果处理](#结果处理)
   - [排序](#排序)
   - [分页](#分页)
   - [字段过滤](#字段过滤-1)
7. [安全分析实战](#安全分析实战)
   - [威胁狩猎](#威胁狩猎)
   - [异常登录检测](#异常登录检测)
   - [进程链分析](#进程链分析)
8. [交叉引用](#交叉引用)

---

## EQL 概述

### 设计目标与适用场景

EQL（Event Query Language）是 Elasticsearch 为**时序事件数据**设计的专用查询语言。其核心设计目标是将"事件驱动"的思维模式直接映射到查询语法，使得安全分析师、运维工程师能够以自然的方式表达对事件序列、因果链条的探索。

**适用场景**：

| 场景 | 说明 |
|------|------|
| 威胁狩猎（Threat Hunting） | 在大量安全日志中搜索符合特定攻击模式的事件序列 |
| 异常行为检测 | 检测偏离正常行为基线的事件组合 |
| 根因分析 | 追溯某个异常事件的前置条件和关联事件 |
| 合规审计 | 验证某些预期事件是否在指定时间窗口内发生 |
| 进程链分析 | 追踪进程创建、网络连接、文件操作的因果链 |

**不适用场景**：

| 场景 | 替代方案 |
|------|----------|
| 全文搜索 | 使用 Query DSL 的 `match` / `multi_match` |
| 聚合统计 | 使用 Aggregation DSL |
| 相关性排序 | 使用 Query DSL 的 `function_score` |
| 嵌套/父子文档查询 | 使用 Query DSL 的 `nested` / `has_child` |

> **注意事项**：EQL 依赖于 `@timestamp` 字段进行时序排序，索引必须包含该字段且字段类型为 `date`。EQL 不支持跨索引查询，一次查询仅限单个索引模式。

---

### 与 DSL 对比

EQL 与 Elasticsearch Query DSL 在**设计哲学**上有本质差异：

| 维度 | EQL | Query DSL |
|------|-----|-----------|
| 核心抽象 | 事件（Event）与序列（Sequence） | 文档（Document）与匹配（Match） |
| 时间感知 | 原生支持时间窗口、时序约束 | 需通过 `range` 查询手动处理 |
| 跨事件关联 | 内置 `sequence`、`by` 等语法 | 需多次查询 + 应用层关联 |
| 学习曲线 | 面向分析师，语法接近自然语言 | 面向开发者，JSON 嵌套结构 |
| 查询能力 | 专注于事件模式的匹配与排序 | 通用查询，支持全文、聚合、高亮等 |
| 结果排序 | 按 `@timestamp` 升序（不可更改） | 支持任意字段排序 |
| 分页方式 | `search_after` 游标分页 | `from/size` 或 `search_after` |

**典型对比示例** —— 查找"进程 A 启动后 5 分钟内创建了网络连接"：

```json
// EQL —— 语义清晰，一行表达
POST /logs-*/_eql/search
{
  "query": "sequence by process.pid [process where process.name == \"powershell.exe\"] [network where destination.port == 443]"
}
```

```json
// Query DSL —— 需要多次查询并在应用层组合
// 第一步：查询进程启动事件
GET /logs-*/_search { "query": { "bool": { "filter": [
  { "term": { "event.type": "start" } },
  { "term": { "process.name": "powershell.exe" } }
] } } }
// 第二步：对每个 PID 查询网络事件（N+1 问题）
```

> **注意事项**：EQL 不是 DSL 的替代品，而是互补工具。在安全分析、APM、审计等时序场景中优先使用 EQL；在全文搜索、聚合分析、推荐系统等场景中仍使用 DSL。

---

### 事件数据模型

EQL 将索引中的每一条文档视为一个**事件（Event）**。事件的本质是一个带有时间戳的 JSON 文档。

**事件数据模型的核心字段**：

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `@timestamp` | `date` | **是** | 事件发生的时间戳，EQL 按此字段升序排列事件 |
| `event.category` | `keyword` | 否 | 事件大类，如 `process`、`network`、`file`、`authentication` |
| `event.type` | `keyword` | 否 | 事件类型，如 `start`、`end`、`access`、`denied` |
| `event.action` | `keyword` | 否 | 事件具体动作，如 `process_start`、`network_connection` |
| `event.id` | `keyword` | 否 | 事件唯一标识 |
| `event.sequence` | `long` | 否 | 事件在序列中的序号 |

**ECS（Elastic Common Schema）兼容**：EQL 天然适配 ECS 字段规范。一个典型的 ECS 进程事件：

```json
{
  "@timestamp": "2026-07-17T10:00:00Z",
  "event": {
    "category": "process",
    "type": "start",
    "action": "process_start"
  },
  "process": {
    "pid": 1234,
    "name": "cmd.exe",
    "command_line": "cmd.exe /c whoami",
    "parent": { "pid": 1000, "name": "explorer.exe" },
    "executable": "C:\\Windows\\System32\\cmd.exe"
  },
  "user": { "name": "administrator", "domain": "CORP" },
  "host": { "hostname": "desktop-01", "ip": "10.0.0.15" }
}
```

> **注意事项**：`@timestamp` 字段是 EQL 的排序基准，不可配置。如果索引中缺少该字段，EQL 查询将失败。建议在索引模板中显式配置 `@timestamp` 的 `date` 映射。

---

## 基本语法

### 事件查询

事件查询（event query）是 EQL 最基本的查询形式，用于匹配满足特定条件的单个事件。

**语法格式**：

```
<event_category> where <condition>
```

**核心参数**：

| 参数 | 说明 | 示例 |
|------|------|------|
| `event_category` | 事件类别，对应 `event.category` 或自定义条件 | `process`、`network`、`file`、`any` |
| `where` | 条件子句，支持逻辑运算符 | `and`、`or`、`not` |
| `condition` | 字段匹配表达式 | `process.name == "cmd.exe"` |

**REST API 示例**：

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"cmd.exe\"",
    "size": 10
  }'
```

> **注意事项**：`any` 关键字用于匹配所有事件类别，不限定 `event.category`。当不确定事件类别时使用 `any where ...`，但性能较差，建议明确指定类别。

---

### 字段过滤

EQL 支持丰富的字段过滤运算符，用于精确筛选事件。

**核心运算符**：

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `==` | 等于 | `process.name == "cmd.exe"` |
| `!=` | 不等于 | `user.name != "root"` |
| `>` `<` `>=` `<=` | 数值比较 | `process.pid >= 1000` |
| `:` | 字符串包含（子串匹配） | `process.name : "cmd"` |
| `in` | 值在列表中 | `process.name in ("cmd.exe", "powershell.exe")` |
| `not in` | 值不在列表中 | `user.name not in ("root", "admin")` |
| `and` | 逻辑与 | `a == 1 and b == 2` |
| `or` | 逻辑或 | `a == 1 or b == 2` |
| `not` | 逻辑非 | `not (a == 1)` |
| `*` | 通配符（like 模式） | `process.name == "cmd*"` |
| `?` | 单字符通配符 | `file.name == "????.exe"` |
| `~` | 正则表达式 | `process.name ~ "c[md]+\\.exe"` |
| `*`（字段存在） | 字段非空 | `process.command_line != null` 或 `process.command_line` 存在 |

**REST API 示例**：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name in (\"cmd.exe\", \"powershell.exe\") and process.pid >= 1000 and user.name != \"SYSTEM\"",
    "size": 10
  }'
```

> **注意事项**：
> - 通配符 `*` 在 `==` 比较中生效（如 `name == "cmd*"`），但正则 `~` 更精确。
> - 字符串比较区分大小写，如需忽略大小写，使用 `process.name : "CMD"`（子串匹配不区分大小写）。
> - `null` 比较使用 `!=` 和 `==`，如 `process.command_line != null` 表示字段存在且非空。

---

### 管道操作符

管道操作符用于对查询结果进行后处理，包括**截断**、**去重**等操作。

#### head —— 返回前 N 条

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `N` | `integer` | — | 返回前 N 条事件（按 `@timestamp` 升序） |

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"svchost.exe\" | head 5"
  }'
```

#### tail —— 返回后 N 条

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `N` | `integer` | — | 返回后 N 条事件（按 `@timestamp` 升序） |

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"svchost.exe\" | tail 5"
  }'
```

#### unique —— 按字段去重

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | `string` | — | 去重字段，保留该字段值首次出现的事件 |
| `N` | `integer` | — | 可选，限制返回的去重事件数量 |

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"svchost.exe\" | unique process.pid | head 10"
  }'
```

> **注意事项**：
> - 管道操作符可以串联，如 `... | unique process.pid | head 10`。
> - `head` 和 `tail` 作用于已排序的结果集，不改变排序方向。
> - `unique` 保留每个分组中 `@timestamp` 最早的事件。

---

## 序列匹配

### sequence 语法

`sequence` 是 EQL 的核心能力，用于匹配按**时间顺序**发生的多个事件，形成事件序列。

**语法格式**：

```
sequence [by <field>] [maxspan=<duration>]
  [ event_query_1 ]
  [ event_query_2 ]
  [ ... ]
  [until event_query_termination]
```

**核心参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `by` | `string` | 否 | 关联字段，同一序列中的事件必须在该字段上值相同 |
| `maxspan` | `duration` | 否 | 序列的最大时间跨度，如 `15m`、`1h` |
| `[...]` | `event_query` | 是 | 序列中的事件步骤，至少 2 步，最多 32 步 |
| `until` | `event_query` | 否 | 终止条件，匹配到该事件则序列终止 |

**REST API 示例** —— 查找"PowerShell 启动后 5 分钟内发起网络连接"：

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid
      [process where process.name == \"powershell.exe\"]
      [network where destination.port == 443]
    "
  }'
```

> **注意事项**：
> - 序列中的事件必须按 `@timestamp` 严格升序，即步骤 1 的时间 < 步骤 2 的时间 < ... < 步骤 N 的时间。
> - 同一时间戳的两个事件，EQL 不保证顺序，建议在数据采集时确保时间戳精度足够（毫秒级）。
> - 序列步骤最多 32 步，超出限制的查询将返回错误。

---

### by 关键字

`by` 关键字用于指定**分组关联字段**，确保同一序列中的所有事件在该字段上具有相同的值。这是实现跨事件关联的核心机制。

**核心参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `by <field>` | `string` | 关联字段，如 `process.pid`、`user.name`、`host.hostname` |

**多字段分组**：

```
sequence by host.hostname, user.name
  [process where process.name == "cmd.exe"]
  [file where file.path : "C:\\Windows\\Temp"]
```

**REST API 示例** —— 按主机和用户分组，检测"cmd.exe 启动后访问 Temp 目录"：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname, user.name
      [process where process.name == \"cmd.exe\"]
      [file where file.path : \"C:\\\\Windows\\\\Temp\"]
    "
  }'
```

> **注意事项**：
> - `by` 字段必须是 `keyword` 类型或 `long` 等精确值类型，`text` 类型字段不可用于 `by`。
> - 如果 `by` 字段在某个步骤中不存在（null），该步骤将被跳过，不会匹配到序列中。
> - `by` 是可选参数，不带 `by` 的序列仅按时间顺序匹配，不要求字段关联。

---

### until 时间窗口

`until` 关键字用于定义**序列终止条件**。当 `until` 指定的事件在序列匹配过程中出现时，序列匹配立即终止。

**语法格式**：

```
sequence ... [step1] [step2] ... until termination_event
```

**核心参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `until <event_query>` | `event_query` | 终止条件，匹配到即终止当前序列 |

**REST API 示例** —— 查找"进程启动后，在进程终止前创建了网络连接"：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid
      [process where event.type == \"start\" and process.name == \"cmd.exe\"]
      [network where destination.port == 443]
    until [process where event.type == \"end\" and process.name == \"cmd.exe\"]
    "
  }'
```

> **注意事项**：
> - `until` 事件不会被包含在序列结果中，仅作为终止标记。
> - 如果 `until` 事件在序列的任意步骤之间出现，整个序列匹配失败。
> - 常用于排除"正常终止"场景，仅捕获异常行为。

---

### maxspan 最大跨度

`maxspan` 用于限制整个序列的最大时间跨度。序列中第一个事件与最后一个事件之间的时间差不得超过该值。

**语法格式**：

```
sequence maxspan=<duration> [step1] [step2] ...
```

**核心参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `maxspan` | `duration` | 时间跨度，单位：`ms`、`s`、`m`、`h`、`d`，如 `15m`、`2h`、`30s` |

**REST API 示例** —— 查找"5 分钟内，进程启动后立即发起外网连接"：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=5m
      [process where process.name == \"powershell.exe\"]
      [network where destination.port == 443 and not destination.ip : \"10.0.0.0/8\"]
    "
  }'
```

> **注意事项**：
> - `maxspan` 的计时从序列中第一个匹配事件的 `@timestamp` 开始，到最后一个匹配事件的 `@timestamp` 结束。
> - 不带 `maxspan` 的序列没有时间上限，可能匹配到数小时甚至数天跨度的序列，对性能有较大影响。
> - 建议在安全场景中始终设置合理的 `maxspan`，典型值为 `5m` ~ `30m`。

---

### with runs 连续匹配

`with runs` 用于匹配**连续重复**的事件模式。例如，同一用户在短时间内连续多次登录失败。

**语法格式**：

```
sequence by <field> maxspan=<duration>
  [event_query] with runs=<N>
```

**核心参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `with runs` | `integer` | 连续匹配次数，表示该步骤的事件需要连续出现 N 次 |

**REST API 示例** —— 查找"同一用户 5 分钟内连续 5 次登录失败"：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by user.name maxspan=5m
      [authentication where event.outcome == \"failure\"] with runs=5
    "
  }'
```

**多步骤 + runs 组合**：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=10m
      [authentication where event.outcome == \"failure\"] with runs=3
      [authentication where event.outcome == \"success\"]
    "
  }'
```

> **注意事项**：
> - `with runs` 要求事件必须**连续**匹配，即中间不能插入其他匹配同一 `by` 字段的事件。
> - `with runs` 不要求事件在时间上是连续的，只要求在事件序列中相邻。
> - 常用于暴力破解检测、DDoS 检测等场景。

---

## 跨事件关联

### 公共字段关联

跨事件关联的核心机制是通过 **`by` 关键字**在公共字段上建立关联，将不同类别的事件串联成有意义的序列。

**公共字段的典型选择**：

| 关联字段 | 使用场景 |
|----------|----------|
| `process.pid` | 关联同一进程的启动、网络、文件、注册表事件 |
| `user.name` | 关联同一用户的操作序列 |
| `host.hostname` | 关联同一主机的多阶段行为 |
| `source.ip` + `destination.ip` | 关联网络攻击链 |
| `process.entity_id` | 使用 ECS 的全局唯一进程标识符进行精确关联 |

**REST API 示例** —— 按进程 PID 关联"进程启动 -> 文件写入 -> 网络连接"：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=10m
      [process where event.type == \"start\" and process.name == \"cmd.exe\"]
      [file where event.type == \"creation\" and file.path : \"C:\\\\Windows\\\\Temp\\\\*\"] 
      [network where event.type == \"connection\" and destination.port > 1024]
    ",
    "size": 10
  }'
```

> **注意事项**：
> - `process.entity_id` 比 `process.pid` 更可靠，因为 PID 可能被回收重用，而 `entity_id` 全局唯一。
> - 多字段关联时，所有 `by` 字段的值必须完全匹配，不存在"部分匹配"。

---

### 多事件条件组合

在单个事件步骤中，可以组合多个条件来精确描述事件特征。

**条件组合模式**：

```
# 模式 1：字段值匹配 + 逻辑组合
process where process.name == "cmd.exe" and (process.args : "-enc" or process.args : "-e")

# 模式 2：排除特定值
process where process.name != "System" and user.name != "NETWORK SERVICE"

# 模式 3：范围匹配
network where destination.port >= 1024 and destination.port <= 65535

# 模式 4：子串匹配
file where file.path : "C:\\Users\\*\\AppData\\Local\\Temp\\*"
```

**REST API 示例** —— 检测"PowerShell 编码命令执行 + 下载行为"：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=2m
      [process where process.name == \"powershell.exe\" and
        (process.command_line : \"-EncodedCommand\" or
         process.command_line : \"-enc\" or
         process.command_line : \"-e \")]
      [network where destination.port == 443 or destination.port == 80]
    "
  }'
```

> **注意事项**：
> - 括号 `()` 用于控制优先级，与大多数编程语言一致。
> - 长查询建议使用 Java Text Block（`"""..."""`）提高可读性。
> - 单个步骤中的条件数量没有硬性限制，但过于复杂的条件可能影响性能。

---

### 异常行为检测示例

结合 `sequence` 和 `by`，构建典型的异常行为检测规则。

**示例 1：可疑的计划任务创建**

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=5m
      [process where process.name == \"schtasks.exe\" and
        process.command_line : \"/create\"]
      [process where process.name in (\"cmd.exe\", \"powershell.exe\") and
        process.parent.name == \"schtasks.exe\"]
    "
  }'
```

**示例 2：可疑的注册表持久化**

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=3m
      [process where process.name == \"reg.exe\" and
        process.command_line : (\"HKCU\\\\Software\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run\" or
                               \"HKLM\\\\SOFTWARE\\\\Microsoft\\\\Windows\\\\CurrentVersion\\\\Run\")]
      [process where process.parent.name == \"reg.exe\"]
    "
  }'
```

> **注意事项**：异常检测规则需要根据实际环境持续调优。过于宽泛的条件会产生大量误报；过于严格的条件会遗漏真实威胁。

---

## 缺失事件检测

### 预期事件未发生

缺失事件检测是 EQL 的独特能力 —— 通过 `sequence` 结合 `until` 和 `maxspan`，检测**预期发生但未发生**的事件。

**核心原理**：定义一个序列，其中最后一个步骤是预期事件，但使用 `until` 或严格的时间窗口，使得预期事件未能在指定范围内发生。

**语法模式**：

```
sequence by <field> maxspan=<duration>
  [trigger_event]
  ![expected_event]
```

`!` 前缀表示该步骤是**否定匹配** —— 该事件在序列中不应出现。

**REST API 示例** —— 检测"进程启动后 5 分钟内未产生任何日志"（进程可能被注入后静默运行）：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=5m
      [process where event.type == \"start\" and process.name == \"cmd.exe\"]
      ![any where true]
    "
  }'
```

**检测"登录成功后 10 分钟内无登出事件"**：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by user.name maxspan=10m
      [authentication where event.outcome == \"success\" and event.action == \"user_login\"]
      ![authentication where event.action == \"user_logout\"]
    "
  }'
```

> **注意事项**：
> - 否定步骤 `!` 只能出现在序列的第二个及之后的位置，不能作为第一步。
> - 否定步骤表示"在指定时间窗口内，该事件未出现"，这需要等待时间窗口到期后才能确定，因此在实时流中可能存在延迟。
> - 否定步骤不应与 `until` 混用，两者语义冲突。

---

### 安全分析场景

缺失事件检测在安全分析中的典型场景：

**场景 1：进程注入检测 —— 进程启动后无后续正常行为**

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=5m
      [process where event.type == \"start\" and
        process.name in (\"svchost.exe\", \"rundll32.exe\") and
        process.command_line : \"*\"] 
      ![any where true]
    "
  }'
```

**场景 2：数据泄露检测 —— 大流量网络连接后无文件访问日志**

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=10m
      [network where destination.bytes > 1048576 and destination.port != 443]
      ![file where event.type == \"access\"]
    "
  }'
```

**场景 3：审计日志中断检测 —— 某一时间段内无任何日志**

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=30m
      [any where true]
      ![any where true]
    "
  }'
```

> **注意事项**：
> - 审计日志中断检测会产生大量误报，建议结合工作时间窗口（如仅在工作日 9:00-18:00 检测）或使用 `filter` 参数预过滤。
> - 否定步骤的 `maxspan` 设置需要权衡：过短则漏报，过长则延迟过高。

---

## 结果处理

### 排序

EQL 查询结果的排序规则与 Query DSL 有显著差异。

**核心参数**：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| 排序字段 | — | `@timestamp` | 固定按 `@timestamp` 升序，不可配置 |
| 排序方向 | — | `asc` | 固定升序，不可更改 |

**排序行为**：

- **事件查询**：结果按 `@timestamp` 升序排列。
- **序列查询**：结果按序列中**第一个事件**的 `@timestamp` 升序排列。
- 序列内部的事件按匹配顺序排列（即步骤 1、步骤 2、...）。

**REST API 示例**：

```bash
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"cmd.exe\"",
    "size": 10
  }'
```

返回结果中的事件按 `@timestamp` 升序排列。

> **注意事项**：
> - EQL 不支持自定义排序字段或排序方向。如需降序排列，需在应用层反转结果列表。
> - 如果需要按其他字段排序（如 `process.pid`、`user.name`），应在查询后使用 Java Stream 的 `sorted()` 进行二次排序。

---

### 分页

EQL 使用 **`search_after` 游标分页**，不支持传统的 `from/size` 分页。

**核心参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `size` | `integer` | 否 | 每页返回的事件数，默认 10，最大 1000 |
| `search_after` | `array` | 否 | 游标，用于获取下一页结果 |
| `filter` | `object` | 否 | 使用 Query DSL 预过滤，缩小查询范围 |

**分页流程**：

1. 首次请求不带 `search_after`，获取结果和游标。
2. 后续请求携带上次返回的 `search_after` 游标。
3. 当返回结果为空时，表示已到达末尾。

**REST API 示例**：

```bash
# 第一页
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"cmd.exe\"",
    "size": 10
  }'

# 响应中包含 "search_after" 游标，用于下一页
# {
#   "hits": { ... },
#   "search_after": ["2026-07-17T10:05:30.123Z", "event-id-xxx"]
# }

# 第二页
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"cmd.exe\"",
    "size": 10,
    "search_after": ["2026-07-17T10:05:30.123Z", "event-id-xxx"]
  }'
```

> **注意事项**：
> - EQL 不支持 `from` 参数，无法跳过分页。`search_after` 是唯一的分页方式。
> - `search_after` 游标有时效性，建议在短时间内完成分页遍历。
> - 对于序列查询，`search_after` 游标的结构与事件查询不同，包含序列的排序键。
> - 使用 `filter` 参数预过滤可以显著减少分页数据量：
>   ```json
>   {
>     "query": "...",
>     "filter": { "range": { "@timestamp": { "gte": "now-1h" } } }
>   }
>   ```

---

### 字段过滤

EQL 支持通过 `fields` 参数控制返回结果中的字段，减少网络传输和内存开销。

**核心参数**：

| 参数 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `fields` | `array` | 否 | 指定返回字段列表，支持通配符 `*` |
| `fields._source` | `boolean` | 否 | 是否返回完整 `_source`，默认 `true` |

**REST API 示例**：

```bash
# 仅返回指定字段
curl -X POST "http://localhost:9200/logs-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "process where process.name == \"cmd.exe\"",
    "fields": [
      "@timestamp",
      "process.pid",
      "process.name",
      "process.command_line",
      "user.name",
      "host.hostname"
    ],
    "size": 10
  }'
```

**序列查询的字段过滤**：

> **注意事项**：
> - `fields` 参数在序列查询中可以为每个步骤分别指定返回字段，数组中的每个元素对应一个步骤。
> - 如果只需要少数字段，建议使用 `fields` 而非返回完整 `_source`，可显著减少网络传输量。
> - 字段过滤不影响查询条件中引用字段的可用性，条件中的字段始终可用。

---

## 安全分析实战

### 威胁狩猎

威胁狩猎（Threat Hunting）是 EQL 的核心应用场景，通过编写 EQL 查询主动搜索潜在威胁。

**典型狩猎规则模板**：

```
# 规则模板：多阶段攻击链
sequence by <correlation_field> maxspan=<time_window>
  [stage_1_event]
  [stage_2_event]
  [stage_3_event]
```

**实战示例 1：DLL 侧加载攻击检测**

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=2m
      [process where event.type == \"start\" and
        process.executable : \"C:\\\\Users\\\\*\" and
        process.name in (\"rundll32.exe\", \"regsvr32.exe\")]
      [file where event.type == \"creation\" and
        file.path : (\"C:\\\\Windows\\\\System32\\\\*.dll\" or
                     \"C:\\\\Windows\\\\SysWOW64\\\\*.dll\")]
    "
  }'
```

**实战示例 2：WMI 持久化检测**

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=5m
      [process where process.name == \"wmiprvse.exe\"]
      [process where process.parent.name == \"wmiprvse.exe\" and
        process.name in (\"cmd.exe\", \"powershell.exe\", \"wscript.exe\", \"cscript.exe\")]
    "
  }'
```

> **注意事项**：
> - 威胁狩猎规则应定期更新，参考 MITRE ATT&CK 框架和最新威胁情报。
> - 使用 `filter` 参数限制时间范围（如 `now-24h`），避免全量扫描。
> - 建议将常用规则参数化，通过变量替换生成具体查询。

---

### 异常登录检测

异常登录检测是 EQL 在安全运营中的高频应用，用于识别暴力破解、凭证填充、异常时间登录等行为。

**场景 1：暴力破解检测 —— 同一用户 5 分钟内连续失败 5 次后成功登录**

```bash
curl -X POST "http://localhost:9200/logs-auth-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by user.name maxspan=5m
      [authentication where event.outcome == \"failure\"] with runs=5
      [authentication where event.outcome == \"success\"]
    "
  }'
```

**场景 2：异常时间登录 —— 非工作时间登录**

```bash
curl -X POST "http://localhost:9200/logs-auth-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by user.name maxspan=1h
      [authentication where event.outcome == \"success\" and
        user.name in (\"administrator\", \"root\", \"admin\")]
    ",
    "filter": {
      "bool": {
        "filter": [
          { "range": { "@timestamp": { "gte": "now-7d" } } }
        ]
      }
    }
  }'
```

**场景 3：横向移动检测 —— 同一用户短时间内登录多台主机**

```bash
curl -X POST "http://localhost:9200/logs-auth-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by user.name maxspan=10m
      [authentication where event.outcome == \"success\"]
      [authentication where event.outcome == \"success\"]
    "
  }'
```

> **注意事项**：
> - 暴力破解检测的阈值需要根据实际环境调整，过低会误报，过高会漏报。
> - 建议结合 `source.ip` 进行多维度分析，区分"同一 IP 的暴力破解"和"分布式凭证填充"。
> - 异常时间登录检测需要结合业务的工作时间定义，可通过 `filter` 参数中的 `script` 实现复杂的时段判断。

---

### 进程链分析

进程链分析通过追踪父子进程关系，检测恶意进程的创建链。

**场景 1：Office 文档宏攻击 —— Word 启动 PowerShell**

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=1m
      [process where process.name == \"WINWORD.EXE\"]
      [process where process.name == \"powershell.exe\" and
        process.parent.name == \"WINWORD.EXE\"]
    "
  }'
```

**场景 2：PowerShell 反射加载 —— 无文件攻击**

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by process.pid maxspan=2m
      [process where process.name == \"powershell.exe\" and
        (process.command_line : \"Invoke-Expression\" or
         process.command_line : \"IEX\" or
         process.command_line : \"Invoke-Mimikatz\")]
      [network where destination.port == 443]
    "
  }'
```

**场景 3：Lsass 凭证转储检测**

```bash
curl -X POST "http://localhost:9200/logs-endpoint-*/_eql/search" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "sequence by host.hostname maxspan=5m
      [process where process.name in (\"procdump.exe\", \"taskmgr.exe\",
        \"rundll32.exe\") and
        process.command_line : \"lsass\"]
      [file where event.type == \"creation\" and
        file.extension in (\"dmp\", \"zip\", \"7z\")]
    "
  }'
```

> **注意事项**：
> - 进程链分析依赖于端点日志的完整性，确保 EDR/EPP 代理正确采集 `process.parent.*` 字段。
> - `process.entity_id` 比 `process.pid` 更适合跨事件追踪，因为 PID 可能被回收重用。
> - 进程链规则需要持续更新，参考 MITRE ATT&CK 的 Execution、Persistence、Privilege Escalation 等战术。

---

