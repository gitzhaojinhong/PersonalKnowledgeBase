## ES|QL 概述

### 设计目标与定位

**概念定义**

ES|QL（Elasticsearch Query Language）是 Elasticsearch 自 8.11 引入、8.14 GA 的全新管道式查询语言。它由全新的查询引擎驱动，支持并发处理，提供高级搜索能力，无论数据源和结构如何。ES|QL 的目标是提供一种单一、统一、强大的查询语言，覆盖搜索、过滤、聚合、数据转换、数据丰富等全链路场景，替代过去需要组合 DSL 查询、脚本、聚合、管道聚合等分散能力才能完成的任务。

**核心定位**

| 维度 | 定位 |
|------|------|
| 语言范式 | 管道式声明语言（Pipe-based declarative language） |
| 执行引擎 | 全新 ES|QL 引擎，支持并发执行 |
| 版本状态 | 8.11 技术预览 → 8.14 GA → 9.x 持续增强 |
| 适用场景 | 搜索、日志分析、安全调查、可观测性、数据探索 |
| 标准接口 | REST `/_query` API + Kibana Discover + Java Client |

**REST API 示例**

```bash
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | LIMIT 10"
  }'
```

**注意事项**

- ES|QL 查询必须从源命令（FROM / ROW / SHOW）开始
- 默认隐式 LIMIT 为 1000 行（无显式 LIMIT 时）
- Kibana Discover 中最大显示 10000 行；聚合在全量数据上执行
- 关键字不区分大小写（`FROM` 与 `from` 等效）

---

### 与 DSL 对比

**概念定义**

ES|QL 与 Elasticsearch Query DSL 是两种不同层次的查询方式。DSL 是基于 JSON 的声明式查询语言，通过构造 JSON 对象描述查询逻辑；ES|QL 是管道式查询语言，通过管道符串联命令链完成搜索、转换、聚合。

**对比速查表**

| 对比维度 | ES|QL | Query DSL |
|----------|------|-----------|
| 语法形式 | 管道式文本（类似 SQL 管道） | 嵌套 JSON 结构 |
| 学习曲线 | 低（接近 SQL 直觉） | 中高（JSON 嵌套、理解上下文） |
| 多步骤操作 | 单次请求完成搜索+转换+聚合 | 需多次请求或组合脚本 |
| 聚合能力 | 内置 STATS 命令 | 需要独立聚合 DSL |
| 字段计算 | EVAL 即时计算 | 需 Script 或运行时字段 |
| 数据丰富 | ENRICH / LOOKUP JOIN | 无法直接实现 |
| 响应格式 | 表结构（行列） | 嵌套 JSON（hits + aggregations） |
| 性能模型 | 并发管道执行 | 分阶段串行执行 |
| 字符串解析 | DISSECT / GROK 原生支持 | 需自定义脚本 |
| 全文搜索 | MATCH / QSTR 函数 | match / query_string 查询 |

**同场景对比示例**

DSL 方式（搜索 + 过滤 + 聚合）：
```json
{
  "query": {
    "bool": {
      "must": [{ "match": { "message": "error" } }],
      "filter": [{ "range": { "@timestamp": { "gte": "now-1h" } } }]
    }
  },
  "aggs": {
    "by_host": {
      "terms": { "field": "host.name" },
      "aggs": {
        "avg_cpu": { "avg": { "field": "system.cpu.usage" } }
      }
    }
  }
}
```

ES|QL 方式（等效）：
```sql
FROM logs-*
| WHERE @timestamp > NOW() - 1hour AND MATCH(message, "error")
| STATS avg_cpu = AVG(system.cpu.usage) BY host.name
| SORT avg_cpu DESC
| LIMIT 20
```

**注意事项**

- ES|QL 和 DSL 可以通过 `filter` 参数组合使用（DSL 作为预过滤）
- 复杂嵌套聚合（如 date_histogram 内嵌 terms）当前 ES|QL 支持有限，但 9.x 持续改进
- DSL 查询不能转换成 ES|QL；ES|QL 不可替代所有 DSL 场景（如 geo_shape 查询）

---

### 与 EQL 对比

**概念定义**

EQL（Event Query Language）是 Elasticsearch 引入的面向事件序列的查询语言，专为安全分析和时间线调查设计，核心能力是匹配事件序列模式（Sequence）。ES|QL 是通用管道查询语言，面向更广泛的搜索、聚合、转换场景。

**对比速查表**

| 对比维度 | ES|QL | EQL |
|----------|------|-----|
| 设计目标 | 通用搜索与聚合 | 安全事件序列匹配 |
| 核心能力 | 管道式搜索+转换+聚合 | 事件序列模式匹配 |
| 序列匹配 | 不支持 | 原生支持（sequence / join） |
| 聚合函数 | 丰富（COUNT/SUM/AVG/MAX/MIN...） | 有限 |
| 数据转换 | EVAL / DISSECT / GROK / ENRICH | 不支持 |
| 时间窗口 | 通过 WHERE 灵活控制 | 内置 max_span 事件窗口 |
| 适用场景 | 日志分析、可观测性、通用搜索 | 安全威胁检测、异常序列 |
| GA 版本 | 8.14 | 7.10（基础） |

**语法差异示例**

EQL 查询（序列匹配）：
```sql
sequence by host.name
  [file where event.action == "creation"]
  [process where event.action == "start"]
until 10m
```

ES|QL 查询（统计分析）：
```sql
FROM logs-*
| WHERE event.action IN ("creation", "start")
| STATS event_count = COUNT(*) BY host.name, event.action
| SORT event_count DESC
```

**注意事项**

- EQL 擅长检测"事件 A 之后发生事件 B"的模式，ES|QL 无法替代
- ES|QL 可以对 EQL 的原始数据进行聚合和可视化
- 9.x 中 ES|QL 的 INLINESTATS 等新特性进一步拓展了分析能力边界
- 安全场景下，EQL 用于检测规则，ES|QL 用于调查和可视化

---

## 基本语法

### FROM 源选择

**概念定义**

`FROM` 是 ES|QL 最核心的源命令，从数据流、索引或别名中检索数据，返回表结构。每个 ES|QL 查询必须以源命令开头，`FROM` 是使用频率最高的源命令。支持通配符、日期数学表达式、跨集群查询和元数据字段提取。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `index_pattern` | string | 是 | 索引、数据流或别名名称，支持通配符（`*`）和逗号分隔列表 |
| `METADATA fields` | keyword | 否 | 启用元数据字段，如 `_id`、`_index`、`_version`、`_score` |

