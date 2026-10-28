# JavaDriver

Neo4j Java Driver 是原生 Java 客户端库，通过 Bolt 协议与 Neo4j 数据库通信。驱动管理连接池、会话生命周期和事务，支持同步、异步和反应式三种编程模型。当前版本 6.x，与 SDN 7.x 底层共享同一驱动。

## Driver

### 创建 Driver

通过 `GraphDatabase.driver()` 静态工厂方法创建 Driver 实例。`bolt://` 创建直连驱动，`neo4j://` 创建路由驱动（自动发现集群成员）。

```java
Driver driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    AuthTokens.basic("neo4j", "password")
);
```

### 连接验证

`verifyConnectivity()` 同步验证连接可用性，`verifyConnectivityAsync()` 异步验证。应用启动时调用，确保数据库可达。

```java
driver.verifyConnectivity();
```

### Driver 生命周期

Driver 实例是线程安全的，持有连接池。应创建为单例，应用退出时调用 `close()` 释放资源。同一应用使用同一 Driver 实例效率最高。

### 连接池

Driver 内部维护连接池，为每个远程 Neo4j 服务器维护独立连接池。连接池通过 `Config` 配置最大连接数、获取超时、最大生命周期等参数。

```java
Config config = Config.builder()
    .withMaxConnectionPoolSize(50)
    .withConnectionAcquisitionTimeout(Duration.ofSeconds(30))
    .build();
Driver driver = GraphDatabase.driver("bolt://localhost:7687", AuthTokens.basic("neo4j", "password"), config);
```

## Session

### SessionConfig

`SessionConfig` 配置会话行为，包括数据库选择、默认访问模式、书签和数据库路由。

```java
SessionConfig config = SessionConfig.builder()
    .withDatabase("mydb")
    .withDefaultAccessMode(AccessMode.READ)
    .build();
```

### 数据库选择

通过 `SessionConfig.withDatabase()` 指定目标数据库。多数据库环境下，不同会话可以操作不同数据库。

### 路由控制

`withDefaultAccessMode(AccessMode.READ)` 或 `AccessMode.WRITE` 控制会话路由到 Read Replica 或 Primary 节点。

### 书签

通过 `SessionConfig.withBookmarks()` 设置会话书签，确保因果一致性。书签从前一个事务的 `ResultSummary` 中获取。

### 默认访问模式

`AccessMode.READ` 路由到只读副本，`AccessMode.WRITE` 路由到主节点。合理设置可以提升读性能。

## 托管事务

### executeRead

在托管读事务中执行查询，自动处理事务创建、提交和重试。适合只读查询。

```java
List<Record> records = session.executeRead(tx -> {
    Result result = tx.run("MATCH (p:Person) RETURN p.name AS name");
    return result.list();
});
```

### executeWrite

在托管写事务中执行查询，失败时自动重试。适合写入和更新操作。

```java
session.executeWrite(tx -> {
    tx.run("CREATE (p:Person {name: $name})", Map.of("name", "Alice"));
    return null;
});
```

### 事务函数

传递 `TransactionCallback` 或 `TransactionCallback<T>` 给 `executeRead`/`executeWrite`，函数内执行查询逻辑。

### 自动重试

托管事务在遇到网络故障、死锁等可重试错误时自动重试最多 3 次。重试间隔指数递增。不可重试的错误（如约束违反）直接抛出。

## 显式事务

### beginTransaction

手动开启事务，获得 `Transaction` 对象。适用于需要多次查询共享同一事务边界的场景。

```java
Transaction tx = session.beginTransaction();
try {
    tx.run("CREATE (p:Person {name: $name})", Map.of("name", "Bob"));
    tx.commit();
} catch (Exception e) {
    tx.rollback();
    throw e;
}
```

### commit

手动提交事务，将修改持久化到数据库。

### rollback

手动回滚事务，撤销所有未提交的修改。

### 事务隔离

Neo4j 默认隔离级别为读已提交。事务内部可看到自己未提交的修改。企业版支持可序列化隔离。

## 隐式事务

### session.run

`session.run()` 直接执行查询，自动创建并提交隐式事务。每次调用都是一个独立事务，适合简单的一次性操作。

```java
Result result = session.run("MATCH (p:Person) RETURN p.name");
```

### 自动提交

隐式事务在查询执行完成后自动提交，无需手动管理事务生命周期。

### 性能权衡

隐式事务每次调用都创建新事务，频繁调用时开销较大。批量操作建议使用托管事务或显式事务。

## 查询执行

### executableQuery

`driver.executableQuery()` 创建可执行查询对象，支持链式调用。配置参数后通过 `execute()` 执行。

```java
var records = driver.executableQuery("MATCH (p:Person) WHERE p.born > $year RETURN p")
    .withParameters(Map.of("year", 1970))
    .withConfig(QueryConfig.builder().withDatabase("mydb").build())
    .execute();
```

### 参数化查询

使用 `$paramName` 占位符和 `Map<String, Object>` 传递参数，防止 Cypher 注入并允许查询计划缓存。

### 结果消费

`Result.list()` 获取所有记录列表，`Result.stream()` 流式消费，`Result.forEach()` 逐条处理。`Result` 对象使用后需关闭。

### 结果摘要

`Result.consume()` 返回 `ResultSummary`，包含查询统计信息（执行时间、扫描节点数、可用更新数等）、通知和计划信息。

## 同步 API

### 阻塞调用

`Session` 接口提供同步阻塞方法，调用线程等待数据库响应后返回结果。

### 结果遍历

`Result` 实现了 `Iterable<Record>`，可通过 for-each 循环遍历结果。

