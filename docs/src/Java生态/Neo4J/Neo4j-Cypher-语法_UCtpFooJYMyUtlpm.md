## Neo4j-Cypher-语法

[Cypher手册跳转](https://neo4j.ac.cn/docs/cypher-manual/current/introduction/)

## 增删改语法

### 创建 CREATE

```cypher
// 建节点
CREATE (p:Person {name: "Emil Eifrem", born: 1978})

// 建关系（先有节点变量，再连边）
MATCH (p:Person {name:"Keanu Reeves"}), (m:Movie {title:"The Matrix"})
CREATE (p)-[:ACTED_IN {roles:["Neo"]}]->(m)

// 一次性建整条模式（节点+关系）
CREATE (a:Person {name:"A"})-[:KNOWS {since: 2020}]->(b:Person {name:"B"})
```

> `CREATE` **不做任何查重**，重复执行就重复插入。要幂等请用 `MERGE`。

### 幂等写入 MERGE

`MERGE` = 「先找，找不到才建」。批量装载数据的标准写法。

```cypher
// ============== 完整语法结构 ==============
MERGE pattern
  [ON CREATE SET property_assignments]  // 可选分支：仅为本次新建时执行
  [ON MATCH  SET property_assignments]  // 可选分支：仅已存在、本次匹配命中时执行
// 说明：
//  pattern 支持节点模式、关系模式、子图模式
```

*示例：*

```cypher
// 基本形态：只处理已存在的情况
MERGE (k:Person {name:'Keanu Reeves'})

// 分支形态：新建时补属性，命中时刷新时间戳
MERGE (m:Movie {title:'The Matrix'})
  ON CREATE SET m.released = 1999,
                m.tagline  = 'Welcome to the Real World'
  ON MATCH  SET m.lastSeen = datetime()

// 关系也要 MERGE，避免重复边
MERGE (k)-[:ACTED_IN {roles:['Neo']}]->(m)
```

> **要点**
>
> * `MERGE` 的匹配依据是**整个模式**（含标签、关系类型、方向、列出的属性）。少写一个属性就可能匹配不到而新建重复节点。
> * 生产环境务必给被 MERGE 的属性建**唯一性约束**，否则并发下会产生重复。
> * MERGE 建关系前，必须先 MATCH 出两端的节点。否则 `MERGE` 会把整个 `(a)-[:R]->(b)` 模式当成一个全新实体去创建，产生重复节点：

### 新增或更新属性 SET

***SET  :***

```cypher
// 属性已存在则覆盖原值，不存在则新增；未提及的属性保持不变
MATCH (a:Article {title:"..."})
SET a.datePublished = date("2019-09-30")

// 多属性批量新增或更新：逗号分隔多个属性项，逐项覆盖或新增，不影响未提及的属性
MATCH (n:Person {name:"Keanu Reeves"})
SET n.nickname = "Neo", n.active = true
                  
// 整体 map 全量替换：用右侧 map 完全覆盖节点/关系的全部属性集合
// 执行后节点原有所有属性会被清空，最终仅保留 map 中定义的属性
MATCH (n:Person {name: "Keanu Reeves"})
SET n = {
  name: "Keanu Reeves",
  age: 60,
  gender: "Male"
}
```

*SET +=  :*

```cypher
// += 合并：
// 增量合并赋值：以 map 形式批量更新，仅改动 map 中列出的属性
// 同名属性覆盖原值，原节点已有的、map 未包含的属性完整保留，不会被删除
MATCH (n:Person {name:"Keanu Reeves"})
SET n += {nickname:"Neo", active:true}
```

> `SET n.p = null` 等价于删除该属性。Neo4j 不存储 `null` 值属性——把属性设为 `null`，效果与 `REMOVE n.p` 相同，该键会从属性集中消失。

### 移除属性 REMOVE

```cypher
MATCH (n:Person {name:"Keanu Reeves"})
REMOVE n.nickname
```

### 删除节点/关系 DELETE

```cypher
// 删关系
MATCH (:Person {name:"A"})-[r:KNOWS]->(:Person {name:"B"})
DELETE r

// 删节点：该节点必须已无任何关系，否则报错
MATCH (n:Person {name:"Emil Eifrem"})
DELETE n

// 连同所有关系一起删（最常用）
MATCH (n:Person {name:"Emil Eifrem"})
DETACH DELETE n
                  
// 清空整个示例图（无 WHERE，匹配所有节点）
MATCH (n) DETACH DELETE n

// 验证是否真的清空了：返回空结果即说明图已无节点
MATCH (n) RETURN n
```

### 批量更新 FOREACH / UNWIND

***FOREACH  :***

```cypher
// =================== FOREACH：只做副作用，不产生新行 ====================
FOREACH (item IN listExpr | write_clauses)
// item：循环变量
// listExpr：任意返回列表的表达式
// write_clauses：只能是写入类语句，多条用逗号隔开

// 批量创建节点/关系
MATCH (m:Movie {title:"The Matrix"})
FOREACH (actorName IN ["Keanu Reeves", "Laurence Fishburne"] |
  // 每次循环处理一个演员，批量完成节点匹配与关系创建
  MERGE (p:Person {name: actorName})
  MERGE (p)-[:ACTED_IN]->(m)
)
                    
// 批量给路径上所有节点新增 visited 属性，无需展开成多行
MATCH path = (a:Person {name:"Keanu Reeves"})-[:ACTED_IN*]->()
FOREACH (node IN nodes(path) | SET node.visited = true)

```

***UNWIND :***

```cypher
// =================UNWIND 基础语法：将列表展开为多行数据==================
UNWIND listExpr AS varName
// listExpr：列表类型表达式（字面量数组、函数返回值、collect聚合结果等）
// varName：展开后每行元素的变量名
// 核心特性：会改变结果集行数，行数 = 列表元素个数
// 后续可接任意 Cypher 子句：MATCH / SET / MERGE / RETURN / WHERE 等

// 一次性批量创建2篇文章节点
UNWIND [
  { title: "Cypher Basics I",
    created: datetime("2019-06-01T18:40:32.142+0100"),
    datePublished: date("2019-06-01"),
    readingTime: {minutes: 2, seconds: 15} },
  { title: "Cypher Basics II",
    created: datetime("2019-06-02T10:23:32.122+0100"),
    datePublished: date("2019-06-02"),
    readingTime: {minutes: 2, seconds: 30} }
] AS articleProperties
CREATE (article:Article {title: articleProperties.title})
SET article.created      = articleProperties.created,
    article.datePublished = articleProperties.datePublished,
    article.readingTime   = duration(articleProperties.readingTime)
```

### 索引与约束（DDL）

**索引**

```cypher
// 普通单属性索引：只加速查询，允许重复值
CREATE INDEX idx_name IF NOT EXISTS FOR (n:Label) ON (n.prop);

// 复合索引
CREATE INDEX person_name IF NOT EXISTS FOR (p:Person) ON (p.firstname, p.lastname);

// 唯一约束（自带索引）：加速查询 + 强校验，值不能重复
CREATE CONSTRAINT c_name IF NOT EXISTS FOR (n:Label) REQUIRE n.prop IS UNIQUE;                                                         
// 查看当前库所有索引、约束信息
SHOW INDEXES;

// 根据索引名称删除索引，IF EXISTS：存在才删，不存在不报异常
DROP INDEX movie_title IF EXISTS;
```

**约束（四种）**

| 类型 | 语法 | 语义 |
| --- | --- | --- |
| 唯一性 | `FOR (m:Movie) REQUIRE m.title IS UNIQUE` | 该属性值全库唯一 |
| 存在性 | `FOR (p:Person) REQUIRE p.name IS NOT NULL` | 该属性必须有值 |
| 类型 | `FOR (p:Person) REQUIRE p.born IS :: INTEGER` | 限定数据类型 |
| 节点键 | `FOR (n:Person) REQUIRE (n.firstname, n.lastname) IS NODE KEY` | 组合唯一 + 全部非空 |

> 图库**没有外键**。关系是一等实体，引用完整性靠「先节点后关系 + 约束」保证。

***

## 查询语法

### 基础语法

#### 最小骨架

```cypher
MATCH (n:Label {key: value})
WHERE n.other > 10
RETURN n.name AS name
ORDER BY name
LIMIT 10
```

子句顺序天然是：`MATCH → WHERE → WITH → RETURN → ORDER BY → SKIP → LIMIT`（写子句可插在 `WITH`/`RETURN` 之前）。

#### 点查与属性过滤

```cypher
// 按唯一键点查
MATCH (tom:Person {name: "Tom Hanks"})
RETURN tom

// 内联属性 vs WHERE，两种等价
MATCH (m:Movie) WHERE m.title = "Cloud Atlas" RETURN m
MATCH (m:Movie {title: "Cloud Atlas"}) RETURN m
```

> `WHERE` 里引用的是**变量**（`tom.name`），不是**标签**（`Person.name`）。

#### 模式匹配：节点与关系

```cypher
// 不定类型，取到关系变量
MATCH (tom:Person {name:"Tom Hanks"})-[r]->(movies:Movie)
RETURN tom, r, movies

// 反向（箭头指入）：谁执导了它
MATCH (m:Movie {title:"Cloud Atlas"})<-[:DIRECTED]-(d)
RETURN d.name

// 无向：不关心方向
MATCH (a:Person)-[:KNOWS]-(b:Person) 
RETURN a, b

// 未知关系类型：用匿名变量 + type() 反查
MATCH (people:Person)-[rel]-(:Movie {title:"Cloud Atlas"})
RETURN people.name, type(rel), rel

// 多段模式：共同主演
MATCH (tom:Person {name:"Tom Hanks"})-[a:ACTED_IN]->(m:Movie)<-[b:ACTED_IN]-(co:Person)
RETURN tom, m, a, b, co
```

**模式速记表**

| 写法 | 含义 |
| --- | --- |
| `(n)` | 匿名/命名节点 |
| `(n:Person)` | 带标签 |
| `(n:Person {name:'X'})` | 带标签 + 内联属性 |
| `()-[r]->()` | 有向关系（任意类型） |
| `()-[:ACTED_IN]->()` | 指定类型 |
| `()-[:ACTED_IN {roles:['Neo']}]->()` | 关系带属性（可为列表） |
| `()<-[:DIRECTED]-()` | 反向 |
| `()-[]-()` | 无向 |
| `()-[:KNOWS*1..3]->()` | 变长 1–3 跳 |
| `shortestPath((a)-[*]-(b))` | 最短路径 |

#### 变长路径与最短路径

```cypher
// 1 到 3 跳内可达
MATCH (a:Person {name:"A"})-[:KNOWS*1..3]->(b:Person)
RETURN DISTINCT b.name

// 最短路径 可以不限制条数[*],也可以限制条数[*..10]十条以内，若不限制则全图搜索
MATCH (a:Person {name:"A"}), (b:Person {name:"B"})
MATCH p = shortestPath((a)-[*..6]-(b))
RETURN p
```

> 变长模式：在关系类型后加 `*` 表示「重复若干次」，可用 `*min..max` 限定跳数。
>
> 变长模式**必须写上界**（`*1..3`、`*..6`），否则在大图上是全图搜索。

### 子查询

Cypher 有四种子查询，按「要不要行」区分使用。

#### EXISTS —— 只判存在

```cypher
MATCH (p:Person)
WHERE EXISTS {
  MATCH (p)-[:ACTED_IN]->(:Movie {title:"The Matrix"})
}
RETURN p.name
```

#### COUNT —— 只计数，不展开行

```cypher
MATCH (p:Person)
RETURN p.name,
       COUNT { (p)-[:ACTED_IN]->(:Movie) } AS movies
```

> 相比 `MATCH ... count()`，`COUNT {}` 不会因为模式无匹配而丢掉外层行。

#### COLLECT —— 收集成列表

```cypher
MATCH (m:Movie)
RETURN m.title,
       COLLECT { MATCH (m)<-[:ACTED_IN]-(a:Person) RETURN a.name } AS cast
```

#### CALL { } —— 独立作用域的完整子查询

```cypher
MATCH (p:Person)
CALL {
  WITH p
  MATCH (p)-[:ACTED_IN]->(m:Movie)
  RETURN count(m) AS movies
}
RETURN p.name, movies
ORDER BY movies DESC
```

> `CALL { … } IN TRANSACTIONS` 同CALL { ... }，底层按批拆分为多个事务提交，防止单事务撑爆内存

#### 作用域规则

1. 子查询**能读**外层变量；`CALL { }` 需要显式 `WITH p` 导入，`EXISTS/COUNT/COLLECT` 隐式可见。
2. 子查询内**新建的变量不会自动传出**，必须 `RETURN`。
3. 只有 `CALL { }` 能与后续子句继续组合，并支持内部 `UNION`(合并加去重)，UNION ALL(合并不去重)。
4. 子查询内的聚合不影响外层聚合——这是「分组内先算、外层再算」的正确姿势。

```cypher
// CALL { } 内部 UNION 的写法
MATCH (n)
CALL {
  WITH n MATCH (n)-[:ACTED_IN]->(m) RETURN m AS x
  UNION
  WITH n MATCH (n)-[:DIRECTED]->(m) RETURN m AS x
}
RETURN n, x
```

### 过滤 WHERE

**比较与逻辑**

```cypher
MATCH (p:Person)
WHERE p.born > 1960 AND NOT p.retired
RETURN p.name
```

**链接式范围（Cypher 特色）**

```cypher
// 一次写完闭区间，无需重复变量
MATCH (p:Person)
WHERE 3 <= p.yearsExperience <= 7
RETURN p
```

**字符串匹配**

```cypher
MATCH (p:Person) WHERE p.name STARTS WITH "Tom"      RETURN p.name
MATCH (m:Movie)  WHERE m.title CONTAINS "Matrix"     RETURN m.title
MATCH (p:Person) WHERE p.name ENDS WITH "Hanks"      RETURN p.name
MATCH (p:Person) WHERE p.name =~ "(?i)tom.*"         RETURN p.name   // 正则
MATCH (m:Movie)  WHERE m.title IN ["The Matrix","Cloud Atlas"] RETURN m.title
```

**空值处理**

```cypher
MATCH (p:Person) WHERE p.email IS NULL     RETURN p.name
MATCH (p:Person) WHERE p.email IS NOT NULL RETURN p.name
// 取第一个非空
RETURN coalesce(p.nickname, p.name) AS displayName
```

> `= null` 永远不成立（结果是 `null` 而非 `true`），必须用 `IS NULL`。

**模式作为过滤条件**

```cypher
// 不存在某关系
MATCH (p:Person)
WHERE NOT (p)-[:ACTED_IN]->(:Movie)
RETURN p.name

// 存在某关系（等价写法，推荐 EXISTS 子查询）
MATCH (p:Person)
WHERE EXISTS { (p)-[:DIRECTED]->(:Movie) }
RETURN p.name
```

### WITH：分段与中转

`WITH` 是 Cypher 版的「管道 / CTE」，常用于「先聚合再筛选」或给子查询传参。

```cypher
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
WITH p, count(m) AS movies
WHERE movies > 3
RETURN p.name, movies
ORDER BY movies DESC
```

> `WHERE` 写在 `WITH` 之后，是**聚合结果过滤（HAVING）**；
>
> 如果写在 MATCH 后面，则是聚合前过滤原始行。

### 聚合

**Cypher 没有**`GROUP BY`：`RETURN`/`WITH` 里的非聚合表达式自动成为分组键。

```cypher
// 分组计数 + 收集明细
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name,
       count(m)        AS movies,
       collect(m.title) AS titles
ORDER BY movies DESC

// 全表计数
MATCH (p:Person) RETURN count(*) AS total

// 数值聚合
MATCH (m:Movie) RETURN avg(m.released) AS avgYear, min(m.released), max(m.released)
```

| 函数 | 说明 |
| --- | --- |
| `count(x)` | 非空值计数 |
| `count(*)` | 行数 |
| `sum` / `avg` / `min` / `max` | 数值聚合 |
| `collect(x)` | 聚成列表（≈ SQL `array_agg`），可用 `collect(DISTINCT x)` |
| `percentileCont` / `stDev` | 统计分布（进阶） |

> 聚合与普通列混用时不需要额外声明分组；但**聚合后要再过滤，必须用**`WITH`（`WHERE` 不能直接写在 `RETURN` 后）。

### 排序·分页·去重

```cypher
// 多列排序 + 分页(跳过前面20行，往后取10行)
MATCH (m:Movie)
RETURN m.title, m.released
ORDER BY m.released DESC, m.title ASC
SKIP 20 LIMIT 10

// 去重（双向关系场景必备，否则同一对出现两次）
MATCH (p:Person)-[:IS_FRIENDS_WITH]-(f:Person)
RETURN DISTINCT p.name, f.name

// 别名在 ORDER BY 中可直接使用
MATCH (p:Person)-[:ACTED_IN]->(m:Movie)
RETURN p.name AS actor, count(m) AS n
ORDER BY n DESC
```

### 结果整形 UNWIND

```cypher
// 展开列表为多行
UNWIND [1,2,3] AS x RETURN x

// 展开属性列表（每个角色一行）
MATCH (:Person)-[r:ACTED_IN]->(m:Movie)
UNWIND r.roles AS role
RETURN m.title, role

// 展开后聚合回去
UNWIND $tags AS t
RETURN collect(DISTINCT t) AS allTags
```

## 日期与时间

Cypher 的时间模型分三类：**Date/Datetime**（时间点）、**Duration**（时长）、**Time/LocalTime**（时刻）。

### 创建日期/时间

```cypher
datetime("2019-06-01T18:40:32.142+0100")   // 带时区
date("2019-06-01")                          // 仅日期
datetime()                                  // 现在
date()                                      // 今天
duration({minutes: 2, seconds: 15})         // 2分15秒
duration("PT3M")                            // ISO-8601 写法
datetime({year:2019, month:7})              // 按字段构造
datetime({epochmillis: 1569816000000})      // 由毫秒时间戳
date("2019-06-01") + duration({days:30})    // 日期 + 时长
```

### 写入与更新

```cypher
// 存进属性
MATCH (a:Article {title:$t})
SET a.created      = datetime($iso),
    a.datePublished = date($d),
    a.readingTime  = duration({minutes:2, seconds:15})

// 时长累加
SET a.readingTime = a.readingTime + duration({minutes:1})
```

### 解析非标准格式（APOC）

```cypher
WITH apoc.date.parse("Sun, 29 September 2019", "ms", "EEE, dd MMMM yyyy") AS ms
MATCH (a:Article {title:$t})
SET a.datePublished = date(datetime({epochmillis: ms}))
```

> `apoc.date.parse(字符串, 目标单位, 格式)`：目标单位可取 `"ms"`（毫秒）或 `"s"`（秒）；省略格式时按默认格式解析。

### 格式化输出（APOC）

```cypher
MATCH (a:Article)
RETURN a.title AS title,
       apoc.temporal.format(a.created,       "dd MMMM yyyy HH:mm") AS created,
       apoc.temporal.format(a.datePublished, "dd MMMM yyyy")        AS datePublished,
       apoc.temporal.format(a.readingTime,   "mm:ss")               AS readingTime
```

### 比较与筛选

```cypher
// 精确某天
WHERE a.datePublished = date({year:2019, month:6, day:1})

// 某个月（必须写区间！）
WHERE date({year:2019, month:7}) > a.datePublished >= date({year:2019, month:6})

// Datetime 同理
WHERE a.created > datetime({year:2019, month:7})

// 近 30 天
WHERE a.created >= datetime() - duration({days:30})
```

> **两个必踩的坑:**
>
> * **坑 1：**`date({year:2019, month:6})`**会补成**`2019-06-01`。\
>   所以「六月所有文章」不能这样写，只能匹配到 6 月 1 日当天——必须改成上面的区间写法。
> * **坑 2：Duration 之间不能直接比大小。**

```cypher
// ✗ 错误：结果恒为空集（"无更改，无记录"）
WHERE a.readingTime <= duration("PT3M")

// ✓ 正确：把时长加到同一基准时间上再比较
WHERE datetime() + a.readingTime <= datetime() + duration("PT3M")
```

***

## 函数与过程扩展

### 函数与过程

|  | 函数（Function） | 过程（Procedure） |
| :--- | :--- | :--- |
| 本质 | 简单的计算/转换 | 更复杂的操作 |
| 返回 | 单个值 | 结果流（一列或多列、多行） |
| 能否嵌入表达式 | ✅ 可用在任何表达式或谓词中 | ❌ 必须用 `CALL` 单独调用 |
| 典型例子 | `type(r)`、`collect(x)`、`datetime()`、`apoc.date.parse` | `db.labels()`、`db.schema.visualization()`、`apoc.help` |

### 调用过程 CALL + YIELD

```cypher
// 调用内置过程
CALL db.labels();                  // 所有标签
CALL db.schema.visualization();    // 图结构可视化数据

// 每个过程返回一列或多列，用 YIELD 选择列并可起别名
CALL apoc.help("temporal") YIELD name, signature, description AS desc
RETURN name, signature, desc
```

### 查可用过程与函数

```cypher
SHOW PROCEDURES;   // 查询可用过程
SHOW FUNCTIONS;    // 查询可用函数
```

### 自定义函数或过程

|  | `@UserFunction` 函数 | `@Procedure` 过程 |
| :--- | :--- | :--- |
| 定义 | 类中带注解的公共 Java 方法 | 带注解的 Java 方法 |
| 默认名称 | `包名.方法名` | `包名.方法名` |
| 返回值 | 单个值 | Java 8 `Stream`（简单对象，字段为 `public`） |
| 只读性 | 只读 | 有 `mode` 属性：`READ` / `WRITE` / `DBMS` |
| 结果列 | — | 对象的字段名自动转为 `YIELD` 可用的列 |


> 更新: 2026-10-21 13:38:54  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/msixvo/gtrpnbnry0rl1yz2>