**REST API 示例**

```bash
# 基础查询
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees | LIMIT 5"}'

# 多索引 + 通配符
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees-00001,other-employees-* | LIMIT 5"}'

# 日期数学表达式
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM <logs-{now/d}> | LIMIT 10"}'

# 跨集群查询
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM cluster_one:employees-*,cluster_two:departments-* | LIMIT 10"}'

# 提取元数据字段
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees METADATA _id, _index, _version | LIMIT 5"}'

# 特殊字符索引名转义
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM \"this=that\", \"\"\"this[that\"\"\" | LIMIT 5"}'
```

**注意事项**

- 默认隐式 LIMIT 为 1000，除非显式指定 LIMIT
- 索引模式支持 Lucene 通配符（`*` 匹配任意字符，不支持 `?`）
- 日期数学必须用尖括号 `<>` 包裹，索引名包含特殊字符时用双引号或三重引号转义
- 跨集群查询需要先配置远程集群（CCS）
- `METADATA` 字段不会自动包含在结果中，必须在 `FROM` 中显式声明
- 使用 `KEEP *` 可显示所有字段为独立列

---

### WHERE 条件过滤

**概念定义**

`WHERE` 处理命令根据指定条件过滤行，保留满足条件的行，丢弃不满足的行。支持丰富的比较运算符、逻辑运算符、全文搜索函数、NULL 判断和类型转换。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `condition` | expression | 是 | 布尔表达式，支持比较、逻辑、NULL 判断、函数调用 |

**常用运算符**

| 运算符 | 说明 | 示例 |
|--------|------|------|
| `==` | 等于（区分 null） | `WHERE status == 200` |
| `!=` | 不等于 | `WHERE status != 404` |
| `<` / `<=` / `>` / `>=` | 大小比较 | `WHERE response_time > 500` |
| `AND` / `OR` / `NOT` | 逻辑运算 | `WHERE status == 200 AND method == "GET"` |
| `IS NULL` / `IS NOT NULL` | 空值判断 | `WHERE error.message IS NOT NULL` |
| `IN` | 列表匹配 | `WHERE status IN (200, 201, 204)` |
| `LIKE` / `RLIKE` | 通配符/正则匹配 | `WHERE message LIKE "error*"` |
| `BETWEEN` | 范围 | `WHERE response_time BETWEEN 200 AND 500` |
| `MATCH()` | 全文搜索 | `WHERE MATCH(message, "error timeout")` |
| `QSTR()` | 查询字符串 | `WHERE QSTR(message, "error AND timeout")` |

**REST API 示例**

```bash
# 基础比较
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM logs-* | WHERE status == 500 | LIMIT 10"}'

# 组合条件
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM logs-* | WHERE status >= 400 AND response_time > 1000 | LIMIT 10"}'

# 时间范围
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM logs-* | WHERE @timestamp > NOW() - 1hour | LIMIT 10"}'

# 参数化查询（防注入）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | WHERE status == ?status AND response_time > ?threshold | LIMIT 10",
    "params": [{"status": 500}, {"threshold": 1000}]
  }'
```

**注意事项**

- `==` 用于等值比较时区分 NULL（`NULL == NULL` 返回 `null`），使用 `IS NULL` 判断空值
- 字符串比较区分大小写；使用 `LOWER()` 函数可以实现不区分大小写
- 索引字段名包含特殊字符时需用反引号包裹（如 `` `@timestamp` ``）
- 使用参数化查询（`?` 占位符）防止 ES|QL 注入，推荐在生产环境使用
- `WHERE` 在管道中尽早执行可以提升性能（减少后续处理的数据量）

---

### 字段处理（EVAL / RENAME / DROP / KEEP）

**概念定义**

字段处理命令用于在管道中增删改列。`EVAL` 添加计算列；`RENAME` 重命名列；`DROP` 删除列；`KEEP` 保留指定列（等价于删除其他所有列）。这些命令是数据转换链的核心组成。

**核心参数**

| 命令 | 语法 | 参数说明 |
|------|------|----------|
| `EVAL` | `EVAL col1 = expr1 [, ..., colN = exprN]` | `col`：列名；`expr`：表达式、字面量或函数 |
| `RENAME` | `RENAME old1 AS new1 [, ..., oldN AS newN]` | `old`：原列名；`new`：新列名 |
| `DROP` | `DROP col1 [, ..., colN]` | 列名列表，支持通配符 |
| `KEEP` | `KEEP col1 [, ..., colN]` | 列名列表，支持通配符和 `*` |

**REST API 示例**

```bash
# EVAL：计算新列
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM employees | KEEP first_name, last_name, salary | EVAL annual_salary = salary * 12, bonus = salary * 0.1 | LIMIT 5"
  }'

# RENAME：重命名列
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM employees | KEEP first_name, salary | RENAME first_name AS name, salary AS monthly_pay | LIMIT 5"
  }'

# DROP：删除列
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM employees | DROP gender, hire_date, *_email | LIMIT 5"
  }'

# KEEP：保留指定列
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM employees | KEEP first_name, last_name, salary, department | LIMIT 5"
  }'
```

**注意事项**

- `EVAL` 中列名若与已有列名冲突，旧列会被覆盖（删除后添加新列）
- `EVAL` 列名可选：若省略 `col =`，新列名等于表达式文本（如 `EVAL salary * 12` 创建列 `` `salary * 12` ``）
- `DROP` 和 `KEEP` 支持通配符（`*`），`KEEP *` 保留所有字段
- 字段处理命令在管道中可以任意位置出现，执行顺序从上到下
- `EVAL` 中可以使用 `CASE(...)` 实现条件表达式（9.x 支持）

---

### 管道操作符（| 管道符）

**概念定义**

管道操作符 `|` 是 ES|QL 的核心语法元素，用于串联命令，将前一个命令的输出作为后一个命令的输入。数据从左到右流经管道链，每个命令对中间结果表进行操作。管道模式是 ES|QL 区别于 DSL 的根本设计差异。

**执行模型**

```
FROM source                  -- 源命令：生成初始表
| WHERE condition            -- 行过滤：减少行数
| EVAL new_col = expression  -- 列扩展：增加列
| STATS agg BY group         -- 聚合：分组汇总
| SORT col DESC              -- 排序
| LIMIT N                    -- 截断
```

**核心参数**

