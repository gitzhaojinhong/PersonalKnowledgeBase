# APOC扩展库

APOC（Awesome Procedures On Cypher）是 Neo4j 的扩展存储过程与函数库，提供数据导入导出、图重构、工具函数、后台作业等超出 Cypher 核心能力的功能。分为 APOC Core（随 Neo4j 发行）和 APOC Extended（需单独安装）两部分。

## 安装与配置

### APOC Core

随 Neo4j 社区版和企业版自动包含，无需额外安装。覆盖数据导入导出、图重构、数据工具等核心功能。

### APOC Extended

需要从 GitHub 下载 JAR 文件放入 `plugins` 目录，或通过 Neo4j Desktop 一键安装。包含后台作业、高级图查询、图比较等扩展功能。

### 安全限制

APOC 默认启用安全限制，阻止对文件系统和网络的非授权访问。在生产环境中必须保持安全限制开启。

```properties
dbms.security.procedures.unrestricted=apoc.*
apoc.import.file.enabled=true
apoc.export.file.enabled=true
```

### 白名单配置

通过 `apoc.import.file.use_neo4j_config` 或 `apoc.import.file.allow_read_from` 配置允许访问的文件路径。

```properties
apoc.import.file.use_neo4j_config=false
apoc.import.file.allow_read_from=file:///data/import/
```

## 数据导入

### JSON 导入

`apoc.load.json()` 从 JSON 文件或 URL 加载数据，`apoc.import.json()` 导入完整的图结构（需 `jsonFormat: 'JSON_LINES'`）。

```cypher
CALL apoc.import.json('file:///path/to/export.json', {
  importIdName: 'neo4jImportId',
  nodePropertyMappings: { User: { born: 'Point' } }
})
```

### CSV 导入

`apoc.import.csv()` 导入节点和关系，支持自定义标签映射和类型转换。

```cypher
CALL apoc.import.csv(
  [{fileName: 'file:///nodes.csv', labels: ['Person']}],
  [{fileName: 'file:///rels.csv', type: 'KNOWS'}],
  {}
)
```

### XML 导入

`apoc.load.xml()` 解析 XML 数据，返回嵌套的 Map 结构，可进一步提取节点和关系。

```cypher
CALL apoc.load.xml('file:///data.xml') YIELD value
RETURN value
```

### GraphML 导入

`apoc.import.graphml()` 从 GraphML 文件导入图数据。先导入节点，再导入关系，需要 `readLabels: true` 和 `storeNodeIds: true`。

```cypher
CALL apoc.import.graphml('queryNodes.graphml', {readLabels: true, storeNodeIds: true})
CALL apoc.import.graphml('queryRelationship.graphml', {readLabels: true, source: {label: 'Foo'}, target: {label: 'Bar'}})
```

### XLS 导入

`apoc.load.xls()` 从 Excel 文件加载数据，支持指定工作表、行范围等配置。

```cypher
CALL apoc.load.xls('file:///data.xlsx', 'Sheet1', {header: true}) YIELD map
RETURN map
```

## 数据导出

### JSON 导出

`apoc.export.json.all()` 导出整个数据库，`apoc.export.json.query()` 按查询结果导出。

```cypher
CALL apoc.export.json.query('MATCH (p:Person) RETURN p', 'people.json', {})
```

### CSV 导出

`apoc.export.csv.all()` 导出所有数据和关系，`apoc.export.csv.query()` 按查询导出。

```cypher
CALL apoc.export.csv.all('movies.csv', {nodes: true, relationships: true, properties: true, useNeo4jName: true})
```

### GraphML 导出

`apoc.export.graphml.all()` 或 `apoc.export.graphml.query()` 按查询导出 GraphML 格式，需要 `useTypes: true` 保留属性类型。

```cypher
CALL apoc.export.graphml.query('MATCH (start:Foo)-[:KNOWS]->(:Bar) RETURN start', 'queryNodes.graphml', {useTypes: true})
```

### Gephi 导出

`apoc.gephi.add()` 将节点和关系流式推送到 Gephi 可视化工具，用于实时图分析。

## 图重构

### 节点合并

`apoc.refactor.mergeNodes()` 将多个节点合并为一个，保留所有关系和属性。

```cypher
MATCH (n1:Person {name: 'Tom H.'}), (n2:Person {name: 'Thomas H.'})
CALL apoc.refactor.mergeNodes([n1, n2], {properties: 'discard'})
YIELD node RETURN node
```

### 关系重定向

`apoc.refactor.to()` 和 `apoc.refactor.from()` 将关系的起始或结束节点重定向到另一个节点。

```cypher
MATCH (old:OldNode)<-[r:REFERS]-(other)
CALL apoc.refactor.from(r, other)
YIELD input, output RETURN input, output
```

### 属性分类

`apoc.refactor.categorize()` 将属性值提升为标签，用于属性值种类有限时的规范化。

### 标签规范化

`apoc.create.addLabels()` 和 `apoc.create.removeLabels()` 批量管理标签。

### 关系属性化

`apoc.refactor.extractNode()` 将关系属性提取为中间节点，实现关系的细粒度建模。

## 图更新

### 周期迭代

`apoc.periodic.iterate()` 分批处理大量数据，每批独立提交事务。适合大数据量的批量更新场景。

```cypher
CALL apoc.periodic.iterate(
  'MATCH (p:Person) RETURN p',
  'SET p.processed = true',
  {batchSize: 1000, parallel: true}
)
```

### 批量更新

`apoc.periodic.commit()` 循环执行直到返回 0 条更新，每批自动提交。

```cypher
CALL apoc.periodic.commit(
  'MATCH (p:Person) WHERE p.processed IS NULL WITH p LIMIT $limit SET p.processed = true RETURN count(p)',
  {limit: 1000}
)
```

