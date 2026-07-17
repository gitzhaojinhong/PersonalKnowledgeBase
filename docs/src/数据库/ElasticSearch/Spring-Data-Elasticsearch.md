

## 版本兼容

### Spring Boot 与 Elasticsearch 版本矩阵

Spring Boot 3.x 与 Spring Data Elasticsearch 5.x 强制绑定 Elasticsearch 8.x 客户端，底层使用 `elasticsearch-java`（即新版 Java API Client），不再支持 `RestHighLevelClient`。

| Spring Boot | Spring Data Elasticsearch | Elasticsearch Server | elasticsearch-java | 备注 |
|---|---|---|---|---|
| 3.0.x | 5.0.x | 8.5+ | 8.5.x | 首个 5.x GA，移除 RHLC |
| 3.1.x | 5.1.x | 8.7+ | 8.7.x | 运行时发现改进 |
| 3.2.x | 5.2.x | 8.11+ | 8.11.x | 虚拟线程支持 |
| 3.3.x | 5.3.x | 8.13+ | 8.13.x | 当前推荐版本 |
| 3.4.x | 5.4.x | 8.15+ | 8.15.x | 最新 |

**注意事项**：

- Elasticsearch 8.x 默认启用 SSL/TLS，本地开发可通过 `spring.elasticsearch.uris` 配置关闭。
- 客户端版本必须与 ES 服务端大版本一致，跨大版本不兼容。
- 从 Spring Data Elasticsearch 4.x 迁移到 5.x 时，`RestHighLevelClient` 相关代码需全部重写。

### Spring Data Elasticsearch 版本演进

| 主版本 | Spring Boot 基线 | 底层客户端 | 关键变更 |
|---|---|---|---|
| 3.x | 2.0.x – 2.2.x | TransportClient | 已废弃 |
| 4.0 – 4.4 | 2.3.x – 2.7.x | RestHighLevelClient | 引入 ReactiveElasticsearchOperations |
| 5.0+ | 3.0+ | elasticsearch-java | 移除 RHLC，全面拥抱新版 Java API Client |

**核心断裂点**：4.x → 5.x 的迁移是破坏性的——`RestHighLevelClient` 完全移除，`IndexCoordinates` 迁移到 `org.springframework.data.elasticsearch.client.elc`，`Query` 体系重构，`SearchHit` 泛型化。

### 依赖配置（Maven / Gradle）

**Maven（pom.xml）**：

```xml
<parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
</parent>

<properties>
    <java.version>17</java.version>
</properties>

<dependencies>
    <!-- Spring Data Elasticsearch Starter -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-data-elasticsearch</artifactId>
    </dependency>

    <!-- 可选：显式指定 elasticsearch-java 版本 -->
    <dependency>
        <groupId>co.elastic.clients</groupId>
        <artifactId>elasticsearch-java</artifactId>
        <!-- 版本由 spring-boot-starter-parent 管理 -->
    </dependency>

    <!-- 测试依赖 -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-test</artifactId>
        <scope>test</scope>
    </dependency>
</dependencies>
```

**Gradle（build.gradle）**：

```groovy
plugins {
    id 'java'
    id 'org.springframework.boot' version '3.3.5'
    id 'io.spring.dependency-management' version '1.1.6'
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-data-elasticsearch'

    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}
```

**最佳实践**：

- 不要手动指定 `elasticsearch-java` 版本，交给 Spring Boot BOM 统一管理。
- 若需使用 `RestClientTransport` 的底层配置项，直接注入 `org.elasticsearch.client.RestClient`。
- 单元测试推荐使用 `testcontainers` 启动真实 ES 实例，而非内存模拟。

---

## 实体映射

### @Document 注解

将一个 Java POJO 映射为 Elasticsearch 文档。定义索引名称、分片/副本策略、刷新间隔等索引级元数据。

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `indexName` | String | 类名小写 | 索引名称，支持 SpEL 表达式 |
| `createIndex` | boolean | true | 应用启动时是否自动创建索引 |
| `refreshInterval` | String | "1s" | 索引刷新间隔 |
| `shards` | int | 1 | 主分片数量 |
| `replicas` | int | 1 | 副本数量 |
| `versionType` | VersionType | EXTERNAL | 乐观锁版本控制策略 |
| `useServerConfiguration` | boolean | false | 忽略注解中的 DDL 设置，使用服务端配置 |

**完整示例**：

```java
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.elasticsearch.annotations.*;

@Document(
    indexName = "product-#{T(java.time.LocalDate).now().toString()}",
    createIndex = true,
    shards = 3,
    replicas = 2,
    refreshInterval = "5s"
)
public class Product {

    @Id
    private String id;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String name;

    @Field(type = FieldType.Keyword)
    private String category;

    @Field(type = FieldType.Double)
    private Double price;

    @Version
    private Long version;

    // 构造器、Getter、Setter 省略
    public Product() {}

    public Product(String id, String name, String category, Double price) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.price = price;
    }

    // ---- Getter / Setter ----
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public Double getPrice() { return price; }
    public void setPrice(Double price) { this.price = price; }
    public Long getVersion() { return version; }
    public void setVersion(Long version) { this.version = version; }
}
```

**注意事项**：

- `indexName` 支持 SpEL 表达式，可实现按日期滚动的索引名（如 `product-2026-07-17`）。
- 生产环境建议 `createIndex = false`，通过 `@Setting` 注解或外部脚本管理索引 DDL。
- `@Version` 配合 `versionType = EXTERNAL` 实现乐观锁，防止并发写冲突。

### @Field 注解

将 Java 字段映射为 Elasticsearch 字段，控制字段类型、分词器、是否索引等。

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `type` | FieldType | Auto | 字段类型（Text / Keyword / Integer / Nested 等） |
| `name` | String | 字段名 | 映射后的 ES 字段名 |
| `analyzer` | String | "" | 索引时使用的分词器 |
| `searchAnalyzer` | String | "" | 查询时使用的分词器 |
| `index` | boolean | true | 是否建立倒排索引 |
| `store` | boolean | false | 是否单独存储原始值 |
| `format` | DateFormat | none | 日期格式（用于 Date 字段） |
| `pattern` | String | "" | 自定义日期格式字符串 |
| `fielddata` | boolean | false | 是否启用 fielddata（Text 字段排序/聚合时需要） |
| `eagerGlobalOrdinals` | boolean | false | 是否预加载全局序号（用于聚合加速） |
| `ignoreAbove` | int | 256 | 超过此长度的字符串不被索引（Keyword 类型） |
| `ignoreMalformed` | boolean | false | 格式错误时是否忽略而非抛异常 |
| `nullValue` | String | "" | 空值替换字符串 |
| `copyTo` | String[] | {} | 拷贝到哪些目标字段（联合搜索） |

**FieldType 枚举表**：

| FieldType | ES 类型 | 适用场景 |
|---|---|---|
| `Auto` | 自动推断 | 默认，由 Spring Data 根据 Java 类型推断 |
| `Text` | text | 全文搜索（分词后索引） |
| `Keyword` | keyword | 精确匹配、排序、聚合 |
| `Integer` | integer | 32 位整数 |
| `Long` | long | 64 位整数 |
| `Double` | double | 双精度浮点 |
| `Boolean` | boolean | 布尔值 |
| `Date` | date | 日期时间 |
| `Nested` | nested | 嵌套对象（独立 Lucene 文档） |
| `Object` | object | 扁平化对象 |
| `Geo_Point` | geo_point | 经纬度坐标 |
| `Geo_Shape` | geo_shape | 地理形状 |
| `Ip` | ip | IP 地址 |
| `Binary` | binary | Base64 编码的二进制 |
| `Dense_Vector` | dense_vector | 向量数据（语义搜索） |
| `Completion` | completion | 自动补全建议 |
| `Flattened` | flattened | 扁平化映射（未知字段的 Key-Value） |
| `Rank_Feature` | rank_feature | 排序特征（用于算分） |

**完整示例**：

```java
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;
import org.springframework.data.elasticsearch.annotations.DateFormat;

@Document(indexName = "blog_post")
public class BlogPost {

    @Id
    private String id;

    @Field(
        type = FieldType.Text,
        name = "post_title",
        analyzer = "ik_max_word",
        searchAnalyzer = "ik_smart",
        copyTo = {"search_content"}
    )
    private String title;

    @Field(
        type = FieldType.Text,
        analyzer = "ik_max_word",
        copyTo = {"search_content"}
    )
    private String body;

    /**
     * 联合搜索字段 —— title 和 body 的内容都拷贝到此字段。
     * 查询时只需搜 search_content 即可命中任一字段。
     */
    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String searchContent;

    @Field(type = FieldType.Keyword, index = true, store = true)
    private String author;

    @Field(
        type = FieldType.Date,
        format = DateFormat.date_hour_minute_second,
        pattern = "yyyy-MM-dd HH:mm:ss||epoch_millis"
    )
    private Date publishTime;

    @Field(type = FieldType.Integer, index = false)
    private Integer viewCount;

    // 构造器、Getter、Setter ...
}
```

**最佳实践**：

- `Auto` 类型在原型阶段方便，但生产环境必须显式声明 `FieldType` 以避免字段映射错误。
- 中文字段必须配置 `analyzer = "ik_max_word"` 或 `analyzer = "ik_smart"`，否则默认 `standard` 分词器按字拆分。
- `copyTo` 字段本身不存储数据，仅作为查询入口，不能直接写入。
- `fielddata = true` 会显著增加堆内存消耗，仅对少量 Text 字段启用。

### @Id 主键

标识文档的唯一标识符，对应 Elasticsearch 的 `_id` 元字段。

| 参数 | 类型 | 说明 |
|---|---|---|
| 无参 | 无 | 标识字段为文档主键 |

**支持的类型**：`String`、`Long`、`Integer`，推荐使用 `String`。

**完整示例**：

```java
@Document(indexName = "order")
public class Order {

    @Id
    private String id;  // 映射到 ES _id

    @Field(type = FieldType.Keyword)
    private String orderNo;

    // ...
}

// 写入时显式指定 ID
Order order = new Order();
order.setId("ORD-20260717-001"); // 自定义 ID
order.setOrderNo("ORD-20260717-001");
repository.save(order);

// 不指定 ID 时 ES 自动生成
Order order2 = new Order();
order2.setOrderNo("ORD-20260717-002");
repository.save(order2); // id 由 ES 自动生成 UUID
```

