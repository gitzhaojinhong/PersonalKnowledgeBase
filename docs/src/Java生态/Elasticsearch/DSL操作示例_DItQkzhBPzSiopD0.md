## DSL操作示例

## 索引操作

### 创建索引 + Mapping

```json
PUT /product_es8
{
  "mappings": {
    "properties": {
      "product_name": {
        "type": "text",
        "fields": {
          "keyword": {"type":"keyword","ignore_above":256}
        }
      },
      "category": {"type":"keyword"},
      "price": {"type":"double"},
      "stock": {"type":"integer"},
      "create_time": {"type":"date","format":"yyyy-MM-dd HH:mm:ss"},
      "tags": {"type":"keyword"},
      "sku_list": {
        "type": "nested",
        "properties": {
          "sku_id": {"type":"keyword"},
          "sku_price": {"type":"double"},
          "color": {"type":"keyword"}
        }
      }
    }
  },
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 1
  }
}
```

### 查看索引Mapping

```json
GET /product_es8/_mapping
```

### 删除索引

```json
DELETE /product_es8
```

## 文档操作

### 写入文档（单条 _doc）

```json
POST /product_es8/_doc/1
{
  "product_name": "机械游戏键盘",
  "category": "computer",
  "price": 399.0,
  "stock": 120,
  "create_time": "2026-01-10 09:30:00",
  "tags": ["mechanical","keyboard"],
  "sku_list": [
    {"sku_id":"sku001","sku_price":399,"color":"black"},
    {"sku_id":"sku002","sku_price":429,"color":"white"}
  ]
}

POST /product_es8/_doc/2
{
  "product_name": "无线静音鼠标",
  "category": "computer",
  "price": 129.0,
  "stock": 350,
  "create_time": "2026-01-12 14:20:00",
  "tags": ["wireless","mouse"],
  "sku_list": [
    {"sku_id":"sku003","sku_price":129,"color":"gray"}
  ]
}

POST /product_es8/_doc/3
{
  "product_name": "电竞机械鼠标",
  "category": "computer",
  "price": 249.0,
  "stock": 88,
  "create_time": "2026-01-15 10:10:00",
  "tags": ["game","mouse"],
  "sku_list": [
    {"sku_id":"sku004","sku_price":249,"color":"black"}
  ]
}
```

### Bulk批量写入

```json
// 实际代码不能有换行，这里只是为了方便观看
POST /product_es8/_bulk
{"index":{"_id":4}}
{"product_name":"27寸显示器","category":"monitor","price":1299,"stock":45,"create_time":"2026-01-18 16:00:00","tags":["screen","4k"],"sku_list":[{"sku_id":"sku005","sku_price":1299,"color":"black"}]}
{"index":{"_id":5}}
{"product_name":"办公薄膜键盘","category":"computer","price":89,"stock":200,"create_time":"2026-01-20 08:10:00","tags":["office","keyboard"],"sku_list":[{"sku_id":"sku006","sku_price":89,"color":"white"}]}
```

### 更新文档

```json
# 更新文档（局部更新 update）
POST /product_es8/_update/1
{
  "doc":{
    "price": 379,
    "stock": 100
  }
}
```

### 删除文档

```json
# 删除单条文档
DELETE /product_es8/_doc/5
```

### 查询文档

```json
# 根据ID查询单条文档
GET /product_es8/_doc/1
```

### 基础查询 DSL

#### match全文检索

1. **match全文检索**

```json
# match 全文检索（text字段分词查询）
GET /product_es8/_search
{
  "query": {
    "match": {
      "product_name": "机械键盘",
      "operator": "and"  
    }
  }
}
```

> "operator":
>
> * "or"：包含部分分词就可以命中（默认）
> * "and"：同时包含全部分词才命中

2. **match_phrase 短语匹配（连续短语，顺序不能乱）**

要求：分词后的词条**连续、保持原有顺序**出现在文档中，还可以用`slop`允许中间插少量其他词。

```json
# 精确短语，词条必须连续
GET /product_es8/_search
{
  "query": {
    "match_phrase": {
      "product_name": {
        "query": "机械游戏键盘"
      }
    }
  }
}

# slop=1：词条之间最多可以隔1个其他词，语序不变
GET /product_es8/_search
{
  "query": {
    "match_phrase": {
      "product_name": {
        "query": "机械键盘",
        "slop": 1
      }
    }
  }
}
```

