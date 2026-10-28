## 深度分页查询

| 方案 | 使用场景 | 实现方式 | 优点 | 缺点 |
| --- | --- | --- | --- | --- |
| 传统分页 (from + size) | 小数据集 | 指定 from 和 size | 简单易用；支持随机跳页 | 深度分页性能差；默认限制 10000 条 |
| Scroll API | 数据导出、批量处理 | scroll_id 连续获取 | 处理大数据高效；数据一致性保证 | 不适合实时搜索；占用服务器资源；不支持跳页 |
| search_after | 深度分页、实时搜索 | 基于上次排序值 | 性能稳定；支持实时数据；无状态设计 | 不支持随机跳页；需要唯一排序字段 |

## from 和 size 参数分页查询

```json
GET /user_logs/_search
{  
  "from": 20,  
  "size": 10,  
  "query": {    
    "match_all": {}  
  }
}
```

参数说明：

* from：跳过的记录数量，表示从第几条记录开始（从 0 开始计数）
* size：返回的记录数量

***

**当进行深度分页时，Elasticsearch 需要：**

1. 每个分片独立处理：假设索引有 5 个分片，查询 from=9900, size=100，每个分片都需要找到并返回前 10000 条记录
2. 协调节点聚合：协调节点需要从 5 个分片收集共 50000 条记录
3. 全局排序：对这 50000 条记录进行全局排序
4. 截取结果：从排序结果中取第 9900-10000 条记录
5. 丢弃数据：前面 49900 条数据被丢弃

**性能影响：**

* CPU 消耗：大量数据的排序计算
* 内存消耗：需要在内存中维护大量待排序数据
* 网络消耗：大量数据在节点间传输
* 响应时间：随着 from 增大，响应时间指数级增长

**索引窗口限制:**

* Elasticsearch 默认限制 from + size 不能超过 index.max_result_window 设置，默认值为 10000。

## Scroll API

**流程：**

* **初始化 Scroll**：第一次请求（如 `POST /user_logs/_search?scroll=1m`）会触发 Elasticsearch 在协调节点上创建一份**数据快照**，并分配一个 `scroll_id`。这次请求同时返回第一批数据。
* **滚动获取后续批次**：后续每次请求只需携带 `scroll_id`（如 `POST /_search/scroll`），Elasticsearch 会从上次游标停留的位置继续取出下一批数据，直到数据全部遍历完毕。每发起一次滚动，`scroll` 参数指定的有效期（如 1m）会自动刷新，避免上下文中途失效。
* **清理上下文**：遍历结束后通过 `DELETE /_search/scroll` 释放服务端内存，防止占用资源。

***

**第一步：初始化 Scroll 请求**

```json
POST /user_logs/_search?scroll=1m
{  
  "size": 1000,  
  "query": {    
    "match_all": {}  
  }
}
```

参数说明：

* scroll=1m：指定 scroll 的有效期为 1 分钟，每次请求会刷新有效期
* size：每批返回的文档数量

响应示例：

```json
{  
  "_scroll_id": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAA...",  
  "hits": {    
    "total": { "value": 50000 },    
    "hits": [ /* 第1批1000条数据 */ ]  
  }
}
```

**第二步：使用 scroll_id 获取后续批次**

```json
POST /_search/scroll
{  
  "scroll": "1m",  
  "scroll_id": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAA..."
}
```

**第三步：重复执行直到到达目标页**

假设要获取第 10 页（每页 1000 条），需要执行 9 次滚动操作，第 10 次请求返回目标数据。

**第四步：清理 scroll 上下文（可选但推荐）**

```json
DELETE /_search/scroll
{  
  "scroll_id": "DXF1ZXJ5QW5kRmV0Y2gBAAAAAAA..."
}
```

## Search After

原理：

* 用"上一页最后一条记录的排序值"作为游标，下一次查询直接从该位置之后取数——全程不做快照、不存状态，每一页都是独立实时的查询

***

**第一步：首次查询（必须定义排序规则）**

```json
GET /user_logs/_search
{  
  "size": 100,  
  "query": {    
  "match": {      
      "level": "ERROR"    
    }  
  },  
  "sort": [    
      { "timestamp": "desc" },    
      { "_id": "asc" }  
    ]
}
```

关键点：

* 必须指定 sort 排序字段
* 建议包含一个唯一字段（如 _id）作为 tiebreaker，确保排序稳定

响应示例：

```json
{  
  "hits": {    
    "hits": [      
      {        
        "_id": "log_12345",        
        "_source": { /* 文档内容 */ },        
        "sort": [1735689600000, "log_12345"]      
      },
            /* ... 更多文档 ... */      
      {        
        "_id": "log_12444",        
        "_source": { /* 文档内容 */ },        
        "sort": [1735603200000, "log_12444"]  // 最后一条的排序值      
      }    
    ]  
  }
}
```

**第二步：使用 search_after 获取下一页**

```json
GET /user_logs/_search
{  
  "size": 100,  
  "query": {    
    "match": {      
      "level": "ERROR"    
    }  
  },  
  "sort": [    
      { "timestamp": "desc" },    
      { "_id": "asc" }  
    ],  
  "search_after": [1735603200000, "log_12444"]
}
```

search_after 数组包含上一页最后一条记录的排序值（对应 sort 字段）。


> 更新: 2026-10-16 16:19:21  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/uetcbf/gt8hvvnwekqazzwi>