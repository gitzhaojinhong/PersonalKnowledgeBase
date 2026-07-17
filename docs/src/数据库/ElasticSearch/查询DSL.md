---

## Query Context vs Filter Context

**概念定义**

Elasticsearch 在执行查询时，将查询子句划分为两种上下文：

- **Query Context**（查询上下文）：回答“此文档与此查询子句的匹配程度如何？”。参与 **相关性评分（_score）**，结果按分数排序。
- **Filter Context**（过滤上下文）：回答“此文档是否匹配此查询子句？”。仅做 **是/否** 判定，不参与评分，结果不会被计分。

同一个查询子句（如 `term`、`bool`）既可用于 Query Context，也可用于 Filter Context，取决于其父级包装。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | Object | — | 顶层查询对象，内部子句默认处于 Query Context |
| `filter` | Object / Array | — | 位于 `bool` 下，子句处于 Filter Context，不参与评分 |
| `must` | Object / Array | — | 位于 `bool` 下，子句处于 Query Context，参与评分 |
| `must_not` | Object / Array | — | 位于 `bool` 下，子句处于 Filter Context，文档必须不匹配 |
| `should` | Object / Array | — | 位于 `bool` 下，子句处于 Query Context，满足越多得分越高 |
| `constant_score` | Object | — | 包裹查询，将内部 Query Context 结果转为统一分数 |

---

### 评分（Score）与非评分

**概念定义**

- **评分查询**：处于 Query Context 的查询子句，Elasticsearch 为每个匹配文档计算 `_score`（BM25 算法，8.x 默认），表示文档与查询的相关度。
- **非评分查询**：处于 Filter Context 的查询子句，不计算 `_score`，所有匹配文档的 `_score` 被视为 0（或由外层 Query Context 决定）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `boost` | float | 1.0 | 用于 Query Context，提升该子句在总分中的权重 |
| `_score` | float | — | 查询返回结果中的评分字段，由 BM25 计算 |
| `explain` | boolean | false | 在查询时开启评分解释，返回各子句的评分细节 |

**REST API 示例**

```bash
# Query Context：match 查询参与评分
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match": {
      "name": "无线蓝牙耳机"
    }
  }
}'

# Filter Context：term 过滤不参与评分
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "bool": {
      "filter": {
        "term": { "brand": "sony" }
      }
    }
  }
}'

# 开启评分解释
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "explain": true,
  "query": {
    "match": { "name": "无线蓝牙耳机" }
  }
}'
```

**注意事项**

- 在 Filter Context 中，`boost` 参数无效，因为不参与评分。
- 查询时尽量将不需要评分的条件放入 `filter`，利用缓存提升性能。
- 使用 `explain` 可诊断评分异常，但生产环境应避免频繁开启。

---

### Filter 缓存机制

**概念定义**

Elasticsearch 对 Filter Context 中执行的查询结果进行 **节点级位集合（BitSet）缓存**。每个段（Segment）上的过滤结果被缓存为位集合，后续相同过滤条件可直接复用，无需重新计算。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `indices.queries.cache.size` | 百分比 | 10% | 节点堆内存中用于查询缓存的最大比例 |
| `index.queries.cache.enabled` | boolean | true | 索引级别是否启用查询缓存 |
| `_cache` | boolean | — | 在 Filter 子句中显式指定是否缓存该过滤结果 |
| `_cache_key` | string | — | 自定义缓存键，用于可被复用的过滤条件 |

**REST API 示例**

```bash
# 默认启用缓存的 filter 查询
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "bool": {
      "filter": {
        "term": { "category": "电子产品" }
      }
    }
  }
}'

# 查看查询缓存统计
curl -X GET "localhost:9200/_stats/query_cache?pretty"

# 清除查询缓存
curl -X POST "localhost:9200/_cache/clear?query=true"
```

**注意事项**

- 只有 Filter Context 中的查询才被缓存，Query Context 中的查询不被缓存。
- `terms` 查询（尤其是 `terms` lookup）和 `range` 查询中的 `now` 表达式不会或很少被缓存。
- 频繁更新的索引（段合并频繁）会降低缓存命中率。
- 位集合缓存基于段级别，段合并时缓存失效，这是正常行为。

---

## 全文查询

### match

**概念定义**

`match` 是最常用的全文查询，对输入文本进行 **分词（Analyzer）** 后，在倒排索引中查找包含任意词项的文档。默认使用 `OR` 逻辑，匹配词项越多，`_score` 越高。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 待查询的文本 |
| `operator` | string | `"or"` | `"or"` 或 `"and"`，控制词项匹配逻辑 |
| `analyzer` | string | 字段映射的 analyzer | 指定分词器 |
| `fuzziness` | string | — | 模糊匹配，如 `"AUTO"` |
| `minimum_should_match` | string/integer | — | 最少匹配词项数，如 `"75%"` 或 `2` |
| `boost` | float | 1.0 | 权重 |
| `zero_terms_query` | string | `"none"` | 当分词后无词项时行为：`"none"` 或 `"all"` |

**REST API 示例**

```bash
# 基本 match 查询
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match": {
      "description": "高性能无线降噪耳机"
    }
  }
}'

# AND 操作符 + minimum_should_match
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match": {
      "description": {
        "query": "高性能无线降噪耳机",
        "operator": "and",
        "minimum_should_match": "75%"
      }
    }
  }
}'
```

**注意事项**

- `match` 查询对 `text` 类型字段使用分词器，对 `keyword` 类型字段不进行分词。
- 当 `operator` 为 `and` 时，所有词项都必须匹配，等价于 `match_phrase` 但不要求词项连续。
- `minimum_should_match` 在 `operator: or` 时非常有用，可避免匹配过多无关文档。

---

### multi_match

**概念定义**

`multi_match` 在多个字段上执行同一个 `match` 查询，支持多种评分策略（如 `best_fields`、`most_fields`、`cross_fields`、`phrase`、`phrase_prefix`）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 待查询的文本 |
| `fields` | string[] | — | 目标字段列表，支持通配符 `*` 和 `^` 加权 |
| `type` | string | `"best_fields"` | 评分策略：`best_fields` / `most_fields` / `cross_fields` / `phrase` / `phrase_prefix` / `bool_prefix` |
| `tie_breaker` | float | 0.0 | `best_fields` 模式下，非最佳字段的参与系数 |
| `operator` | string | `"or"` | 词项匹配逻辑 |
| `minimum_should_match` | string/integer | — | 最少匹配词项数 |

**REST API 示例**

```bash
# basic multi_match
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "multi_match": {
      "query": "无线降噪耳机",
      "fields": ["name^3", "description", "brand"]
    }
  }
}'

# cross_fields 类型
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "multi_match": {
      "query": "Sony WH-1000XM5",
      "type": "cross_fields",
      "fields": ["brand", "model", "description"],
      "operator": "and"
    }
  }
}'
```

**注意事项**

- `best_fields`（默认）：取最佳匹配字段的分数，适合词项应出现在同一字段的场景。
- `most_fields`：各字段分数求和，适合同一文本以不同方式分析存入多字段的场景。
- `cross_fields`：将多个字段视为一个整体，解决词项分散在不同字段的匹配问题，适合人名、地址等结构化搜索。
- `tie_breaker` 仅在 `best_fields` 和 `most_fields` 下生效。

---

### match_phrase

**概念定义**

`match_phrase` 将输入文本分词后，要求所有词项 **按顺序连续出现** 在文档中，允许通过 `slop` 控制词项间的间隔容忍度。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 待匹配的短语 |
| `slop` | integer | 0 | 词项间允许的最大距离（词项数），0 表示必须完全连续 |
| `analyzer` | string | 字段映射的 analyzer | 分词器 |
| `zero_terms_query` | string | `"none"` | 分词后无词项时的行为 |

