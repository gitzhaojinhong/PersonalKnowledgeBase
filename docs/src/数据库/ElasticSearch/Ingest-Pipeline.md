

## Ingest Pipeline 概述

### 什么是 Ingest Pipeline

**概念定义：** Ingest Pipeline 是 Elasticsearch 在索引文档之前，对原始数据进行预处理（转换、丰富、清洗）的轻量级 ETL 管道。它运行在 Ingest Node 上，由一组有序的 Processor 组成，每个 Processor 对文档的 `_source` 字段执行一次原子操作，最终将处理后的文档写入目标索引。

**核心特征：**

| 特征 | 说明 |
|------|------|
| 执行位置 | Ingest Node（协调节点或专用节点） |
| 执行时机 | 文档索引前，写入磁盘之前 |
| 组成单元 | 一组有序 Processor |
| 数据范围 | 仅操作 `_source` 中的字段 |
| 失败策略 | 可配置 `on_failure` 回退处理器或 `ignore_failure` 跳过 |

**REST API 示例 —— 创建一条简单 Pipeline：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/my-pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "A simple ingest pipeline",
    "processors": [
      { "set": { "field": "processed", "value": true } }
    ]
  }'
```

**注意事项：**

- Pipeline 在索引文档之前执行，不会修改原始数据源。
- 每条 Pipeline 的名称在集群范围内唯一。
- 删除 Pipeline 不会影响已经通过该 Pipeline 索引的存量文档。

---

### 与 Logstash 对比

**概念定义：** Logstash 是 Elastic Stack 中的独立数据收集引擎，Ingest Pipeline 是内置于 Elasticsearch 的轻量级替代方案。两者均用于数据预处理，但架构定位不同。

| 对比维度 | Ingest Pipeline | Logstash |
|----------|----------------|----------|
| 部署形态 | 内置于 Elasticsearch，无需额外进程 | 独立 JVM 进程，需独立部署 |
| 资源开销 | 共享 ES 节点资源 | 独占 JVM 堆内存 |
| 插件生态 | 约 40+ 内置 Processor | 200+ 插件（input/filter/output） |
| 数据源 | 仅处理写入 ES 的数据 | 支持多种 input（Kafka、Beats、JDBC 等） |
| 输出目标 | 仅 Elasticsearch | 多种 output（ES、Kafka、S3、CSV 等） |
| 吞吐量 | 高（无网络跳转） | 中等（额外的网络跳转） |
| 复杂度 | 低，声明式 JSON 配置 | 高，支持复杂过滤逻辑和 Ruby 脚本 |
| 适用场景 | 简单字段操作、类型转换、GeoIP | 复杂 ETL、多数据源汇聚、流式处理 |

**注意事项：**

- Logstash 和 Ingest Pipeline 可以组合使用：Logstash 负责复杂 ETL，Ingest Pipeline 负责索引前最后一公里处理。
- 如果已有 Logstash 基础设施且团队熟悉，不建议强行迁移到 Ingest Pipeline。
- 自 7.x 起，Ingest Pipeline 的性能已大幅优化，简单场景下可完全替代 Logstash。

---

### 适用场景

**概念定义：** Ingest Pipeline 适合在索引文档之前执行的轻量级数据转换，无需引入外部 ETL 组件。

**典型场景：**

| 场景 | 示例 |
|------|------|
| 字段重命名 | 将 `@timestamp` 重命名为 `ts` |
| 类型转换 | 字符串 `"123"` 转为整数 `123` |
| 默认值填充 | 未提供 `status` 时默认为 `"active"` |
| 字段删除 | 移除不需要索引的临时字段 |
| Grok 解析 | 将日志行解析为结构化字段 |
| 日期解析 | 将字符串日期转为 `date` 类型 |
| GeoIP 丰富 | 根据 IP 填充地理位置信息 |
| 脚本处理 | 复杂业务逻辑（Painless 脚本） |
| Enrich 丰富 | 从查找表追加补充数据 |
| 推理/向量化 | 写入时自动生成 Embedding 向量 |

**不适用场景：**

- 需要从 Kafka、数据库等外部源拉取数据 —— 使用 Logstash。
- 需要将数据写入多个目标 —— 使用 Logstash。
- 需要复杂的状态化处理（窗口聚合、流式 JOIN）—— 使用 Flink / Kafka Streams。

**注意事项：**

- Ingest Pipeline 仅处理写入 Elasticsearch 的数据，不处理已存在的存量数据（需借助 `_update_by_query` 或 Reindex 配合 Pipeline）。
- 若 Processor 链较长（>10 个），建议评估性能影响。

---

### Node 角色（Ingest Node）

**概念定义：** Ingest Node 是 Elasticsearch 中负责执行 Ingest Pipeline 的节点角色。所有节点默认启用 `ingest` 角色，可在 `elasticsearch.yml` 中通过 `node.roles` 控制。

**节点角色配置：**

```yaml
# 默认（所有节点兼作 Ingest Node）
node.roles: [ data, master, ingest ]

# 专用 Ingest Node（无数据存储）
node.roles: [ ingest ]

# 禁用 Ingest 角色
node.roles: [ data, master ]
```

**核心参数：**

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `node.roles` | `[data, master, ingest]` | 节点角色列表 |
| `ingest.geoip.downloader.enabled` | `true` | 是否自动下载 GeoIP 数据库 |

**注意事项：**

- 专用 Ingest Node 不存储数据，可减轻 Data Node 的 CPU 压力。
- 写入请求若未路由到 Ingest Node，协调节点会将其转发到 Ingest Node 执行 Pipeline。
- 高吞吐写入场景（>10K docs/s），建议部署专用 Ingest Node。
- 集群中至少保留一个节点启用 `ingest` 角色，否则 Pipeline 无法执行。

---

## Processor 类型

### set

**概念定义：** 将指定字段设置为固定值。若字段不存在则创建，若已存在则覆盖。值是静态的，不依赖文档上下文。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 目标字段名，支持点号路径 |
| `value` | any | 是 | 要设置的静态值 |
| `override` | boolean | 否 | 是否覆盖已有值，默认 `true` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/set-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "set": {
          "field": "env",
          "value": "production"
        }
      },
      {
        "set": {
          "field": "nested.level",
          "value": 1,
          "override": false
        }
      }
    ]
  }'
```

**注意事项：**

- `value` 支持 JSON 支持的所有数据类型（字符串、数字、布尔、数组、对象）。
- 嵌套字段使用点号路径，如 `user.address.city`。
- `override: false` 时，仅当字段不存在才设置值，可用于提供默认值。

---

### remove

