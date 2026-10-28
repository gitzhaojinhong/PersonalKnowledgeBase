# SpringDataNeo4j

Spring Data Neo4j（SDN）是 Spring Data 生态中用于 Neo4j 图数据库的持久层框架，提供对象图映射（OGM）、Repository 抽象、Neo4jTemplate 和事务管理。SDN 7.x 是目前主推版本，基于原生 Neo4j Java Driver 重写，移除了 OGM Session 层。

## 实体映射

### @Node

标记 Java 类为图节点实体。可指定 `value` 属性设置主标签，`labels` 设置附加标签。

```java
@Node(primaryLabel = "Person", labels = {"Actor"})
public class Person {
    @Id @GeneratedValue
    private Long id;
    private String name;
    private Integer born;
}
```

### @Relationship

标记实体间的关联字段。`type` 指定关系类型，`direction` 指定方向（`OUTGOING`、`INCOMING`、`UNDIRECTED`）。

```java
@Relationship(type = "ACTED_IN", direction = Relationship.Direction.OUTGOING)
private Set<Movie> movies = new HashSet<>();
```

### @Id

标记实体标识符属性。支持 `@GeneratedValue` 自动生成 ID（推荐使用 Neo4j 内部 ID 或 UUID）。

### @Property

显式指定属性映射到 Neo4j 的属性名，当 Java 字段名与 Neo4j 属性名不一致时使用。

```java
@Property("birth_place")
private String birthPlace;
```

### @DynamicLabels

支持运行时动态添加标签的集合属性。标签从该集合字段中读取，可动态变更。

```java
@DynamicLabels
private Set<String> labels = new HashSet<>();
```

### @CompositeProperty

将多个 Java 字段映射为一个 Neo4j 复合属性（Map 类型），适用于复杂嵌套值对象的存储。

## 映射基础

### 不可变实体

SDN 7.x 支持不可变实体（Java Record 或 final 字段），通过构造器注入而非 setter 方法赋值，减少状态变更的副作用。

```java
@Node
public record Person(@Id Long id, String name, Integer born) {}
```

### 构造器注入

SDN 通过构造器参数名匹配属性名。如果属性名与构造器参数名不一致，使用 `@PersistenceConstructor` 或 `@Value` 注解。

### 属性转换器

实现 `PropertyValueConverter` 或 `CompositePropertyConverter` 接口，自定义 Java 类型与 Neo4j 属性类型之间的转换逻辑。

### 元数据映射

`Neo4jMappingContext` 提供实体元数据，包括节点描述、关系描述、持久化构造器信息等，用于框架内部的映射决策。

## Repository

### Neo4jRepository

提供同步的 CRUD 操作，继承自 `PagingAndSortingRepository`，支持 `save()`、`findById()`、`findAll()`、`delete()` 等方法。

```java
public interface PersonRepository extends Neo4jRepository<Person, Long> {
    List<Person> findByName(String name);
}
```

### ReactiveNeo4jRepository

响应式 Repository，返回 `Mono` 和 `Flux` 类型，支持非阻塞操作。

```java
public interface ReactivePersonRepository extends ReactiveNeo4jRepository<Person, Long> {
    Flux<Person> findByBornGreaterThan(Integer born);
}
```

### 派生查询

通过方法名自动生成 Cypher 查询，支持 `findBy`、`deleteBy`、`countBy`、`existsBy` 等前缀，以及 `And`、`Or`、`Between`、`GreaterThan`、`Like`、`OrderBy` 等关键字。

```java
List<Person> findByNameAndBornGreaterThan(String name, Integer born);
List<Person> findByBornBetweenOrderByNameAsc(Integer start, Integer end);
```

### 方法命名规则

解析规则遵循 Spring Data 标准：`findBy` + 属性名 + 操作符 + 条件。属性名支持嵌套（如 `findByMovies_Title`）。

### 分页与排序

方法参数中传入 `Pageable`、`Sort` 对象，实现分页和排序功能。

```java
Page<Person> findByName(String name, Pageable pageable);
```

## 自定义查询

### @Query 注解

在 Repository 方法上使用 `@Query` 注解定义自定义 Cypher 查询。支持 `$` 参数占位符和 `:#{#entity}` 表达式。

```java
@Query("MATCH (p:Person)-[:ACTED_IN]->(m:Movie) WHERE m.title = $title RETURN p")
List<Person> findActorsByMovieTitle(String title);
```

### 参数绑定

`$paramName` 按名称绑定，`$0` 按位置绑定。支持 `@Param` 注解显式指定参数名。

```java
@Query("MATCH (p:Person) WHERE p.name = $name RETURN p")
Person findByName(@Param("name") String name);
```

### 动态查询

通过 `Criteria` 和 `Query` 对象构建动态查询条件，结合 `Neo4jTemplate` 执行。适合复杂多条件查询场景。

### 结果映射

`@Query` 方法可以返回实体、投影接口、DTO 类、`Map`、`List` 等多种类型，SDN 自动进行结果映射。

## Neo4jTemplate

### 同步模板

`Neo4jTemplate` 提供编程式数据访问 API，支持 `save()`、`findById()`、`findAll()`、`count()` 和自定义 Cypher 查询。

```java
@Autowired
private Neo4jTemplate neo4jTemplate;

List<Person> people = neo4jTemplate.findAll(Person.class);
neo4jTemplate.save(new Person("Tom Hanks", 1956));
```