**注意事项**：

- 不指定 ID 时 ES 自动生成 20 字符的 Base64 编码字符串。
- 写入时相同 ID 会覆盖已有文档（upsert 语义）。
- 推荐使用业务主键而非 ES 自动生成的 ID，便于追溯和幂等。

### @Setting 注解

定义索引级配置，包括分词器、过滤器、相似度算法等索引设置。

**完整示例**：

```java
@Document(indexName = "news")
@Setting(
    shards = 3,
    replicas = 2,
    refreshInterval = "10s",
    // 关键：通过 settingPath 引用外部 JSON 配置文件
    settingPath = "elasticsearch/settings/news-settings.json"
)
public class News {
    // ...
}
```

**外部配置文件** `resources/elasticsearch/settings/news-settings.json`：

```json
{
  "index": {
    "number_of_shards": 3,
    "number_of_replicas": 2,
    "refresh_interval": "10s",
    "max_result_window": 20000,
    "analysis": {
      "analyzer": {
        "ik_pinyin_analyzer": {
          "type": "custom",
          "tokenizer": "ik_max_word",
          "filter": ["pinyin_filter", "lowercase"]
        },
        "ngram_analyzer": {
          "type": "custom",
          "tokenizer": "ngram_tokenizer",
          "filter": ["lowercase"]
        }
      },
      "tokenizer": {
        "ngram_tokenizer": {
          "type": "ngram",
          "min_gram": 2,
          "max_gram": 3
        }
      },
      "filter": {
        "pinyin_filter": {
          "type": "pinyin",
          "keep_first_letter": true,
          "keep_full_pinyin": false
        }
      }
    }
  }
}
```

**注意事项**：

- `settingPath` 与注解内属性互斥：当 `settingPath` 指定后，注解中的 `shards`、`replicas` 等属性被忽略。
- 索引一旦创建，`number_of_shards` 不可修改（需 reindex）。
- 自定义分词器依赖的插件（如 IK、Pinyin）必须在 ES 集群中预先安装。

### 日期格式化

Spring Data Elasticsearch 5.x 支持 Java 8+ 时间类型（`LocalDate`、`LocalDateTime`、`Instant`、`ZonedDateTime`）与 `java.util.Date`。

| 参数 | 类型 | 说明 |
|---|---|---|
| `format` | DateFormat | 预设日期格式枚举 |
| `pattern` | String | 自定义格式字符串，支持多格式（`||` 分隔） |

**DateFormat 枚举**：

| 枚举值 | 格式字符串 | 示例 |
|---|---|---|
| `none` | 无 | 使用 Epoch Millis |
| `basic_date` | `yyyyMMdd` | `20260717` |
| `basic_date_time` | `yyyyMMdd'T'HHmmss.SSSZ` | `20260717T103000.000+0800` |
| `date` | `yyyy-MM-dd` | `2026-07-17` |
| `date_hour_minute_second` | `yyyy-MM-dd'T'HH:mm:ss` | `2026-07-17T10:30:00` |
| `date_hour_minute_second_millis` | `yyyy-MM-dd'T'HH:mm:ss.SSS` | `2026-07-17T10:30:00.000` |
| `date_time` | `yyyy-MM-dd'T'HH:mm:ss.SSSZ` | `2026-07-17T10:30:00.000+0800` |
| `epoch_millis` | 毫秒时间戳 | `1721183400000` |
| `epoch_second` | 秒时间戳 | `1721183400` |

**完整示例**：

```java
@Document(indexName = "log_record")
public class LogRecord {

    @Id
    private String id;

    // 方案一：java.util.Date + 预设格式
    @Field(type = FieldType.Date, format = DateFormat.date_hour_minute_second)
    private Date createTime;

    // 方案二：LocalDateTime + 自定义格式（多格式兼容）
    @Field(
        type = FieldType.Date,
        format = {},
        pattern = "yyyy-MM-dd HH:mm:ss||yyyy-MM-dd'T'HH:mm:ss.SSS||epoch_millis"
    )
    private LocalDateTime updateTime;

    // 方案三：LocalDate（日期维度，无时分秒）
    @Field(type = FieldType.Date, format = DateFormat.date)
    private LocalDate businessDate;

    // 方案四：Instant（推荐：时区无关，精确到纳秒）
    @Field(type = FieldType.Date, format = DateFormat.date_time)
    private Instant eventTime;

    // 方案五：ZonedDateTime（带时区信息）
    @Field(type = FieldType.Date, format = DateFormat.date_time)
    private ZonedDateTime zonedTime;
}
```

**最佳实践**：

- 存储层推荐使用 `Instant`，时区无关，避免序列化偏差。
- `pattern` 中使用 `||` 分隔多个格式，ES 会按顺序尝试解析，兼容旧数据迁移。
- 避免使用 `epoch_millis` 作为唯一格式，查询时不可读。

### 嵌套对象映射

`@Field(type = FieldType.Nested)` 将对象数组映射为独立的 Lucene 文档，保证子对象之间的关联性不被扁平化破坏。

**扁平化（Object）问题**：

```java
// 假设文档：comments = [{ author: "A", content: "好" }, { author: "B", content: "差" }]
// 扁平化后：comments.author = ["A", "B"], comments.content = ["好", "差"]
// 查询 "author=A AND content=差" 会错误命中（因为 A 和 差 被跨对象关联）
```

**完整示例**：

```java
@Document(indexName = "article")
public class Article {

    @Id
    private String id;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String title;

    /**
     * Nested 类型：每个 Comment 独立索引，查询时保持对象边界。
     */
    @Field(type = FieldType.Nested, includeInParent = false)
    private List<Comment> comments;

    // 内嵌类
    public static class Comment {
        @Field(type = FieldType.Keyword)
        private String author;

        @Field(type = FieldType.Text, analyzer = "ik_max_word")
        private String content;

        @Field(type = FieldType.Integer)
        private Integer likes;

        // 构造器、Getter、Setter ...
        public Comment() {}
        public Comment(String author, String content, Integer likes) {
            this.author = author;
            this.content = content;
            this.likes = likes;
        }
        public String getAuthor() { return author; }
        public void setAuthor(String author) { this.author = author; }
        public String getContent() { return content; }
        public void setContent(String content) { this.content = content; }
        public Integer getLikes() { return likes; }
        public void setLikes(Integer likes) { this.likes = likes; }
    }
}
```

**Nested 查询示例**：

```java
import co.elastic.clients.elasticsearch._types.query_dsl.NestedQuery;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.SearchHits;

// 查询：comments 中 author="张三" 且 content 包含 "好评"
Query nestedQuery = NestedQuery.of(n -> n
    .path("comments")
    .query(q -> q.bool(b -> b
        .must(m -> m.term(t -> t.field("comments.author").value("张三")))
        .must(m -> m.match(mt -> mt.field("comments.content").query("好评")))
    ))
)._toQuery();

NativeQuery nativeQuery = NativeQuery.builder()
    .withQuery(nestedQuery)
    .build();

SearchHits<Article> hits = operations.search(nativeQuery, Article.class);
```

**注意事项**：

- `includeInParent = true` 会将嵌套对象同时扁平化到父文档（增加存储但可用简单查询）。
- Nested 查询性能低于 Object 查询，大量嵌套文档应评估是否需要独立的父子索引。
- 每个 Nested 文档都会增加索引大小，过深的嵌套（3 层以上）应避免。

### Geo 字段映射

支持地理位置查询（距离过滤、矩形范围、多边形包含）。

| FieldType | ES 类型 | 说明 |
|---|---|---|
| `Geo_Point` | geo_point | 单一经纬度坐标 |
| `Geo_Shape` | geo_shape | 复杂地理形状（多边形、线段等） |

**完整示例**：

```java
import org.springframework.data.elasticsearch.core.geo.GeoPoint;

@Document(indexName = "restaurant")
public class Restaurant {

    @Id
    private String id;

    @Field(type = FieldType.Text, analyzer = "ik_max_word")
    private String name;

    /**
     * Geo 点：纬度 latitude，经度 longitude
     */
    @Field(type = FieldType.Geo_Point)
    private GeoPoint location;

    /**
     * 配送范围（GeoJSON 多边形）
     */
    @Field(type = FieldType.Geo_Shape)
    private String deliveryArea; // 存储 GeoJSON 字符串

    // 构造器、Getter、Setter ...
    public Restaurant() {}
    public Restaurant(String id, String name, double lat, double lon) {
        this.id = id;
        this.name = name;
        this.location = new GeoPoint(lat, lon);
    }
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public GeoPoint getLocation() { return location; }
    public void setLocation(GeoPoint location) { this.location = location; }
    public String getDeliveryArea() { return deliveryArea; }
    public void setDeliveryArea(String deliveryArea) { this.deliveryArea = deliveryArea; }
}
```

**Geo 距离查询**：

```java
import co.elastic.clients.elasticsearch._types.query_dsl.GeoDistanceQuery;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.data.elasticsearch.core.geo.GeoPoint;

// 查询距离 (39.9042, 116.4074) 3km 以内的餐厅
GeoPoint center = new GeoPoint(39.9042, 116.4074);

Query geoQuery = GeoDistanceQuery.of(g -> g
    .field("location")
    .distance("3km")
    .location(l -> l.latlon(ll -> ll.lat(center.getLat()).lon(center.getLon())))
)._toQuery();

NativeQuery nativeQuery = NativeQuery.builder()
    .withQuery(geoQuery)
    .build();

SearchHits<Restaurant> hits = operations.search(nativeQuery, Restaurant.class);
```

**注意事项**：

- `GeoPoint` 坐标顺序为 `(纬度, 经度)`，与 GeoJSON 的 `[经度, 纬度]` 相反，注意区分。
- 地理距离查询底层使用 BKD 树，性能优秀，支持百万级文档。
- `GeoShape` 字段存储 GeoJSON 字符串，查询时需确保 CRS 为 WGS84（EPSG:4326）。