**概念定义：** 从文档 `_source` 中移除一个或多个字段，可减少索引大小和存储开销。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string / array | 是 | 要移除的字段名，支持点号路径和数组 |
| `ignore_missing` | boolean | 否 | 字段不存在时是否忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/remove-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "remove": {
          "field": ["temp_field", "debug_info"],
          "ignore_missing": true
        }
      }
    ]
  }'
```

**注意事项：**

- 移除字段可减少索引大小，但已索引的存量数据不受影响。
- 移除父对象字段时，子字段也会被递归移除。
- `ignore_missing: true` 可避免因字段不存在导致的 Pipeline 失败。

---

### rename

**概念定义：** 将文档中的字段重命名为新名称。若目标字段已存在，默认会抛出错误。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `target_field` | string | 是 | 目标字段名 |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/rename-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "rename": {
          "field": "old_field_name",
          "target_field": "new_field_name",
          "ignore_missing": true
        }
      }
    ]
  }'
```

**注意事项：**

- 目标字段已存在时会抛出 `illegal_argument_exception`。
- 与 Logstash `mutate { rename }` 行为一致。
- 需要使用 `\{\{\{ }}}` 模板语法时，应改用 `set` + `remove` 组合。

---

### split

**概念定义：** 使用分隔符将字符串拆分为字符串数组。常用于处理 CSV 格式的字段或标签字符串。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `separator` | string | 是 | 分隔符（支持正则） |
| `target_field` | string | 否 | 目标字段名，默认覆盖源字段 |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `preserve_trailing` | boolean | 否 | 是否保留尾随空元素，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/split-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "split": {
          "field": "tags",
          "separator": ","
        }
      }
    ]
  }'
```

**注意事项：**

- 分隔符是正则表达式，特殊字符需转义（如 `\\.` 匹配点号）。
- 源字段必须是字符串类型，否则抛出类型错误。
- `preserve_trailing: true` 时，`"a,b,"` 拆分为 `["a","b",""]`。

---

### join

**概念定义：** 将数组中的每个元素用分隔符连接为单个字符串。是 `split` 的逆操作。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名（必须是数组） |
| `separator` | string | 是 | 连接分隔符 |
| `target_field` | string | 否 | 目标字段名，默认覆盖源字段 |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/join-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "join": {
          "field": "tags_array",
          "separator": "|"
        }
      }
    ]
  }'
```

**注意事项：**

- 源字段必须是数组类型，否则报错。
- 若需将非数组字段转为字符串，应先用 `split` 转为数组再 `join`。

---

### grok

**概念定义：** Grok Processor 使用正则表达式模式从非结构化文本（如日志行）中提取结构化字段。内置 120+ 预定义模式，也支持自定义模式。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `patterns` | array | 是 | Grok 模式列表，按顺序匹配 |
| `pattern_definitions` | object | 否 | 自定义模式定义（key-value） |
| `trace_match` | boolean | 否 | 是否输出匹配调试信息，默认 `false` |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |
| `ecs_compatibility` | string | 否 | ECS 兼容模式，默认 `disabled` |

**常用内置模式速查：**

| 模式 | 匹配示例 | 说明 |
|------|----------|------|
| `%{IP:client_ip}` | `192.168.1.1` | IP 地址 |
| `%{TIMESTAMP_ISO8601:ts}` | `2024-01-15T10:30:00Z` | ISO 8601 时间戳 |
| `%{NUMBER:code:int}` | `200` | 数字并转为整数 |
| `%{GREEDYDATA:message}` | 任意剩余文本 | 贪婪匹配 |
| `%{LOGLEVEL:level}` | `ERROR` | 日志级别 |
| `%{NOTSPACE:method}` | `GET` | 非空白字符 |
| `%{URIPATHPARAM:path}` | `/api/v1/users` | URI 路径 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/grok-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "grok": {
          "field": "message",
          "patterns": [
            "%{IP:client_ip} - - \\[%{HTTPDATE:timestamp}\\] \"%{WORD:method} %{URIPATHPARAM:request} HTTP/%{NUMBER:http_version}\" %{NUMBER:status:int} %{NUMBER:bytes:int}"
          ],
          "pattern_definitions": {
            "CUSTOM_ID": "[A-Z]{2}-\\d{6}"
          }
        }
      }
    ]
  }'
```

**注意事项：**

- Grok 模式匹配是 CPU 密集操作，高吞吐场景建议使用专用 Ingest Node。
- 提取出的字段默认是字符串类型，可通过 `:int`、`:float` 后缀转换类型。
- 复杂的 Grok 模式建议先用 Simulate API 调试。
- `trace_match: true` 会在 `_ingest` 元数据中输出匹配信息，辅助调试。

---

### date

**概念定义：** 将字符串格式的日期字段解析为 Elasticsearch 内部日期格式（epoch millis）。支持多种日期格式和时区。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `target_field` | string | 否 | 目标字段名，默认 `@timestamp` |
| `formats` | array | 是 | 日期格式列表，按顺序尝试 |
| `timezone` | string | 否 | 时区，默认 `UTC` |
| `locale` | string | 否 | 语言环境，默认 `ENGLISH` |
| `output_format` | string | 否 | 输出格式，默认 `yyyy-MM-dd'T'HH:mm:ss.SSSZ` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**常用日期格式速查：**

| 格式模式 | 匹配示例 |
|----------|----------|
| `yyyy-MM-dd'T'HH:mm:ss.SSSZ` | `2024-01-15T10:30:00.000+0000` |
| `yyyy-MM-dd HH:mm:ss` | `2024-01-15 10:30:00` |
| `MMM dd yyyy HH:mm:ss` | `Jan 15 2024 10:30:00` |
| `UNIX_MS` | `1705312200000`（毫秒时间戳） |
| `UNIX` | `1705312200`（秒时间戳） |
| `ISO8601` | `2024-01-15T10:30:00Z` |
| `epoch_millis` | `1705312200000` |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/date-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "date": {
          "field": "log_time",
          "target_field": "@timestamp",
          "formats": ["yyyy-MM-dd HH:mm:ss", "ISO8601"],
          "timezone": "Asia/Shanghai"
        }
      }
    ]
  }'
```

**注意事项：**

- 多个 `formats` 按顺序匹配，第一个成功即返回。
- 建议始终设置 `target_field` 为 `@timestamp`，便于 Kibana 时间序列展示。
- 源字段解析后仍保留原始字符串值，可配合 `remove` Processor 清理。
- 中国大陆用户建议使用 `timezone: "Asia/Shanghai"`。

---

### script

