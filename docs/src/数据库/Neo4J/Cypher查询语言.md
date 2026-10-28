# Cypher查询语言

Cypher 是 Neo4j 的声明式图查询语言，基于 ASCII 艺术风格的模式匹配语法。Cypher 25 是当前最新版本，引入了字符串函数、量化路径模式等新特性。

## 模式匹配

Cypher 的核心语法是模式匹配，使用 `( )` 表示节点，`[ ]` 表示关系，`--` 表示无向边，`-->` 表示有向边。

### 节点模式

用括号表示节点，括号内指定标签和属性过滤条件。

```cypher
MATCH (p:Person {name: 'Tom Hanks'})
RETURN p
```

### 关系模式

用方括号表示关系，可指定类型、方向和属性。

```cypher
MATCH (p:Person)-[r:ACTED_IN]->(m:Movie)
RETURN p.name, r.roles, m.title
```

### 路径模式

将节点和关系模式连接起来，形成完整的路径。

```cypher
MATCH path = (:Person {name: 'Tom Hanks'})-[:ACTED_IN]->(:Movie)<-[:DIRECTED]-(:Person)
RETURN path
```

### 变长路径

使用 `*min..max` 语法匹配指定跳数范围的关系。`*1..3` 表示 1 到 3 跳，`*2` 表示恰好 2 跳，`*` 表示任意跳数。

```cypher
MATCH (p:Person {name: 'Tom Hanks'})-[:KNOWS*1..3]-(connection:Person)
RETURN DISTINCT connection.name
```

### 最短路径

使用 `shortestPath()` 或 `allShortestPaths()` 函数查找两个节点之间的最短路径。

```cypher
MATCH p = shortestPath((a:Person {name: 'Tom Hanks'})-[:KNOWS*]-(b:Person {name: 'Meryl Streep'}))
RETURN p
```

## 读取子句

### MATCH

图模式匹配，是 Cypher 中最常用的子句。从图中查找匹配指定模式的所有子图。

```cypher
MATCH (p:Person)-[:ACTED_IN]->(m:Movie {title: 'Forrest Gump'})
RETURN p.name, p.born
```

### OPTIONAL MATCH

可选匹配，类似 SQL 的 LEFT JOIN。当模式不匹配时返回 null，而不会导致整个查询返回空结果。

```cypher
MATCH (p:Person {name: 'Tom Hanks'})
OPTIONAL MATCH (p)-[:DIRECTED]->(m:Movie)
RETURN p.name, collect(m.title) AS directedMovies
```

### RETURN

指定查询返回的字段、表达式和聚合结果。支持 `AS` 别名、`DISTINCT` 去重和 `ORDER BY` 排序。

```cypher
MATCH (p:Person)
RETURN p.name AS name, p.born AS birthYear
ORDER BY birthYear DESC
```

### WITH

管道操作符，将前一个子句的结果传递给后续子句。用于控制数据流、聚合、分页和变量作用域隔离。

```cypher
MATCH (:Supplier {name: 'Foodies Inc.'})-[:SUPPLIES]->(p:Product)
WITH p ORDER BY p.price DESC LIMIT 1
MATCH (p)<-[:BUYS]-(c:Customer)
RETURN p.name AS product, collect(c.firstName) AS customers
```

### UNWIND

将列表展开为多行，将一个列表元素转化为多行记录。

```cypher
WITH ['Tom Hanks', 'Meryl Streep', 'Brad Pitt'] AS names
UNWIND names AS name
MATCH (p:Person {name: name})
RETURN p.name, p.born
```

### CALL

调用存储过程，包括 APOC 扩展和自定义过程。括号内可以传递参数。

```cypher
CALL db.labels() YIELD label
RETURN label
```

## 写入子句

### CREATE

创建节点、关系和模式。每次执行都会创建新数据，即使模式已存在。

```cypher
CREATE (p:Person {name: 'Tom Hanks', born: 1956})
CREATE (p)-[:ACTED_IN {roles: ['Forrest']}]->(m:Movie {title: 'Forrest Gump', released: 1994})
```

### MERGE

幂等创建——如果模式存在则匹配，不存在则创建。使用 `ON CREATE` 和 `ON MATCH` 子句处理不同分支逻辑。

```cypher
MERGE (p:Person {name: 'Tom Hanks'})
ON CREATE SET p.createdAt = datetime()
ON MATCH SET p.updatedAt = datetime()
```

### DELETE

删除节点或关系。删除节点前必须先删除其所有关系，或使用 DETACH DELETE 自动删除关联关系。

```cypher
MATCH (p:Person {name: 'Unknown'})
DETACH DELETE p
```

### DETACH DELETE

同时删除节点及其所有关联关系。避免因残留关系导致的删除失败。

```cypher
MATCH (m:Movie)
WHERE m.released < 1950
DETACH DELETE m
```

### SET

设置或更新节点和关系的属性值。支持同时设置多个属性，以及 `+=` 批量设置。