---

## ElasticsearchRepository

### 声明式 Repository 接口

继承 `ElasticsearchRepository<T, ID>` 即可获得开箱即用的 CRUD 与分页功能，无需编写实现类。

| 内置方法 | 说明 |
|---|---|
| `save(T entity)` | 保存/更新单个文档 |
| `saveAll(Iterable<T> entities)` | 批量保存 |
| `findById(ID id)` | 按 ID 查询 |
| `existsById(ID id)` | 判断是否存在 |
| `findAll()` | 全量查询（注意：默认限制 10000 条） |
| `findAllById(Iterable<ID> ids)` | 批量按 ID 查询 |
| `count()` | 文档总数 |
| `deleteById(ID id)` | 按 ID 删除 |
| `delete(T entity)` | 删除文档 |
| `deleteAllById(Iterable<ID> ids)` | 批量删除 |
| `deleteAll()` | 删除全部文档 |
| `search(Query query)` | 通用搜索 |
| `searchSimilar(T entity, String[] fields, Pageable pageable)` | 相似度搜索 |

**完整示例**：

```java
import org.springframework.data.elasticsearch.repository.ElasticsearchRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProductRepository extends ElasticsearchRepository<Product, String> {

    // 方法命名查询（见下一节）
    List<Product> findByCategory(String category);

    List<Product> findByNameContaining(String keyword);

    List<Product> findByPriceBetween(Double min, Double max);

    Page<Product> findByCategory(String category, Pageable pageable);

    // @Query 自定义查询（见后续章节）
    @Query("{\"match\": {\"name\": {\"query\": \"?0\"}}}")
    List<Product> searchByName(String keyword);
}
```

**YAML 配置**：

```yaml
spring:
  elasticsearch:
    uris: http://localhost:9200
    # 若使用 Basic Auth
    username: elastic
    password: changeme
    connection-timeout: 5s
    socket-timeout: 60s

logging:
  level:
    org.springframework.data.elasticsearch: DEBUG
    tracer: TRACE  # 打印请求/响应 JSON
```

**注意事项**：

- `findAll()` 默认只返回 10000 条（受 `index.max_result_window` 限制），超大数据量需使用 `Scroll` 或 `Search After`。
- Repository 方法默认即时执行，如需异步，配合 `@Async` 注解。
- 启动时若 ES 不可达，应用会启动失败（默认行为），可配置 `spring.elasticsearch.connection-timeout` 优化等待。

### 方法命名查询规则

Spring Data 自动解析方法名生成 Elasticsearch 查询，无需编写 DSL。

| 关键词 | 示例方法名 | 等价 ES 查询 |
|---|---|---|
| `findBy` / `readBy` / `getBy` / `queryBy` | `findByName` | term query |
| `Containing` / `Contains` / `IsContaining` | `findByNameContaining` | match query |
| `Like` | `findByNameLike` | wildcard query |
| `Not` | `findByNameNot` | must_not term |
| `Between` | `findByPriceBetween` | range query |
| `LessThan` / `GreaterThan` | `findByPriceGreaterThan` | range query |
| `Before` / `After` | `findByCreateTimeAfter` | range query |
| `In` / `NotIn` | `findByCategoryIn` | terms query |
| `True` / `False` | `findByActiveTrue` | term query |
| `And` | `findByNameAndCategory` | bool must |
| `Or` | `findByNameOrCategory` | bool should |
| `OrderBy` | `findByCategoryOrderByPriceDesc` | sort |
| `Exists` | `findByNameExists` | exists query |
| `StartsWith` / `EndsWith` | `findByNameStartsWith` | prefix query |

**完整示例**：

```java
@Repository
public interface ArticleRepository extends ElasticsearchRepository<Article, String> {

    // 精确匹配 category
    List<Article> findByCategory(String category);

    // 全文检索 title（分词后匹配）
    List<Article> findByTitleContaining(String keyword);

    // 组合条件 + 排序
    List<Article> findByCategoryAndPublishTimeAfterOrderByViewCountDesc(
        String category, Date publishTime);

    // 范围查询
    List<Article> findByViewCountBetween(Integer min, Integer max);

    // 根据嵌套对象字段查询
    List<Article> findByCommentsAuthor(String author);

    // 分页
    Page<Article> findByCategory(String category, Pageable pageable);

    // 流式查询
    Stream<Article> findByCategory(String category);
}
```

**注意事项**：

- 嵌套对象字段查询直接使用 `.` 链式引用，如 `findByCommentsAuthor`。
- `Containing` 对 Text 字段执行 match 查询（分词），对 Keyword 字段执行 wildcard 查询。
- 方法名过长时可读性差，复杂查询改用 `@Query` 注解。
- `Stream<T>` 返回类型需配合 `@Transactional` 使用，确保连接在流消费期间保持打开。

### @Query 注解自定义查询

当方法命名查询无法表达复杂逻辑时，使用 `@Query` 直接编写 Elasticsearch JSON DSL。

**完整示例**：

```java
@Repository
public interface ProductRepository extends ElasticsearchRepository<Product, String> {

    // 简单 match 查询
    @Query("{\"match\": {\"name\": {\"query\": \"?0\", \"fuzziness\": \"AUTO\"}}}")
    List<Product> fuzzySearchByName(String keyword);

    // bool 复合查询（多条件）
    @Query("""
        {
            "bool": {
                "must": [
                    {"match": {"name": "?0"}},
                    {"term": {"category": "?1"}}
                ],
                "filter": [
                    {"range": {"price": {"gte": ?2, "lte": ?3}}}
                ]
            }
        }
        """)
    List<Product> searchByNameAndCategoryWithPriceRange(
        String keyword, String category, Double minPrice, Double maxPrice);

    // 带排序的查询
    @Query("""
        {
            "bool": {
                "must": [{"match": {"name": "?0"}}]
            }
        }
        """)
    List<Product> searchByNameSorted(String keyword, Sort sort);

    // 指定返回字段（_source filtering）
    @Query("""
        {
            "bool": {
                "must": [{"match_all": {}}]
            },
            "_source": ["id", "name", "price"]
        }
        """)
    List<Product> findAllWithSelectedFields();

    // 使用 Pageable 参数
    @Query("{\"match\": {\"name\": \"?0\"}}")
    Page<Product> searchByNameWithPagination(String keyword, Pageable pageable);

    // 删除操作
    @Query("{\"term\": {\"category\": \"?0\"}}")
    void deleteByCategory(String category);
}
```

**参数占位符说明**：

| 占位符 | 说明 |
|---|---|
| `?0`, `?1`, `?2` ... | 按方法参数顺序引用 |
| `?{pageable}` | 引用 Pageable 参数（自动注入 from/size） |
| `?{sort}` | 引用 Sort 参数 |

**注意事项**：

- `@Query` 中的 JSON 必须符合 Elasticsearch Query DSL 规范。
- 参数占位符 `?0` 等会自动做 JSON 转义，无需手动处理字符串安全。
- 删除操作需在方法上添加 `@org.springframework.transaction.annotation.Transactional` 或使用 `void` 返回值。
- `@Query` 的 `_source` 过滤仅减少网络传输，不影响查询性能。

### 分页与排序

**分页查询**：

```java
// Pageable 分页
Pageable pageable = PageRequest.of(0, 20); // 第 0 页，每页 20 条

Page<Product> page = repository.findByCategory("电子产品", pageable);

System.out.println("总页数: " + page.getTotalPages());
System.out.println("总记录数: " + page.getTotalElements());
System.out.println("当前页: " + page.getNumber());
System.out.println("当前页记录数: " + page.getNumberOfElements());

List<Product> content = page.getContent(); // 当前页数据
```

**排序查询**：

```java
// 单字段排序
Sort sort = Sort.by(Sort.Direction.DESC, "price");
List<Product> products = repository.findByCategory("电子产品", sort);

// 多字段排序
Sort multiSort = Sort.by(
    Sort.Order.desc("price"),
    Sort.Order.asc("name.keyword")
);

// 分页 + 排序组合
Pageable pageable = PageRequest.of(0, 20, Sort.by("price").descending());
Page<Product> page = repository.searchByNameWithPagination("手机", pageable);
```

**完整 Repository 示例**：

```java
@Repository
public interface ProductRepository extends ElasticsearchRepository<Product, String> {

    // 返回 Page
    Page<Product> findByCategory(String category, Pageable pageable);

    // 返回 List + Sort
    List<Product> findByPriceGreaterThan(Double minPrice, Sort sort);

    // 返回 Slice（不计算总数，性能更高）
    Slice<Product> findByCategoryOrderByPriceDesc(String category, Pageable pageable);
}
```

**注意事项**：

- ES 的分页深度受 `index.max_result_window` 限制（默认 10000），超过需使用 `Search After` 或 `Scroll`。
- `Page` 会执行 `count` 查询计算总数，开销较大；如果不需要总数，使用 `Slice` 替代。
- `Sort` 对 Text 字段排序时需使用 `.keyword` 子字段（如 `name.keyword`），否则会因 fielddata 问题报错。

### 批量保存

**方法一：`saveAll`（Repository 方式）**：

```java
List<Product> products = IntStream.rangeClosed(1, 1000)
    .mapToObj(i -> new Product(
        "PROD-" + i,
        "商品名称" + i,
        "category-" + (i % 10),
        RandomUtils.nextDouble(1.0, 9999.0)
    ))
    .collect(Collectors.toList());

// 批量保存
Iterable<Product> saved = repository.saveAll(products);
```

**方法二：`bulkIndex`（ElasticsearchOperations 方式，性能更优）**：