**概念定义：** 使用 Painless 脚本执行任意逻辑，可访问文档上下文 `ctx`。适合复杂条件判断、动态计算、字段组合等场景。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `source` | string | 否 | Painless 脚本源码（与 `id` 二选一） |
| `id` | string | 否 | 已存储脚本的 ID（与 `source` 二选一） |
| `lang` | string | 否 | 脚本语言，默认 `painless` |
| `params` | object | 否 | 脚本参数（key-value） |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/script-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "script": {
          "source": "ctx.full_name = ctx.first_name + ' ' + ctx.last_name; ctx.processed_at = new Date().getTime();"
        }
      }
    ]
  }'
```

**注意事项：**

- Script Processor 是 CPU 密集型操作，避免在高吞吐 Pipeline 中使用复杂脚本。
- `ctx` 中的字段修改会直接反映到 `_source`。
- 可通过 `ctx['_index']` 动态修改目标索引，但需谨慎使用。
- Painless 脚本语法受沙箱限制，无法执行 I/O 或网络操作。
- 建议将复杂且复用的脚本存储为 Stored Script，通过 `id` 引用。

---

### convert

**概念定义：** 将字段值从一种类型转换为另一种类型。支持 `integer`、`long`、`float`、`double`、`string`、`boolean`、`ip`、`auto` 等类型。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `type` | string | 是 | 目标类型 |
| `target_field` | string | 否 | 目标字段名，默认覆盖源字段 |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**支持的类型转换：**

| 目标类型 | 说明 |
|----------|------|
| `integer` | 32 位整数 |
| `long` | 64 位整数 |
| `float` | 32 位浮点数 |
| `double` | 64 位浮点数 |
| `string` | 字符串 |
| `boolean` | 布尔值 |
| `ip` | IP 地址 |
| `auto` | 自动推断最佳类型 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/convert-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "convert": {
          "field": "price_str",
          "target_field": "price",
          "type": "double",
          "ignore_missing": true
        }
      }
    ]
  }'
```

**注意事项：**

- `auto` 类型会尝试推断为最合适的类型，但可能有歧义（如 `"123"` 会是 integer 还是 string？）。
- `boolean` 转换规则：`"true"` / `"false"` 和 `0` / `1` 均可转换。
- `ip` 类型会验证合法 IPv4/IPv6 格式。
- 转换失败时（如 `"abc"` 转 `integer`），若不设置 `ignore_failure`，整个文档写入失败。

---

### append

**概念定义：** 向数组字段追加一个或多个元素。若字段不存在则创建数组，若字段已存在且为数组则追加，若字段为非数组类型则转为数组后追加。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 目标字段名 |
| `value` | array | 是 | 要追加的值列表 |
| `allow_duplicates` | boolean | 否 | 是否允许重复值，默认 `true` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/append-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "append": {
          "field": "tags",
          "value": ["production", "high-priority"]
        }
      }
    ]
  }'
```

**注意事项：**

- 若字段已存在且为单值（非数组），`append` 会将其转为数组 `[原值, 新值1, 新值2]`。
- `allow_duplicates: false` 时，追加前会检查元素是否已存在。
- 区分 `set`（覆盖）和 `append`（追加）的语义。

---

### json

**概念定义：** 将 JSON 字符串字段解析为 JSON 对象，并使嵌套字段可直接访问。常用于处理消息队列中序列化的 JSON 载荷。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 包含 JSON 字符串的字段名 |
| `target_field` | string | 否 | 目标字段名，默认覆盖源字段，设为根级别时用 `_root` 特殊值 |
| `add_to_root` | boolean | 否 | 是否将解析后的字段添加到文档根级别，默认 `false` |
| `add_to_root_conflict_strategy` | string | 否 | 冲突策略：`fail`、`replace`、`merge` |
| `allow_duplicate_keys` | boolean | 否 | 是否允许 JSON 中有重复键，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/json-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "json": {
          "field": "message",
          "target_field": "parsed",
          "add_to_root": false
        }
      }
    ]
  }'
```

**注意事项：**

- `add_to_root: true` + `add_to_root_conflict_strategy: "merge"` 可将 JSON 字段合并到文档根级别，这是常见模式。
- 解析失败时若不设置 `ignore_failure`，整个文档写入失败。
- 源字段中的 JSON 字符串必须是合法的 JSON 格式。

---

### foreach

**概念定义：** 对数组字段中的每个元素依次执行子 Processor。是处理数组元素的通用迭代器。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 要迭代的数组字段名 |
| `processor` | object | 是 | 对每个元素执行的子 Processor |
| `ignore_missing` | boolean | 否 | 字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**在子 Processor 中访问元素：** 使用 `_ingest._value` 引用当前迭代元素。

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/foreach-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "foreach": {
          "field": "items",
          "processor": {
            "convert": {
              "field": "_ingest._value.price",
              "type": "double"
            }
          }
        }
      }
    ]
  }'
```

**注意事项：**

- `_ingest._value` 是 foreach 上下文中独有的元数据引用。
- 嵌套 foreach 不推荐，会导致性能问题。
- 若数组元素不是对象，`_ingest._value` 直接引用该元素值。
- `ignore_missing: true` 时，字段不存在则跳过整个 foreach 块。

---

### dot_expander

**概念定义：** 将包含点号的字段名展开为嵌套对象结构。例如 `"user.name"` 展开为 `{"user": {"name": "..."}}`。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 包含点号的字段名 |
| `path` | string | 否 | 仅展开路径中匹配的字段，默认展开所有 |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/dot-expander-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "dot_expander": {
          "field": "user.name"
        }
      }
    ]
  }'
```

**注意事项：**

- 默认情况下，Elasticsearch 不允许字段名中包含点号（7.x+），此 Processor 主要用于处理历史数据或特定数据源。
- 展开后原字段会被移除。
- 若同时存在 `user.name` 和 `user` 对象，展开可能导致冲突。

---

### lowercase / uppercase

**概念定义：** 将字符串字段转换为全小写或全大写。常用于标准化枚举值、标签、状态字段。

**lowercase 核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `target_field` | string | 否 | 目标字段名，默认覆盖源字段 |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例（lowercase）：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/lowercase-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "lowercase": {
          "field": "email",
          "target_field": "email_normalized"
        }
      }
    ]
  }'
```

**REST API 示例（uppercase）：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/uppercase-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "uppercase": {
          "field": "country_code"
        }
      }
    ]
  }'
```

**注意事项：**

- 仅对字符串类型字段有效，非字符串类型需先用 `convert` 转换。
- 大小写转换遵循 Unicode 标准，对非 ASCII 字符（如德语 `ß`、中文）也有效。
- 建议使用 `target_field` 保留原始值，便于后续审计。

---

### trim