**REST API 示例**

```bash
# 精确短语匹配
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match_phrase": {
      "description": "主动降噪技术"
    }
  }
}'

# 带 slop 的短语匹配
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match_phrase": {
      "description": {
        "query": "降噪蓝牙耳机",
        "slop": 2
      }
    }
  }
}'
```

**注意事项**

- `slop=0` 时等价于精确短语匹配，词项必须完全连续且顺序一致。
- `slop` 值越大，召回率越高，但精度越低，且性能开销越大。
- 对于长文本，可结合 `match` + `minimum_should_match` 获得更好的召回效果。
- 短语查询在 `index_phrases` 开启时，可通过 `_index_phrase` 优化性能。

---

### match_phrase_prefix

**概念定义**

`match_phrase_prefix` 与 `match_phrase` 类似，但最后一个词项作为 **前缀匹配**，允许用户输入未完成的短语进行实时搜索（即搜即得 / search-as-you-type）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 待匹配的短语，最后一个词项按前缀处理 |
| `slop` | integer | 0 | 词项间允许的最大距离 |
| `max_expansions` | integer | 50 | 最后一个词项前缀扩展的最大词项数 |
| `analyzer` | string | — | 分词器 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match_phrase_prefix": {
      "name": {
        "query": "无线蓝牙降",
        "max_expansions": 20
      }
    }
  }
}'
```

**注意事项**

- `max_expansions` 控制性能：值越大，召回越全但越慢；值越小，性能越好但可能遗漏。
- 前缀匹配在最后一个词项上执行，其他词项仍按 `match_phrase` 逻辑处理。
- 对于 search-as-you-type 场景，推荐使用 `search_as_you_type` 字段类型或 Completion Suggester，性能更优。
- 该查询可能引发大量前缀扩展，在大型索引上需谨慎使用。

---

### match_bool_prefix

**概念定义**

`match_bool_prefix` 将输入文本分词后，最后一个词项作为 `prefix` 查询，其余词项作为 `term` 查询，整体放入 `bool` 查询中。是 `match_phrase_prefix` 的宽松版本，不要求词项按顺序出现。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 待匹配的文本，最后一个词项按前缀处理 |
| `analyzer` | string | — | 分词器 |
| `operator` | string | `"or"` | 除最后一个词项外，其他词项的匹配逻辑 |
| `minimum_should_match` | string/integer | — | 最少匹配词项数 |
| `fuzziness` | string | — | 模糊匹配 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match_bool_prefix": {
      "description": {
        "query": "无线蓝牙降",
        "operator": "and"
      }
    }
  }
}'
```

**注意事项**

- 与 `match_phrase_prefix` 的区别在于不要求词项顺序，召回更宽松。
- 适合输入纠错和自动补全场景，但不如 Completion Suggester 高效。
- 内部会被重写为 `bool` + `term` + `prefix` 的组合查询。

---

### query_string

**概念定义**

`query_string` 使用一套完整的 **迷你查询语法**，支持 AND/OR/NOT、通配符、正则、范围查询、字段指定、模糊匹配、邻近搜索、分组等，适合高级用户或调试场景。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 查询字符串，支持完整语法 |
| `default_field` | string | `"*"` | 默认搜索字段 |
| `default_operator` | string | `"or"` | 默认操作符 `"or"` / `"and"` |
| `fields` | string[] | — | 指定搜索的字段列表 |
| `allow_leading_wildcard` | boolean | true | 是否允许前置通配符（如 `*foo`） |
| `analyze_wildcard` | boolean | false | 是否对通配符词项做分词 |
| `lenient` | boolean | false | 宽松模式，忽略格式错误 |
| `fuzziness` | string | — | 模糊匹配 |
| `fuzzy_max_expansions` | integer | 50 | 模糊匹配最大扩展词项数 |
| `minimum_should_match` | string/integer | — | 最少匹配词项数 |

**REST API 示例**

```bash
# 基本语法
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "query_string": {
      "query": "(无线 OR 蓝牙) AND 降噪 NOT 有线",
      "default_field": "description"
    }
  }
}'

# 多字段 + 字段指定语法
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "query_string": {
      "query": "name:耳机 AND brand:Sony AND price:[500 TO 2000]",
      "fields": ["name^3", "description"]
    }
  }
}'
```

**注意事项**

- 语法错误会导致查询失败（除非设置 `lenient: true`）。
- 对用户输入直接使用 `query_string` 存在安全风险（语法注入），生产环境应避免。
- 前置通配符（`*foo`）极其消耗资源，生产环境建议设置 `allow_leading_wildcard: false`。
- 如果需求简单，优先使用 `simple_query_string`。

---

### simple_query_string

**概念定义**

`simple_query_string` 是 `query_string` 的简化版。使用 `+`、`-`、`|`、`*`、`"` 等符号，语法更容错，错误不会直接抛出异常，适合面向终端用户的搜索场景。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | string | — | 查询字符串，使用简化语法 |
| `fields` | string[] | — | 搜索字段列表 |
| `default_operator` | string | `"or"` | 默认操作符 |
| `flags` | string | `"ALL"` | 启用的语法特性：`AND`/`OR`/`NOT`/`PREFIX`/`PHRASE`/`PRECEDENCE`/`ESCAPE`/`WHITESPACE`/`FUZZY`/`NEAR`/`SLOP` |
| `analyze_wildcard` | boolean | false | 是否对通配符词项分词 |
| `minimum_should_match` | string/integer | — | 最少匹配词项数 |
| `quote_field_suffix` | string | — | 短语引号中字段的后缀，如 `".exact"` |

**REST API 示例**

```bash
# 基本语法
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "simple_query_string": {
      "query": "+无线 +降噪 -有线 | 蓝牙",
      "fields": ["name^3", "description"]
    }
  }
}'

# 禁用某些语法
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "simple_query_string": {
      "query": "Sony 耳机",
      "fields": ["name", "brand"],
      "flags": "AND|OR|PHRASE"
    }
  }
}'
```

**注意事项**

- 语法规则：`+` 表示 AND，`|` 表示 OR，`-` 表示 NOT，`*` 表示前缀，`"..."` 表示短语。
- 与 `query_string` 不同，语法错误不会抛异常，而是将无效部分作为普通词项处理。
- 建议通过 `flags` 限制可用语法，避免用户输入特殊字符造成意外行为。

---

### intervals

**概念定义**

`intervals` 是 8.x 中的高级全文查询，用于对词项在文档中的 **位置关系** 进行细粒度控制。支持 `match`、`all_of`、`any_of`、`filter` 等规则，可精确描述词项间的顺序、距离、包含等关系。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `<field>` | Object | — | 字段名，其下为规则定义 |
| `match` | Object | — | 匹配单个词项或短语 |
| `all_of` | Object | — | 所有子规则必须匹配，可通过 `ordered` 控制顺序 |
| `any_of` | Object | — | 任意子规则匹配即可 |
| `filter` | Object | — | 基于 `all_of` 或 `any_of`，对其结果进一步过滤 |
| `max_gaps` | integer | — | `filter` 规则中，子规则间允许的最大间隔 |
| `ordered` | boolean | — | `all_of` 中是否要求子规则按顺序出现 |

**REST API 示例**

```bash
# match 基本规则
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "intervals": {
      "description": {
        "match": {
          "query": "降噪",
          "max_gaps": 0,
          "ordered": true
        }
      }
    }
  }
}'

# all_of + filter 组合
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "intervals": {
      "description": {
        "all_of": {
          "ordered": true,
          "intervals": [
            { "match": { "query": "无线" } },
            { "match": { "query": "降噪" } }
          ],
          "filter": {
            "not_containing": {
              "match": { "query": "有线" }
            }
          }
        }
      }
    }
  }
}'
```