```java
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.query.BulkOptions;
import org.springframework.data.elasticsearch.core.query.IndexQuery;
import org.springframework.data.elasticsearch.core.query.IndexQueryBuilder;

@Service
public class ProductBulkService {

    @Autowired
    private ElasticsearchOperations operations;

    public void bulkIndexWithBulkOptions(List<Product> products) {
        List<IndexQuery> queries = products.stream()
            .map(product -> new IndexQueryBuilder()
                .withId(product.getId())
                .withObject(product)
                .build())
            .collect(Collectors.toList());

        // 自定义 BulkOptions：设置超时、刷新策略
        BulkOptions bulkOptions = BulkOptions.builder()
            .withTimeout(Duration.ofSeconds(60))
            .withRefreshPolicy(WriteRequest.RefreshPolicy.IMMEDIATE)
            .build();

        // 执行批量插入
        List<IndexedObjectInformation> result = operations.bulkIndex(
            queries, bulkOptions, Product.class);

        result.forEach(info -> System.out.println(
            "ID: " + info.id() + ", Version: " + info.version()));
    }
}
```

**BulkOptions 参数说明**：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `timeout` | 1m | 批量请求超时时间 |
| `refreshPolicy` | NONE | 刷新策略：NONE / IMMEDIATE / WAIT_UNTIL |
| `pipeline` | "" | Ingest pipeline 名称 |
| `routing` | "" | 路由值 |

**注意事项**：

- `saveAll` 底层也使用 Bulk API，但批大小由 `ElasticsearchConfiguration` 控制。
- 批量写入时建议每批 500–1000 条，过大容易触发 ES 的 `circuit_breaking_exception`。
- `refreshPolicy = IMMEDIATE` 会强制刷新，写入后可立即查询，但严重影响写入性能；生产环境使用 `NONE` 或 `WAIT_UNTIL`。
- 批量操作中的单条失败不会影响其他文档，需检查返回结果中的错误信息。

---

## ElasticsearchOperations

### ElasticsearchRestTemplate 基础操作

`ElasticsearchOperations` 是 Spring Data Elasticsearch 的核心操作接口，`ElasticsearchRestTemplate` 是其默认实现。相比 Repository 的声明式风格，它提供命令式编程接口，适合动态查询场景。

**配置类**：

```java
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.client.elc.ElasticsearchConfiguration;

@Configuration
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo("localhost:9200")
            .withBasicAuth("elastic", "changeme")
            .withConnectTimeout(Duration.ofSeconds(5))
            .withSocketTimeout(Duration.ofSeconds(60))
            .build();
    }
}
```

**注入使用**：

```java
@Service
public class ProductService {

    @Autowired
    private ElasticsearchOperations operations;

    // 等同于 Repository 的 save()
    public Product saveProduct(Product product) {
        return operations.save(product);
    }

    // 等同于 Repository 的 findById()
    public Product getById(String id) {
        return operations.get(id, Product.class);
    }

    // 等同于 Repository 的 deleteById()
    public String deleteById(String id) {
        return operations.delete(id, Product.class);
    }
}
```

**注意事项**：

- `ElasticsearchOperations` 是线程安全的，可直接注入到单例 Bean 中。
- 复杂项目建议 Service 层注入 `ElasticsearchOperations`，Repository 仅用于简单 CRUD。
- 启动时若 ES 不可达，`ElasticsearchConfiguration` 的 `clientConfiguration()` 中配置的 `connectTimeout` 决定等待时间。

### 索引操作（创建/删除/存在判断）

```java
@Service
public class IndexManagementService {

    @Autowired
    private ElasticsearchOperations operations;

    @Autowired
    private IndexOperations indexOperations;

    /**
     * 方式一：通过 ElasticsearchOperations 获取 IndexOperations
     */
    public IndexOperations getIndexOps(Class<?> entityClass) {
        return operations.indexOps(entityClass);
    }

    // ---- 创建索引 ----

    /**
     * 使用 @Document 和 @Setting 注解配置创建索引
     */
    public boolean createIndex(Class<?> entityClass) {
        IndexOperations ops = operations.indexOps(entityClass);

        if (ops.exists()) {
            log.warn("索引 [{}] 已存在，跳过创建", ops.getIndexCoordinates().getIndexName());
            return false;
        }

        return ops.create(); // 使用注解中的 settings 和 mappings
    }

    /**
     * 使用自定义 Settings 和 Mappings 创建索引
     */
    public boolean createIndexWithCustomSettings(Class<?> entityClass) {
        IndexOperations ops = operations.indexOps(entityClass);

        Map<String, Object> settings = Map.of(
            "index.number_of_shards", 3,
            "index.number_of_replicas", 2,
            "index.refresh_interval", "30s"
        );

        Document mapping = ops.createMapping(entityClass);

        return ops.create(settings, mapping);
    }

    // ---- 删除索引 ----

    public boolean deleteIndex(Class<?> entityClass) {
        IndexOperations ops = operations.indexOps(entityClass);
        return ops.delete();
    }

    // ---- 判断存在 ----

    public boolean indexExists(Class<?> entityClass) {
        return operations.indexOps(entityClass).exists();
    }

    // ---- 刷新索引 ----

    public void refreshIndex(Class<?> entityClass) {
        operations.indexOps(entityClass).refresh();
    }
}
```

**配置 IndexOperations Bean**：

```java
@Configuration
public class IndexOpsConfig {

    @Bean
    public IndexOperations indexOperations(ElasticsearchOperations operations) {
        // 为 Product 实体创建 IndexOperations
        return operations.indexOps(Product.class);
    }
}
```

**注意事项**：

- `create()` 是一个幂等操作吗？否——索引已存在时会抛出异常，必须先 `exists()` 判断。
- 索引名称支持 SpEL 表达式，`getIndexCoordinates().getIndexName()` 返回的是解析后的真实名称。
- 生产环境建议通过 CI/CD 管道管理索引生命周期，而非应用启动时自动创建。

### 文档 CRUD

```java
@Service
public class DocumentCrudService {

    @Autowired
    private ElasticsearchOperations operations;

    // ---- Create / Update ----

    /**
     * 保存（upsert 语义：存在则覆盖，不存在则插入）
     */
    public Product save(Product product) {
        return operations.save(product);
    }

    /**
     * 带 ID 的保存（指定 ID 而非用实体中的 @Id 字段）
     */
    public Product saveWithCustomId(String id, Product product) {
        return operations.save(product, IndexCoordinates.of("product"));
    }

    // ---- Read ----

    /**
     * 按 ID 查询
     */
    public Product getById(String id) {
        return operations.get(id, Product.class);
    }

    /**
     * 按 ID 查询（返回 Optional）
     */
    public Optional<Product> findById(String id) {
        Product product = operations.get(id, Product.class);
        return Optional.ofNullable(product);
    }

    /**
     * 批量按 ID 查询
     */
    public List<Product> multiGet(List<String> ids) {
        NativeQuery query = NativeQuery.builder()
            .withIds(ids)
            .build();
        return toList(operations.search(query, Product.class));
    }

    // ---- Update ----

    /**
     * 部分更新（仅更新指定字段，不覆盖整个文档）
     */
    public void partialUpdate(String id, Map<String, Object> updates) {
        Document document = Document.from(updates);
        UpdateQuery updateQuery = UpdateQuery.builder(id)
            .withDocument(document)
            .build();
        operations.update(updateQuery, IndexCoordinates.of("product"));
    }

    /**
     * 按条件批量更新
     */
    public long updateByQuery(String category, Double newPrice) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.term(q -> q.field("category").value(category)))
            .build();

        UpdateQuery updateQuery = UpdateQuery.builder(query)
            .withScript("ctx._source.price = params.newPrice")
            .withParams(Map.of("newPrice", newPrice))
            .build();

        UpdateResponse response = operations.updateByQuery(
            updateQuery, IndexCoordinates.of("product"));
        return response.getUpdated();
    }

    // ---- Delete ----

    /**
     * 按 ID 删除
     */
    public String deleteById(String id) {
        return operations.delete(id, Product.class);
    }

    /**
     * 按条件批量删除
     */
    public long deleteByQuery(String category) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.term(q -> q.field("category").value(category)))
            .build();
        return operations.delete(query, Product.class).getDeleted();
    }

    // ---- 辅助方法 ----

    private <T> List<T> toList(SearchHits<T> hits) {
        return hits.stream()
            .map(SearchHit::getContent)
            .collect(Collectors.toList());
    }
}
```

**更新操作对比**：

| 操作 | 语义 | 适用场景 |
|---|---|---|
| `save()` | 全量覆盖（upsert） | 文档结构完整、字段确定 |
| `update()` | 部分字段更新 | 仅更新个别字段，无需传输全量文档 |
| `updateByQuery()` | 条件批量更新 | 按条件更新一批文档（底层使用 `_update_by_query` API） |

**注意事项**：

- `save()` 是全量覆盖，未传入的字段会被设为 null。需要部分更新时使用 `update()`。
- `update()` 使用 `_update` API，必须传入 `IndexCoordinates`。
- `updateByQuery()` 返回的 `updated` 计数是在查询阶段匹配到的文档数，实际更新可能因脚本冲突而失败。
- 删除操作返回的是 String 类型的 ID，而非 `DeleteResponse` 对象。

### 批量操作

```java
@Service
public class BulkOperationService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 批量索引（插入）
     */
    public List<IndexedObjectInformation> bulkIndex(List<Product> products) {
        List<IndexQuery> queries = products.stream()
            .map(p -> new IndexQueryBuilder()
                .withId(p.getId())
                .withObject(p)
                .build())
            .collect(Collectors.toList());

        return operations.bulkIndex(queries, Product.class);
    }

    /**
     * 批量更新
     */
    public void bulkUpdate(List<Product> products) {
        List<UpdateQuery> queries = products.stream()
            .map(p -> {
                Document doc = operations.getElasticsearchConverter()
                    .mapObject(p);
                return UpdateQuery.builder(p.getId())
                    .withDocument(doc)
                    .build();
            })
            .collect(Collectors.toList());

        operations.bulkUpdate(queries, IndexCoordinates.of("product"));
    }

    /**
     * 混合批量操作（索引 + 更新 + 删除）
     */
    public void mixedBulk() {
        List<Object> queries = new ArrayList<>();

        // 索引操作
        queries.add(new IndexQueryBuilder()
            .withId("1")
            .withObject(new Product("1", "商品A", "电子", 99.0))
            .build());

        // 更新操作
        queries.add(UpdateQuery.builder("2")
            .withDocument(Document.parse("{\"price\": 199.0}"))
            .build());

        // 删除操作
        // 需自定义批量请求

        BulkOptions bulkOptions = BulkOptions.builder()
            .withTimeout(Duration.ofSeconds(30))
            .build();

        // 使用底层 RestClient 执行混合批量操作（见下方）
    }
}
```