**概念定义：** 去除字符串字段首尾的空白字符（空格、制表符、换行符等）。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源字段名 |
| `target_field` | string | 否 | 目标字段名，默认覆盖源字段 |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/trim-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "trim": {
          "field": "username",
          "ignore_missing": true
        }
      }
    ]
  }'
```

**注意事项：**

- 去除的字符包括空格（` `）、制表符（`\t`）、换行符（`\n`）、回车符（`\r`）。
- 不处理字符串中间的空白字符，仅处理首尾。
- 若需同时去除中间冗余空白，应配合 `gsub` Processor 或 `script` Processor。

---

### fail

**概念定义：** 主动触发 Pipeline 失败并抛出指定错误消息。用于在满足特定条件时拒绝文档写入。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `message` | string | 是 | 错误消息（支持 `\{\{\{ }}}` 模板） |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/fail-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "fail": {
          "if": "ctx.age != null && ctx.age < 0",
          "message": "Invalid age: \{\{\{age}}}, must be non-negative"
        }
      }
    ]
  }'
```

**注意事项：**

- `fail` 通常与 `if` 条件配合使用，实现数据校验。
- 使用 `\{\{\{ }}}` Mustache 模板语法可动态引用文档字段值。
- `fail` 导致的错误会被 `on_failure` 处理器捕获，若不配置 `on_failure` 则文档写入失败。
- 典型应用场景：必填字段校验、值域范围校验、业务规则校验。

---

## Enrich Processor

### Enrich Policy

**概念定义：** Enrich Policy 定义了一个查找表（Lookup Table）的构建规则，包括源索引、匹配字段和丰富字段。Enrich Processor 在执行时根据 Policy 从查找表中获取匹配行，将丰富字段追加到当前文档。

**核心参数（Enrich Policy）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `match` | object | 否 | 精确匹配（match 类型） |
| `range` | object | 否 | 范围匹配（range 类型） |
| `geo_match` | object | 否 | 地理位置匹配（geo_match 类型） |
| `indices` | array | 是 | 源索引列表 |
| `match_field` | string | 是 | 用于匹配的字段 |
| `enrich_fields` | array | 是 | 要追加的丰富字段 |
| `query` | object | 否 | 过滤源索引的查询条件 |
| `name` | string | 否 | 排序字段名（仅 range 类型） |

**核心参数（Enrich Processor）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `policy_name` | string | 是 | 引用的 Enrich Policy 名称 |
| `field` | string | 是 | 当前文档中用于匹配的字段 |
| `target_field` | string | 是 | 丰富数据写入的目标字段 |
| `max_matches` | integer | 否 | 最大匹配行数，默认 `1` |
| `override` | boolean | 否 | 是否覆盖已有字段，默认 `true` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例 —— 创建 Policy 并执行：**

```bash
# Step 1: 创建 Enrich Policy
curl -X PUT "localhost:9200/_enrich/policy/user-enrich-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "match": {
      "indices": "user_lookup",
      "match_field": "user_id",
      "enrich_fields": ["department", "manager", "level"]
    }
  }'

# Step 2: 执行 Policy（构建查找表）
curl -X POST "localhost:9200/_enrich/policy/user-enrich-policy/_execute"

# Step 3: 创建使用 Enrich Processor 的 Pipeline
curl -X PUT "localhost:9200/_ingest/pipeline/enrich-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "enrich": {
          "policy_name": "user-enrich-policy",
          "field": "user_id",
          "target_field": "user_info",
          "max_matches": 1
        }
      }
    ]
  }'
```

**注意事项：**

- Enrich Policy 创建后必须执行 `_execute` 才会构建系统索引 `.enrich-*`。
- 源索引数据变更后需重新执行 `_execute` 以刷新查找表。
- 查找表数据存储在系统索引 `.enrich-*` 中，占用磁盘空间。
- `match` 类型基于精确匹配，`range` 类型基于数值或日期范围匹配，`geo_match` 基于地理位置匹配。

---

### 查找表（Lookup Table）

**概念定义：** 查找表是 Enrich Policy 从源索引构建的系统索引（`.enrich-*`），用于在文档写入时进行快速数据关联。查找表将外部参考数据（如用户信息、产品目录、地理编码）预加载到 Elasticsearch 内存中，避免每次写入时查询外部系统。

**查找表类型：**

| 类型 | 匹配方式 | 适用场景 |
|------|----------|----------|
| `match` | 精确匹配（term-level） | 用户 ID 匹配、产品编码匹配 |
| `range` | 数值/日期范围匹配 | IP 段匹配、时间段匹配 |
| `geo_match` | 地理多边形匹配 | 行政区划匹配、地理围栏 |

**注意事项：**

- 查找表数据量大时（>10 万行），建议使用专用节点承载 Enrich 操作。
- 查找表数据存储在 Elasticsearch 中，高频率更新需考虑 `_execute` 的执行开销。
- 查找表数据源索引的分片数会影响匹配性能，建议控制在 1-5 个分片。

---

### GeoIP 丰富

**概念定义：** 使用 GeoIP Processor 根据 IP 地址追加地理位置信息（国家、城市、经纬度、ASN 等）。Elasticsearch 内置 GeoIP 数据库（MaxMind GeoLite2），也可配置自定义数据库。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `field` | string | 是 | 源 IP 字段名 |
| `target_field` | string | 否 | 目标字段名，默认 `geoip` |
| `database_file` | string | 否 | 自定义 GeoIP 数据库文件路径 |
| `properties` | array | 否 | 要获取的 GeoIP 属性列表 |
| `first_only` | boolean | 否 | 是否仅返回第一个匹配，默认 `true` |
| `ignore_missing` | boolean | 否 | 源字段不存在时忽略，默认 `false` |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**常用 GeoIP 属性：**

| 属性 | 说明 |
|------|------|
| `continent_name` | 洲名 |
| `country_iso_code` | 国家 ISO 代码 |
| `country_name` | 国家名 |
| `region_name` | 地区/省份名 |
| `city_name` | 城市名 |
| `location` | 经纬度坐标 `{lat, lon}` |
| `timezone` | 时区 |
| `asn` | 自治系统编号 |
| `organization_name` | 组织名称 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/geoip-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "geoip": {
          "field": "client_ip",
          "target_field": "geo",
          "properties": ["country_name", "city_name", "location", "timezone"],
          "first_only": true
        }
      }
    ]
  }'