适用场景：搜索 “无线鼠标” 这种短语，只想命中连续在一起的文字，避免只匹配到单独 “无线” 或者单独 “鼠标” 的无关文档。

3. **multi_match 多字段同时检索（高频！同时在多个 text 字段搜关键词）**

三种常用类型：`best_fields`(默认)、`most_fields`、`cross_fields`

| type | 中心视角 | 算分规则 |
| --- | --- | --- |
| best_fields
（默认） | 按字段 | 取最高字段分数，tie_breaker 少量叠加其他分 |
| most_fields | 按字段 | 所有命中字段分数累加，命中字段越多分越高 |
| cross_fields | 按词条 | 所有字段当成一个大文本域，词条跨字段查找 |

```json
# 默认 best_fields：取单个字段中匹配最好的得分，适合主标题+副标题
GET /product_es8/_search
{
  "query": {
    "multi_match": {
      "query": "机械鼠标",
      "fields": ["product_name"],
      "type": "best_fields",  # 默认就是"best_fields"
      "tie_breaker": 0.3      # 叠加其他分所占的比例，仅"best_fields"类型中可以使用
    }
  }
}

# 多字段：product_name + 其他字段，^2 权重提升2倍
GET /product_es8/_search
{
  "query": {
    "multi_match": {
      "query": "电竞",
      "fields": ["product_name^2","其他的字段"]
    }
  }
}
```

#### term精确匹配

1. **term 单词条精确匹配**

```json
# term 精确匹配（keyword字段，不分词）
GET /product_es8/_search
{
  "query": {
    "term": {
      "category": {"value":"computer"}
    }
  }
}
```

含义：文档`category`字段里**必须存在完整词条 computer**，大小写严格，不会分词。

2. **terms 多词条精确匹配（OR 关系，满足任意一个就命中，业务筛选高频）**

相当于 SQL `in (a,b,c)`

```json
GET /product_es8/_search
{
  "query": {
    "terms": {
      "category": ["computer", "monitor"]
    }
  }
}
```

含义：category 是 computer **或者** monitor 的文档都命中。 注意：只能填词条，不支持模糊、分词。

3. **exists 判断字段是否存在（筛选必备，业务高频）**

判断文档是否包含该字段，且字段不为 null。

```json
# 存在tags字段的文档
GET /product_es8/_search
{
  "query": {
    "exists": {
      "field": "tags"
    }
  }
}

# 不存在sku_list字段的文档（must_not + exists）
GET /product_es8/_search
{
  "query": {
    "bool": {
      "must_not": [
        {"exists": {"field": "sku_list"}}
      ]
    }
  }
}
```

4. **prefix 前缀匹配（词条开头匹配，keyword）**

匹配词条以指定字符开头，适合编码、编号搜索

```json
GET /product_es8/_search
{
  "query": {
    "prefix": {
      "category": {
        "value": "com"
      }
    }
  }
}
```

匹配 category 词条以`com`开头：computer 会命中，monitor 不会。

5. wildcard 通配符匹配（ 任意字符，? 单个字符，慎用，性能差）

不推荐前置通配符 `*abc`，会扫描大量词条，性能灾难。尽量只用后缀 `abc*`

```json
# 后缀通配：以board结尾
GET /product_es8/_search
{
  "query": {
    "wildcard": {
      "category": {
        "value": "comp*"
      }
    }
  }
}
```

6. **fuzzy 模糊纠错查询（拼写容错，输入错别字也能匹配，编辑距离）**

`fuzziness`：允许的字符编辑距离，0/1/2，越大容错越高，性能越差

```json
GET /product_es8/_search
{
  "query": {
    "fuzzy": {
      "category": {
        "value": "computr",
        "fuzziness": 1
      }
    }
  }
}
```

computr 拼写错误，fuzziness=1，允许改动 1 个字符，命中 computer。

#### range区间查询

```json
# range 区间查询
GET /product_es8/_search
{
  "query": {
    "range": {
      "price": {
        "gte": 100,
        "lte": 500
      }
    }
  }
}
```