**底层 Bulk API 调用（混合操作）**：

```java
@Autowired
private ElasticsearchOperations operations;

// 获取底层客户端
ElasticsearchClient client = ((ElasticsearchRestTemplate) operations)
    .getElasticsearchClient();

BulkRequest request = BulkRequest.of(b -> b
    .operations(op -> op
        .index(idx -> idx
            .index("product")
            .id("1")
            .document(new Product("1", "A", "cat", 9.9))
        )
    )
    .operations(op -> op
        .update(upd -> upd
            .index("product")
            .id("2")
            .action(act -> act.doc(Map.of("price", 199.0)))
        )
    )
    .operations(op -> op
        .delete(del -> del
            .index("product")
            .id("3")
        )
    )
);

BulkResponse response = client.bulk(request);
response.items().forEach(item -> System.out.println(
    "操作: " + item.operationType() + ", 状态: " + item.status()));
```

**注意事项**：

- `bulkIndex` 返回的 `List<IndexedObjectInformation>` 包含每个文档的 ID 和版本号，下标与入参顺序一致。
- 批量操作错误不会阻止其他操作继续执行，需逐条检查 `BulkResponse.items()` 中的错误。
- `bulkUpdate` 使用 `_update` API，部分更新不需要传输整个文档。
- 批量操作中混合索引、更新、删除时，直接使用 `ElasticsearchClient` 的 `bulk()` 方法更灵活。

---

## 查询构建

### NativeQuery

`NativeQuery` 是 Spring Data Elasticsearch 5.x 中最强大的查询形式，直接使用 `elasticsearch-java` 的 Query DSL Builder 构建原生查询。

```java
@Service
public class NativeQueryService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 基础 bool 查询
     */
    public SearchHits<Product> boolQuery(String keyword, String category, Double minPrice) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(q -> q
                .bool(b -> b
                    .must(m -> m.match(mt -> mt.field("name").query(keyword)))
                    .filter(f -> f.term(t -> t.field("category").value(category)))
                    .filter(f -> f.range(r -> r.field("price").gte(JsonData.of(minPrice))))
                )
            )
            .build();

        return operations.search(query, Product.class);
    }

    /**
     * 带分页 + 排序
     */
    public SearchHits<Product> searchWithPagination(String keyword, int page, int size) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(q -> q.match(m -> m.field("name").query(keyword)))
            .withPageable(PageRequest.of(page, size))
            .withSort(Sort.by(Sort.Direction.DESC, "price"))
            .build();

        return operations.search(query, Product.class);
    }

    /**
     * 指定返回字段（_source filtering）
     */
    public SearchHits<Product> searchWithSourceFilter(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(q -> q.match(m -> m.field("name").query(keyword)))
            .withSourceFilter(new FetchSourceFilter(
                new String[]{"id", "name", "price"},  // includes
                new String[]{}                         // excludes
            ))
            .build();

        return operations.search(query, Product.class);
    }

    /**
     * 指定路由（routing）
     */
    public SearchHits<Product> searchWithRouting(String keyword, String routing) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(q -> q.match(m -> m.field("name").query(keyword)))
            .withRoute(routing)  // 路由到指定分片
            .build();

        return operations.search(query, Product.class);
    }

    /**
     * 排除某些字段（excludes）
     */
    public SearchHits<Product> searchExcludingFields(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(q -> q.match(m -> m.field("name").query(keyword)))
            .withSourceFilter(new FetchSourceFilter(null, new String[]{"description"}))
            .build();

        return operations.search(query, Product.class);
    }
}
```

**NativeQuery 核心参数**：

| 参数 | 类型 | 说明 |
|---|---|---|
| `query` | `Query` | `elasticsearch-java` 的 Query 对象 |
| `filter` | `Query` | post_filter 过滤 |
| `pageable` | `Pageable` | 分页参数 |
| `sort` | `Sort` | 排序参数 |
| `sourceFilter` | `FetchSourceFilter` | 源字段过滤 |
| `highlightQuery` | `HighlightQuery` | 高亮配置 |
| `trackScores` | `boolean` | 是否追踪评分 |
| `minScore` | `double` | 最低评分阈值 |
| `route` | `String` | 路由值 |
| `searchAfter` | `List<Object>` | 深度分页游标 |
| `indicesOptions` | `IndicesOptions` | 索引选项 |
| `ids` | `Collection<String>` | 按 ID 列表查询 |

**注意事项**：

- `NativeQuery` 的 `withQuery()` 接受 `elasticsearch-java` 的 `Query` 对象，可使用 `QueryBuilders` 构建（见后续章节）。
- `withFilter()` 是 post_filter，在聚合之后、返回结果之前执行，不影响聚合结果。
- `withSourceFilter` 仅减少网络传输量，不影响 ES 查询性能。

### CriteriaQuery

`CriteriaQuery` 是 Spring Data 原生的查询抽象，通过 `Criteria` 链式构建查询条件，无需编写原生 DSL，但表达能力有限。

```java
@Service
public class CriteriaQueryService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 单条件查询
     */
    public SearchHits<Product> singleCriteria(String category) {
        Criteria criteria = new Criteria("category").is(category);
        CriteriaQuery query = new CriteriaQuery(criteria);
        return operations.search(query, Product.class);
    }

    /**
     * 多条件 AND 查询
     */
    public SearchHits<Product> multiCriteriaAnd(String category, Double minPrice) {
        Criteria criteria = new Criteria("category").is(category)
            .and(new Criteria("price").greaterThanEqual(minPrice));

        CriteriaQuery query = new CriteriaQuery(criteria);
        return operations.search(query, Product.class);
    }

    /**
     * OR 条件查询
     */
    public SearchHits<Product> multiCriteriaOr(String keyword1, String keyword2) {
        Criteria criteria = new Criteria("name").contains(keyword1)
            .or(new Criteria("name").contains(keyword2));

        CriteriaQuery query = new CriteriaQuery(criteria);
        return operations.search(query, Product.class);
    }

    /**
     * 带分页和排序
     */
    public SearchHits<Product> criteriaWithPagination(String category) {
        Criteria criteria = new Criteria("category").is(category);
        CriteriaQuery query = new CriteriaQuery(criteria)
            .setPageable(PageRequest.of(0, 20))
            .addSort(Sort.by(Sort.Direction.DESC, "price"));

        return operations.search(query, Product.class);
    }
}
```

**Criteria 操作符**：

| 方法 | ES 等价 | 说明 |
|---|---|---|
| `is(value)` | term | 精确匹配 |
| `in(values)` | terms | 多值匹配 |
| `notIn(values)` | must_not terms | 反向多值匹配 |
| `contains(value)` | match | 全文搜索 |
| `startsWith(value)` | prefix | 前缀匹配 |
| `endsWith(value)` | 无直接对应 | 转为 wildcard 查询 |
| `greaterThan(value)` | range gt | 大于 |
| `greaterThanEqual(value)` | range gte | 大于等于 |
| `lessThan(value)` | range lt | 小于 |
| `lessThanEqual(value)` | range lte | 小于等于 |
| `between(min, max)` | range | 区间 |
| `fuzzy(value)` | fuzzy | 模糊匹配 |
| `expression(value)` | query_string | 表达式查询 |

**注意事项**：

- `CriteriaQuery` 不支持聚合查询，需要聚合时使用 `NativeQuery`。
- `endsWith()` 底层转为 wildcard 查询，性能较差，避免全表扫描。
- 嵌套对象查询需要使用 `new Criteria("comments.author").is("张三")` 的方式，但复杂嵌套查询建议直接使用 `NativeQuery`。
- `CriteriaQuery` 在 Spring Data Elasticsearch 5.x 中仍可用，但表达能力有限，核心查询推荐 `NativeQuery`。

### StringQuery

`StringQuery` 直接使用 JSON 字符串作为查询 DSL，适合简单场景或从配置中动态加载查询。

```java
@Service
public class StringQueryService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 基础 JSON 字符串查询
     */
    public SearchHits<Product> simpleStringQuery(String keyword) {
        String json = """
            {
                "match": {
                    "name": {
                        "query": "%s"
                    }
                }
            }
            """.formatted(keyword);

        StringQuery query = new StringQuery(json);
        return operations.search(query, Product.class);
    }

    /**
     * 带分页的 StringQuery
     */
    public SearchHits<Product> stringQueryWithPagination(String keyword) {
        StringQuery query = new StringQuery(
            "{\"match\": {\"name\": {\"query\": \"" + keyword + "\"}}}"
        );
        query.setPageable(PageRequest.of(0, 10));
        query.addSort(Sort.by("price").descending());

        return operations.search(query, Product.class);
    }

    /**
     * 从配置文件加载查询
     */
    @Value("${es.queries.product-search}")
    private String productSearchQueryTemplate;

    public SearchHits<Product> templatedQuery(String keyword) {
        String json = productSearchQueryTemplate.replace("{{keyword}}", keyword);
        StringQuery query = new StringQuery(json);
        return operations.search(query, Product.class);
    }
}
```

**application.yml 中的查询模板**：

```yaml
es:
  queries:
    product-search: >
      {
        "bool": {
          "must": [
            {"multi_match": {"query": "{{keyword}}", "fields": ["name^3", "description"]}}
          ],
          "filter": [
            {"term": {"status": "ONLINE"}}
          ]
        }
      }
```

**注意事项**：

- `StringQuery` 不提供类型安全的构建方式，参数拼接需自行处理 JSON 转义。
- 适合从外部配置中心（如 Nacos、Apollo）动态加载查询 DSL。
- 避免直接拼接用户输入到 JSON 字符串中（ES 注入风险），使用 `StringEscapeUtils.escapeJson()` 或直接使用 `NativeQuery`。
- `StringQuery` 不支持 `SourceFilter`，如需过滤字段请使用 `NativeQuery`。

### 查询构建器（QueryBuilders）

`QueryBuilders` 是 Spring Data Elasticsearch 5.x 中提供的工厂类，封装了 `elasticsearch-java` 的 Query DSL 构建方法，提供类型安全的查询构建。