| 概念 | 说明 |
|------|------|
| 管道链 | 命令序列，用 `|` 分隔，从上到下执行 |
| 中间表 | 每个命令处理后的临时结果表，对后续命令可见 |
| 命令顺序 | 影响性能和结果；WHERE 尽早执行可减少后续数据量 |
| 多行格式 | 每行一个命令（推荐），也支持单行写法 |

**REST API 示例**

```bash
# 多行管道（推荐格式）
curl -X POST "http://localhost:9200/_query?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE @timestamp > NOW() - 1hour
      | EVAL response_time_ms = response_time * 1000
      | STATS avg_time = AVG(response_time_ms), max_time = MAX(response_time_ms) BY status
      | SORT avg_time DESC
      | LIMIT 10
    """
  }'

# 单行管道（等效）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM logs-* | WHERE @timestamp > NOW() - 1hour | STATS count = COUNT(*) BY status | SORT count DESC | LIMIT 5"}'
```

**注意事项**

- 管道符 `|` 前后空格不强制，但推荐保留空格增强可读性
- 命令顺序至关重要：先 `WHERE` 过滤，再 `EVAL` 计算，最后 `STATS` 聚合
- 切勿在 `STATS` 之后使用 `WHERE` 过滤原始字段（原始字段在聚合后已不存于中间表）
- Kibana 控制台推荐使用三重引号 `"""` 包裹多行查询
- 管道链中的所有命令异步并发执行（引擎内部优化），无需手动优化并行度

---

## 数据聚合

### STATS 聚合命令

**概念定义**

`STATS ... BY` 是 ES|QL 的聚合处理命令，对输入表的行进行分组聚合计算，生成汇总结果表。它是 ES|QL 数据分析的核心命令，等效于 SQL 的 `SELECT ... GROUP BY` 或 DSL 的 `aggs`。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `aggregate_expression` | expression | 是 | 至少一个聚合表达式，如 `count = COUNT(*)` |
| `BY grouping_field` | field | 否 | 分组字段，不指定时全表聚合为一行 |

**聚合命名规则**

```sql
STATS [new_col_name =] aggregate_function(field) [BY group_field]
```

**REST API 示例**

```bash
# 全表聚合（无 BY）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | STATS total = COUNT(*), avg_bytes = AVG(bytes), max_bytes = MAX(bytes)"
  }'

# 分组聚合（BY）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | STATS request_count = COUNT(*), avg_bytes = AVG(bytes) BY status | SORT request_count DESC | LIMIT 10"
  }'

# 多字段分组
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | STATS count = COUNT(*) BY status, method | SORT count DESC | LIMIT 20"
  }'

# 带聚合命名和不命名的混合
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | STATS total = COUNT(*), AVG(bytes) BY status"
  }'
```

**注意事项**

- `STATS` 之后中间表只包含聚合列和分组列，原始字段列不再可用
- 聚合表达式命名是可选的；若不命名，列名等于表达式文本（如 `AVG(bytes)`）
- `STATS` 支持在一个命令中同时进行多个聚合计算
- 支持 `PERCENTILE(field, percentile)` 百分位聚合（如 P50 / P95 / P99）
- 聚合会在所有分片数据上执行，结果不受隐式 LIMIT 影响

---

### 常用聚合函数（COUNT / SUM / AVG / MAX / MIN）

**概念定义**

聚合函数是 `STATS` 命令中使用的计算函数，对一组值进行汇总计算，返回单一标量值。ES|QL 支持丰富的聚合函数，覆盖统计、字符串、日期等类型。

**核心参数**

| 函数 | 签名 | 返回类型 | 说明 |
|------|------|----------|------|
| `COUNT(*)` | 无参数 | long | 计数所有行 |
| `COUNT(field)` | 字段名 | long | 计数字段非 NULL 的行数 |
| `COUNT_DISTINCT(field)` | 字段名 | long | 去重计数 |
| `SUM(field)` | 数值字段 | 与字段类型匹配 | 求和 |
| `AVG(field)` | 数值字段 | double | 平均值 |
| `MAX(field)` | 任意可比字段 | 与字段类型匹配 | 最大值 |
| `MIN(field)` | 任意可比字段 | 与字段类型匹配 | 最小值 |
| `MEDIAN(field)` | 数值字段 | double | 中位数 |
| `PERCENTILE(field, p)` | 字段 + 百分位 | double | 百分位值（p 为 1-100） |
| `STD_DEV(field)` | 数值字段 | double | 标准差 |
| `TOP(field, N, order)` | 字段 + 数量 + 排序 | 多值 | 返回前 N 个值 |
| `VALUES(field)` | 字段 | 多值 | 返回所有非 NULL 去重值 |

**REST API 示例**

```bash
# 综合聚合
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE @timestamp > NOW() - 1hour
      | STATS
          total = COUNT(*),
          total_bytes = SUM(bytes),
          avg_bytes = AVG(bytes),
          max_bytes = MAX(bytes),
          min_bytes = MIN(bytes),
          p50_bytes = PERCENTILE(bytes, 50),
          p99_bytes = PERCENTILE(bytes, 99),
          unique_ips = COUNT_DISTINCT(clientip)
    """
  }'

# 按小时聚合 + 中位数和标准差
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | EVAL hour = DATE_TRUNC(1 hour, @timestamp)
      | STATS
          count = COUNT(*),
          med = MEDIAN(response_time),
          stddev = STD_DEV(response_time)
        BY hour
      | SORT hour ASC
      | LIMIT 24
    """
  }'
```

**注意事项**

- `COUNT(*)` 和 `COUNT(field)` 的区别：前者计数所有行，后者忽略 NULL 值
- `PERCENTILE` 使用近似算法（TDigest），性能高效但结果为近似值
- `SUM` 和 `AVG` 对 NULL 值忽略；全 NULL 时返回 NULL
- `COUNT_DISTINCT` 使用近似算法（HyperLogLog++），大数据量下有 1-2% 误差
- `TOP` 和 `VALUES` 返回多值字段，结果类型为多值列

---

### 分组聚合（BY 子句）

**概念定义**

`BY` 子句是 `STATS` 命令的可选部分，用于指定分组维度。聚合函数按分组字段的不同值分别计算，每组产生一行结果。支持多字段分组、表达式分组和时间桶分组。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `grouping_field` | field / expression | 否 | 一个或多个分组字段或表达式，逗号分隔 |

**分组策略**