**注意事项**

- `intervals` 查询比 `match_phrase` 更灵活，但语法复杂度更高。
- 适合法律文本、专利搜索等需要精确位置控制的场景。
- `filter` 规则中的 `not_containing`、`containing` 等子规则可实现复杂的排除和包含逻辑。
- 性能开销比 `match_phrase` 大，小规模索引使用无感，海量数据需评估。

---

## 词项查询

### term

**概念定义**

`term` 查询在倒排索引中查找 **精确词项**，不对输入文本进行分词。适用于 `keyword` 类型字段、`boolean`、`numeric`、`date` 等精确值字段。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | string/number/boolean | — | 精确匹配的值 |
| `boost` | float | 1.0 | 权重 |
| `case_insensitive` | boolean | false | 8.10+ 支持，是否忽略大小写 |

**REST API 示例**

```bash
# keyword 字段精确匹配
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "term": {
      "brand.keyword": "Sony"
    }
  }
}'

# 数值精确匹配
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "term": {
      "status": 1
    }
  }
}'
```

**注意事项**

- 对 `text` 字段使用 `term` 查询时，需要知道该字段分词后的确切词项（通常是小写），否则无法匹配。
- 对 `keyword` 字段使用 `term` 查询时，值必须与索引时完全一致（大小写敏感）。
- 8.10+ 版本支持 `case_insensitive: true`，需在映射中配置 `normalizer`。

---

### terms

**概念定义**

`terms` 查询是 `term` 的批量版本，匹配字段值等于数组中 **任意一个值** 的文档（逻辑 OR）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | array | — | 待匹配的值列表 |
| `boost` | float | 1.0 | 权重 |
| `index` | string | — | Terms Lookup 时，指定源索引名 |
| `id` | string | — | Terms Lookup 时，指定源文档 ID |
| `path` | string | — | Terms Lookup 时，指定源文档中的字段路径 |

**REST API 示例**

```bash
# 基本 terms 查询
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "terms": {
      "brand.keyword": ["Sony", "Bose", "Sennheiser"]
    }
  }
}'

# Terms Lookup：从其他文档获取值
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "terms": {
      "brand.keyword": {
        "index": "favorites",
        "id": "user_123",
        "path": "preferred_brands"
      }
    }
  }
}'
```

**注意事项**

- `terms` 查询不计算评分（即使放在 Query Context 中，每个匹配的 term 评分相同）。
- Terms Lookup 功能强大但需注意网络开销和数据一致性。
- 大量值（数千以上）时性能下降，考虑使用 `terms_set` 或改用 Filter。

---

### range

**概念定义**

`range` 查询匹配字段值在指定范围内的文档，支持数值、日期、IP 等类型。支持 `gt`、`gte`、`lt`、`lte` 四个边界参数。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `gt` | number/date | — | 大于 |
| `gte` | number/date | — | 大于等于 |
| `lt` | number/date | — | 小于 |
| `lte` | number/date | — | 小于等于 |
| `format` | string | — | 日期格式，如 `"yyyy-MM-dd"` |
| `time_zone` | string | — | 日期查询时区，如 `"+08:00"` |
| `relation` | string | `"INTERSECTS"` | 与 range 字段的关系：`INTERSECTS` / `CONTAINS` / `WITHIN` |
| `boost` | float | 1.0 | 权重 |

**REST API 示例**

```bash
# 数值范围
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "range": {
      "price": {
        "gte": 500,
        "lte": 2000
      }
    }
  }
}'

# 日期范围
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "range": {
      "created_at": {
        "gte": "2024-01-01",
        "lte": "2024-12-31",
        "format": "yyyy-MM-dd",
        "time_zone": "+08:00"
      }
    }
  }
}'
```

**注意事项**

- 日期范围查询中，`now` 表达式（如 `"now-7d/d"`）非常常用，但不会被缓存。
- `time_zone` 参数确保日期边界在不同时区下正确计算。
- 对 `range` 字段类型（如 `integer_range`），`relation` 参数控制范围匹配语义。

---

### exists

**概念定义**

`exists` 查询返回 **指定字段存在且有值** 的文档。字段值为 `null` 或 `[]`（空数组）视为不存在。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | string | — | 要检查是否存在的字段名 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "exists": {
      "field": "discount_price"
    }
  }
}'
```

**注意事项**

- `null` 值在 Elasticsearch 中不会被索引，`exists` 无法匹配。
- 空字符串 `""` 被视为存在。
- 空数组 `[]` 被视为不存在（8.x 行为）。
- `exists` 通常放在 `bool.filter` 中使用，因为不需要评分。
- 在 `must_not` + `exists` 组合中可查询缺失某字段的文档。

---

### prefix

**概念定义**

`prefix` 查询匹配字段值以指定前缀开头的文档。对 `keyword` 字段效率较高，对 `text` 字段效率较低。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | string | — | 前缀字符串 |
| `case_insensitive` | boolean | false | 8.10+ 是否忽略大小写 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "prefix": {
      "brand.keyword": "Son"
    }
  }
}'
```

**注意事项**

- 对 `keyword` 字段性能较好，对 `text` 字段需遍历所有词项，性能较差。
- 大规模前缀匹配时，优先考虑使用 `edge_ngram` 分词器建立专用索引字段。
- 前缀查询在 Filter Context 中效果更好，无需评分。
- 8.10+ 支持 `case_insensitive`，依赖字段的 `normalizer` 配置。

---

### wildcard

**概念定义**

`wildcard` 查询支持通配符匹配：`*` 匹配任意字符序列，`?` 匹配任意单个字符。与 `prefix` 类似，对 `keyword` 字段性能较好。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | string | — | 通配符表达式 |
| `boost` | float | 1.0 | 权重 |
| `case_insensitive` | boolean | false | 8.10+ 是否忽略大小写 |
| `wildcard` | string | — | 同 `value`，两者等价 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "wildcard": {
      "sku.keyword": "WH-1000XM*"
    }
  }
}'
```

**注意事项**

- 以 `*` 或 `?` 开头的前置通配符极其消耗资源，应避免在大型索引上使用。
- 如果前缀固定，优先使用 `prefix` 查询，性能更好。
- 可考虑用 `ngram` 分词器替代运行时通配符查询。

---

### regexp

**概念定义**

`regexp` 查询使用正则表达式匹配词项。Elasticsearch 使用 Lucene 的正则引擎，支持锚定操作符（`^`、`$`）、字符类、重复等，但不支持部分 Perl 特性（如前瞻/后顾）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | string | — | 正则表达式 |
| `flags` | string | `"ALL"` | 可选标志：`COMPLEMENT`/`INTERVAL`/`INTERSECTION`/`ANYSTRING`/`EMPTY`/`NONE`/`ALL` |
| `max_determinized_states` | integer | 10000 | 正则自动机的最大状态数，防止内存爆炸 |
| `case_insensitive` | boolean | false | 8.10+ 是否忽略大小写 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "regexp": {
      "sku.keyword": "WH-1000XM[0-9]"
    }
  }
}'
```

**注意事项**

- 正则表达式查询性能较差，应避免在大型索引的热数据上使用。
- `max_determinized_states` 防止过于复杂的正则导致内存溢出，如果查询失败可适当调大该值。
- 尽可能将正则查询限定在 `keyword` 字段上。
- 优先考虑用 `ngram` 索引或 `prefix` 查询替代复杂正则。

---

### fuzzy

**概念定义**