```java
import org.springframework.data.elasticsearch.client.elc.QueryBuilders;

@Service
public class QueryBuildersService {

    @Autowired
    private ElasticsearchOperations operations;

    // ---- Term 级别查询 ----

    /** term 精确匹配（Keyword 字段） */
    public SearchHits<Product> termQuery(String category) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.term(q -> q.field("category").value(category)))
            .build();
        return operations.search(query, Product.class);
    }

    /** terms 多值匹配 */
    public SearchHits<Product> termsQuery(List<String> categories) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.terms(q -> q
                .field("category")
                .terms(t -> t.value(categories.stream()
                    .map(FieldValue::of)
                    .collect(Collectors.toList())))))
            .build();
        return operations.search(query, Product.class);
    }

    /** range 范围查询 */
    public SearchHits<Product> rangeQuery(Double min, Double max) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.range(q -> q
                .field("price")
                .gte(JsonData.of(min))
                .lte(JsonData.of(max))))
            .build();
        return operations.search(query, Product.class);
    }

    /** exists 字段存在性查询 */
    public SearchHits<Product> existsQuery() {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.exists(q -> q.field("description")))
            .build();
        return operations.search(query, Product.class);
    }

    /** prefix 前缀查询 */
    public SearchHits<Product> prefixQuery(String prefix) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.prefix(q -> q.field("name").value(prefix)))
            .build();
        return operations.search(query, Product.class);
    }

    /** wildcard 通配符查询 */
    public SearchHits<Product> wildcardQuery(String pattern) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.wildcard(q -> q
                .field("name.keyword")
                .value(pattern)))  // 例如 "手机*Pro"
            .build();
        return operations.search(query, Product.class);
    }

    // ---- 全文查询 ----

    /** match 分词匹配 */
    public SearchHits<Product> matchQuery(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.match(q -> q
                .field("name")
                .query(keyword)
                .fuzziness("AUTO")
                .operator(Operator.And)))
            .build();
        return operations.search(query, Product.class);
    }

    /** multi_match 多字段匹配 */
    public SearchHits<Product> multiMatchQuery(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.multiMatch(q -> q
                .fields("name^3", "description^1", "category")
                .query(keyword)
                .type(TextQueryType.BestFields)))
            .build();
        return operations.search(query, Product.class);
    }

    /** match_phrase 短语匹配 */
    public SearchHits<Product> matchPhraseQuery(String phrase) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchPhrase(q -> q
                .field("name")
                .query(phrase)
                .slop(2)))  // 允许间隔 2 个词
            .build();
        return operations.search(query, Product.class);
    }

    // ---- 复合查询 ----

    /** bool 复合查询 */
    public SearchHits<Product> boolQuery(String keyword, String category, Double minPrice) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.bool(b -> b
                // must：必须匹配（影响评分）
                .must(QueryBuilders.match(m -> m.field("name").query(keyword)))
                // filter：必须匹配（不影响评分，可缓存）
                .filter(QueryBuilders.term(t -> t.field("category").value(category)))
                .filter(QueryBuilders.range(r -> r.field("price").gte(JsonData.of(minPrice))))
                // should：或条件（minimum_should_match 控制至少匹配数量）
                .should(QueryBuilders.term(t -> t.field("brand").value("华为")))
                .minimumShouldMatch("0")
                // must_not：反向过滤
                .mustNot(QueryBuilders.term(t -> t.field("status").value("deleted")))
            ))
            .build();
        return operations.search(query, Product.class);
    }

    // ---- 特殊查询 ----

    /** match_all 全量查询 */
    public SearchHits<Product> matchAllQuery() {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchAll(q -> q))
            .build();
        return operations.search(query, Product.class);
    }

    /** ids 批量 ID 查询 */
    public SearchHits<Product> idsQuery(List<String> ids) {
        NativeQuery query = NativeQuery.builder()
            .withIds(ids)
            .build();
        return operations.search(query, Product.class);
    }

    /** function_score 函数评分 */
    public SearchHits<Product> functionScoreQuery(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.functionScore(fs -> fs
                .query(QueryBuilders.match(m -> m.field("name").query(keyword)))
                .functions(fn -> fn
                    .fieldValueFactor(fvf -> fvf
                        .field("viewCount")
                        .factor(1.2)
                        .modifier(FieldValueFactorModifier.Log1p)
                        .missing(1.0)
                    )
                )
                .boostMode(FunctionBoostMode.Multiply)
                .scoreMode(FunctionScoreMode.Sum)
            ))
            .build();
        return operations.search(query, Product.class);
    }
}
```

**查询类型速查表**：

| 场景 | 查询类型 | 适用字段 |
|---|---|---|
| 精确匹配 | `term` | Keyword, Integer, Boolean |
| 多值匹配 | `terms` | Keyword |
| 范围过滤 | `range` | Integer, Double, Date |
| 全文搜索 | `match` | Text |
| 多字段搜索 | `multi_match` | 多个 Text 字段 |
| 短语搜索 | `match_phrase` | Text |
| 前缀匹配 | `prefix` | Keyword |
| 通配符 | `wildcard` | Keyword |
| 存在性检查 | `exists` | 任意 |
| 复合条件 | `bool` | 任意（组合使用） |
| 自定义评分 | `function_score` | 任意 |

**注意事项**：

- `filter` 上下文不计算评分且结果可缓存，性能优于 `must`。对不涉及相关性排序的条件优先使用 `filter`。
- `QueryBuilders` 是 Spring Data Elasticsearch 5.x 新增的工厂类，与 `elasticsearch-java` 的 `QueryBuilders` 不同，位于 `org.springframework.data.elasticsearch.client.elc` 包下。
- `multi_match` 的 `fields` 中可使用 `^` 提升字段权重，如 `"name^3"` 表示 name 字段权重为 3 倍。
- `function_score` 的 `scoreMode` 控制多个函数评分的组合方式（multiply / sum / avg / max / min）。

### 聚合查询

```java
@Service
public class AggregationService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 按类别分组统计（Terms Aggregation）
     */
    public Map<String, Long> aggregateByCategory() {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchAll(q -> q))
            .withAggregation("by_category", Aggregation.of(a -> a
                .terms(t -> t.field("category").size(100))
            ))
            .withMaxResults(0)  // 不返回文档，仅返回聚合结果
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);

        Aggregate agg = hits.getAggregations().get("by_category");
        if (agg == null) return Map.of();

        // 解析 StringTerms 聚合
        return agg.sterms().buckets().array().stream()
            .collect(Collectors.toMap(
                b -> b.key().stringValue(),
                b -> b.docCount()
            ));
    }

    /**
     * 嵌套聚合：先按类别分组，再计算每组的平均价格
     */
    public Map<String, Double> aggregateByCategoryWithAvgPrice() {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchAll(q -> q))
            .withAggregation("by_category", Aggregation.of(a -> a
                .terms(t -> t.field("category").size(50))
                .aggregations(Map.of("avg_price", Aggregation.of(sa -> sa
                    .avg(av -> av.field("price"))
                )))
            ))
            .withMaxResults(0)
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);
        Aggregate agg = hits.getAggregations().get("by_category");
        if (agg == null) return Map.of();

        return agg.sterms().buckets().array().stream()
            .collect(Collectors.toMap(
                b -> b.key().stringValue(),
                b -> b.aggregations().get("avg_price").avg().value()
            ));
    }

    /**
     * 价格直方图（Histogram Aggregation）
     */
    public Map<String, Long> priceHistogram(double interval) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchAll(q -> q))
            .withAggregation("price_histogram", Aggregation.of(a -> a
                .histogram(h -> h.field("price").interval(interval).minDocCount(1))
            ))
            .withMaxResults(0)
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);
        Aggregate agg = hits.getAggregations().get("price_histogram");
        if (agg == null) return Map.of();

        return agg.longTerms().buckets().array().stream()
            .collect(Collectors.toMap(
                b -> b.key().stringValue(),
                b -> b.docCount()
            ));
    }

    /**
     * 日期直方图（Date Histogram Aggregation）
     */
    public Map<String, Long> dateHistogram() {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchAll(q -> q))
            .withAggregation("sales_by_day", Aggregation.of(a -> a
                .dateHistogram(dh -> dh
                    .field("createTime")
                    .calendarInterval(CalendarInterval.Day)
                    .format("yyyy-MM-dd")
                    .minDocCount(1)
                )
            ))
            .withMaxResults(0)
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);
        Aggregate agg = hits.getAggregations().get("sales_by_day");
        if (agg == null) return Map.of();

        return agg.dateHistogram().buckets().array().stream()
            .collect(Collectors.toMap(
                b -> b.keyAsString(),
                b -> b.docCount()
            ));
    }

    /**
     * 统计聚合（min / max / avg / sum / count）
     */
    public StatsResult priceStats() {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.matchAll(q -> q))
            .withAggregation("price_stats", Aggregation.of(a -> a
                .stats(s -> s.field("price"))
            ))
            .withMaxResults(0)
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);
        Aggregate agg = hits.getAggregations().get("price_stats");
        if (agg == null) return null;

        StatsAggregate stats = agg.stats();
        return new StatsResult(stats.count(), stats.min(), stats.max(), stats.avg(), stats.sum());
    }

    // 统计结果封装
    public record StatsResult(long count, double min, double max, double avg, double sum) {}
}
```

**聚合类型速查**：

| 聚合类型 | 说明 | 典型场景 |
|---|---|---|
| `terms` | 按字段值分组 | 分类统计、Top N |
| `histogram` | 数值区间分组 | 价格区间分布 |
| `date_histogram` | 时间区间分组 | 日/周/月趋势 |
| `avg` / `sum` / `min` / `max` | 数值统计 | 平均价格、总销量 |
| `stats` | 综合统计（count+min+max+avg+sum） | 数据概览 |
| `cardinality` | 基数统计（去重计数） | UV 统计 |
| `percentiles` | 百分位数 | 性能分析 P99 |
| `top_hits` | 每组内取 Top N 文档 | 每类最佳商品 |
| `nested` | 嵌套对象聚合 | 嵌套文档统计 |
| `filter` | 过滤聚合（在聚合内部过滤） | 条件分组统计 |