### 条件更新

`apoc.do.when()` 根据条件执行不同分支逻辑，`apoc.case()` 处理多分支逻辑。

```cypher
MATCH (p:Person)
CALL apoc.do.when(
  p.born < 1970,
  'SET p.generation = "Senior" RETURN p',
  'SET p.generation = "Junior" RETURN p',
  {p: p}
) YIELD value RETURN value
```

## 数据结构

### Map 操作

`apoc.map.fromPairs()`、`apoc.map.merge()`、`apoc.map.removeKeys()`、`apoc.map.setKey()` 等函数，操作 Map 数据结构。

```cypher
RETURN apoc.map.fromPairs([['key1', 'value1'], ['key2', 42]])
```

### List 操作

`apoc.coll.zip()`、`apoc.coll.partition()`、`apoc.coll.flatten()`、`apoc.coll.sort()` 等函数。

```cypher
RETURN apoc.coll.zip([1, 2, 3], ['a', 'b', 'c']) AS zipped
```

### Set 操作

`apoc.coll.intersection()`、`apoc.coll.union()`、`apoc.coll.subtract()`、`apoc.coll.toSet()` 集合运算。

```cypher
RETURN apoc.coll.intersection([1, 2, 3], [2, 3, 4]) AS intersection
```

## 时间日期

### 格式化

`apoc.date.format()` 将时间戳转换为格式化字符串，`apoc.temporal.format()` 格式化时间对象。

```cypher
RETURN apoc.date.format(timestamp(), 'ms', 'yyyy-MM-dd HH:mm:ss')
```

### 转换

`apoc.date.parse()` 将字符串解析为时间戳，`apoc.date.toYears()`、`apoc.date.toDays()` 等时间单位转换。

### 计算

`apoc.date.add()` 时间加减计算，`apoc.date.diff()` 时间差计算。

## 数学函数

### 统计

`apoc.math.percentile()`、`apoc.math.regr()` 等统计函数。

### 科学计算

`apoc.math.sigmoid()`、`apoc.math.cosSimilarity()` 等科学计算函数。

## 高级图查询

### 路径扩展

`apoc.path.expand()` 和 `apoc.path.expandConfig()` 配置化路径扩展，支持标签过滤、关系过滤、最大深度和唯一性约束。

```cypher
MATCH (p:Person {name: 'Tom Hanks'})
CALL apoc.path.expand(p, 'ACTED_IN|DIRECTED', '+Person|+Movie', 1, 3)
YIELD path RETURN path
```

### 邻居发现

`apoc.neighbors.byhop()` 按跳数分层返回邻居节点，分析网络拓扑结构。

### 子图匹配

`apoc.path.subgraphAll()` 返回起始节点为起点的完整子图，支持自定义最大深度。

## 条件执行

### apoc.when

根据条件执行对应的 Cypher 语句，返回第一个分支的结果。

### apoc.case

多分支条件执行，依次评估条件直到匹配。

### apoc.do.when

条件执行写入操作，返回结果的 YIELD 值。

## Cypher 执行

### apoc.cypher.run

执行动态 Cypher 语句，返回结果流。支持参数化，避免注入攻击。

```cypher
CALL apoc.cypher.run('MATCH (p:Person) WHERE p.name = $name RETURN p', {name: 'Tom Hanks'})
YIELD value RETURN value.p
```

### apoc.cypher.runMany

执行多条 Cypher 语句，按分号分隔，依次执行。

### apoc.cypher.doIt

执行写入型 Cypher 语句，返回更新统计数据。

## 虚拟节点与关系

### 虚拟节点

`apoc.create.vNode()` 创建虚拟节点，不会持久化到数据库，仅用于临时结果展示和可视化。

### 虚拟关系

`apoc.create.vRelationship()` 创建虚拟关系，将虚拟节点连接起来，构建临时图结构。

### 图投影

结合虚拟节点和虚拟关系，将外部数据源或聚合结果投射为图结构，用于可视化分析。

## 后台作业

### 周期提交

`apoc.periodic.commit()` 循环执行更新直到没有更多数据，每批自动提交事务。

### 作业管理

`apoc.periodic.submit()` 提交后台作业，`apoc.periodic.list()` 查看运行中的作业，`apoc.periodic.cancel()` 取消作业。

```cypher
CALL apoc.periodic.submit('myJob', 'CALL apoc.periodic.commit("MATCH (n) WITH n LIMIT 1000 SET n:Processed RETURN count(n)", {})')
CALL apoc.periodic.list()
```

## 图比较

### 结构比较

`apoc.diff.graph()` 比较两个图的节点和关系结构差异。

### 属性比较

`apoc.diff.nodes()` 比较两个节点属性差异，返回变化详情。

## Schema 信息

### 索引信息

`apoc.schema.node.indexExists()` 和 `apoc.schema.node.constraintExists()` 检查索引和约束是否存在。

### 约束信息

`apoc.schema.nodes()` 和 `apoc.schema.relationships()` 返回所有约束和索引定义。

### 标签统计

`apoc.node.count()` 统计每个标签的节点数量。

## 聚合扩展

### 中位数

`apoc.agg.median()` 计算中位数，弥补 Cypher 内置聚合函数不支持的统计指标。

### 百分位数

`apoc.agg.percentiles()` 计算分位数分布。

### 统计信息

`apoc.agg.statistics()` 一次性返回最小值、最大值、平均值、标准差等统计信息。

## 相关文档

- [Cypher查询语言](./Cypher查询语言.md)
- [索引与约束](./索引与约束.md)
- [图数据库核心概念](./图数据库核心概念.md)