```java
Result result = session.run("MATCH (p:Person) RETURN p");
while (result.hasNext()) {
    Record record = result.next();
    System.out.println(record.get("p").asNode().get("name"));
}
```

### 记录访问

`Record.get(String key)` 按键名获取字段值，`Record.get(int index)` 按索引获取。返回 `Value` 对象，可调用 `asString()`、`asInt()`、`asNode()` 等方法类型转换。

## 异步 API

### CompletableFuture

`AsyncSession` 返回 `CompletionStage` 和 `CompletableFuture`，适合异步编程模型。

```java
AsyncSession session = driver.session(AsyncSession.class);
session.executeReadAsync(tx ->
    tx.runAsync("MATCH (p:Person) RETURN p")
        .thenCompose(ResultCursor::listAsync)
).thenAccept(records -> {
    records.forEach(r -> System.out.println(r.get("p").asNode().get("name")));
});
```

### 回调模式

异步 API 通过 `thenAccept`、`thenApply`、`thenCompose` 等回调方法处理结果，避免阻塞线程。

### 错误处理

异步操作通过 `exceptionally` 或 `whenComplete` 处理异常。`CompletionException` 包装原始异常，通过 `getCause()` 获取。

## 反应式 API

### Reactive Streams

Neo4j Driver 支持 Reactive Streams 规范，提供 `ReactiveSession` 和 `ReactiveResult` 接口。

```java
ReactiveSession session = driver.session(ReactiveSession.class);
Publisher<Record> publisher = session.executeRead(tx ->
    tx.run("MATCH (p:Person) RETURN p").records()
);
```

### Reactor 集成

通过 `ReactorAdapter` 将 Reactive Streams 的 Publisher 转换为 Reactor 的 `Mono` 和 `Flux`，与 Spring WebFlux 无缝集成。

```java
Flux<Record> flux = Flux.from(session.executeRead(tx ->
    Flux.from(tx.run("MATCH (p:Person) RETURN p").records())
));
```

### Java Flow API

Java 9+ 的原生 Flow API（`java.util.concurrent.Flow`）也受支持。`ReactiveSession` 接口同时兼容两种 Reactive Streams 实现。

### 背压控制

Reactive Streams 内置背压机制，消费者可以控制数据接收速率，避免内存溢出。

### 会话延迟创建

反应式会话在订阅时才创建底层连接，延迟初始化资源，减少空闲连接。

## 书签与因果一致性

### 书签传递

从写入事务的 `ResultSummary` 获取书签，传递给后续读取会话，确保读取到自己的写入。

```java
ResultSummary summary = session.executeWrite(tx -> {
    return tx.run("CREATE (p:Person {name: $name})", Map.of("name", "Dave")).consume();
});
Bookmark bookmark = summary.bookmark();

Session readSession = driver.session(SessionConfig.builder()
    .withBookmarks(Set.of(bookmark))
    .withDefaultAccessMode(AccessMode.READ)
    .build());
```

### 因果链

书签链保证了因果一致性——客户端读取到的数据版本至少包含所有书签标记的写入。

### 会话书签

`Session.lastBookmarks()` 返回会话中最后执行事务的书签集合，用于传递给下一个会话。

## 连接池

### 连接池配置

通过 `Config` 配置连接池参数：`withMaxConnectionPoolSize()`（最大连接数）、`withConnectionAcquisitionTimeout()`（获取超时）、`withMaxConnectionLifetime()`（最大生命周期）。

### 连接获取

连接池按需创建连接，空闲连接自动回收。当连接池耗尽时，获取连接的操作会阻塞等待，直到超时。

### 连接耗尽

连接池耗尽时抛出 `ClientException`，提示连接获取超时。应监控连接池使用率，按需扩容。

### 连接超时

通过 `withConnectionTimeout()` 设置建立新连接的超时时间，`withConnectionAcquisitionTimeout()` 设置从池中获取连接的等待时间。

## 路由控制

### RoutingControl.READ

`SessionConfig.withDefaultAccessMode(AccessMode.READ)` 将读查询路由到 Read Replica，减轻主节点负载。

### RoutingControl.WRITE

`AccessMode.WRITE` 将写查询路由到主节点，确保数据一致性。

### 集群路由表

路由驱动定期从集群获取路由表，缓存集群拓扑信息。当集群成员变更时，路由表自动更新。

### 路由驱动

使用 `neo4j://` URI 创建路由驱动，自动发现集群成员并路由会话。适用于 Neo4j 集群部署。

## 性能建议

### 指定目标数据库

通过 `SessionConfig.withDatabase()` 指定数据库，避免在查询中使用 `USE` 子句，减少不必要的数据库切换。

### 事务成本

尽量使用托管事务（`executeRead`/`executeWrite`），避免手动管理事务生命周期。托管事务自动处理重试和资源释放。

### 批量操作

将多个操作合并到一个事务中执行，减少事务创建开销。对于大量数据导入，使用 `UNWIND` + `CALL { } IN TRANSACTIONS` 模式。

### 查询参数

始终使用参数化查询，避免字符串拼接构建 Cypher 语句。参数化查询允许 Neo4j 缓存查询计划，提升性能。

### 索引创建

为频繁查询的属性创建索引，确保查询计划使用索引扫描而非全节点扫描。使用 `EXPLAIN` 和 `PROFILE` 验证索引使用情况。

## 相关文档

- [SpringDataNeo4j](./SpringDataNeo4j.md)
- [Cypher查询语言](./Cypher查询语言.md)
- [集群运维与安全](./集群运维与安全.md)