`fuzzy` 查询基于 **Damerau-Levenshtein 编辑距离** 进行模糊匹配，允许指定编辑距离（增删改换字符），用于处理拼写错误。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `value` | string | — | 待匹配的值 |
| `fuzziness` | string | `"AUTO"` | 最大编辑距离：`"AUTO"`（3-6 字符允许 1，6+ 允许 2），或指定 0/1/2 |
| `max_expansions` | integer | 50 | 模糊匹配最大扩展词项数 |
| `prefix_length` | integer | 0 | 前缀必须精确匹配的字符数 |
| `transpositions` | boolean | true | 是否允许相邻字符交换（Damerau-Levenshtein 特性） |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "fuzzy": {
      "name.keyword": {
        "value": "Sonyy",
        "fuzziness": "AUTO",
        "prefix_length": 2
      }
    }
  }
}'
```

**注意事项**

- `fuzziness: AUTO` 是推荐值：长度为 0-2 不允许错误，3-5 允许 1 个错误，6+ 允许 2 个错误。
- `prefix_length` 可显著提升性能，固定前缀越长，扩展词项越少。
- 模糊查询在 `match` 查询中也可通过 `fuzziness` 参数使用，但 `fuzzy` 查询是独立的词项级查询。
- 对 `text` 字段使用模糊查询时，是对分词后的每个词项分别模糊匹配，而非对整个文本。

---

### ids

**概念定义**

`ids` 查询根据文档 `_id` 进行精确匹配，是最快的查询之一，直接通过 `_id` 字段查找。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `values` | string[] | — | 文档 `_id` 列表 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "ids": {
      "values": ["prod_001", "prod_005", "prod_012"]
    }
  }
}'
```

**注意事项**

- 等价于 `terms` 查询 `_id` 字段，但语法更简洁。
- 不需要评分，通常放在 `bool.filter` 中使用。
- 与 `_mget` API 不同，`ids` 查询返回的是完整搜索结果格式（含 `_score`、`hits` 元数据等）。

---

## 复合查询

### bool（must / filter / should / must_not）

**概念定义**

`bool` 查询是 Elasticsearch 中最重要的复合查询，将多个查询子句按四种逻辑组合：

- **must**：子句必须匹配，参与评分（Query Context）。
- **filter**：子句必须匹配，不参与评分（Filter Context），结果可缓存。
- **should**：子句应该匹配，匹配越多得分越高（Query Context）。如果 `bool` 中没有 `must`/`filter`，则至少一个 `should` 必须匹配。
- **must_not**：子句必须不匹配，不参与评分（Filter Context），结果可缓存。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `must` | Object / Array | — | 必须满足的查询条件，参与评分 |
| `filter` | Object / Array | — | 必须满足的过滤条件，不参与评分 |
| `should` | Object / Array | — | 可选满足的条件，用于提升评分 |
| `must_not` | Object / Array | — | 必须不满足的条件，不参与评分 |
| `minimum_should_match` | string/integer | 0 | 最少需要满足的 `should` 子句数 |
| `boost` | float | 1.0 | 整体权重 |

**REST API 示例**

```bash
# 典型的电商搜索
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "bool": {
      "must": [
        { "match": { "name": "无线降噪耳机" } }
      ],
      "filter": [
        { "term": { "status": 1 } },
        { "range": { "price": { "gte": 500, "lte": 3000 } } }
      ],
      "should": [
        { "term": { "brand.keyword": { "value": "Sony", "boost": 2 } } },
        { "term": { "is_promotion": true } }
      ],
      "must_not": [
        { "term": { "is_deleted": true } }
      ],
      "minimum_should_match": 1
    }
  }
}'
```

**注意事项**

- `filter` 结果被缓存，应将不依赖评分的固定条件放入 `filter`。
- `must_not` 中的子句虽不参与评分，但会影响搜索结果的召回。
- 当 `bool` 中只有 `should`（无 `must`/`filter`）时，默认至少一个 `should` 匹配；可通过 `minimum_should_match: 0` 覆盖此行为。
- `bool` 查询支持嵌套，可实现复杂的逻辑组合。

---

### dis_max

**概念定义**

`dis_max`（Disjunction Max）将多个查询子句的分数取 **最大值** 作为最终分数，而非求和。适用于同一概念以不同方式表达的场景（如不同字段存储相同内容）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `queries` | Object[] | — | 子查询列表 |
| `tie_breaker` | float | 0.0 | 0~1，其他子查询分数乘以该系数后加到最佳匹配分数上 |
| `boost` | float | 1.0 | 整体权重 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "dis_max": {
      "tie_breaker": 0.3,
      "queries": [
        { "match": { "name": "无线耳机" } },
        { "match": { "description": "无线耳机" } }
      ]
    }
  }
}'
```

**注意事项**

- `tie_breaker: 0` 时只取最高分，`tie_breaker: 1` 时等价于 `bool.should` 求和。
- 适合 `multi_match` 的 `best_fields` 类型无法满足需求时的自定义场景。
- `tie_breaker` 建议设置为 0.1~0.4，既保留最佳匹配的优势，又对多字段匹配给予一定奖励。

---

### constant_score

**概念定义**

`constant_score` 将内部查询的评分结果替换为固定分数，内部查询子句的匹配文档全部获得相同的 `_score`。适用于仅需过滤、不关心相关性的场景。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `filter` | Object | — | 内部查询 / 过滤条件 |
| `boost` | float | 1.0 | 统一分数值 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "constant_score": {
      "filter": {
        "term": { "brand.keyword": "Sony" }
      },
      "boost": 1.5
    }
  }
}'
```

**注意事项**

- 内部 `filter` 的结果会被缓存（Filter Context 特性）。
- 如果内部查询需要评分，应使用 `bool.filter` 或其他方式。
- `boost` 值即为所有匹配文档的统一分数。

---

### boosting

**概念定义**

`boosting` 查询通过 **降权（而非排除）** 某些匹配文档来调整排序。包含 `positive`（正向查询）和 `negative`（负向查询），匹配 `negative` 的文档的分数乘以 `negative_boost` 系数。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `positive` | Object | — | 正向查询，文档必须匹配 |
| `negative` | Object | — | 负向查询，匹配的文档被降权 |
| `negative_boost` | float | — | 降权系数，0~1，值越小降权幅度越大 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "boosting": {
      "positive": {
        "match": { "name": "耳机" }
      },
      "negative": {
        "term": { "is_outdated": true }
      },
      "negative_boost": 0.2
    }
  }
}'
```

**注意事项**

- 与 `must_not` 不同，`boosting` 不会排除文档，只是降低其排序权重。
- `negative_boost` 取值在 0 到 1 之间，0 表示完全降权到 0，1 表示不降权。
- 适合"不排除但降权"的场景，如将过时商品排在后面。

---

### function_score

**概念定义**

`function_score` 通过一个或多个 **评分函数** 修改查询结果的原始 `_score`，支持 `weight`、`random_score`、`field_value_factor`、`script_score`、`decay` 函数，以及 `boost_mode` 和 `score_mode` 控制分数组合方式。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `query` | Object | — | 基础查询 |
| `functions` | Object[] | — | 评分函数数组 |
| `boost_mode` | string | `"multiply"` | 函数分数与原始分数的组合方式：`multiply` / `sum` / `avg` / `replace` / `min` / `max` |
| `score_mode` | string | `"multiply"` | 多个函数分数的组合方式：`multiply` / `sum` / `avg` / `first` / `max` / `min` |
| `max_boost` | float | `FLT_MAX` | 分数上限 |
| `min_score` | float | — | 最低分数阈值，低于此分数的文档被过滤 |
| `boost` | float | 1.0 | 整体权重 |

#### 函数类型

| 函数 | 说明 |
|------|------|
| `weight` | 简单乘以固定权重 |
| `random_score` | 随机分数，用于随机排序 |
| `field_value_factor` | 基于文档字段值计算分数 |
| `script_score` | 使用 Painless 脚本计算分数 |
| `decay`（gauss/linear/exp） | 基于数值/日期/地理距离的衰减函数 |

**REST API 示例**

```bash
# field_value_factor + weight
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "function_score": {
      "query": { "match": { "name": "耳机" } },
      "functions": [
        {
          "field_value_factor": {
            "field": "sales_count",
            "factor": 0.1,
            "modifier": "log1p",
            "missing": 0
          },
          "weight": 2
        }
      ],
      "boost_mode": "multiply"
    }
  }
}'