```

**注意事项：**

- Elasticsearch 默认每 3 天自动下载 GeoIP 数据库，通过 `ingest.geoip.downloader.enabled` 控制。
- 内网 IP（`10.x.x.x`、`192.168.x.x`、`172.16-31.x.x`）无法匹配 GeoIP 信息。
- 自定义 GeoIP 数据库需为 `.mmdb` 格式，放置在 `$ES_CONFIG/ingest-geoip/` 目录。
- 中国大陆用户可能需要配置代理以下载 GeoIP 数据库。

---

### IP 地理位置丰富

**概念定义：** 基于 IP 地址段（CIDR）范围匹配，将 IP 映射到自定义的地理位置或业务属性。与 GeoIP Processor 不同，IP 地理位置丰富使用自定义的 IP 段到属性的映射表。

**实现方式：** 使用 Enrich Policy 的 `range` 类型 + `ip_range` 字段：

```bash
# 创建源索引
curl -X PUT "localhost:9200/ip_mapping" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "ip_range_start": { "type": "ip" },
        "ip_range_end": { "type": "ip" },
        "datacenter": { "type": "keyword" },
        "region": { "type": "keyword" }
      }
    }
  }'

# 创建 Range Enrich Policy
curl -X PUT "localhost:9200/_enrich/policy/ip-range-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "range": {
      "indices": "ip_mapping",
      "match_field": "ip_range_start",
      "enrich_fields": ["datacenter", "region"],
      "query": {
        "range": {
          "ip_range_end": { "gte": "{{_ingest._value}}" }
        }
      }
    }
  }'
```

**注意事项：**

- 与 GeoIP 的区别：GeoIP 使用 MaxMind 数据库，IP 地理位置丰富使用自定义映射表。
- 适合内部 IDC IP 段到机房/区域的映射，补充 GeoIP 无法覆盖的私有 IP 地址。
- Range 类型 Enrich 需要 `match_field` 为 `ip_range` 或 `date_range` 等范围类型字段。

---

### 自定义数据丰富

**概念定义：** 使用 Enrich Processor 将任意外部参考数据（产品目录、用户画像、部门信息、配置数据）关联到写入文档中，实现写入时数据关联。

**典型模式：**

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  写入文档      │────▶│  Enrich Processor │────▶│  丰富后的文档      │
│  {user_id: 1} │     │  match: user_id   │     │  {user_id: 1,    │
│               │     │  policy: user-    │     │   user_info: {   │
│               │     │  enrich-policy    │     │     dept: "IT",  │
│               │     │                   │     │     level: 3     │
│               │     │                   │     │   }}             │
└──────────────┘     └──────────────────┘     └──────────────────┘
```

**REST API 示例 —— 产品目录丰富：**

```bash
# 创建产品目录索引
curl -X PUT "localhost:9200/products" \
  -H "Content-Type: application/json" \
  -d '{
    "mappings": {
      "properties": {
        "product_id": { "type": "keyword" },
        "product_name": { "type": "text" },
        "category": { "type": "keyword" },
        "unit_price": { "type": "double" }
      }
    }
  }'

# 创建 Enrich Policy
curl -X PUT "localhost:9200/_enrich/policy/product-enrich-policy" \
  -H "Content-Type: application/json" \
  -d '{
    "match": {
      "indices": "products",
      "match_field": "product_id",
      "enrich_fields": ["product_name", "category", "unit_price"]
    }
  }'

# 执行 Policy
curl -X POST "localhost:9200/_enrich/policy/product-enrich-policy/_execute"

# 创建 Pipeline
curl -X PUT "localhost:9200/_ingest/pipeline/order-enrich" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "enrich": {
          "policy_name": "product-enrich-policy",
          "field": "product_id",
          "target_field": "product_info"
        }
      }
    ]
  }'
```

**注意事项：**

- 参考数据变更后必须重新执行 `_execute`。
- 匹配字段必须是 `keyword` 类型以确保精确匹配。
- 源索引数据量大时建议控制 `enrich_fields` 数量，减少内存占用。
- 若匹配到多行，`max_matches` 控制返回最大行数，默认仅返回第一行。

---

## Inference Processor

### 推理处理器

**概念定义：** Inference Processor 是 8.x 引入的机器学习推理处理器，可在文档写入时调用已部署的 NLP/ML 模型对文档字段进行推理，将推理结果写入文档。支持 Elastic 内置模型、第三方模型（通过 Eland 导入）和自定义模型。

**核心参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model_id` | string | 是 | 已部署的模型 ID |
| `input_output` | array | 否 | 输入字段到输出字段的映射 |
| `target_field` | string | 否 | 推理结果写入的目标字段 |
| `field_map` | object | 否 | 字段映射（输入字段到模型输入字段） |
| `inference_config` | object | 否 | 推理配置（如分类阈值） |
| `ignore_failure` | boolean | 否 | 失败时是否忽略，默认 `false` |
| `if` | string | 否 | 条件表达式 |

**REST API 示例 —— 文本分类推理：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/inference-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "inference": {
          "model_id": "lang_ident_model_1",
          "target_field": "ml",
          "field_map": {
            "message": "text_field"
          },
          "inference_config": {
            "classification": {
              "num_top_classes": 3
            }
          }
        }
      }
    ]
  }'
```

**注意事项：**

- 模型必须先通过 `_ml/trained_models/{model_id}/deployment/_start` 部署。
- 推理是 CPU/内存密集型操作，建议使用专用 ML Node。
- `field_map` 将文档字段映射到模型期望的输入字段名。
- 推理失败时若未设置 `ignore_failure`，整个文档写入失败。

---

### 写入时自动生成 Embedding

**概念定义：** 在文档写入时，使用 Inference Processor 调用文本嵌入模型（如 ELSER、BERT、E5 等），自动将文本字段转换为向量（Embedding），写入 `dense_vector` 字段，用于后续的向量相似度搜索（kNN）。

**核心流程：**

```
写入文档 { text: "hello world" }
    │
    ▼
Inference Processor (model_id: elser-v2)
    │
    ▼
{ text: "hello world", embedding: [0.12, -0.34, 0.56, ...] }
```

**REST API 示例 —— ELSER v2 嵌入生成：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/embedding-pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "inference": {
          "model_id": ".elser_model_2",
          "target_field": "ml",
          "field_map": {
            "content": "text_field"
          },
          "inference_config": {
            "text_expansion": {
              "results_field": "tokens"
            }
          }
        }
      }
    ]
  }'