| 分组类型 | 示例 | 说明 |
|----------|------|------|
| 单字段分组 | `BY status` | 按单个字段值分组 |
| 多字段分组 | `BY status, method` | 按多个字段组合分组 |
| 表达式分组 | `BY DATE_TRUNC(1 hour, @timestamp)` | 按表达式计算结果分组 |
| 时间桶分组 | `BY BUCKET(@timestamp, 50, NOW()-1hour, NOW())` | 按时间桶分组（直方图） |

**REST API 示例**

```bash
# 多字段分组
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | STATS count = COUNT(*), avg_bytes = AVG(bytes) BY status, method
      | SORT count DESC
      | LIMIT 20
    """
  }'

# 时间桶聚合（按小时）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE @timestamp > NOW() - 24hour
      | STATS count = COUNT(*), avg_response = AVG(response_time) BY hour = DATE_TRUNC(1 hour, @timestamp)
      | SORT hour ASC
      | LIMIT 24
    """
  }'

# BUCKET 数字直方图
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | STATS count = COUNT(*) BY bucket = BUCKET(response_time, 10, 0, 1000)
      | SORT bucket ASC
    """
  }'
```

**注意事项**

- `BY` 子句可以给分组字段起别名：`BY alias = field` 或 `BY alias = expression`
- 分组字段可以是表达式，如 `BY DATE_TRUNC(...)` 或 `BY BUCKET(...)`
- `BUCKET(field, buckets, from, to)` 用于创建等宽数字直方图
- 分组聚合后，只有分组字段和聚合字段可用；需要使用 `STATS` 后的别名引用
- 大数据量分组时注意分组基数（cardinality），过高可能导致内存压力

---

## 排序与分页

### SORT 排序

**概念定义**

`SORT` 处理命令按指定列对中间表进行排序，支持升序（ASC）和降序（DESC），以及多列排序。排序是服务端执行，不受 Kibana 客户端排序限制，作用于全量数据。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `column` | field | 是 | 排序列名，支持多列（逗号分隔） |
| `ASC` / `DESC` | keyword | 否 | 排序方向，默认 ASC |

**语法**

```sql
SORT column1 [ASC | DESC] [, column2 [ASC | DESC], ...]
```

**REST API 示例**

```bash
# 单列降序
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees | KEEP emp_no, first_name, salary | SORT salary DESC | LIMIT 10"}'

# 多列排序
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees | KEEP first_name, last_name, salary, hire_date | SORT salary DESC, hire_date ASC | LIMIT 10"}'

# 聚合后排序
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM logs-* | STATS count = COUNT(*) BY status | SORT count DESC | LIMIT 10"}'
```

**注意事项**

- `SORT` 在服务端执行，作用于全量数据，不受隐式 LIMIT 影响
- 多列排序从左到右依次比较，只有前一列相同时才比较下一列
- 排序操作需要将数据加载到内存，大数据量排序可能消耗较多资源
- 聚合后的排序列名必须使用 `STATS` 中定义的别名
- NULL 值在排序中的行为：ASC 时 NULL 排在最前，DESC 时 NULL 排在最后

---

### LIMIT 限制

**概念定义**

`LIMIT` 处理命令截断结果表，仅保留前 N 行。它是控制结果集大小的主要手段。默认隐式 LIMIT 为 1000（无显式指定时），Kibana Discover 中最大显示 10000 行，但聚合计算在全量数据上执行。

**核心参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `N` | integer | 是 | 1000（隐式） | 保留的最大行数，Kibana 中最大 10000 |

**REST API 示例**

```bash
# 显式 LIMIT
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees | LIMIT 5"}'

# LIMIT 结合 SORT（取 Top N）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM employees | KEEP first_name, salary | SORT salary DESC | LIMIT 10"}'

# 聚合后 LIMIT
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "FROM logs-* | STATS count = COUNT(*) BY status | SORT count DESC | LIMIT 5"}'
```

**注意事项**

- 默认隐式 LIMIT 为 1000，即使不写 `LIMIT` 也会被限制
- 聚合计算（`STATS`）在 `LIMIT` 之前执行，因此 LIMIT 不会影响聚合结果
- Kibana Discover 和 REST API 的 LIMIT 上限不同，API 支持更大值
- ES|QL 无原生 `OFFSET` 关键字，深分页需使用 `search_after` 结合 DSL 的 `filter` 参数
- `LIMIT 0` 合法但返回空结果集

---

### 分页查询

**概念定义**

ES|QL 本身不提供 `OFFSET` 或游标式分页命令。分页通过以下策略实现：游标分页（使用 `filter` 参数 + DSL 的 `search_after`）、异步查询 API（适合大数据量导出）、以及客户端内存分页。

**核心参数**

| 策略 | 机制 | 适用场景 |
|------|------|----------|
| DSL filter 参数 | `filter` 参数 + `search_after` | 深度分页、逐页浏览 |
| 异步查询 | `POST /_query/async` + `GET /_query/async/{id}` | 大数据量导出 |
| 客户端分页 | 接收全部结果，客户端分页 | 小数据量（< 10000 行） |
| WHERE 条件分页 | 按时间/ID 范围分段查询 | 时间序列数据 |

**REST API 示例**

```bash
# 方案1：使用 DSL filter 参数 + search_after 思路
# 第一页
curl -X POST "http://localhost:9200/_query?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | SORT @timestamp DESC, _id ASC | LIMIT 100",
    "filter": { "range": { "@timestamp": { "gte": "now-1d" } } }
  }'

# 方案2：异步查询（大数据量导出）
# 发起异步查询
curl -X POST "http://localhost:9200/_query/async?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | WHERE @timestamp > NOW() - 30day | KEEP @timestamp, message, status",
    "wait_for_completion_timeout": "2s"
  }'

# 轮询结果（使用返回的 id）
curl -X GET "http://localhost:9200/_query/async/{query_id}?wait_for_completion_timeout=30s"

# 方案3：WHERE 条件分段
curl -X POST "http://localhost:9200/_query?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "FROM logs-* | WHERE @timestamp >= ?from AND @timestamp < ?to | SORT @timestamp ASC | LIMIT 1000",
    "params": [{"from": "2024-01-01T00:00:00Z"}, {"to": "2024-01-02T00:00:00Z"}]
  }'
```

**注意事项**

