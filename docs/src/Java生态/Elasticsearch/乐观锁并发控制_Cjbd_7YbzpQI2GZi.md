## 乐观锁并发控制

## seq_no + primary_term

**字段含义**：

+ _seq_no（序列号）：递增的序列号，表示文档的每次修改操作，每次更新后 +1
+ _primary_term（主分片任期）：主分片的当前任期号，每当主分片发生变化（如故障转移）时增加

**查询文档获取版本信息：**

```plain
GET /orders/_doc/12345
```

**返回结果：**

```json
{  
  "_index": "orders",  
  "_id": "12345",  
  "_version": 15,  
  "_seq_no": 312,  
  "_primary_term": 2,  
  "_source": {    
    "order_no": "SO2024001",    
    "customer": "王先生",    
    "total_amount": 1299.00,    
    "status": "pending"  
    }
}
```

**基于版本的更新操作：**

```json
POST /orders/_doc/12345?if_seq_no=312&if_primary_term=2
{  
  "order_no": "SO2024001",  
  "customer": "王先生",  
  "total_amount": 1299.00,  
  "status": "paid"
}
```

**工作机制：**

+ 如果文档自上次读取以来没有被修改，if_seq_no 和 if_primary_term 会匹配，更新成功
+ 如果不匹配，说明其他客户端已经修改了该文档，更新操作失败，返回版本冲突错误

**冲突响应**：

```json
{  
  "error": {    
    "type": "version_conflict_engine_exception",    
    "reason": "[12345]: version conflict, current version [313] is different than the one provided [312]"  
    },  
  "status": 409
}
```

+ **更精确的冲突检测**：seq_no 和 primary_term 共同工作，能更精确地追踪文档变更历史，特别是在分布式和高并发环境中。
+ **防止脑裂问题**：当主分片发生变化（如分片重新分配到新节点）时，primary_term 会增加。这确保即使在集群状态发生变化的情况下，也不会应用基于过时副本的更新，有效防止脑裂导致的数据不一致。
+ **更好的故障恢复**：在节点故障或网络分区恢复后，通过 primary_term 可以识别哪些写操作是在故障期间发生的，从而正确处理数据同步。



> 更新: 2026-10-16 15:29:58  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/uetcbf/vkrpn8zov19xgu91>