```

**注意事项：**

- ELSER 是 Elastic 自有的稀疏向量模型，适合语义搜索。
- 密集向量模型（如 `all-MiniLM-L6-v2`）需通过 Eland 导入。
- 向量维度和索引 Mapping 中的 `dims` 必须一致。
- 生成 Embedding 的计算开销较大，高吞吐场景需评估性能。

---

### NLP 模型集成

**概念定义：** Elasticsearch 8.x 通过 PyTorch 模型集成支持多种 NLP 任务，包括命名实体识别（NER）、情感分析、文本分类、零样本分类、文本嵌入、填空等。模型通过 Eland 客户端导入并部署。

**支持的 NLP 任务类型：**

| 任务类型 | 说明 | 典型模型 |
|----------|------|----------|
| `text_classification` | 文本分类 | `distilbert-base-uncased` |
| `zero_shot_classification` | 零样本分类 | `facebook/bart-large-mnli` |
| `text_embedding` | 文本向量化 | `sentence-transformers/all-MiniLM-L6-v2` |
| `named_entity_recognition` | 命名实体识别 | `dslim/bert-base-NER` |
| `fill_mask` | 填空任务 | `bert-base-uncased` |
| `text_expansion` | 稀疏向量扩展 | `.elser_model_2`（内置） |
| `question_answering` | 问答抽取 | `distilbert-base-cased-distilled-squad` |

**模型导入流程（Eland）：**

```bash
# 安装 Eland
pip install eland[pytorch]

# 导入模型到 Elasticsearch
eland_import_hub_model \
  --url http://localhost:9200 \
  --hub-model-id sentence-transformers/all-MiniLM-L6-v2 \
  --task-type text_embedding \
  --start
```

**NER 模型 Pipeline 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/ner-pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "inference": {
          "model_id": "dslim__bert-base-ner",
          "target_field": "entities",
          "field_map": {
            "document": "text_field"
          }
        }
      }
    ]
  }'
```

**注意事项：**

- PyTorch 模型需要 `xpack.ml.enabled: true` 且至少有一个 ML Node。
- 模型通过 Eland 导入后会存储在 `.ml-models-*` 系统索引中。
- 模型部署会占用内存（通常 200MB - 2GB），需合理规划集群资源。
- Elasticsearch 8.11+ 支持内置 ELSER v2 和 E5 模型，无需通过 Eland 导入。

---

## Pipeline 管理

### 条件语句（if）

**概念定义：** 每个 Processor 都支持 `if` 条件语句，使用 Painless 脚本语法在运行时判断是否执行该 Processor。条件表达式可访问 `ctx` 上下文（即文档 `_source`）和部分元数据。

**条件语法要素：**

| 要素 | 说明 | 示例 |
|------|------|------|
| `ctx.field` | 访问文档字段 | `ctx.status == 'active'` |
| `ctx['field']` | 字段名含特殊字符时使用 | `ctx['@timestamp']` |
| `!= null` | 空值检查 | `ctx.email != null` |
| `contains` | 字符串包含 | `ctx.message.contains('ERROR')` |
| `instanceof` | 类型检查 | `ctx.tags instanceof List` |
| `&&` / `\|\|` | 逻辑与/或 | `ctx.age > 18 && ctx.age < 65` |
| `=~` | 正则匹配 | `ctx.email =~ /.*@example\\.com/` |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/conditional-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "set": {
          "if": "ctx.log_level == null",
          "field": "log_level",
          "value": "INFO"
        }
      },
      {
        "uppercase": {
          "if": "ctx.country_code != null && ctx.country_code.length() == 2",
          "field": "country_code"
        }
      }
    ]
  }'
```

**注意事项：**

- `if` 条件中的字段访问使用 `ctx.field` 而非 `ctx._source.field`。
- 条件中不支持 Mustache 模板，仅支持 Painless 表达式。
- 条件失败（如类型错误）会导致 Processor 失败，可配合 `ignore_failure` 使用。
- 复杂条件逻辑建议提取到 `script` Processor 中。

---

### 错误处理（on_failure / ignore_failure）

**概念定义：** Pipeline 提供两种错误处理机制：`ignore_failure`（处理器级别，忽略单个 Processor 的错误并继续执行）和 `on_failure`（Pipeline 级别，当 Processor 失败时执行回退处理器组）。

**对比：**

| 机制 | 级别 | 行为 |
|------|------|------|
| `ignore_failure` | Processor 级 | 忽略该 Processor 的错误，继续执行下一个 Processor |
| `on_failure` | Processor 级 / Pipeline 级 | 失败时执行一组回退 Processor，不继续执行后续 Processor |

**`on_failure` 可访问的元数据：**

| 元数据字段 | 说明 |
|------------|------|
| `on_failure_message` | 错误消息 |
| `on_failure_processor_type` | 失败 Processor 的类型 |
| `on_failure_processor_tag` | 失败 Processor 的 tag |
| `on_failure_pipeline` | 失败的 Pipeline 名称 |

**REST API 示例：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/error-handling-demo" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "grok": {
          "field": "message",
          "patterns": ["%{TIMESTAMP_ISO8601:ts} %{LOGLEVEL:level} %{GREEDYDATA:msg}"],
          "ignore_failure": false,
          "on_failure": [
            {
              "set": {
                "field": "error_info",
                "value": "Grok parse failed: {{ _ingest.on_failure_message }}"
              }
            },
            {
              "set": {
                "field": "raw_message",
                "value": "\{\{\{message}}}"
              }
            }
          ]
        }
      }
    ]
  }'
```

**注意事项：**

- `on_failure` 中的 Processor 若再次失败，错误会向上传播。
- `on_failure` 块中建议使用 `ignore_failure: true` 避免二次失败。
- `ignore_failure: true` 时，`on_failure` 块不会执行。
- 在 `on_failure` 中可将错误信息写入文档，便于后续排查（如写入 `_index` 为 `failed-*` 的索引）。

---

### Pipeline 版本管理

**概念定义：** Pipeline 本身没有内置版本号字段，但可通过命名约定（如 `my-pipeline-v1`、`my-pipeline-v2`）、Pipeline 元数据中的 `version` 字段或 `description` 字段实现版本管理。

**版本管理策略：**

| 策略 | 实现方式 | 优点 | 缺点 |
|------|----------|------|------|
| 命名版本 | `pipeline-name-v1`、`pipeline-name-v2` | 简单直观，可并行保留多个版本 | 索引模板需更新引用 |
| 元数据版本 | `"_meta": {"version": 2}` | Pipeline 名不变，减少索引模板变更 | 无法同时保留多个版本 |
| Git 管理 | 将 Pipeline JSON 纳入 Git 仓库 | 可追溯、可审核、可回滚 | 需额外 CI/CD 流程 |

**REST API 示例 —— 使用 `_meta` 字段：**