- ES|QL 无原生 `OFFSET`，深度分页对性能影响大，推荐使用 `search_after` 方式
- 异步查询 API 的 `keep_alive` 周期默认为 5 天，过期后结果自动清理
- 异步查询 ID 无法跨集群共享
- 使用 `WHERE` 条件分段时，建议按 `@timestamp` 或 `_id` 等天然有序字段分段
- `filter` 参数中的 DSL 查询在 ES|QL 执行前进行预过滤，结合 `search_after` 可实现高效游标分页

---

## 数据处理

### LOOKUP JOIN 查找连接

**概念定义**

`LOOKUP JOIN`（8.18/9.0 GA，9.2 增强）将 ES|QL 查询结果表与指定查找索引中的匹配记录合并，根据连接字段匹配值，将查找索引中的字段作为新列添加到结果表中。它是一种左外连接（left-join），如果查找索引中无匹配记录，则新列值为 NULL。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `lookup_index` | string | 是 | 查找索引名称（模式） |
| `ON join_field` | field | 是 | 连接字段，用于匹配查找索引 |
| `AS new_name` | string | 否 | 重命名添加的列 |

**语法**

```sql
LOOKUP lookup_index ON join_field [AS new_column_name]
```

**REST API 示例**

```bash
# 基础 LOOKUP JOIN
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM orders
      | KEEP order_id, customer_id, amount
      | LOOKUP customers ON customer_id
      | LIMIT 10
    """
  }'

# 带列选择
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM orders
      | KEEP order_id, customer_id, amount
      | LOOKUP customers ON customer_id
      | KEEP order_id, customer_id, customer_name, amount
      | LIMIT 10
    """
  }'
```

**注意事项**

- 8.18/9.0 中 `LOOKUP JOIN` 为 GA 状态，9.2 版本对其进行了智能优化
- 查找索引需要在查询时存在，且字段类型需与主查询兼容
- 基于左外连接语义：主查询结果全部保留，查找不到时填充 NULL
- 查找索引不应过大（建议 < 10M 文档），否则影响性能
- 9.2 版本引入了智能 LOOKUP JOIN，支持更高效的哈希连接
- 不适用于实时高频关联场景，更适合维度表补充（低频更新）
- 若查找索引的字段名与主查询现有字段冲突，查找字段会覆盖现有字段

---

### DISSECT 字符串解析

**概念定义**

`DISSECT` 处理命令基于分隔符模式从字符串中提取结构化数据。与 GROK 不同，DISSECT 使用简单的占位符匹配（非正则），性能远高于 GROK，适用于格式固定的日志行解析。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `input` | string field | 是 | 包含待解析字符串的列 |
| `pattern` | string | 是 | Dissect 模式字符串 |
| `APPEND_SEPARATOR` | string | 否 | 追加修饰符的分隔符，默认 `""` |

**Dissect 模式修饰符**

| 修饰符 | 语法 | 说明 |
|--------|------|------|
| 普通字段 | `%{fieldname}` | 提取匹配字段 |
| 跳过字段 | `%{}` 或 `%{?fieldname}` | 匹配但不输出 |
| 追加修饰符 | `%{+fieldname}` | 追加到已有字段 |
| 带顺序的追加 | `%{+fieldname/order}` | 按顺序追加 |
| 间接字段 | `%{&fieldname}` | 引用其他字段的值作为字段名 |

**REST API 示例**

```bash
# 基础解析
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW a = "2023-01-23T12:15:00.000Z - ERROR - 127.0.0.1 - Connection timeout"
      | DISSECT a "%{date} - %{level} - %{ip} - %{msg}"
      | KEEP date, level, ip, msg
    """
  }'

# 追加修饰符（解析堆栈跟踪）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW a = "ERROR: java.lang.NullPointerException at com.example.MyClass.method(MyClass.java:42)"
      | DISSECT a "%{level}: %{+msg} at %{+msg}"
      | KEEP level, msg
    """
  }'

# 类型转换
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW a = "2023-01-23T12:15:00.000Z - 127.0.0.1 - 42"
      | DISSECT a "%{date} - %{ip} - %{num}"
      | EVAL date = TO_DATETIME(date), num = TO_INTEGER(num)
      | KEEP date, ip, num
    """
  }'
```

**注意事项**

- DISSECT 不依赖正则，性能远优于 GROK（可达 10-100 倍差异）
- 模式中 `%{field}` 的 field 命名不应与已有列名冲突（冲突时旧列被删除）
- 默认输出为 keyword 字符串类型，需用 `EVAL` + 类型转换函数转为目标类型
- DISSECT 使用分隔符（空格、短横、冒号等）确定字段边界，不适合无固定分隔符的数据
- 追加修饰符 `%{+field}` 的多个匹配结果拼接为单个字段值
- 不适合解析嵌套 JSON 或 XML 等高度结构化数据
- 字段名重复（非追加修饰符）时，只有最右侧的重复项创建列

---

### GROK 模式匹配

**概念定义**

`GROK` 处理命令基于正则表达式从字符串中提取结构化数据。与 DISSECT 相比，GROK 更灵活（支持正则语义），但性能较低。GROK 内置了 120+ 种预定义模式（如 `%{IP}`、`%{TIMESTAMP_ISO8601}`、`%{EMAILADDRESS}` 等），也可自定义模式。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `input` | string field | 是 | 包含待解析字符串的列 |
| `pattern` | string | 是 | Grok 模式字符串，使用 `%{PATTERN:fieldname}` 语法 |

**常用内置模式**

| 模式 | 匹配内容 | 示例 |
|------|----------|------|
| `%{IP}` | IPv4/IPv6 地址 | `192.168.1.1` |
| `%{TIMESTAMP_ISO8601}` | ISO8601 时间戳 | `2023-01-23T12:15:00.000Z` |
| `%{EMAILADDRESS}` | 电子邮件地址 | `user@example.com` |
| `%{NUMBER}` | 数字 | `42` |
| `%{WORD}` | 单词（字母数字） | `ERROR` |
| `%{DATA}` | 任意数据（非贪婪） | 任意字符串 |
| `%{GREEDYDATA}` | 任意数据（贪婪） | 任意字符串 |
| `%{LOGLEVEL}` | 日志级别 | `ERROR`, `WARN` |
| `%{URIPATH}` | URI 路径 | `/api/v1/users` |
| `%{UUID}` | UUID | `550e8400-...` |

**类型转换语法**

```
%{PATTERN:fieldname:target_type}
```

目标类型：`int`、`long`、`float`、`double`、`boolean`、`keyword`、`text`、`ip`、`date` 等。