# 衰减函数（gauss）
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "function_score": {
      "query": { "match_all": {} },
      "functions": [
        {
          "gauss": {
            "price": {
              "origin": 1000,
              "scale": 500,
              "decay": 0.5
            }
          }
        }
      ],
      "boost_mode": "multiply"
    }
  }
}'
```

**注意事项**

- `field_value_factor` 的 `modifier` 支持 `none`/`log`/`log1p`/`log2p`/`ln`/`ln1p`/`ln2p`/`square`/`sqrt`/`reciprocal`，用于平滑字段值的影响。
- 衰减函数（`gauss`/`linear`/`exp`）中，`scale` 越大衰减越慢，`decay` 决定在 `origin + scale` 处的分数。
- `function_score` 计算开销较大，大量文档时需注意性能。
- 使用 `random_score` 时需提供 `seed` 和 `field` 以保证可复现。

---

## 结果处理

### 高亮（Highlight）

**概念定义**

高亮（Highlight）在搜索结果中标记与查询匹配的文本片段，返回带 `<em>` 标签的 HTML 片段。支持三种高亮器：`unified`（默认）、`plain`、`fvh`（Fast Vector Highlighter）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fields` | Object | — | 需要高亮的字段及配置 |
| `type` | string | `"unified"` | 高亮器类型：`unified` / `plain` / `fvh` |
| `pre_tags` / `post_tags` | string[] | `["<em>"]` / `["</em>"]` | 高亮标签 |
| `fragment_size` | integer | 100 | 高亮片段长度（字符数） |
| `number_of_fragments` | integer | 5 | 返回的片段数量 |
| `no_match_size` | integer | 0 | 无匹配字段的返回长度 |
| `boundary_scanner` | string | — | 片段边界扫描器：`chars` / `sentence` / `word` |
| `require_field_match` | boolean | true | 是否只高亮匹配的字段 |
| `highlight_query` | Object | — | 自定义高亮查询，覆盖原始查询 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "match": { "description": "无线降噪耳机" }
  },
  "highlight": {
    "pre_tags": ["<mark>"],
    "post_tags": ["</mark>"],
    "fields": {
      "description": {
        "fragment_size": 150,
        "number_of_fragments": 3,
        "type": "unified"
      },
      "name": {
        "number_of_fragments": 0
      }
    }
  }
}'
```

**注意事项**

- `unified` 高亮器（默认）使用 BM25 算法选择最佳片段，性能与质量兼顾。
- `fvh` 需要字段的 `term_vector` 设置为 `with_positions_offsets`，占用更多存储但高亮速度最快。
- `plain` 高亮器是传统实现，适用于简单场景。
- `number_of_fragments: 0` 返回整个字段内容（带高亮标签），适合短文本字段。
- 高亮会增加查询开销，建议只对需要显示的字段开启。

---

### 排序（Sort）

**概念定义**

排序（Sort）控制搜索结果的返回顺序。默认按 `_score` 降序排列，可指定一个或多个字段进行自定义排序，支持 `asc`、`desc`，以及 `nested` 排序、`geo_distance` 排序、`script` 排序。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | string | `_score` | 排序字段 |
| `order` | string | `desc`（`_score`）/ `asc`（其他） | `asc` / `desc` |
| `mode` | string | — | 多值字段排序模式：`min` / `max` / `sum` / `avg` / `median` |
| `missing` | string / number | `"_last"` | 缺失值排序位置：`_first` / `_last` 或自定义值 |
| `unmapped_type` | string | — | 未映射字段的类型推断 |
| `nested` | Object | — | 嵌套对象排序配置 |
| `format` | string | — | 日期格式化 |

**REST API 示例**

```bash
# 多字段排序
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match_all": {} },
  "sort": [
    { "sales_count": { "order": "desc" } },
    { "price": { "order": "asc" } },
    { "_score": { "order": "desc" } }
  ]
}'

# 缺失值处理
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match_all": {} },
  "sort": [
    { "rating": { "order": "desc", "missing": 0 } }
  ]
}'
```

**注意事项**

- 对 `text` 字段排序需使用 `field.keyword` 子字段。
- 排序字段的值会被加载到 `fielddata` 缓存（或使用 `doc_values`），可能占用大量堆内存。
- 多字段排序按数组顺序依次应用，前一字段相同时才比较后一字段。
- 使用 `_score` 排序时，如果所有文档分数相同，结果顺序不确定，应添加第二个排序字段（如 `_id`）保证确定性。

---

### 分页（from + size）

**概念定义**

`from` 和 `size` 是 Elasticsearch 最基本的分页方式。`from` 指定跳过的文档数，`size` 指定返回的文档数。内部实现为分布式系统中的"浅分页"。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `from` | integer | 0 | 起始偏移量（跳过的文档数） |
| `size` | integer | 10 | 每页返回的文档数 |
| `track_total_hits` | integer / boolean | 10000 | 精确追踪命中总数。设为 `true` 精确追踪全部，设为 `false` 不追踪 |

**REST API 示例**

```bash
# 第 3 页，每页 20 条
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match_all": {} },
  "from": 40,
  "size": 20,
  "track_total_hits": true,
  "sort": [
    { "created_at": { "order": "desc" } }
  ]
}'
```

**注意事项**

- `from + size` 的总和不能超过 `index.max_result_window`（默认 10000），更深的分页需使用 `search_after` 或 Scroll。
- 每个分片需构建一个 `from + size` 大小的优先队列，然后协调节点合并排序。`from` 越大，内存和 CPU 开销越高。
- `track_total_hits` 设为 `false` 可提升查询性能，适用于不需要精确总数的场景（如无限滚动）。
- 推荐使用 `sort` 字段确保分页结果一致性，否则可能因文档增删导致重复或遗漏。

---

### search_after

**概念定义**

`search_after` 是深度分页的推荐方案，基于上一页最后一条文档的排序值获取下一页。不支持跳页，但可遍历全部结果，无 `from + size` 的 10000 条限制。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `search_after` | array | — | 上一页最后一条文档的排序值数组 |
| `size` | integer | 10 | 每页返回的文档数 |
| `sort` | array | — | 排序字段，必须包含唯一值字段（如 `_id`）作为最后排序键，保证分页确定性 |

**REST API 示例**

```bash
# 第一页
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match": { "name": "耳机" } },
  "size": 20,
  "sort": [
    { "price": "asc" },
    { "_id": "asc" }
  ]
}'

# 第二页：使用上一页最后一条的 sort 值
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match": { "name": "耳机" } },
  "size": 20,
  "search_after": [599.00, "prod_042"],
  "sort": [
    { "price": "asc" },
    { "_id": "asc" }
  ]
}'
```

**注意事项**

- 排序字段的最后一个必须是 **唯一值**（如 `_id` 或 `_doc`），否则可能因排序值相同而导致分页重复或遗漏。
- `search_after` 不支持跳页，只能顺序翻页，适合无限滚动和导出场景。
- 与 PIT 结合使用可保证分页期间数据一致性。
- 不依赖 `track_total_hits`，可设为 `false` 提升性能。

---

### PIT（Point in Time）

**概念定义**

PIT（Point in Time）是 8.x 中替代 Scroll 的推荐方案。PIT 创建一个索引的时间点快照，在该快照上进行搜索，即使索引数据持续更新，搜索结果保持一致性。PIT 通过 `pit.id` 和 `search_after` 配合实现一致性深度分页。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `id` | string | — | PIT ID，由 `_pit` API 创建 |
| `keep_alive` | string | — | PIT 存活时间，如 `"5m"`、`"1h"` |
| `pit` | Object | — | 用于搜索请求中替代 `index` 参数 |

**REST API 示例**

```bash
# 创建 PIT
curl -X POST "localhost:9200/products/_pit?keep_alive=5m" -H "Content-Type: application/json"