#### bool复合查询

```json
# bool复合查询（must / filter / must_not / should，bool标准样例）
GET /product_es8/_search
{
  "query": {
    "bool": {
      "must": [
        {"match":{"product_name":"鼠标"}}
      ],
      "filter": [
        {"range":{"price":{"gte":100}}}
      ],
      "must_not": [
        {"term":{"tags":"4k"}}
      ],
      "should": [
        {"term":{"tags":"game"}}
      ],
      # 当 bool 中只有 should 时，默认至少匹配 1 个；
      # 当存在 must/filter 时，should 默认不做强制要求（等效为 0）。
      "minimum_should_match":1 
    }
  }
}
```

| **Bool查询支持的子句语义** | 逻辑含义 | 是否影响相关性评分 _score | 典型用途 |
| --- | --- | --- | --- |
| must | 必须匹配（AND） | ✅ 影响 | 核心的搜索条件，比如关键词匹配 |
| filter | 必须匹配（AND） | ❌ 不影响 | 筛选条件，比如价格区间、状态、时间范围 |
| should | 应该匹配（OR），匹配得越多分越高 | ✅ 影响 | 加分项、可选的扩展匹配 |
| must_not | 必须不匹配（NOT） | ❌ 不影响 | 排除条件，比如排除下架商品、黑名单 |

### 复杂查询 DSL

> 复杂查询 DSL 章节仅演示基础查询用法；更多高阶能力，需自行搜索。

#### 分页、排序、高亮

```json
# from/size 浅分页（from + size 之和不能超过 index.max_result_window（默认 10000））
GET /product_es8/_search
{
  "from": 0,
  "size": 2,
  "sort": [
    {"price":"desc"}
  ],
  "query": {
    "match_all": {}
  },
  "highlight": {
    "fields": {
      "product_name": {}
    }
  }
}

# search_after 深度分页（推荐大数据分页，需要sort）
# 第一页
GET /product_es8/_search
{
  "size":2,
  "sort":[{"price":"asc"}],
  "query":{"match_all":{}}
}
# 第二页，search_after 值取上一页最后一条的sort数组结果
GET /product_es8/_search
{
  "size":2,
  "sort":[{"price":"asc"}],
  "search_after": [249],
  "query":{"match_all":{}}
}
```

> **search_after 的排序字段唯一性约束未说明**。若排序字段存在并列值，翻页可能出现数据重复或遗漏；实践中常以 `_id` 或唯一字段作为 tie-breaker。

#### 聚合 Aggregation（桶聚合+指标聚合）

```json
# 筛选出价格不低于 50 的商品，
# 然后按类目分组计算平均价格和总库存，
# 同时对全部商品价格做一次多维统计；
# size: 0 表示只要统计结果，不返回任何原始文档
GET /product_es8/_search
{
  "size":0,
  "query":{
    "range":{"price":{"gte":50}}
  },
  "aggs":{
    "group_by_category":{
      "terms":{"field":"category"},
      "aggs":{
        "avg_price":{"avg":{"field":"price"}},
        "total_stock":{"sum":{"field":"stock"}}
      }
    },
    "price_stats":{
      "stats":{"field":"price"}
    }
  }
}
```

* `size:0`：不返回原始文档，只返回聚合结果
* terms：分桶；avg/sum/stats：指标聚合（平均值、求和、多指标统计）

#### Nested嵌套查询（数组对象）

场景：sku_list是nested类型，需要同时匹配sku_price和color，普通bool会跨对象错乱

```json
GET /product_es8/_search
{
  "query": {
    "nested": {
      "path": "sku_list",
      "query": {
        "bool": {
          "must": [
            {"range":{"sku_list.sku_price":{"gte":400}}},
            {"term":{"sku_list.color":"black"}}
          ]
        }
      },
      "inner_hits": {}
    }
  }
}
```

`inner_hits`：返回命中的子nested文档详情

### ES|QL（ES8新查询语言）

```json
POST /_esql
{
  "query": """
  FROM product_es8
  | WHERE price >= 100
  | KEEP product_name,category,price
  | SORT price DESC
  | LIMIT 5
  """
}
```


> 更新: 2026-10-19 15:30:33  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/uetcbf/xwovmn88y24rlhxt>