**REST API 示例**

```bash
# 基础 GROK 解析
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW a = "2023-01-23T12:15:00.000Z 127.0.0.1 some.email@foo.com 42"
      | GROK a "%{TIMESTAMP_ISO8601:date} %{IP:ip} %{EMAILADDRESS:email} %{NUMBER:num:int}"
      | KEEP date, ip, email, num
    """
  }'

# 日志行解析
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM app-logs-*
      | WHERE @timestamp > NOW() - 1hour
      | GROK message "%{TIMESTAMP_ISO8601:log_time} \\[%{WORD:thread}\\] %{LOGLEVEL:level} +%{DATA:logger} - %{GREEDYDATA:msg}"
      | KEEP log_time, thread, level, logger, msg
      | LIMIT 20
    """
  }'

# 多值字段（同名字段）
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM addresses
      | KEEP city.name, zip_code
      | GROK zip_code "%{WORD:zip_parts} %{WORD:zip_parts}"
    """
  }'
```

**注意事项**

- GROK 基于正则，性能低于 DISSECT；数据量大时优先使用 DISSECT
- 模式中特殊字符需转义（如 `\[` 匹配 `[`）
- 可用 `%{PATTERN:field:type}` 语法直接指定输出类型，无需额外 EVAL 转换
- 同名字段被多次匹配时，GROK 创建多值列（与 DISSECT 的追加修饰符不同）
- GROK 不支持自定义模式文件（仅限内置模式），复杂场景需使用 DISSECT 或预处理
- 字段名与现有列冲突时，旧列被删除
- 解析失败时，目标字段值为 NULL（不抛出异常）

---

### ENRICH 数据丰富

**概念定义**

`ENRICH` 处理命令使用预先创建的 enrich policy（丰富策略）将外部索引中的参考数据作为新列合并到查询结果中。典型场景：IP 地址补充地理信息、用户 ID 补充用户信息、错误码补充错误描述。ENRICH 需要预先创建并执行 enrich policy。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `policy` | string | 是 | 已创建并执行的 enrich policy 名称 |
| `ON match_field` | field | 否 | 匹配字段，默认使用 policy 中定义的 match_field |
| `WITH [new_name=]field1, ...` | field list | 否 | 选择要添加的丰富字段，可选重命名 |

**语法**

```sql
ENRICH policy_name [ON match_field] [WITH [new_name = ]field1, [new_name = ]field2, ...]
```

**REST API 示例**

```bash
# 步骤1：创建 enrich policy（在 Kibana Dev Tools 或 REST API 中执行）
# PUT /_enrich/policy/languages_policy
# {
#   "match": {
#     "indices": "languages",
#     "match_field": "language_code",
#     "enrich_fields": ["language_name", "language_family"]
#   }
# }

# 步骤2：执行 enrich policy
# POST /_enrich/policy/languages_policy/_execute

# 步骤3：使用 ENRICH 命令
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW language_code = "1"
      | ENRICH languages_policy
    """
  }'

# 指定匹配字段
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW a = "1"
      | ENRICH languages_policy ON a WITH language_name
    """
  }'

# 重命名丰富字段
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      ROW a = "1"
      | ENRICH languages_policy ON a WITH name = language_name, family = language_family
    """
  }'
```

**注意事项**

- ENRICH 使用前必须先创建并执行 enrich policy（`PUT /_enrich/policy/{name}` + `POST /_enrich/policy/{name}/_execute`）
- Enrich policy 类型：`match`（精确匹配）、`range`（范围匹配）、`geo_match`（地理匹配）
- 跨集群 ES|QL 中使用 ENRICH 需要指定 `mode` 参数
- 丰富字段与现有列同名时，现有列被删除
- 匹配不到记录时，丰富字段值为 NULL
- Enrich policy 的索引数据变更后需要重新执行 policy
- `match` 类型 policy 适用于等值匹配（如 ID、code），范围匹配（如 IP 段）使用 `range` 类型

---

## 高级特性

### INLINESTATS（9.x 新增，语义搜索）

**概念定义**

`INLINESTATS ... BY` 是 9.x 中引入的实验性命令（技术预览阶段），在数据流中内联计算聚合结果，并将聚合结果作为新列附加到每一行原始数据中。与 `STATS` 不同，`INLINESTATS` 不改变行数，而是将聚合值"广播"回原始行。这是语义搜索和高级分析的关键能力。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `aggregate_expression` | expression | 是 | 聚合表达式，如 `avg_salary = AVG(salary)` |
| `BY grouping_expression` | field | 否 | 分组字段，按分组计算聚合值 |

**语法**

```sql
INLINESTATS [col1 =] agg_expr1 [, ..., [colN =] agg_exprN] [BY grouping_expr1, ...]
```

**与 STATS 的对比**

| 维度 | STATS | INLINESTATS |
|------|-------|-------------|
| 输出行数 | 减少（每组一行） | 不变（每行附加聚合值） |
| 数据流 | 聚合中断管道 | 聚合值合并回原流 |
| 典型场景 | 汇总报告 | 异常检测、排名、标准化 |
| 版本状态 | 8.11+ GA | 9.x 技术预览 |

**REST API 示例**

```bash
# 内联计算部门平均工资，附到每个员工行
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM employees
      | KEEP emp_no, first_name, department, salary
      | INLINESTATS avg_dept_salary = AVG(salary), max_dept_salary = MAX(salary) BY department
      | EVAL salary_ratio = salary / avg_dept_salary
      | SORT salary_ratio DESC
      | LIMIT 10
    """
  }'

# 全表统计附加到每行
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM employees
      | KEEP first_name, salary
      | INLINESTATS global_avg = AVG(salary), global_max = MAX(salary)
      | EVAL percentile = salary / global_max * 100
      | SORT percentile DESC
      | LIMIT 10
    """
  }'
```

**注意事项**

- INLINESTATS 目前在 9.x 中处于技术预览阶段，API 可能变更
- 支持所有聚合函数（与 STATS 一致）
- 无 BY 子句时，聚合值广播到每一行
- 有 BY 子句时，按分组匹配聚合值
- 适用于异常检测、归一化、排名分析等"行级聚合"场景
- 计算开销高于 STATS（需要将聚合结果合并回原流），大数据量时注意性能

---

### 时间序列函数

**概念定义**

ES|QL 提供了丰富的时间序列函数，用于日期时间计算、截断、提取、格式化等操作。这些函数是处理时间序列数据（日志、指标、事件）的核心工具。