### 反应式模板

`ReactiveNeo4jTemplate` 提供响应式 API，返回 `Mono` 和 `Flux`，适合 WebFlux 应用。

```java
@Autowired
private ReactiveNeo4jTemplate reactiveTemplate;

Flux<Person> people = reactiveTemplate.findAll(Person.class);
```

### Fluent API

`Neo4jTemplate.toExecutableQuery()` 和 `ReactiveNeo4jTemplate.toExecutableQuery()` 提供链式 API，构建参数化查询。

```java
List<Person> people = neo4jTemplate.toExecutableQuery(Person.class)
    .withCypher("MATCH (p:Person) WHERE p.born > $year RETURN p")
    .withParameters(Map.of("year", 1970))
    .findAll();
```

### 查询方法

`count()` 统计数量，`exists()` 检查存在性，`findOne()` 返回单条记录，`findAll()` 返回列表。

## 事务管理

### @Transactional

Spring 声明式事务，方法或类级别使用 `@Transactional` 注解。SDN 通过 Neo4j TransactionManager 管理事务。

```java
@Transactional
public void createPersonWithMovies(Person person, List<Movie> movies) {
    personRepository.save(person);
    movieRepository.saveAll(movies);
}
```

### TransactionTemplate

编程式事务管理，适用于需要精细控制事务边界的场景。通过 `TransactionTemplate.execute()` 执行事务。

```java
@Autowired
private TransactionTemplate transactionTemplate;

public void executeInTransaction() {
    transactionTemplate.executeWithoutResult(status -> {
        personRepository.save(new Person("Alice", 1990));
        personRepository.save(new Person("Bob", 1992));
    });
}
```

### 事务传播

SDN 支持 Spring 标准的 7 种事务传播行为（`REQUIRED`、`REQUIRES_NEW`、`NESTED` 等），通过 `@Transactional(propagation = ...)` 配置。

### 只读事务

`@Transactional(readOnly = true)` 标记只读事务，Neo4j 可以优化此类事务的路由（路由到 Read Replica）。

## 投影

### 接口投影

定义只包含 getter 方法的接口，SDN 将查询结果映射为接口实现。适用于只读的数据展示场景。

```java
public interface PersonNameOnly {
    String getName();
    Integer getBorn();
}

@Query("MATCH (p:Person) RETURN p.name AS name, p.born AS born")
List<PersonNameOnly> findAllNames();
```

### DTO 投影

将查询结果映射到具体的 DTO 类，构造函数参数名需与查询返回的字段名一致。

```java
public record PersonDTO(String name, Integer born) {}

@Query("MATCH (p:Person) RETURN p.name AS name, p.born AS born")
List<PersonDTO> findAllDTOs();
```

### 动态投影

Repository 方法返回类型由调用方指定，通过泛型参数或 `Class<T>` 参数实现。

```java
<T> List<T> findByName(String name, Class<T> type);
```

## 审计

### @CreatedDate

实体创建时自动填充当前时间戳。需要在配置类上启用 `@EnableNeo4jAuditing`。

```java
@CreatedDate
private LocalDateTime createdAt;
```

### @LastModifiedDate

实体更新时自动更新为当前时间戳。

```java
@LastModifiedDate
private LocalDateTime updatedAt;
```

### @CreatedBy

配合 Spring Security，实体创建时自动填充创建者用户名。

### @LastModifiedBy

实体更新时自动填充最后修改者用户名。

## 测试

### @SpringBootTest

集成测试注解，启动完整 Spring 上下文。常与 Testcontainers 结合使用。

### Testcontainers

使用 `Neo4jContainer` 在 Docker 中启动临时 Neo4j 实例，确保测试环境的隔离性和一致性。

```java
@Container
static Neo4jContainer<?> neo4jContainer = new Neo4jContainer<>("neo4j:latest")
    .withAdminPassword("secret");
```

### Neo4jExtension

Neo4j 提供 JUnit 5 扩展，无需 Spring 上下文即可测试 SDN Repository。使用 `@ExtendWith(Neo4jExtension.class)` 激活。

## 版本迁移

### SDN 6.x 到 7.x

SDN 7.x 移除了 OGM Session 层，直接基于 Neo4j Java Driver。主要变化：`@NodeEntity` 改为 `@Node`，`@Relationship` 不再需要 `@RelationshipEntity`，移除了 `@StartNode` 和 `@EndNode`。

### OGM 到 SDN

从 Neo4j OGM 迁移到 SDN 7.x 需要重写实体注解、Repository 接口和查询方法。OGM 的 `Session` 替换为 `Neo4jTemplate`，`@NodeEntity` 替换为 `@Node`。

### 注解变化

| SDN 6.x / OGM | SDN 7.x |
|--------------|---------|
| `@NodeEntity` | `@Node` |
| `@RelationshipEntity` | 移除，关系属性实体化 |
| `@StartNode` / `@EndNode` | 移除 |
| `@GraphId` | `@Id` + `@GeneratedValue` |
| `@Index` | 需手动创建索引 |

## 相关文档

- [JavaDriver](./JavaDriver.md)
- [Cypher查询语言](./Cypher查询语言.md)
- [图数据库核心概念](./图数据库核心概念.md)