**注意事项**：

- `withMaxResults(0)` 设置返回文档数为 0，仅返回聚合结果，减少网络传输。
- `terms` 聚合的 `size` 参数控制返回桶的数量，默认 10，受 `search.max_buckets` 限制（默认 65536）。
- 解析聚合结果时，需根据聚合类型调用对应方法：`sterms()`、`lterms()`、`stats()`、`avg()` 等。
- ES 聚合结果在内存中计算，大基数聚合可能导致 OOM，使用 `execution_hint` 优化。

### 高亮查询

```java
@Service
public class HighlightService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 单字段高亮
     */
    public List<HighlightResult> searchWithHighlight(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.match(m -> m.field("name").query(keyword)))
            .withHighlightQuery(
                new HighlightQuery(
                    new HighlightBuilder()
                        .field("name")
                        .preTags("<em style='color:red'>")
                        .postTags("</em>")
                        .fragmentSize(100)
                        .numberOfFragments(1),
                    Product.class
                )
            )
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);

        return hits.stream().map(hit -> {
            Product product = hit.getContent();
            String highlightedName = hit.getHighlightField("name")
                .stream()
                .collect(Collectors.joining("..."));
            return new HighlightResult(product, highlightedName);
        }).collect(Collectors.toList());
    }

    /**
     * 多字段高亮
     */
    public List<HighlightResult> searchWithMultiFieldHighlight(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.multiMatch(m -> m
                .fields("name", "description")
                .query(keyword)))
            .withHighlightQuery(
                new HighlightQuery(
                    new HighlightBuilder()
                        .field("name")
                        .preTags("<mark>")
                        .postTags("</mark>")
                        .field("description")
                        .preTags("<mark>")
                        .postTags("</mark>")
                        .fragmentSize(150)
                        .numberOfFragments(2),
                    Product.class
                )
            )
            .build();

        SearchHits<Product> hits = operations.search(query, Product.class);

        return hits.stream().map(hit -> {
            Product product = hit.getContent();
            Map<String, List<String>> highlightFields = hit.getHighlightFields();
            String nameHighlight = highlightFields.getOrDefault("name", List.of())
                .stream().collect(Collectors.joining("..."));
            String descHighlight = highlightFields.getOrDefault("description", List.of())
                .stream().collect(Collectors.joining("..."));
            return new HighlightResult(product, nameHighlight, descHighlight);
        }).collect(Collectors.toList());
    }

    /**
     * 使用 elasticsearch-java 原生高亮配置
     */
    public SearchHits<Product> nativeHighlight(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.match(m -> m.field("name").query(keyword)))
            .withHighlightQuery(
                HighlightQuery.of(h -> h
                    .fields("name", HighlightField.of(hf -> hf
                        .fragmentSize(100)
                        .numberOfFragments(1)
                        .preTags("<b>")
                        .postTags("</b>")
                    ))
                    .fields("description", HighlightField.of(hf -> hf
                        .fragmentSize(150)
                        .numberOfFragments(2)
                    ))
                ),
                Product.class
            )
            .build();

        return operations.search(query, Product.class);
    }

    // 高亮结果封装
    public record HighlightResult(
        Product product,
        String highlightedName,
        String highlightedDescription
    ) {
        public HighlightResult(Product product, String highlightedName) {
            this(product, highlightedName, "");
        }
    }
}
```

**高亮参数说明**：

| 参数 | 默认值 | 说明 |
|---|---|---|
| `preTags` | `<em>` | 高亮前置标签 |
| `postTags` | `</em>` | 高亮后置标签 |
| `fragmentSize` | 100 | 高亮片段长度（字符数） |
| `numberOfFragments` | 5 | 返回片段数量 |
| `fragmenter` | span | 片段分割器（span / simple） |
| `noMatchSize` | 0 | 无匹配时返回的前缀长度 |
| `requireFieldMatch` | true | 是否要求高亮字段与查询字段一致 |

**注意事项**：

- 高亮片段可能不完整，前端展示时需处理省略号（...）。
- `numberOfFragments = 0` 返回整个字段的高亮内容，适合短文本。
- 高亮结果通过 `SearchHit.getHighlightFields()` 获取，不是直接在实体对象上。
- `requireFieldMatch = false` 时，即使查询字段与高亮字段不一致也会返回高亮（如 `multi_match` 查询中高亮其中一个字段）。

---

## 高级特性

### 安全认证配置（Basic Auth / API Key / TLS）

**方式一：Basic Auth（用户名 + 密码）**：

```java
@Configuration
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo("localhost:9200")
            .usingSsl()                          // 启用 TLS（默认）
            .withBasicAuth("elastic", "changeme") // Basic Auth
            .build();
    }
}
```

**方式二：API Key（推荐：生产环境）**：

```java
@Configuration
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo("localhost:9200")
            .usingSsl()
            .withApiKey("id", "api_key")  // Base64 编码的 API Key
            .build();
    }
}
```

**方式三：SSL 证书配置**：

```java
@Configuration
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Override
    public ClientConfiguration clientConfiguration() {
        // 获取证书路径
        URL certUrl = ResourceUtils.getURL("classpath:ca.crt");

        SSLContext sslContext = null;
        try {
            sslContext = SSLContextBuilder.create()
                .loadTrustMaterial(certUrl, "password".toCharArray())
                .build();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }

        return ClientConfiguration.builder()
            .connectedTo("localhost:9200")
            .usingSsl(sslContext)  // 使用自定义 SSLContext
            .withBasicAuth("elastic", "changeme")
            .build();
    }
}
```

**方式四：配置文件方式（外部化配置）**：

```yaml
spring:
  elasticsearch:
    uris: https://es-cluster.example.com:9200
    username: elastic
    password: ${ES_PASSWORD:changeme}  # 环境变量优先
    connection-timeout: 5s
    socket-timeout: 60s
```

**ElasticsearchConfig 完整示例（生产级）**：

```java
@Configuration
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Value("${spring.elasticsearch.uris}")
    private String uris;

    @Value("${spring.elasticsearch.username}")
    private String username;

    @Value("${spring.elasticsearch.password}")
    private String password;

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo(uris.replace("https://", "").replace("http://", ""))
            .usingSsl(uris.startsWith("https"))
            .withBasicAuth(username, password)
            .withConnectTimeout(Duration.ofSeconds(5))
            .withSocketTimeout(Duration.ofSeconds(60))
            .withClientConfigurer(
                ElasticsearchClientConfigurer.from(clientConfigurer -> {
                    // 自定义底层 RestClient 配置
                    clientConfigurer.setHttpClientConfigCallback(httpClientBuilder -> {
                        // 跳过 SSL 验证（仅限开发环境！）
                        // httpClientBuilder.setSSLContext(...);
                        return httpClientBuilder;
                    });
                })
            )
            .build();
    }
}
```

**认证方式对比**：

| 认证方式 | 安全级别 | 适用场景 | 注意事项 |
|---|---|---|---|
| 无认证 | 低 | 本地开发（仅限 localhost） | 生产环境禁止 |
| Basic Auth | 中 | 中小型项目 | 密码明文传输，需配合 HTTPS |
| API Key | 高 | 生产环境 | 支持权限细分，可独立吊销 |
| SSL/TLS | 高 | 所有生产环境 | 需维护证书，自签名证书注意 CA 信任 |

**注意事项**：

- Elasticsearch 8.x 默认启用安全功能，首次启动会生成 `elastic` 用户的密码和 CA 证书。
- API Key 通过 `POST /_security/api_key` 创建，返回的 `encoded` 字段即为 `clientConfiguration().withApiKey()` 的参数。
- 跳过 SSL 验证（`allowInsecure()`）仅限开发环境，生产环境必须使用有效证书。
- 密码和 API Key 必须通过环境变量或密钥管理服务（如 Vault）注入，禁止硬编码。

### 连接池配置

Spring Data Elasticsearch 5.x 底层使用 `RestClient`（基于 Apache HttpAsyncClient），连接池配置通过 `ClientConfiguration` 的 `withClientConfigurer` 进行。

```java
@Configuration
public class ElasticsearchConfig extends ElasticsearchConfiguration {

    @Override
    public ClientConfiguration clientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo("localhost:9200")
            .withBasicAuth("elastic", "changeme")
            .withConnectTimeout(Duration.ofSeconds(5))
            .withSocketTimeout(Duration.ofSeconds(60))
            .withClientConfigurer(
                ElasticsearchClientConfigurer.from(clientConfigurer -> {
                    clientConfigurer.setHttpClientConfigCallback(httpClientBuilder -> {
                        // 连接池配置
                        httpClientBuilder
                            .setMaxConnTotal(100)       // 最大连接数
                            .setMaxConnPerRoute(50)    // 每路由最大连接数
                            .setKeepAliveStrategy((response, context) ->
                                Duration.ofMinutes(5).toMillis()) // Keep-Alive 5 分钟
                            .evictIdleConnections(
                                Duration.ofSeconds(30).toMillis()); // 驱逐空闲连接

                        // 重试策略
                        httpClientBuilder.setRetryHandler(
                            new DefaultHttpRequestRetryHandler(3, true));

                        return httpClientBuilder;
                    });
                })
            )
            .build();
    }
}
```

**连接池参数**：

| 参数 | 推荐值 | 说明 |
|---|---|---|
| `maxConnTotal` | 100–200 | 总连接数上限，根据 ES 节点数和并发量调整 |
| `maxConnPerRoute` | 50–100 | 每路由（每个 ES 节点）的最大连接数 |
| `keepAlive` | 5 min | 空闲连接保持时间 |
| `evictIdleConnections` | 30 s | 驱逐空闲连接的检查间隔 |
| `connectTimeout` | 1–5 s | 建立连接超时（网络波动可适当增大） |
| `socketTimeout` | 30–60 s | 等待响应超时（大数据量查询需增大） |
| `retryCount` | 3 | 请求失败重试次数 |

**注意事项**：