```bash
curl -X PUT "localhost:9200/_ingest/pipeline/my-pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Main data pipeline",
    "version": 2,
    "_meta": {
      "version": 2,
      "author": "team-backend",
      "updated_at": "2024-01-15",
      "changelog": "Added GeoIP enrichment"
    },
    "processors": [
      { "set": { "field": "pipeline_version", "value": 2 } }
    ]
  }'
```

**注意事项：**

- `version` 字段（Elasticsearch 内置）仅用于乐观并发控制，不保证语义版本。
- 建议将 Pipeline JSON 文件纳入版本控制系统（Git），实现 Infrastructure as Code。
- 更新 Pipeline 时会立即影响所有通过该 Pipeline 写入的文档。
- 索引模板中引用 Pipeline 时，修改 Pipeline 名称后需同步更新索引模板。

---

### Simulate API 调试

**概念定义：** Simulate API 允许在不实际索引文档的情况下测试 Pipeline 行为。提供测试文档和期望的输出，验证 Pipeline 的 Processor 执行结果。

**核心端点：**

| 端点 | 用途 |
|------|------|
| `POST /_ingest/pipeline/_simulate` | 测试指定 Pipeline 定义（内联） |
| `POST /_ingest/pipeline/{id}/_simulate` | 测试已存在的 Pipeline |

**REST API 示例：**

```bash
curl -X POST "localhost:9200/_ingest/pipeline/_simulate" \
  -H "Content-Type: application/json" \
  -d '{
    "pipeline": {
      "processors": [
        {
          "set": {
            "field": "env",
            "value": "production"
          }
        },
        {
          "grok": {
            "field": "message",
            "patterns": ["%{IP:client_ip} %{GREEDYDATA:rest}"]
          }
        }
      ]
    },
    "docs": [
      {
        "_index": "test",
        "_id": "1",
        "_source": {
          "message": "192.168.1.100 GET /api/v1/users"
        }
      },
      {
        "_index": "test",
        "_id": "2",
        "_source": {
          "message": "10.0.0.5 POST /api/v1/orders"
        }
      }
    ]
  }'
```

**注意事项：**

- Simulate 不会实际写入数据，对集群无副作用。
- 建议在 CI/CD 流程中集成 Simulate API 实现 Pipeline 变更的自动化测试。
- 测试文档应覆盖边界情况（缺失字段、异常值、空值）。
- 对于 Enrich Processor，Simulate 需要 Enrich Policy 已执行（查找表已构建）。

---

### 默认 Pipeline（default_pipeline）

**概念定义：** 在索引设置中配置 `index.default_pipeline`，指定该索引所有写入请求默认执行的 Pipeline。无需在每次写入时指定 `pipeline` 参数。

**配置方式：**

| 配置项 | 说明 |
|--------|------|
| `index.default_pipeline` | 索引默认 Pipeline，所有写入自动执行 |
| `index.final_pipeline` | 最终 Pipeline，在默认 Pipeline 之后执行 |

**REST API 示例：**

```bash
# 创建 Pipeline
curl -X PUT "localhost:9200/_ingest/pipeline/default-logs" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      { "set": { "field": "indexed_at", "value": "{{_ingest.timestamp}}" } }
    ]
  }'

# 创建索引时绑定默认 Pipeline
curl -X PUT "localhost:9200/app-logs" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index.default_pipeline": "default-logs"
    }
  }'

# 或更新已有索引
curl -X PUT "localhost:9200/app-logs/_settings" \
  -H "Content-Type: application/json" \
  -d '{
    "index.default_pipeline": "default-logs"
  }'
```

**注意事项：**

- `default_pipeline` 对 `_bulk`、`_index`、`_update` 等所有写入操作生效。
- 写入请求中显式指定 `pipeline` 参数会覆盖 `default_pipeline`。
- 设置 `default_pipeline: "_none"` 可禁用默认 Pipeline。
- 索引模板中推荐配置 `default_pipeline`，确保所有匹配的索引自动应用。

---

### 最终 Pipeline（final_pipeline）

**概念定义：** `index.final_pipeline` 在 `default_pipeline` 和请求级 Pipeline 之后执行，且无法被覆盖或跳过。适合用于强制性的审计日志、安全标记、合规字段等场景。

**执行顺序：**

```
请求级 Pipeline（若指定）
    │
    ▼
default_pipeline（若配置）
    │
    ▼
final_pipeline（若配置，总是执行）
    │
    ▼
写入索引
```

**REST API 示例：**

```bash
# 创建审计 Pipeline
curl -X PUT "localhost:9200/_ingest/pipeline/audit-pipeline" \
  -H "Content-Type: application/json" \
  -d '{
    "processors": [
      {
        "set": {
          "field": "audit.ingested_at",
          "value": "{{_ingest.timestamp}}"
        }
      },
      {
        "set": {
          "field": "audit.pipeline_info",
          "value": "{{_ingest.pipeline}}"
        }
      }
    ]
  }'

# 绑定 final_pipeline
curl -X PUT "localhost:9200/secure-index" \
  -H "Content-Type: application/json" \
  -d '{
    "settings": {
      "index.final_pipeline": "audit-pipeline"
    }
  }'
```

**注意事项：**

- `final_pipeline` 总是执行，用户无法在写入请求中跳过。
- 若 `final_pipeline` 失败，整个文档写入失败，除非 Processor 配置了 `ignore_failure`。
- 适合安全合规场景（如强制添加数据分类标记、访问审计日志）。
- `final_pipeline` 中可通过 `_ingest.pipeline` 获取上游 Pipeline 名称。

---

## 性能优化

### Pipeline 执行顺序

**概念定义：** Pipeline 中的 Processor 按数组顺序串行执行，每个 Processor 的输出是下一个 Processor 的输入。理解执行顺序有助于优化 Pipeline 性能。

**执行顺序原则：**

```
文档 → Processor 1 → Processor 2 → ... → Processor N → 索引
        │ 失败时                        │
        └── on_failure 块 ──────────────┘
```

| 原则 | 说明 |
|------|------|
| 串行执行 | Processor 按声明顺序依次执行，不并行 |
| 短路失败 | 某 Processor 失败且无 `ignore_failure`/`on_failure`，Pipeline 终止 |
| 结果可传递 | 前一个 Processor 的修改对后续 Processor 立即可见 |
| 条件跳过 | `if` 为 `false` 时跳过该 Processor |
| 先验证后转换 | 建议先做字段存在性检查，再做类型转换 |
| 先删除后添加 | 先用 `remove` 清理不需要的字段，减少后续处理的数据量 |

**最优顺序建议：**

```
1. remove     → 删除无用字段，减少数据体积
2. grok/json  → 解析非结构化数据
3. convert    → 类型转换
4. date       → 日期解析
5. set        → 默认值填充
6. rename     → 字段重命名
7. enrich     → 数据丰富（最耗时，放最后）
8. trim/lowercase → 标准化
```

