## neo4j-java-driver

[neo4j-java-driver手册跳转](https://neo4j.ac.cn/docs/java-manual/current/install/)

## 添加依赖

```xml
<dependency>
  <groupId>org.neo4j.driver</groupId>
  <artifactId>neo4j-java-driver</artifactId>
  <version>6.1.0</version>
</dependency>
```

## 配置连接参数

```yaml
app:
  manage:
      neo4j:
        # 是否启用 Neo4j 结构图投影查询。MySQL 结构节点表始终是权威结构数据源；Neo4j 用于结构导航加速和图查询展示。
        enabled: true
        # Neo4j 连接地址，包含协议、主机及 Bolt 端口。
        uri: bolt://127.0.0.1:7687
        # Neo4j 数据库连接用户名。
        username: neo4j
        # Neo4j 数据库连接密码。
        password: ${NEO4J_PASSWORD:12345678}
        # Neo4j 连接后使用的数据库名称。
        database: neo4j
        # Neo4j 查询超时时间，单位：秒。
        query-timeout-seconds: 5
```

## 创建配置类

```java
// 只有当 app.manage.neo4j.enabled = true 满足时，此配置类才会被注册。
@Configuration
@ConditionalOnProperty(prefix = "app.manage.neo4j", name = "enabled", havingValue = "true")
public class Neo4jConfiguration {
    /** neo4j数据库地址 */
    @Value("${app.manage.neo4j.uri:}")
    private String uri;

    /** neo4j 用户名。 */
    @Value("${app.manage.neo4j.username:}")
    private String username;

    /** neo4j 密码。 */
    @Value("${app.manage.neo4j.password:}")
    private String password;

    /** 查询的超时时间，单位秒。 */
    @Value("${app.manage.neo4j.query-timeout-seconds:5}")
    private int queryTimeoutSeconds;


    /**
     * Driver客户端
     * destroyMethod = "close" 让 Spring 在容器关闭时自动调用 Driver.close()，
     * 释放连接池与后台的空闲连接回收线程。
     */
    @Bean(destroyMethod = "close")
    public Driver neo4jDriver() {
        Config config = Config.builder()
            .withConnectionTimeout(queryTimeoutSeconds, TimeUnit.SECONDS)
            .build();
        return GraphDatabase.driver(
            uri,
            AuthTokens.basic(username, password),
            config
        );
    }
}
```

> 创建 `Driver`实例仅提供如何访问数据库的信息，并不会实际建立连接；连接推迟到执行第一个查询时才建立。
>
> 若要立即验证驱动能否连上数据库（校验凭据、版本兼容等），在初始化后调用 `.verifyConnectivity()`。连接失败时，启用驱动日志有助于排查。

## 基本操作

### API选型

| API | 适用场景 | 自动重试 |
| --- | --- | --- |
| driver.executableQuery() | 简单单条 Cypher   | ✅ |
| session.executeRead/Write() | 需要查→Java 判断→写、批量、大结果集   | ✅ |
| session.beginTransaction() | 跨方法传递事务、精细控制 commit   | ❌ |
| session.run() | `CALL { ... } IN TRANSACTIONS` 查询 | ✅ |

### Driver.executableQuery()

#### 操作示例->无参数自动映射

```java
List<Map> people = List.of(
    Map.of("name", "Alice", "age", 42, "friends", List.of("Bob", "Peter", "Anna")),
    Map.of("name", "Bob",   "age", 19),
    Map.of("name", "Peter", "age", 50),
    Map.of("name", "Anna",  "age", 30)
);

try {
    // 创建节点
    people.forEach(person -> {
        var result = driver.executableQuery("""
            CREATE (p:Person {name: $person.name, age: $person.age})
            """)
            // 指定要操作的数据库
            .withConfig(QueryConfig.builder().withDatabase("<database-name>").build())
            // 参数映射
            .withParameters(Map.of("person", person))
            .execute();
    });

    // 创建关系
    people.forEach(person -> {
        if (person.containsKey("friends")) {
            var result = driver.executableQuery("""
                MATCH (p:Person {name: $person.name})
                UNWIND $person.friends AS friend_name
                MATCH (friend:Person {name: friend_name})
                CREATE (p)-[:KNOWS]->(friend)
                """)
                .withConfig(QueryConfig.builder().withDatabase("<database-name>").build())
                .withParameters(Map.of("person", person))
                .execute();
        }
    });

    // 查询 Alice 40 岁以下的朋友
    var result = driver.executableQuery("""
        MATCH (p:Person {name: $name})-[:KNOWS]-(friend:Person)
        WHERE friend.age < $age
        RETURN friend
        """)
        .withConfig(QueryConfig.builder()
            .withDatabase("<database-name>")
            .withRouting(RoutingControl.READ)
            .build())
        .withParameters(Map.of("name", "Alice", "age", 40))
        .execute();

    // 遍历结果
    result.records().forEach(r -> {
        System.out.println(r);
    });

    // 摘要信息
    System.out.printf("The query %s returned %d records in %d ms.%n",
        result.summary().query(), result.records().size(),
        result.summary().resultAvailableAfter(TimeUnit.MILLISECONDS));
} catch (Neo4jException e) {
    if (e.gqlStatus().equals("42NFF")) {
        System.out.println("There was a permission issue. Make sure you have correct permissions and try again.");
    } else {
        System.out.println(e.getMessage());
        System.exit(1);
    }
}
```

> 处理查询返回值时，手动提取属性并转换为 Java 类型很繁琐（如 `person.get("name").asString()`）。
>
> **Value Mapping** 允许声明一个 Java Record 描述期望的返回值结构，由驱动依据该类从查询结果生成对象。

#### 查询->参数自动映射

```java
record Person(String name, Integer age) {}

Optional<Person> persons = driver.executableQuery("MERGE (p:Person {name: $name, age: $age}) RETURN p")
    .withParameters(Map.of("name", "Margarida", "age", 29))
    .withConfig(QueryConfig.builder().withDatabase("neo4j").build())
    .execute()
    .records()
    .stream()
    .map(record -> record.get("p").as(Person.class))
    // .map(record -> record.as(Person.class)) // 或者直接映射Record实例
    .findFirst();
```

#### 插入->参数自动映射

```java
record Person(String name, int age) {}

Person person = new Person("Lucia", 29);
driver.executableQuery("CREATE (:Person $person)")
         .withParameters(Map.of("person", person))
         .execute();
```

#### 更新->参数自动映射

```java
record Person(String name, int age) {}

Person person = new Person("Lucia", 30);
driver.executableQuery("""
            MATCH (p:Person {name: $person.name})
            SET p += $person
        """)
    .withParameters(Map.of("person", person))
    .execute();
```

#### 删除->参数自动映射

```java
record Person(String name, int age) {}

Person person = new Person("Lucia", 29);

driver.executableQuery("MATCH (p:Person {name: $person.name, age: $person.age}) DELETE p")
        .withParameters(Map.of("person", person))
        .execute();

```

### Driver.session() 推荐

> 使用 `executableQuery()` 时驱动会自动创建一个**事务**——一个工作单元，要么**提交**（全部完成），要么失败时**回滚**。
>
> 单条查询中可以按顺序包含多条 Cypher 语句（如 `MATCH` + `CREATE` 更新数据库），但**无法在多个查询之间交替执行客户端逻辑**。
>
> 这类高级场景需要手动控制事务，最常见的形式是**托管事务**——可视为把 `executableQuery()` 的流程拆开，从而在更多位置指定行为。

#### 获取session

```java
private final Driver driver;

private Session openSession() {
    return driver.session(SessionConfig.forDatabase("neo4j database"));
}
```

***

***会话配置 SessionConfig  ：***

1. 数据库选择

```java
Session session = driver.session(SessionConfig.builder()
    .withDatabase("<database-name>").build());
```

2. 会话路由

> 请求路由：集群中所有会话默认以写模式打开并路由到主节点（Leader）。
>
> 可用 `.withRouting(RoutingControl.READ)` 修改；
>
> 注意 `.executeRead()` / `.executeWrite()` 会自动覆盖会话的默认访问模式。

```java
var session = driver.session(SessionConfig.builder()
    .withDatabase("<database-name>")
    .withDefaultAccessMode(AccessMode.READ)
    .build());
```

3. 使用其他用户身份登录

```java
// 通过会话创建时传入 AuthToken 作为第三个参数（切换成本低于新建 Driver）
var authToken = AuthTokens.basic("<username>", "<password>");
var session = driver.session(
    Session.class,
    SessionConfig.builder()
        .withDatabase("<database-name>")
        .build(),
    authToken
);
```

#### 查询

```java
try (Session session = openSession()) {
    List<People> people = session.executeRead(tx -> {                                                          // (2)
        var result = tx.run("""
                MATCH (p:Person) WHERE p.name STARTS WITH $filter
                RETURN p
                """, Map.of("filter", "Al"));
        return result.stream()
                .map(record -> record.get("p").as(People.class))
                .toList();                                                  // (4)
    });
    // 后续 tx.run() 调用在同一事务内执行
}
```

#### 插入

```java
try (Session session = openSession()) {
    People people = new People("Lucia", 29);

    session.executeWrite(tx -> {
        // 直接传 People 对象，驱动自动转为 {name:..., age:...}
        tx.run("CREATE (p:Person{name:$p.name, age:$p.age})", Map.of("p", people));
        return null;
    });
}
```

#### 更新

```java
try (Session session = openSession()) {
    People newData = new People("Lucia", 30);  // 新数据，age 已更新

    session.executeWrite(tx -> {
        tx.run("""
                MATCH (p:Person {name: $newData.name})
                SET p += $newData
                """,
                Map.of("newData", newData));
        return null;
    });
}
```

#### 删除

```java
try (Session session = openSession()) {
    People people = new People("Lucia", 29);
    session.executeWrite(tx -> {
        tx.run("""
                MATCH (p:Person {name: $p.name, age: $p.age})
                DELETE p
                """,
                Map.of("p", people));
        return null;
    });
}
```

#### beginTransaction()显式事务

```java
try (Session session = openSession()) {
    try (Transaction tx = session.beginTransaction()) {
        // 使用 tx.run() 运行查询
        //     tx.commit()   提交事务
        //     tx.rollback() 回滚事务
    }
}
```

#### run()隐式事务+自管理查询

* `CALL { ... } IN TRANSACTIONS` 查询：这是 `session.run()`唯一不可被替代的场景。对于需要分批处理大量数据（如批量导入）的自管理查询，`executableQuery` 和 `executeRead/Write`无法使用，只有 `session.run()` 能正确执行它们。
* `LOAD CSV` 大批量导入：结合 `LOAD CSV` 和 `CALL {} IN TRANSACTIONS` 来避免单个超大事务导致的超时。
* 快速原型验证：只有当其他查询接口不适用，或用于快速原型设计时，才应考虑使用隐式事务。

#### 事务配置

把 `TransactionConfig` 对象作为 `.executeRead()`、`.executeWrite()` 和 `.beginTransaction()` 的可选第二个参数，可进一步控制事务：

| 配置 | 说明 |
| --- | --- |
| 事务超时 | 运行过久的事务会被服务器终止。默认值由服务端设置，最小为 1 毫秒。 |
| 元数据 Map | 附加到事务的元数据，会记录在服务器 query.log 中，并在 SHOW TRANSACTIONS 输出中可见。可用于标记事务。 |

```java
try (Session session = openSession()) {
    var people = session.executeRead(tx -> {
        var result = tx.run("MATCH (p:Person) RETURN p");
        return result.list();  // 返回 Record 列表
    }, TransactionConfig.builder()
        .withTimeout(Duration.ofSeconds(5))
        .withMetadata(Map.of("appName", "peopleTracker"))
        .build()
    );

    people.forEach(person -> System.out.println(person));
}
```