```cypher
MATCH (p:Person {name: 'Tom Hanks'})
SET p.birthPlace = 'Concord, California',
    p.oscarWins = 2
```

### REMOVE

移除属性或标签。与 `SET` 互补，`SET property = null` 效果等同于 `REMOVE property`。

```cypher
MATCH (p:Person {name: 'Tom Hanks'})
REMOVE p.birthPlace
```

## 过滤与排序

### WHERE

子句级过滤，在 MATCH、OPTIONAL MATCH、WITH 子句中过滤结果。支持比较运算符、逻辑运算符、字符串匹配、列表运算和正则表达式。

```cypher
MATCH (p:Person)
WHERE p.born >= 1950 AND p.born < 1970
RETURN p.name, p.born
```

### ORDER BY

结果排序，支持 `ASC`（默认）和 `DESC`。可以对多个字段排序。

```cypher
MATCH (p:Person)
RETURN p.name, p.born
ORDER BY p.born DESC, p.name ASC
```

### SKIP

跳过前 N 条记录，常与 LIMIT 配合实现分页。

```cypher
MATCH (n) ORDER BY n.name SKIP 2 LIMIT 2
RETURN collect(n.name) AS names
```

### LIMIT

限制返回结果行数。与 SKIP 配合可实现分页查询。

```cypher
MATCH (p:Person)
RETURN p.name
LIMIT 10
```

## 表达式与运算符

### 比较运算符

`=`、`<>`、`<`、`>`、`<=`、`>=`、`IS NULL`、`IS NOT NULL`、`STARTS WITH`、`ENDS WITH`、`CONTAINS`、`IN`。

```cypher
MATCH (p:Person)
WHERE p.name STARTS WITH 'Tom' AND p.born IS NOT NULL
RETURN p
```

### 逻辑运算符

`AND`、`OR`、`NOT`、`XOR`。`NOT` 可结合 `IN`、`CONTAINS` 等使用。

```cypher
MATCH (p:Person)
WHERE NOT p.name CONTAINS 'X' AND (p.born > 1960 OR p.oscarWins > 0)
RETURN p
```

### 字符串运算符

`+` 字符串拼接，`=~` 正则表达式匹配。

```cypher
MATCH (p:Person)
WHERE p.name =~ 'T.*'
RETURN p.name + ' (' + toString(p.born) + ')' AS display
```

### 列表运算符

`+` 和 `||` 列表拼接，`IN` 元素包含检查，`[index]` 下标访问，`[start..end]` 切片。

```cypher
RETURN [1, 2] || [3, 4] AS list
```

### 正则表达式

使用 `=~` 运算符匹配正则表达式模式。

```cypher
MATCH (p:Person)
WHERE p.name =~ '(?i)tom.*'
RETURN p.name
```

### CASE 表达式

条件分支表达式，支持简单 CASE 和搜索 CASE 两种形式。

```cypher
MATCH (p:Person)
RETURN p.name,
  CASE
    WHEN p.born < 1950 THEN 'Veteran'
    WHEN p.born < 1970 THEN 'Senior'
    ELSE 'Junior'
  END AS generation
```

## 函数

### 标量函数

操作单个值并返回单个结果。包括 `coalesce()`、`head()`、`last()`、`size()`、`toInteger()`、`toString()` 等。

```cypher
RETURN coalesce(null, 'default value') AS result
```

### 聚合函数

对多行数据进行聚合计算。包括 `count()`、`sum()`、`avg()`、`min()`、`max()`、`collect()`、`stDev()`、`percentileCont()`。

```cypher
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name, count(m) AS movieCount, collect(m.title) AS movies
```

### 列表函数

操作列表值的函数。包括 `range()`、`reduce()`、`filter()`、`any()`、`all()`、`none()`、`single()`。

```cypher
RETURN [x IN range(1, 10) WHERE x % 2 = 0] AS evens
```

### 字符串函数

`left()`、`right()`、`substring()`、`replace()`、`split()`、`trim()`、`toUpper()`、`toLower()`、`reverse()`。Cypher 25 新增 `string.indexOf()`、`string.join()`、`string.regexReplace()`。

```cypher
RETURN string.indexOf('hello', 'l') AS idx,
       string.join(['one', 'two'], ', ') AS joined,
       string.regexReplace('hello', 'l.', 'w') AS replaced
```

### 数学函数

`abs()`、`ceil()`、`floor()`、`round()`、`sign()`、`sqrt()`、`log()`、`exp()`、`sin()`、`cos()`、`rand()`、`pi()`。

```cypher
RETURN sqrt(25) AS root, round(3.14159, 2) AS pi
```

### 时间日期函数

`date()`、`datetime()`、`time()`、`localdatetime()`、`localtime()`、`duration()`。Cypher 25 支持自定义时间格式解析。

```cypher
RETURN datetime('11/18/1986', 'MM/dd/yyyy') AS dt
```