**常用时间函数**

| 函数 | 签名 | 返回类型 | 说明 |
|------|------|----------|------|
| `NOW()` | 无参数 | datetime | 当前日期时间 |
| `DATE_TRUNC(interval, field)` | 间隔 + 日期字段 | datetime | 日期截断到指定间隔 |
| `DATE_DIFF(unit, from, to)` | 单位 + 起止 | integer | 日期差值 |
| `DATE_EXTRACT(part, field)` | 提取部分 + 日期字段 | integer | 提取年/月/日/时/分/秒 |
| `DATE_FORMAT(pattern, field)` | 格式 + 日期字段 | keyword | 日期格式化 |
| `DATE_PARSE(string)` | 日期字符串 | datetime | 字符串解析为日期 |
| `TO_DATETIME(field)` | 字段 | datetime | 类型转换为日期 |

**时间间隔单位**

| 单位 | 说明 |
|------|------|
| `millisecond` / `ms` | 毫秒 |
| `second` / `s` / `sec` | 秒 |
| `minute` / `min` | 分钟 |
| `hour` / `h` | 小时 |
| `day` / `d` | 天 |
| `week` / `w` | 周 |
| `month` / `mo` | 月 |
| `quarter` / `q` | 季度 |
| `year` / `y` / `yr` | 年 |

**REST API 示例**

```bash
# 时间截断 + 聚合
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE @timestamp > NOW() - 24hour
      | STATS count = COUNT(*) BY hour = DATE_TRUNC(1 hour, @timestamp)
      | SORT hour ASC
      | LIMIT 24
    """
  }'

# 日期差值计算
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM employees
      | EVAL years_of_service = DATE_DIFF("year", hire_date, NOW())
      | KEEP first_name, hire_date, years_of_service
      | SORT years_of_service DESC
      | LIMIT 10
    """
  }'

# 日期提取 + 格式化
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM employees
      | EVAL
          hire_year = DATE_EXTRACT("year", hire_date),
          hire_month = DATE_EXTRACT("month", hire_date),
          hire_day_of_week = DATE_FORMAT("EEEE", hire_date)
      | KEEP first_name, hire_year, hire_month, hire_day_of_week
      | LIMIT 10
    """
  }'
```

**注意事项**

- `NOW()` 在查询解析时确定，同一查询中多次调用返回相同值
- `DATE_TRUNC` 的间隔参数支持 `1 hour`、`1 day`、`1 week` 等表述
- 时间跨度字面量对空格不敏感（`1day`、`1 day` 等效）
- `DATE_FORMAT` 使用 Java DateTimeFormatter 模式字符串
- `DATE_DIFF` 返回的是整数差值（向下取整）
- 时间桶聚合时建议使用 `DATE_TRUNC` 而非 `BUCKET`（时间语义更自然）

---

### 全文搜索（MATCH / QSTR）

**概念定义**

ES|QL 提供了 `MATCH` 和 `QSTR` 两个全文搜索函数，可在 `WHERE` 子句中使用，对文本字段进行全文匹配。`MATCH` 使用 Lucene 的 match 查询；`QSTR` 使用 Lucene 的 query_string 查询，支持更复杂的查询语法。

**核心参数**

| 函数 | 签名 | 说明 |
|------|------|------|
| `MATCH(field, query)` | 字段 + 查询字符串 | 全文搜索，使用 match 查询语义 |
| `MATCH(field, query, options)` | 字段 + 查询 + 配置 | 带选项的全文搜索（如 `{"fuzziness": "AUTO"}`） |
| `QSTR(field, query)` | 字段 + 查询字符串 | 查询字符串搜索，支持 AND/OR/通配符/正则 |

**MATCH 与 QSTR 对比**

| 维度 | MATCH | QSTR |
|------|-------|------|
| 查询语法 | 自然语言，分词后 OR 匹配 | Lucene 查询字符串语法 |
| 运算符支持 | 不支持 AND/OR | 支持 AND、OR、NOT、`+`、`-` |
| 通配符 | 不支持 | 支持 `*` 和 `?` |
| 模糊匹配 | 通过 options 参数 | 支持 `~` 模糊操作符 |
| 字段权重 | 支持 | 支持 `field^weight` |
| 典型场景 | 通用搜索框 | 高级搜索、日志过滤 |

**REST API 示例**

```bash
# MATCH 基础搜索
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE MATCH(message, "error timeout connection")
      | KEEP @timestamp, level, message
      | LIMIT 20
    """
  }'

# MATCH 模糊搜索
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE MATCH(message, "conection timeout", {\"fuzziness\": \"AUTO\"})
      | KEEP @timestamp, message
      | LIMIT 10
    """
  }'

# QSTR 高级搜索
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE QSTR(message, "error AND (timeout OR connection) AND NOT warning")
      | KEEP @timestamp, level, message
      | LIMIT 20
    """
  }'

# QSTR 通配符搜索
curl -X POST "http://localhost:9200/_query?format=txt" \
  -H "Content-Type: application/json" \
  -d '{
    "query": """
      FROM logs-*
      | WHERE QSTR(message, "time* AND connect*")
      | KEEP @timestamp, message
      | LIMIT 10
    """
  }'
```

**注意事项**

- `MATCH` 和 `QSTR` 仅适用于 `text` 类型字段（需要分词）
- `MATCH` 的 options 参数为 JSON 对象字符串，支持 `fuzziness`、`operator`、`minimum_should_match` 等
- `QSTR` 支持完整的 Lucene 查询字符串语法，但用户输入需防范注入（使用参数化查询）
- 全文搜索与结构化过滤（`WHERE status == 200`）可以组合使用
- 高亮（highlighting）在 ES|QL 中暂不支持，需要通过 DSL 实现
- 对于 keyword 字段，使用 `==`、`LIKE`、`RLIKE` 进行匹配，而非 MATCH/QSTR

---

## SQL REST API

### SQL 查询语法

**概念定义**

Elasticsearch SQL 是 Elasticsearch 提供的 SQL 兼容查询接口，通过 `POST /_sql` 端点将 SQL 查询翻译为 DSL 并执行。它支持标准的 SQL 语法（SELECT、FROM、WHERE、GROUP BY、ORDER BY、LIMIT 等），并提供 `_sql/translate` 端点将 SQL 翻译为 DSL JSON。