**注意事项：**

- `enrich` 和 `geoip` 涉及索引查找，耗时较长，建议放在 Pipeline 靠后的位置。
- `grok` 是 CPU 密集型操作，避免在 Pipeline 中使用多个 Grok Processor。
- 字段删除应尽早执行，减少后续 Processor 处理的数据量。

---

### 避免复杂脚本

**概念定义：** `script` Processor 是最灵活的 Processor，但也是性能开销最大的。应优先使用内置 Processor 实现相同功能，避免不必要的 Painless 脚本。

**性能对比（相对开销）：**

| Processor | 相对开销 | 说明 |
|-----------|----------|------|
| `set` / `remove` / `rename` | 1x | 几乎无开销 |
| `convert` / `trim` / `lowercase` | 1x | 简单字符串操作 |
| `split` / `join` | 2x | 少量字符串操作 |
| `grok` | 5-10x | 正则匹配，CPU 密集 |
| `script` | 10-50x | 取决于脚本复杂度 |
| `enrich` / `geoip` | 10-20x | 索引查找 |
| `inference` | 100-500x | ML 模型推理 |

**脚本优化建议：**

| 优化项 | 说明 |
|--------|------|
| 用内置 Processor 替代 | `set` + `if` 替代简单条件脚本 |
| 提取参数 | 使用 `params` 传递外部参数，避免硬编码 |
| 避免循环 | 遍历大数组的脚本应改为 `foreach` + 内置 Processor |
| 预编译 | 将复用脚本存储为 Stored Script |
| 限制字段访问 | 仅访问需要的字段，避免 `ctx` 全量遍历 |

**不推荐的脚本写法：**

```painless
// 不推荐：循环遍历大数组
for (item in ctx.items) {
    item.price = Double.parseDouble(item.priceStr);
}
```

**推荐的替代方案：**

```json
{
  "foreach": {
    "field": "items",
    "processor": {
      "convert": {
        "field": "_ingest._value.priceStr",
        "target_field": "_ingest._value.price",
        "type": "double"
      }
    }
  }
}
```

**注意事项：**

- Painless 脚本编译有缓存，但首次执行仍需编译开销。
- 脚本中的正则表达式操作比 Grok Processor 更慢。
- 建议对 Pipeline 进行基准测试，量化每个 Processor 的耗时。

---

### 批量处理建议

**概念定义：** 通过 `_bulk` API 批量写入时，Pipeline 对每个文档独立执行。合理配置批量大小和 Pipeline 复杂度可显著提升吞吐量。

**批量写入与 Pipeline 的交互：**

| 配置项 | 建议值 | 说明 |
|--------|--------|------|
| Bulk 大小 | 500-1500 文档 | 太小则网络开销大，太大则内存压力大 |
| Bulk 大小（字节） | 5-15 MB | 按字节限制，避免单次请求过大 |
| Pipeline 复杂度 | Processor 数 < 10 | 简单 Pipeline 可支持更高吞吐 |
| 并发请求 | 2-5 个 Bulk 线程 | 取决于 Ingest Node 核心数 |

**REST API 示例 —— 批量写入指定 Pipeline：**

```bash
curl -X POST "localhost:9200/_bulk?pipeline=my-pipeline" \
  -H "Content-Type: application/json" \
  -d '
{ "index": { "_index": "logs", "_id": "1" } }
{ "message": "192.168.1.1 - - [15/Jan/2024:10:30:00 +0000] \"GET /api HTTP/1.1\" 200 1234" }
{ "index": { "_index": "logs", "_id": "2" } }
{ "message": "10.0.0.1 - - [15/Jan/2024:10:30:01 +0000] \"POST /api/users HTTP/1.1\" 201 567" }
'
```

**注意事项：**

- `_bulk` 中的每个文档独立执行 Pipeline，一个文档的 Pipeline 失败不影响其他文档。
- 批量写入时 Pipeline 错误会记录在 `_bulk` 响应的每个 item 中。
- 高吞吐场景建议使用专用 Ingest Node，避免影响 Data Node 的数据写入性能。
- 建议监控 `thread_pool.bulk` 和 `thread_pool.write` 的拒绝次数。

---

### Pipeline 监控

**概念定义：** 通过 Elasticsearch 的 Node Stats API 和 Ingest Pipeline Metrics 监控 Pipeline 的执行性能，包括执行次数、失败次数、耗时统计等。

**关键监控指标：**

| 指标 | API 路径 | 说明 |
|------|----------|------|
| Pipeline 执行次数 | `_nodes/stats/ingest?metric=pipelines` | 每个 Pipeline 的总执行次数 |
| Pipeline 失败次数 | 同上 | 每个 Pipeline 的失败次数 |
| Pipeline 耗时 | 同上 | 各 Pipeline 的累计耗时和当前耗时 |
| Processor 耗时 | 同上 | 各 Processor 的时间统计 |
| Ingest 线程池 | `_nodes/stats/thread_pool` | 查看 `ingest` 线程池队列和拒绝 |

**REST API 示例 —— 查看 Pipeline 统计：**

```bash
# 查看所有 Ingest 统计
curl -X GET "localhost:9200/_nodes/stats/ingest"

# 查看特定 Pipeline 统计
curl -X GET "localhost:9200/_nodes/stats/ingest/my-pipeline"

# 查看线程池统计
curl -X GET "localhost:9200/_nodes/stats/thread_pool?pretty" | grep -A 10 ingest
```

**告警建议：**

| 告警条件 | 说明 | 建议操作 |
|----------|------|----------|
| `ingest_failed > ingest_total * 0.01` | 失败率超过 1% | 检查 Pipeline 逻辑和输入数据质量 |
| `ingest_time_in_millis > 1000` | 单次 Pipeline 耗时 > 1 秒 | 优化 Processor 顺序，减少复杂脚本 |
| `thread_pool.ingest.rejected > 0` | Ingest 线程池有拒绝 | 增加 Ingest Node 或优化 Pipeline |
| `enrich.*.ingest_time > 500` | Enrich 耗时 > 500ms | 检查查找表大小，优化源索引分片 |

**注意事项：**

- Ingest 统计信息是节点级别的，需汇总所有节点数据。
- 建议通过 Kibana Stack Monitoring 或 Elastic APM 进行可视化监控。
- 长时间运行的 Pipeline 会阻塞 Ingest 线程池，影响整体吞吐。
- 推荐使用 `_cluster/health` 监控集群状态，结合 `_nodes/hot_threads` 排查 CPU 热点。

---