- `maxConnPerRoute` 不应超过 ES 各节点的 `http.max_content_length` 和线程池大小。
- 连接池耗尽会导致 `ConnectionPoolTimeoutException`，需监控 `available` 和 `pending` 连接数。
- `socketTimeout` 并非查询超时，而是等待数据的超时，长时间 Scroll 查询需设置更大值。
- 生产环境建议使用 Micrometer + Prometheus 监控 HTTP 连接池指标。

### 多集群数据源

当应用需要同时连接多个 Elasticsearch 集群时，需定义多个 `ElasticsearchOperations` Bean。

```java
@Configuration
public class MultiClusterConfig {

    // ---- 集群一：主数据集群 ----

    @Bean("primaryClientConfiguration")
    @Primary
    public ClientConfiguration primaryClientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo("primary-es:9200")
            .withBasicAuth("elastic", "pass1")
            .build();
    }

    @Bean("primaryElasticsearchOperations")
    @Primary
    public ElasticsearchOperations primaryElasticsearchOperations() {
        return new ElasticsearchRestTemplate(
            new ElasticsearchClientProvider().get(primaryClientConfiguration())
        );
    }

    // ---- 集群二：日志集群 ----

    @Bean("logClientConfiguration")
    public ClientConfiguration logClientConfiguration() {
        return ClientConfiguration.builder()
            .connectedTo("log-es:9200")
            .withBasicAuth("elastic", "pass2")
            .build();
    }

    @Bean("logElasticsearchOperations")
    public ElasticsearchOperations logElasticsearchOperations() {
        return new ElasticsearchRestTemplate(
            new ElasticsearchClientProvider().get(logClientConfiguration())
        );
    }
}
```

**使用多数据源**：

```java
@Service
public class MultiClusterService {

    @Autowired
    @Qualifier("primaryElasticsearchOperations")
    private ElasticsearchOperations primaryOps;

    @Autowired
    @Qualifier("logElasticsearchOperations")
    private ElasticsearchOperations logOps;

    public Product saveToPrimary(Product product) {
        return primaryOps.save(product);
    }

    public Product saveToLog(Product product) {
        return logOps.save(product);
    }
}
```

**注意事项**：

- 多数据源场景下，`ElasticsearchRepository` 默认使用 `@Primary` 标记的 `ElasticsearchOperations`。如需绑定特定数据源，需自定义 `RepositoryFactoryBean`。
- 多集群之间的数据一致性需要应用层保证（如分布式事务框架 Seata + TCC 模式）。
- `ElasticsearchClientProvider` 是 Spring Data Elasticsearch 5.x 内部使用的工厂类，每次调用 `get()` 创建新的 `ElasticsearchClient` 实例。

### 异常处理

Spring Data Elasticsearch 的异常体系及处理策略。

**异常层次结构**：

```
DataAccessException (Spring)
  └── UncategorizedElasticsearchException
        ├── ElasticsearchException
        │     ├── DocumentMissingException
        │     ├── IndexNotFoundException
        │     ├── VersionConflictException
        │     └── ...
        └── ElasticsearchStatusException
```

**全局异常处理**：

```java
@RestControllerAdvice
public class ElasticsearchExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ElasticsearchExceptionHandler.class);

    /**
     * 索引不存在异常
     */
    @ExceptionHandler(IndexNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleIndexNotFound(IndexNotFoundException e) {
        log.error("索引不存在: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("INDEX_NOT_FOUND", "请求的索引不存在: " + e.getIndexName()));
    }

    /**
     * 文档不存在异常
     */
    @ExceptionHandler(DocumentMissingException.class)
    public ResponseEntity<ErrorResponse> handleDocumentMissing(DocumentMissingException e) {
        log.warn("文档不存在: {}", e.getId());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(new ErrorResponse("DOCUMENT_NOT_FOUND", "文档不存在: " + e.getId()));
    }

    /**
     * 版本冲突（乐观锁）
     */
    @ExceptionHandler(VersionConflictException.class)
    public ResponseEntity<ErrorResponse> handleVersionConflict(VersionConflictException e) {
        log.warn("版本冲突，请重试: {}", e.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(new ErrorResponse("VERSION_CONFLICT", "数据已被修改，请刷新后重试"));
    }

    /**
     * ES 状态异常（如查询语法错误）
     */
    @ExceptionHandler(ElasticsearchStatusException.class)
    public ResponseEntity<ErrorResponse> handleElasticsearchStatus(ElasticsearchStatusException e) {
        log.error("ES 查询异常: status={}, message={}", e.getStatus(), e.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
            .body(new ErrorResponse("ES_QUERY_ERROR", e.getMessage()));
    }

    /**
     * 兜底异常
     */
    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ErrorResponse> handleDataAccess(DataAccessException e) {
        log.error("ES 数据访问异常: {}", e.getMessage(), e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ErrorResponse("ES_ERROR", "内部搜索服务异常，请稍后重试"));
    }

    // 错误响应体
    public record ErrorResponse(String code, String message) {}
}
```

**Service 层异常重试**：

```java
@Service
public class ResilientProductService {

    @Autowired
    private ElasticsearchOperations operations;

    @Retryable(
        retryFor = {ElasticsearchStatusException.class},
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000, multiplier = 2)
    )
    public SearchHits<Product> searchWithRetry(String keyword) {
        NativeQuery query = NativeQuery.builder()
            .withQuery(QueryBuilders.match(m -> m.field("name").query(keyword)))
            .build();
        return operations.search(query, Product.class);
    }

    @Recover
    public SearchHits<Product> searchFallback(ElasticsearchStatusException e, String keyword) {
        log.error("ES 查询失败，已重试 3 次: {}", e.getMessage());
        return SearchHits.empty();
    }
}
```

**注意事项**：

- `ElasticsearchStatusException` 包含 ES 返回的 HTTP 状态码和错误原因，日志中应记录完整信息。
- 批量操作中部分文档失败不会抛出异常，需逐条检查 `BulkResponse.items()` 中的 `error` 字段。
- 生产环境建议配合 Sentinel / Resilience4j 实现熔断降级，避免 ES 故障拖垮应用。
- 不要对 `DocumentMissingException` 做重试（文档不存在重试无意义），直接返回业务错误。

### 与 elasticsearch-java 客户端的关系

Spring Data Elasticsearch 5.x 的底层传输层完全基于 `elasticsearch-java`（即新版 Elasticsearch Java API Client），`RestHighLevelClient` 已被移除。

**架构层次**：

```
应用层
  ├── ElasticsearchRepository (声明式 Repository)
  ├── ElasticsearchOperations (模板操作)
  │     └── NativeQuery (查询构建)
  │           └── QueryBuilders (Spring Data 封装)
  └── ElasticsearchClient (elasticsearch-java 原生客户端)
        └── RestClient (Apache HttpAsyncClient)
              └── Elasticsearch Server
```

**获取底层客户端**：

```java
@Service
public class NativeClientService {

    @Autowired
    private ElasticsearchOperations operations;

    /**
     * 获取 elasticsearch-java 的 ElasticsearchClient
     * 用于执行 Spring Data 不直接支持的操作
     */
    public ElasticsearchClient getNativeClient() {
        return ((ElasticsearchRestTemplate) operations).getElasticsearchClient();
    }

    /**
     * 使用原生客户端执行集群健康检查
     */
    public HealthCheckResult clusterHealth() {
        ElasticsearchClient client = getNativeClient();
        try {
            HealthResponse health = client.cat().health();
            return new HealthCheckResult(
                health.status().name(),
                health.numberOfNodes(),
                health.activeShardsPercent()
            );
        } catch (IOException e) {
            throw new RuntimeException("集群健康检查失败", e);
        }
    }

    /**
     * 使用原生客户端创建索引模板
     */
    public boolean createIndexTemplate(String templateName, String indexPattern) {
        ElasticsearchClient client = getNativeClient();
        try {
            PutIndexTemplateResponse response = client.indices().putIndexTemplate(
                req -> req
                    .name(templateName)
                    .indexPatterns(List.of(indexPattern))
                    .template(t -> t
                        .settings(s -> s
                            .numberOfShards("3")
                            .numberOfReplicas("2")
                        )
                        .mappings(m -> m
                            .properties("name", p -> p.text(tx -> tx.analyzer("ik_max_word")))
                            .properties("createTime", p -> p.date(d -> d))
                        )
                    )
            );
            return response.acknowledged();
        } catch (IOException e) {
            throw new RuntimeException("创建索引模板失败", e);
        }
    }

    /**
     * 使用原生客户端执行 reindex
     */
    public ReindexResponse reindex(String sourceIndex, String destIndex) {
        ElasticsearchClient client = getNativeClient();
        try {
            return client.reindex(r -> r
                .source(s -> s.index(sourceIndex))
                .dest(d -> d.index(destIndex))
            );
        } catch (IOException e) {
            throw new RuntimeException("Reindex 失败", e);
        }
    }

    public record HealthCheckResult(String status, int nodes, double activeShardsPercent) {}
}
```

**何时使用原生客户端**：

| 场景 | 使用方式 |
|---|---|
| 文档 CRUD | `ElasticsearchRepository` 或 `ElasticsearchOperations` |
| 基础查询 | `NativeQuery` + `QueryBuilders` |
| 聚合查询 | `NativeQuery` + `withAggregation` |
| 索引管理 | `IndexOperations` |
| 集群管理（健康、节点） | `ElasticsearchClient`（原生） |
| 索引模板/生命周期 | `ElasticsearchClient`（原生） |
| Snapshot/Restore | `ElasticsearchClient`（原生） |
| Reindex | `ElasticsearchClient`（原生） |
| Ingest Pipeline | `ElasticsearchClient`（原生） |

**注意事项**：

- `ElasticsearchClient` 是线程安全的，可直接缓存复用，无需每次创建新实例。
- 原生客户端返回的 `*Response` 对象是 `elasticsearch-java` 的类型，不是 Spring Data 的封装。
- 从 `ElasticsearchOperations` 获取 `ElasticsearchClient` 需要强制转换，这是 Spring Data Elasticsearch 5.x 的设计意图——保留原生访问入口。
- 不要混用 `RestHighLevelClient`（已废弃），迁移时所有代码统一到 `elasticsearch-java`。

## 