**核心参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `query` | string | 是 | SQL 查询语句 |
| `fetch_size` | integer | 否 | 每次获取的行数（游标分页） |
| `filter` | object | 否 | DSL 过滤条件 |
| `params` | array | 否 | 参数化查询参数 |
| `time_zone` | string | 否 | 时区 |
| `field_multi_value_leniency` | boolean | 否 | 多值字段容错 |

**SQL 翻译 API**

```bash
curl -X POST "http://localhost:9200/_sql/translate?format=json" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT * FROM library ORDER BY page_count DESC LIMIT 5"}'
```

**REST API 示例**

```bash
# 基础 SQL 查询
curl -X POST "http://localhost:9200/_sql?format=txt" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT author, name, page_count FROM library ORDER BY page_count DESC LIMIT 5"}'

# SQL 聚合
curl -X POST "http://localhost:9200/_sql?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT status, COUNT(*) as cnt, AVG(response_time) as avg_rt FROM \"logs-*\" GROUP BY status ORDER BY cnt DESC LIMIT 10"
  }'

# 参数化 SQL 查询
curl -X POST "http://localhost:9200/_sql?format=json" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM library WHERE page_count > ? AND release_date >= ?",
    "params": [300, "2000-01-01T00:00:00.000Z"]
  }'

# SQL 翻译为 DSL（调试用）
curl -X POST "http://localhost:9200/_sql/translate" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT author, COUNT(*) FROM library GROUP BY author HAVING COUNT(*) > 1"}'
```

**注意事项**

- SQL 查询通过 `_sql` 端点执行，底层翻译为 DSL 后执行
- SQL 支持 `HAVING` 子句（ES|QL 不支持，需在 `STATS` 后加 `WHERE`）
- 索引名包含特殊字符时需用双引号包裹（如 `FROM "logs-*"`）
- SQL 的 LIMIT 默认为 1000，游标模式支持更大结果集
- SQL 翻译 API (`_sql/translate`) 是调试 SQL 到 DSL 映射的利器
- SQL 不支持 ES|QL 的管道操作（ENRICH、DISSECT、GROK 等），只能做查询和聚合

---

### SQL 与 ES|QL 对比

**概念定义**

Elasticsearch SQL 和 ES|QL 是两种不同的查询方式。SQL 是传统的声明式查询，语法接近标准 SQL；ES|QL 是管道式查询，语法接近 Unix 管道。两者适用场景不同，各有优劣。

**核心对比**

| 对比维度 | SQL | ES|QL |
|----------|-----|------|
| 语法风格 | 标准 SQL（SELECT...FROM...WHERE...GROUP BY） | 管道式（FROM...| WHERE...| STATS...） |
| 执行引擎 | 翻译为 DSL 执行 | 专用 ES|QL 引擎 |
| 数据转换 | 不支持 | 支持（EVAL、DISSECT、GROK、ENRICH） |
| 数据丰富 | 不支持 | 支持 ENRICH / LOOKUP JOIN |
| 管道操作 | 不支持 | 支持连续管道链 |
| HAVING 子句 | 支持 | 不支持（用 STATS + WHERE 替代） |
| JOIN | 不支持 | 支持 LOOKUP JOIN（8.18+） |
| 全文搜索 | 支持 MATCH 函数 | 支持 MATCH / QSTR 函数 |
| JDBC 驱动 | 官方支持 | 暂不支持 |
| 适用场景 | BI 工具连接、报表系统 | 日志分析、数据探索、安全调查 |
| 学习成本 | 低（SQL 知识可复用） | 低（管道直觉，接近 Unix 管道） |

**同场景对比**

SQL 查询：
```sql
SELECT status, COUNT(*) as cnt, AVG(response_time) as avg_rt
FROM "logs-*"
WHERE response_time > 100
GROUP BY status
HAVING COUNT(*) > 10
ORDER BY cnt DESC
LIMIT 10
```

ES|QL 等效查询：
```sql
FROM logs-*
| WHERE response_time > 100
| STATS cnt = COUNT(*), avg_rt = AVG(response_time) BY status
| WHERE cnt > 10
| SORT cnt DESC
| LIMIT 10
```

**注意事项**

- SQL 的 HAVING 子句在 ES|QL 中通过在 STATS 后添加 WHERE 实现
- ES|QL 的管道操作（ENRICH、DISSECT、GROK）在 SQL 中无法实现
- SQL 通过 JDBC 驱动可集成 BI 工具（Tableau、Power BI、Metabase），ES|QL 暂不支持
- SQL 支持 `DESCRIBE` 查看表结构，`SHOW TABLES` 查看索引列表
- 选择 SQL 还是 ES|QL 取决于场景：BI 集成选 SQL，数据探索和日志分析选 ES|QL

---

### JDBC 驱动简介

**概念定义**

Elasticsearch JDBC 驱动是官方提供的 Type 4 JDBC 驱动程序，允许 Java 应用和 BI 工具通过标准 JDBC 接口连接 Elasticsearch 并执行 SQL 查询。它通过 `_sql` API 将 SQL 翻译为 DSL 执行，对应用层透明。

**核心参数**

| 参数 | 说明 |
|------|------|
| 驱动类 | `org.elasticsearch.xpack.sql.jdbc.EsDriver` |
| JDBC URL | `jdbc:es://http://host:9200` |
| Maven 坐标 | `org.elasticsearch.plugin:x-pack-sql-jdbc:8.14.0` |
| 协议 | HTTP/HTTPS（通过 `_sql` API） |
| 认证 | 支持 Basic Auth 和 API Key |

**Maven 依赖**

```xml
<dependency>
    <groupId>org.elasticsearch.plugin</groupId>
    <artifactId>x-pack-sql-jdbc</artifactId>
    <version>8.14.0</version>
</dependency>
```

**Java 示例**

**Spring Boot 集成示例**

**注意事项**

- JDBC 驱动仅支持 SQL 查询（不支持 ES|QL），通过 `_sql` 端点执行
- JDBC 驱动是 x-pack 组件，需要 Elasticsearch 许可证（Basic 免费版可用）
- 游标模式支持大数据量（`fetch_size` 参数控制每次获取行数）
- 不支持 DDL/DML 操作（仅 SELECT），不能创建/修改索引
- 索引名包含特殊字符或大写字母时需用双引号包裹
- 时间函数（如 `NOW() - 1 HOUR`）的 SQL 语法与 ES|QL 略有不同
- 在生产环境中建议对 JDBC 连接做连接池管理和超时控制

---