# 使用 PIT 搜索（返回结果中不指定 index）
curl -X POST "localhost:9200/_search?pretty" -H "Content-Type: application/json" -d'{
  "size": 20,
  "query": { "match": { "name": "耳机" } },
  "pit": {
    "id": "oO2VAQEGcHJvZHVjdHMWSkdaMk1qRGhUaUdDQ0xpQjVfVkNYZwAWbGp3b0x0dFJTaUtpZm0yR0FyVUpYUQAAAAAAAAAHPhZGeGZNcG4ta1N3S2lHTmJ2dmhFbE1nAAEWSkdaMk1qRGhUaUdDQ0xpQjVfVkNYZwAA",
    "keep_alive": "2m"
  },
  "sort": [
    { "price": "asc" },
    { "_id": "asc" }
  ]
}'

# 删除 PIT
curl -X DELETE "localhost:9200/_pit" -H "Content-Type: application/json" -d'{
  "id": "oO2VAQEGcHJvZHVjdHMWSkdaMk1qRGhUaUdDQ0xpQjVfVkNYZwAWbGp3b0x0dFJTaUtpZm0yR0FyVUpYUQAAAAAAAAAHPhZGeGZNcG4ta1N3S2lHTmJ2dmhFbE1nAAEWSkdaMk1qRGhUaUdDQ0xpQjVfVkNYZwAA"
}'
```

**注意事项**

- PIT 创建后占用节点资源（文件句柄、内存），使用完毕后必须显式删除或等待 `keep_alive` 过期。
- PIT 搜索中不能使用 `index` 参数，只能使用 `pit.id`。
- PIT 与 `search_after` 结合是实现一致性深度分页的最佳实践。
- PIT 创建时锁定索引的段，在此期间已删除的文档仍可见。

---

### Scroll（已废弃）

**概念定义**

Scroll 是旧版深度分页方案，在 7.x 中标记为废弃，8.x 中保留但推荐使用 `search_after` + PIT 替代。Scroll 创建一个服务端游标，维持搜索上下文，适合一次性导出大量数据。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `scroll` | string | — | 搜索上下文存活时间，如 `"1m"` |
| `scroll_id` | string | — | Scroll 上下文 ID，用于后续翻页 |

**注意事项**

- Scroll 不支持跳页，只能顺序遍历。
- 维护搜索上下文消耗大量堆内存，并发 Scroll 请求过多可能导致 OOM。
- 推荐迁移到 `search_after` + PIT 方案，8.x 中新增功能不再支持 Scroll 参数。
- 如确需导出全量数据，优先考虑 `_search` + `search_after` + PIT。

---

### _source 过滤

**概念定义**

`_source` 过滤允许在搜索结果的 `_source` 中仅返回指定字段，减少网络传输和内存开销。支持 `includes`（包含）和 `excludes`（排除）模式，支持通配符 `*`。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `_source` | boolean / Object | true | `false` 禁用返回 `_source`；Object 配置 `includes`/`excludes` |
| `_source.includes` | string[] | — | 包含的字段列表，支持通配符 |
| `_source.excludes` | string[] | — | 排除的字段列表，支持通配符 |
| `fields` | string[] | — | 8.x 推荐方式，使用 `fields` 替代 `_source` 过滤 |
| `stored_fields` | string[] | — | 返回存储字段（`store: true` 的字段） |

**REST API 示例**

```bash
# 包含/排除模式
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match": { "name": "耳机" } },
  "_source": {
    "includes": ["name", "brand", "price", "rating"],
    "excludes": ["*.keyword", "*.raw"]
  }
}'

# 使用 fields（8.x 推荐）
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": { "match": { "name": "耳机" } },
  "fields": ["name", "brand", "price"],
  "_source": false
}'
```

**注意事项**

- `_source: false` 时文档内容不返回，但 `hits.total` 等元数据正常返回。
- `fields` 参数（8.x 推荐）比 `_source` 更灵活，支持运行时字段、格式化等。
- `includes` 和 `excludes` 可同时使用，排除优先于包含。
- `stored_fields` 仅返回显式标记 `store: true` 的字段，与 `_source` 无关。

---

## Painless 脚本

**概念定义**

Painless 是 Elasticsearch 的默认脚本语言，语法类似 Java，具有沙箱安全机制、类型推断和编译缓存。用于 `script_score`、`script` 过滤、`script` 聚合、`reindex`、`update` 等场景。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `source` | string | — | 脚本源代码（内联） |
| `id` | string | — | 存储脚本的 ID（引用已存储的脚本） |
| `params` | Object | — | 传递给脚本的参数，通过 `params.xxx` 访问 |
| `lang` | string | `"painless"` | 脚本语言 |

---

### script_score

**概念定义**

`script_score` 是 `function_score` 中的一种评分函数，使用 Painless 脚本基于文档字段值计算自定义分数。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `script.source` | string | — | 脚本源代码 |
| `script.params` | Object | — | 脚本参数 |
| `script.lang` | string | `"painless"` | 脚本语言 |

**REST API 示例**

```bash
# 基于文档字段计算自定义分数
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "function_score": {
      "query": { "match": { "name": "耳机" } },
      "script_score": {
        "script": {
          "source": """
            double sales = doc['sales_count'].size() == 0 ? 0 : doc['sales_count'].value;
            double rating = doc['rating'].size() == 0 ? 0 : doc['rating'].value;
            return _score * (1 + Math.log1p(sales)) * (rating / 5.0);
          """,
          "params": {}
        }
      }
    }
  }
}'
```

**注意事项**

- `_score` 变量在 `script_score` 中代表原始查询分数，脚本返回的值为最终分数。
- 访问文档字段使用 `doc['field_name'].value`（从 doc_values 读取），需在映射中启用 `doc_values: true`。
- 字段值可能缺失，必须检查 `doc['field'].size() == 0`，否则抛出异常。
- 脚本计算开销较大，避免在 `script_score` 中进行复杂计算或访问 `_source`（需加载整个文档）。

---

### script 过滤

**概念定义**

`script` 查询/过滤使用 Painless 脚本对文档进行自定义布尔判断，返回 `true` 或 `false`。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `script.source` | string | — | 脚本源代码，返回 `boolean` |
| `script.params` | Object | — | 脚本参数 |

**REST API 示例**

```bash
# 脚本过滤：价格高于平均值的文档
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "bool": {
      "filter": {
        "script": {
          "script": {
            "source": "doc['price'].value > params.threshold",
            "params": {
              "threshold": 1000
            }
          }
        }
      }
    }
  }
}'
```

**注意事项**

- `script` 过滤不参与评分，通常放在 `bool.filter` 中。
- 脚本过滤逐文档执行，性能远低于普通查询，尽量使用 `term`/`range` 等替代。
- 脚本中避免使用 `_source`，应使用 `doc['field']` 从 doc_values 读取。

---

### script 聚合

**概念定义**

`script` 聚合允许在聚合操作中使用 Painless 脚本动态计算聚合值。支持 `script` 作为 `terms` 聚合的键、`avg`/`sum` 等指标聚合的值来源。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `script.source` | string | — | 脚本源代码 |
| `script.params` | Object | — | 脚本参数 |

**REST API 示例**

```bash
# 脚本计算折扣价后聚合
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "size": 0,
  "aggs": {
    "avg_discounted_price": {
      "avg": {
        "script": {
          "source": "doc['price'].value * (1 - doc['discount_rate'].value / 100.0)",
          "lang": "painless"
        }
      }
    }
  }
}'
```

**注意事项**

- 聚合中的脚本在每个文档的聚合操作中执行，大量文档时性能开销显著。
- 可使用 `runtime_mappings`（运行时字段）替代脚本聚合，将计算前置到索引时，8.x 推荐此方式。
- `size: 0` 不返回搜索结果，只返回聚合结果，节省带宽。

---

### Painless 语法要点

**概念定义**

Painless 是 Elasticsearch 内置的安全脚本语言，语法与 Java 高度相似，但运行在沙箱中，限制了对系统资源、网络的访问。

#### 语法要点

| 特性 | 说明 | 示例 |
|------|------|------|
| 变量声明 | 支持 `def` 和具体类型 | `int x = 10;` 或 `def y = "hello";` |
| 文档字段访问 | `doc['field'].value` | `doc['price'].value` |
| 字段缺失检查 | `.size()` | `doc['field'].size() == 0` |
| 参数访问 | `params.xxx` | `params.threshold` |
| 原始分数 | `_score`（仅 `script_score` 中可用） | `return _score * 2;` |
| 数学函数 | Java Math 类函数 | `Math.log1p(x)`、`Math.sqrt(x)` |
| 字符串操作 | 支持基本字符串方法 | `params.name.toLowerCase()` |
| 日期处理 | `doc['date'].value.toInstant()` | `.toEpochMilli()` |
| 列表/Map | 支持 `List`、`Map` | `params.tags.contains('new')` |
| 三元运算符 | `?:` | `doc['price'].size() == 0 ? 0 : doc['price'].value` |
| 循环 | `for`/`while` | `for (def item : params.items) { ... }` |
| 异常处理 | 不支持 try/catch | 必须用防御式编程检查字段存在性 |

**REST API 示例**

```bash
# 创建存储脚本
curl -X POST "localhost:9200/_scripts/discount_price" -H "Content-Type: application/json" -d'{
  "script": {
    "lang": "painless",
    "source": "doc['price'].value * (1 - params.discount / 100.0)"
  }
}'