## 子查询

### CALL 子查询

在 `{ }` 内执行子查询，结果通过 `RETURN` 返回。支持 `UNION` 合并多个查询结果。

```cypher
MATCH (p:Person)
CALL {
  WITH p
  MATCH (p)-[:ACTED_IN]->(m:Movie)
  RETURN count(m) AS movieCount
}
RETURN p.name, movieCount
```

### EXISTS 子查询

检查模式是否存在，返回布尔值。可以用于 WHERE 过滤。

```cypher
MATCH (p:Person)
WHERE EXISTS { (p)-[:DIRECTED]->(:Movie) }
RETURN p.name AS directors
```

### COUNT 子查询

计算模式匹配的数量，嵌入在表达式中使用。

```cypher
MATCH (p:Person)
RETURN p.name,
  COUNT { (p)-[:ACTED_IN]->(:Movie) } AS movieCount,
  COUNT { (p)-[:DIRECTED]->(:Movie) } AS directedCount
```

### 导入子查询

使用 `LOAD CSV` 和 `CALL { }` 结合，实现从外部数据导入的复杂逻辑。

```cypher
LOAD CSV WITH HEADERS FROM 'file:///people.csv' AS row
CALL {
  WITH row
  CREATE (:Person {name: row.name, born: toInteger(row.born)})
}
```

## 标签表达式

### 合取标签

`Label1&Label2` 或 `Label1:Label2`，匹配同时拥有两个标签的节点。

```cypher
MATCH (p:Person&Actor)
RETURN p.name
```

### 析取标签

`Label1|Label2`，匹配拥有任一标签的节点。

```cypher
MATCH (p:Person|Actor)
RETURN p.name, labels(p)
```

### 否定标签

`!Label` 或 `Label1&!Label2`，匹配不拥有指定标签的节点。

```cypher
MATCH (p:Person&!Actor)
RETURN p.name
```

## 参数化查询

### 参数占位符

使用 `$paramName` 作为参数占位符，避免 Cypher 注入攻击，并允许查询计划缓存复用。

```cypher
MATCH (p:Person {name: $name})
RETURN p
```

### 参数类型

支持字符串、数值、布尔、列表、Map 等类型。在 Java Driver 中通过 `Map<String, Object>` 传递。

```java
Map<String, Object> params = Map.of("name", "Tom Hanks", "minBorn", 1950);
session.run("MATCH (p:Person) WHERE p.name = $name AND p.born > $minBorn RETURN p", params);
```

### 查询缓存

参数化查询的字面文本相同但参数值不同时，Neo4j 可以复用已编译的查询计划，减少查询编译开销。使用字符串拼接构建查询会阻止缓存复用。

## Cypher 版本

### Cypher 5

Cypher 5 引入了子查询（CALL { }）、量化路径模式、标签表达式、新的时间类型等特性，是继 Cypher 4 后的重大升级。

### Cypher 25

Cypher 25 是当前最新版本，在 Cypher 5 基础上新增 `string.indexOf()`、`string.join()`、`string.regexReplace()` 等字符串函数，增强了时间解析能力，引入了更多路径模式语法。

### 版本选择

通过 `CYPHER 5` 或 `CYPHER 25` 关键字在查询开头指定版本，或通过 `dbms.cypher.version` 配置项设置默认版本。

```cypher
CYPHER 25
MATCH (p:Person)
RETURN string.join([p.name, toString(p.born)], ' - ')
```

### 迁移指南

从 Cypher 5 迁移到 Cypher 25 基本兼容，主要注意新函数的行为差异和已弃用语法的替代方案。建议使用 `SHOW FUNCTIONS` 和 `SHOW PROCEDURES` 查看可用函数和过程。

## 数据导入

### LOAD CSV

从 CSV 文件导入数据，支持 `WITH HEADERS` 选项将首行作为列名。文件需放在 Neo4j 的 import 目录下。

```cypher
LOAD CSV WITH HEADERS FROM 'file:///people.csv' AS row
CREATE (:Person {name: row.name, born: toInteger(row.born)})
```

### 批量创建

使用 `UNWIND` + `CALL { } IN TRANSACTIONS` 实现批量导入，每批自动提交事务，避免内存溢出。

```cypher
LOAD CSV WITH HEADERS FROM 'file:///large.csv' AS row
CALL {
  WITH row
  CREATE (:Person {name: row.name})
} IN TRANSACTIONS OF 1000 ROWS
```

### 事务批处理

`CALL { } IN TRANSACTIONS OF N ROWS` 将大批量操作拆分为多个事务，每 N 行提交一次。适用于大数据量导入场景，避免单个事务过大导致内存耗尽。

## 相关文档

- [图数据库核心概念](./图数据库核心概念.md)
- [APOC扩展库](./APOC扩展库.md)
- [索引与约束](./索引与约束.md)
- [数据建模](./数据建模.md)