# 使用存储脚本
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "query": {
    "script_score": {
      "query": { "match_all": {} },
      "script": {
        "id": "discount_price",
        "params": { "discount": 15 }
      }
    }
  }
}'
```

**注意事项**

- Painless 脚本会被编译并缓存，相同的脚本（包括参数名）只编译一次。
- 脚本中不能使用反射、不能创建线程、不能访问网络、不能调用系统命令。
- 字段访问使用 `doc['field']` 从 doc_values 读取，速度最快；`params._source` 访问原始文档需加载整个 `_source`。
- 推荐使用存储脚本（`id` 引用）代替内联脚本，便于版本管理和复用。
- 脚本调试：可使用 `_scripts/painless/_execute` API 或 `explain` API 中的 `script` 调试。

---

## 搜索建议

### Completion Suggester

**概念定义**

Completion Suggester 是 **基于前缀** 的自动补全功能，使用 Finite State Transducer（FST）数据结构，查询速度极快（O(前缀长度)），适用于搜索框的即时建议（typeahead / autocomplete）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | string | — | `completion` 类型的字段名 |
| `prefix` | string | — | 前缀文本 |
| `size` | integer | 5 | 返回的建议数量 |
| `skip_duplicates` | boolean | false | 是否跳过重复建议 |
| `fuzzy` | Object | — | 模糊匹配配置 |
| `contexts` | Object | — | 上下文过滤（如类别、地理位置） |

#### 映射配置

```bash
# 创建带 completion 字段的索引
curl -X PUT "localhost:9200/product_suggestions" -H "Content-Type: application/json" -d'{
  "mappings": {
    "properties": {
      "name": { "type": "text" },
      "name_suggest": {
        "type": "completion",
        "analyzer": "standard"
      }
    }
  }
}'

# 索引带建议的文档
curl -X PUT "localhost:9200/product_suggestions/_doc/1" -H "Content-Type: application/json" -d'{
  "name": "Sony WH-1000XM5 无线降噪耳机",
  "name_suggest": {
    "input": ["Sony WH-1000XM5", "WH-1000XM5", "无线降噪耳机"]
  }
}'
```

**REST API 示例**

```bash
curl -X POST "localhost:9200/product_suggestions/_search?pretty" -H "Content-Type: application/json" -d'{
  "suggest": {
    "product_suggest": {
      "prefix": "无线",
      "completion": {
        "field": "name_suggest",
        "size": 5,
        "skip_duplicates": true
      }
    }
  }
}'
```

**注意事项**

- Completion Suggester 仅支持前缀匹配，不支持中缀或后缀匹配。
- 需要创建 `completion` 类型的专用字段，并预先将建议词项索引到 `input` 数组中。
- FST 存储在内存中，大量建议词项会占用 JVM 堆内存。
- 模糊匹配（`fuzzy`）可纠正常见拼写错误，但会增加延迟。
- 对于中文补全，建议使用 `icu_analyzer` 或 `pinyin` 分词器。

---

### Phrase Suggester

**概念定义**

Phrase Suggester 基于 n-gram 语言模型，在 **短语级别** 提供纠错建议。不仅考虑单个词项的正确性，还考虑词项间的共现关系，适合搜索"Did you mean?"场景。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | string | — | 建议器字段 |
| `text` | string | — | 待纠错文本 |
| `size` | integer | 1 | 返回的建议短语数 |
| `gram_size` | integer | 1 | n-gram 大小，最大 3 |
| `max_errors` | float | 1.0 | 允许的最大错误比例（0~1），或整数表示最大错误词项数 |
| `confidence` | float | 1.0 | 置信度阈值，越高建议越保守 |
| `direct_generator` | Object[] | — | 候选生成器，通常为 `term` 建议器 |
| `collate` | Object | — | 校验建议是否产生匹配结果的查询 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "suggest": {
    "text": "无线酱噪耳机",
    "phrase_suggestion": {
      "phrase": {
        "field": "description",
        "size": 3,
        "gram_size": 2,
        "max_errors": 2,
        "confidence": 0.5,
        "direct_generator": [{
          "field": "description",
          "suggest_mode": "popular",
          "min_word_length": 1
        }]
      }
    }
  }
}'
```

**注意事项**

- Phrase Suggester 需要索引数据作为训练语料，数据量越大效果越好。
- `collate` 查询可验证建议短语是否至少匹配一个文档，避免建议无结果。
- `confidence` 越高，建议越保守，但可能遗漏正确的纠错。
- 比 Term Suggester 慢，但纠错效果更自然。

---

### Term Suggester

**概念定义**

Term Suggester 在 **词项级别** 提供拼写纠错，基于编辑距离为每个错误词项生成候选建议。速度快，适合简单的单词拼写纠正。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | string | — | 建议器字段 |
| `text` | string | — | 待纠错文本 |
| `size` | integer | 5 | 每个词项的建议数 |
| `suggest_mode` | string | `"missing"` | 建议模式：`missing` / `popular` / `always` |
| `max_edits` | integer | 2 | 最大编辑距离（1 或 2） |
| `prefix_length` | integer | 1 | 前缀必须精确匹配的字符数 |
| `min_word_length` | integer | 4 | 最小词项长度 |
| `string_distance` | string | `"internal"` | 编辑距离算法：`internal` / `damerau_levenshtein` / `levenshtein` / `jaro_winkler` / `ngram` |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search?pretty" -H "Content-Type: application/json" -d'{
  "suggest": {
    "text": "无线酱噪",
    "term_suggestion": {
      "term": {
        "field": "description",
        "suggest_mode": "popular",
        "min_word_length": 2,
        "string_distance": "damerau_levenshtein"
      }
    }
  }
}'
```

**注意事项**

- `suggest_mode: missing` 只对索引中不存在的词项给出建议（默认，最常用）。
- `suggest_mode: popular` 建议出现频率更高的词项。
- `suggest_mode: always` 总是给出建议，即使词项已存在。
- Term Suggester 不关心词项间关系，只纠正单个词项，适合简单拼写纠错。

---

### Context Suggester

**概念定义**

Context Suggester 是 Completion Suggester 的扩展，允许在自动补全时按 **上下文类别** 过滤建议。支持两种上下文类型：`category`（分类上下文）和 `geo`（地理位置上下文）。

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `contexts` | Object | — | 上下文过滤条件 |
| `contexts.<name>` | Object | — | 上下文名称，值为 `context` 对象数组 |
| `context` | string | — | `category` 类型上下文值 |
| `boost` | float | — | 上下文权重 |
| `lat` / `lon` | float | — | `geo` 类型上下文的经纬度 |
| `precision` | string | — | `geo` 精度，如 `"5km"`、`"10km"` |

#### 映射配置 + REST API 示例

```bash
# 创建带 context 的 completion 字段
curl -X PUT "localhost:9200/product_suggestions" -H "Content-Type: application/json" -d'{
  "mappings": {
    "properties": {
      "name_suggest": {
        "type": "completion",
        "contexts": [
          { "name": "category", "type": "category" },
          { "name": "location", "type": "geo", "precision": "5km" }
        ]
      }
    }
  }
}'

# 索引文档
curl -X PUT "localhost:9200/product_suggestions/_doc/1" -H "Content-Type: application/json" -d'{
  "name_suggest": {
    "input": ["无线降噪耳机"],
    "contexts": {
      "category": ["电子产品", "耳机"],
      "location": { "lat": 31.2304, "lon": 121.4737 }
    }
  }
}'

# 带上下文查询
curl -X POST "localhost:9200/product_suggestions/_search?pretty" -H "Content-Type: application/json" -d'{
  "suggest": {
    "product_suggest": {
      "prefix": "无线",
      "completion": {
        "field": "name_suggest",
        "contexts": {
          "category": ["电子产品"],
          "location": { "lat": 31.2304, "lon": 121.4737 }
        }
      }
    }
  }
}'
```

**注意事项**

- `category` 上下文最多支持 10 个类别，每个索引文档可指定多个类别。
- `geo` 上下文支持按地理位置精度过滤，`precision` 决定匹配阈值。
- 上下文过滤发生在 FST 层面，不会影响查询速度。
- 适合多租户、多品类场景下的差异化自动补全。

---

## 搜索模式

### Retriever 概述

**概念定义**

Retriever（检索器）是 Elasticsearch 8.x 引入的搜索抽象层，取代传统的 `query` + `knn` 顶层字段组合方式。Retriever 将不同类型的检索策略统一为可组合的检索器对象，通过 `retriever` 参数在 `_search` API 中声明。核心优势在于：支持多检索器并行执行、统一的 RRF 融合排序、更清晰的语义表达。

Retriever 的三种基础类型：

| 类型 | 说明 | 适用场景 |
|------|------|----------|
| `standard` | 标准查询检索器，包装任意 DSL Query | 关键词搜索、过滤查询 |
| `knn` | 向量 kNN 检索器 | 语义搜索、向量相似度检索 |
| `rrf` | 倒数排名融合检索器，合并多个子检索器 | 混合搜索（BM25 + 向量 / 多路召回） |

**与传统 query 的对比**

| 维度 | 传统 query | Retriever 模式 |
|------|-----------|---------------|
| 语法 | `{ "query": {...}, "knn": {...} }` | `{ "retriever": {...} }` |
| 混合搜索 | 手动组合 query + knn 顶层字段 | RRF 检索器自动融合 |
| 可组合性 | 低，query 和 knn 独立 | 高，任意数量检索器可嵌套 |
| 官方推荐 | 向后兼容 | 8.x 推荐，未来方向 |

---

### Standard Retriever

**概念定义**

Standard Retriever 将传统 DSL Query 包装为检索器对象，可独立使用或作为 RRF 的子检索器。支持所有标准查询类型（match、bool、term 等）。

**核心参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `query` | Object | 标准 DSL 查询对象 |
| `filter` | Object / Array | 可选，Filter Context 过滤条件 |
| `search_after` | Array | 可选，深度分页游标 |
| `sort` | Array / Object | 可选，排序规则 |
| `min_score` | float | 可选，最低分数阈值 |
| `collapse` | Object | 可选，字段折叠（去重） |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search" -H "Content-Type: application/json" -d'{
  "retriever": {
    "standard": {
      "query": {
        "bool": {
          "must": { "match": { "name": "无线耳机" } },
          "filter": { "term": { "brand": "sony" } }
        }
      }
    }
  },
  "size": 10
}'
```

---

### kNN Retriever

**概念定义**

kNN Retriever 将向量 kNN 搜索包装为检索器对象，可独立使用或作为 RRF 的子检索器。与传统的 `knn` 顶层字段功能一致，但语法更统一。

**核心参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `field` | String | 向量字段名 |
| `query_vector` | Array[float] | 查询向量 |
| `query_vector_builder` | Object | 动态向量生成（Inference 集成） |
| `k` | Integer | 返回的最近邻数量 |
| `num_candidates` | Integer | 每分片候选数（HNSW 内部参数） |
| `filter` | Object | 预过滤条件 |
| `similarity` | float | 最低相似度阈值 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search" -H "Content-Type: application/json" -d'{
  "retriever": {
    "knn": {
      "field": "name_vector",
      "query_vector": [0.12, -0.34, 0.78, 0.05, 0.91],
      "k": 10,
      "num_candidates": 100,
      "filter": {
        "term": { "status": "published" }
      }
    }
  }
}'
```

---

### RRF Retriever

**概念定义**

RRF（Reciprocal Rank Fusion）Retriever 是 Retriever 模式的核心能力，将多个子检索器（Standard、kNN）的结果通过倒数排名融合算法合并排序。RRF 不依赖原始分数的量级，仅基于各子列表中排名位置计算融合分数。

**RRF 公式**

```
RRF_score(d) = sum_over_retrievers( 1 / (k + rank_i(d)) )
```

**核心参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `retrievers` | Array | — | 子检索器列表（Standard / kNN） |
| `rank_constant` | Integer | 60 | 排名平滑常数，越大越平滑 |
| `rank_window_size` | Integer | 100 | 每个子检索器参与融合的窗口大小 |

**REST API 示例**

```bash
curl -X POST "localhost:9200/products/_search" -H "Content-Type: application/json" -d'{
  "retriever": {
    "rrf": {
      "retrievers": [
        {
          "standard": {
            "query": {
              "multi_match": {
                "query": "无线降噪耳机",
                "fields": ["name^3", "description"]
              }
            }
          }
        },
        {
          "knn": {
            "field": "name_vector",
            "query_vector": [0.12, -0.34, 0.78],
            "k": 10,
            "num_candidates": 100
          }
        }
      ],
      "rank_constant": 60,
      "rank_window_size": 100
    }
  },
  "size": 10
}'
```

**注意事项**

- RRF 是无监督融合算法，不需要训练或调参，`rank_constant` 通常保持默认值 60 即可。
- `rank_window_size` 控制每个子检索器贡献的排名范围，增大可提高召回但增加计算成本。
- 子检索器的 `k` 值应略大于最终返回数，以提供更多候选给 RRF 融合。
- Retriever 模式与传统的 `query` + `knn` 顶层写法互斥，不能同时使用。
- 8.12+ 版本推荐使用 Retriever 模式进行混合搜索，是官方后续重点发展方向。

---

