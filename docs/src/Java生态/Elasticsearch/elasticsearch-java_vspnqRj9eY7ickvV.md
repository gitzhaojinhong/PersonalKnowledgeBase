## elasticsearch-java

## 添加依赖

```xml
<dependency>
    <groupId>co.elastic.clients</groupId>
    <artifactId>elasticsearch-java</artifactId>
    <version>8.19.23</version>
</dependency>
<!-- Spring Boot 默认就带了 jackson-databind ,建议手动声明，便于管理，elasticsearch-java8.x jakarta版本必须为2.x-->
<!-- Elasticsearch Java API Client 
      在设计上将 JSON 序列化/反序列化的工作，
      委托给了一个外部的 JSON 映射库，
      它自己并不内置完整的 JSON 处理能力。-->
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>2.17.0</version>
</dependency>
```

## 配置连接参数

```yaml
app:
  manage:
    elasticsearch:
      enabled: true
      # 多个地址用英文逗号分隔（@Value 不支持 YAML 列表绑定）
      uris: http://127.0.0.1:9200
      username: elastic
      password: ${ELASTICSEARCH_PASSWORD:elastic}
      connect-timeout-millis: 3000
      socket-timeout-millis: 5000
```

## 创建配置类，注入ElasticsearchClient

### 方式一：用户名密码

```java
// 只有当 app.manage.elasticsearch.enabled = true 满足时，此配置类才会被注册。如果什么都没有配置matchIfMissing生效，运行配置缺省
@Configuration
@ConditionalOnProperty(prefix = "app.manage.elasticsearch", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DocumentManageElasticsearchConfiguration {

    /**
     * ES 地址列表。多个地址用英文逗号分隔，例如 http://127.0.0.1:9200,http://127.0.0.1:9201。
     * 注意：@Value 不支持 YAML 列表写法，配置文件里必须写成一行逗号分隔。
     */
    @Value("${app.manage.elasticsearch.uris:http://127.0.0.1:9200}")
    private String uris;

    /** ES 用户名。留空表示不带认证（需 ES 侧关闭鉴权）。 */
    @Value("${app.manage.elasticsearch.username:}")
    private String username;

    /** ES 密码。仅当用户名非空时才生效。 */
    @Value("${app.manage.elasticsearch.password:}")
    private String password;

    /** 建立 TCP 连接的超时时间，单位毫秒。 */
    @Value("${app.manage.elasticsearch.connect-timeout-millis:3000}")
    private int connectTimeoutMillis;

    /** 请求发出后等待响应的读超时时间，单位毫秒。 */
    @Value("${app.manage.elasticsearch.socket-timeout-millis:5000}")
    private int socketTimeoutMillis;

    /**
     * 第一层：底层 REST 客户端。
     * destroyMethod = "close" 让 Spring 在容器关闭时自动调用 RestClient.close()，
     * 释放连接池与后台的空闲连接回收线程。
     */
    @Bean(name = "elasticsearchRestClient", destroyMethod = "close")
    public RestClient elasticsearchRestClient() {
        // 1) 解析地址：按逗号拆分，过滤空串，转成 HttpHost 数组
        List<String> uriList = StrUtil.split(uris, ',');
        HttpHost[] hosts = uriList.stream()
            .filter(StrUtil::isNotBlank)
            .map(HttpHost::create)
            .toArray(HttpHost[]::new);
        if (hosts.length == 0) {
            throw new IllegalStateException("app.manage.elasticsearch.uris 不能为空");
        }

        // 2) 连接/读超时。回调是延迟执行的，真正生效发生在最后的 build()。
        RestClientBuilder builder = RestClient.builder(hosts)
            .setRequestConfigCallback(requestConfigBuilder -> requestConfigBuilder
                .setConnectTimeout(connectTimeoutMillis)
                .setSocketTimeout(socketTimeoutMillis));

        // 3) 可选 Basic 认证：只有配置了用户名才挂认证，否则匿名访问
        if (StrUtil.isNotBlank(username)) {
            CredentialsProvider credentialsProvider = new BasicCredentialsProvider();

            /*
             * AuthScope.ANY —— 通配认证作用域。
             *
             * 背景：HttpClient 的凭证是按“作用域(scope)”存放的，一个作用域由
             *       协议 + 主机 + 端口 + realm(认证域) 共同描述；发起请求时，
             *       HttpClient 会按目标地址去匹配对应作用域的凭证。
             *
             * 含义：AuthScope.ANY 是一个“匹配任意目标”的哨兵作用域，
             *       表示这份用户名/密码对任意主机、任意端口、任意 realm 都生效，
             *       即“无论请求打到哪个 ES 节点，都使用这组凭证”。
             *
             * 为什么这里能用 ANY：本 RestClient 只服务单一 ES 集群（地址来自上面的 uris），
             *       集群内各节点共用同一套账号，不存在“不同 host 用不同账号”的需求，
             *       所以无需为每个 host/port 单独建 scope，直接用 ANY 最省事。
             */
            credentialsProvider.setCredentials(
                AuthScope.ANY,
                new UsernamePasswordCredentials(username, StrUtil.blankToDefault(password, ""))
            );

            // 延迟回调：build() 时才把凭证注入底层异步 HttpClient。
            builder.setHttpClientConfigCallback(httpClientBuilder -> httpClientBuilder
                .setDefaultCredentialsProvider(credentialsProvider));
        }

        return builder.build();
    }

    /**
     * 第二层：传输层。把 RestClient 与 JSON 序列化器组合成 ES 官方 transport。
     * destroyMethod = "close" 让 Spring 在容器关闭时自动调用 ElasticsearchTransport.close()
     * 补充：该 close() 内部会级联关闭它持有的底层 RestClient，幂等关闭，无副作用。
     */
    @Bean(name = "elasticsearchTransport", destroyMethod = "close")
    public ElasticsearchTransport elasticsearchTransport(
            @Qualifier("elasticsearchRestClient") RestClient restClient,
            ObjectMapper objectMapper) {
        return new RestClientTransport(restClient, new JacksonJsonpMapper(objectMapper));
    }

    /**
     * 第三层：ES 官方 Java API 客户端，供各业务网关注入使用。
     * ElasticsearchClient 未实现 Closeable，无需（也无法）声明 destroyMethod；
     * 其底层资源由上面两个可关闭 Bean 在容器关闭时释放。
     */
    @Bean(name = "elasticsearchClient")
    public ElasticsearchClient elasticsearchClient(
            @Qualifier("elasticsearchTransport") ElasticsearchTransport transport) {
        return new ElasticsearchClient(transport);
    }
}
```

### 方式二：API Key认证

省略Bean封装（项目中自行封装bean）

```java
// 方式 A：门面方法（最简洁）,ElasticsearchClient.of() 是官方推荐的新写法
ElasticsearchClient esClient = ElasticsearchClient.of(b -> b
    .host("https://localhost:9200")   // 注意是 https
    .apiKey("VnVhQ2ZHY0JDZGJrU...")
);
// 方式 B：传统三层构建（更灵活）
RestClient restClient = RestClient
    .builder(HttpHost.create("https://127.0.0.1:9200"))
    .setDefaultHeaders(new Header[]{
        new BasicHeader("Authorization", "ApiKey " + apiKey)
    })
    .build();

ElasticsearchTransport transport = new RestClientTransport(
    restClient, new JacksonJsonpMapper());

ElasticsearchClient esClient = new ElasticsearchClient(transport);
```

### 启用HTTPS，需配置CA证书

无论选择哪种认证方式，只要集群启用了 HTTPS（8.x 默认如此），客户端就必须信任 Elasticsearch 的证书。

**如果 CA 证书是 PEM 格式（如 `http_ca.crt`）：**

```java
// 加载CA证书
Path caPath = Paths.get("/path/to/http_ca.crt");
CertificateFactory factory = CertificateFactory.getInstance("X.509");
Certificate trustedCa;
try (InputStream is = Files.newInputStream(caPath)) {
    trustedCa = factory.generateCertificate(is);
}

// 配置SSL上下文
KeyStore trustStore = KeyStore.getInstance("pkcs12");
trustStore.load(null, null);
trustStore.setCertificateEntry("ca", trustedCa);

SSLContext sslContext = SSLContexts.custom()
    .loadTrustMaterial(trustStore, null)
    .build();

//构建RestClient
RestClient restClient = RestClient
    .builder(new HttpHost("https", "localhost", 9200))
    .setHttpClientConfigCallback(builder -> builder.setSSLContext(sslContext))
    .build();
```

## 基本操作

### CRUD操作

创建索引：

```java
// 创建索引：同时配置分片副本（settings）和字段映射（mappings）
CreateIndexResponse response = esClient.indices().create(c -> c
    .index("products")//创建索引
    .settings(s -> s
        .numberOfShards("3")// 分片数 = 3
        .numberOfReplicas("1")// 每个分片的副本数 = 1
    )
    .mappings(m -> m
        .properties("name", p -> p
            .type(ElasticsearchPropertyType.Text) //字段主类型text分词
            .fields("keyword", f -> f.type(ElasticsearchPropertyType.Keyword))//字段副类型keyword不分词
        )
        .properties("price", p -> p
            .type(ElasticsearchPropertyType.Double)
        )
        .properties("category", p -> p
            .type(ElasticsearchPropertyType.Keyword)
        )
    )
);

```

索引中插入文档：

```java
Product product = new Product("Laptop", 999.99, "electronics");
IndexResponse response = esClient.index(i -> i
    .index("products")
    .id("1")
    .document(product));
```

根据 ID 查询文档：

```java
GetResponse<Product> getResponse = esClient.get(g -> g
    .index("products")
    .id("1"),
    Product.class);
Product product = getResponse.source();
```

更新文档：

```java
UpdateResponse<Product> updateResponse = esClient.update(u -> u
     .index("products")
     .id("1")
     .doc(new Product("Laptop Pro", 1299.99, "electronics")),
     Product.class);
```

删除文档：

```java
DeleteResponse deleteResponse = esClient.delete(d -> d
    .index("products")
    .id("1"));
```

### 查询构建

以组合了文本搜索和价格范围的布尔查询示例：

#### Lambda 方式

```java
SearchResponse<Product> response = esClient.search(s -> s
    .index("products")
    .query(q -> q
        .bool(b -> b
            .must(m -> m
                .match(t -> t
                    .field("name")
                    .query("laptop")
                )
            )
            .filter(f -> f
                .range(r -> r
                    .field("price")
                    .gte(JsonData.of(500))
                    .lte(JsonData.of(1500))
                )
            )
        )
    )
    .from(0)
    .size(10),
    Product.class
);

for (Hit<Product> hit : response.hits().hits()) {
    System.out.println(hit.source().getName());
}
```

#### 显式 `SearchRequest`方式

```java
// 1. 对应 .must(m -> m.match(t -> t.field("name").query("laptop")))
Query matchQuery = new MatchQuery.Builder()
    .field("name")
    .query("laptop")
    .build()
    ._toQuery();

// 2. 对应 .filter(f -> f.range(r -> r.field("price").gte(...).lte(...)))
Query rangeQuery = new RangeQuery.Builder()
    .field("price")
    .gte(JsonData.of(500))
    .lte(JsonData.of(1500))
    .build()
    ._toQuery();

// 3. 对应 q -> q.bool(b -> b.must(...).filter(...))
Query boolQuery = new BoolQuery.Builder()
    .must(matchQuery)
    .filter(rangeQuery)
    .build()
    ._toQuery();

// 4. 对应 s -> s.index("products").query(...).from(0).size(10)
SearchRequest searchRequest = new SearchRequest.Builder()
    .index("products")
    .query(boolQuery)
    .from(0)
    .size(10)
    .build();

// 5. 执行查询，与 Lambda 方式的 esClient.search(..., Product.class) 等价
SearchResponse<Product> response = esClient.search(searchRequest, Product.class);

for (Hit<Product> hit : response.hits().hits()) {
    System.out.println(hit.source().getName());
}
```

***

#### 查询类型与子句语义说明

> 可用的查询类型包括 `MatchQuery`、`MultiMatchQuery`、`TermQuery` 、`RangeQuery`、`BoolQuery`等。
>
> `bool` 查询支持查询子句语义有 `must`（必须匹配）、`filter`（过滤，不参与评分）、`should`（应该匹配）、`mustNot`（排除）等子句。

| **可用的查询Java 类** | JSON DSL | 用途 |
| --- | --- | --- |
| `MatchQuery` | `{"match": {...}}` | 对单个字段做全文检索，会分词 |
| `MultiMatchQuery` | `{"multi_match": {...}}` | 一次在多个字段上做全文检索 |
| `TermQuery` | `{"term": {...}}` | 精确匹配某个词项，不分词，常用于 keyword 字段、ID、状态枚举 |
| `RangeQuery` | `{"range": {...}}` | 范围查询，如价格 `gte/lte`
、日期区间 |
| `BoolQuery` | `{"bool": {...}}` | 逻辑组合器，连接以上子查询 |

***

| **Bool查询支持的子句语义** | 逻辑含义 | 是否影响相关性评分 _score | 典型用途 |
| --- | --- | --- | --- |
| must | 必须匹配（AND） | ✅ 影响 | 核心的搜索条件，比如关键词匹配 |
| filter | 必须匹配（AND） | ❌ 不影响 | 筛选条件，比如价格区间、状态、时间范围 |
| should | 应该匹配（OR），匹配得越多分越高 | ✅ 影响 | 加分项、可选的扩展匹配 |
| must_not | 必须不匹配（NOT） | ❌ 不影响 | 排除条件，比如排除下架商品、黑名单 |

***

BoolQuery示例:

```java
Query query = BoolQuery.of(b -> b
    // 必须匹配关键词，参与打分
    .must(m -> m.match(t -> t.field("name").query("laptop")))
    // 价格区间，只做筛选，不打分
    .filter(f -> f.range(r -> r.field("price").gte(JsonData.of(500)).lte(JsonData.of(1500))))
    // 打了 "hot" 标签的加分（不是必须）
    .should(s -> s.term(t -> t.field("tags").value("hot")))
    // 排除已删除商品
    .mustNot(n -> n.term(t -> t.field("status").value("deleted")))
)._toQuery();
```

对应的json示例：

```json
{
  "query": {
    "bool": {
      "must":     [ { "match": { "name": "laptop" } } ],
      "filter":   [ { "range": { "price": { "gte": 500, "lte": 1500 } } } ],
      "should":   [ { "term":  { "tags": "hot" } } ],
      "must_not": [ { "term":  { "status": "deleted" } } ]
    }
  }
}
```

### 查询聚合

一次 `search` 请求的响应大致包含：

```plain
SearchResponse
├── hits()          → 命中的文档 + 总数（受 size 控制）
├── aggregations()  → 聚合结果 Map（请求里写了聚合才有内容）
└── ...             → took、shards、suggest 等
```

> 关键点：
>
> 纯分析场景通常设置 `.size(0)` 并将结果类型设为 `Void.class`，这样 Elasticsearch 不会返回匹配的文档，只返回聚合结果，节省带宽。
>
> 如果既想看文档又想看聚合，把 `size` 设为非零值、类型改为 `Product.class` 即可。

***

**常见的聚合类型：**

| **常见的聚合类别** | Java 构建器入口 | 作用 |
| --- | --- | --- |
| 指标聚合 | .avg() / .max() / .min() / .sum() / .cardinality() | 计算数值平均值、极值、去重计数等 |
| 分桶聚合 | .terms() / .histogram() / .range() / .dateHistogram() | 按字段值、区间或时间间隔将文档分组 |
| 管道聚合 | 在子聚合中引用其他聚合结果 | 对聚合结果再做计算（如桶的脚本计算） |

**聚合结果获取方式：**

| 聚合类型 | 读取入口 | 核心操作 | 注意事项 |
| --- | --- | --- | --- |
| 指标聚合 | response.aggregations ().get ("名") | .avg ().value () 等 | 直接取值，方法名与聚合类型对应 |
| 分桶聚合 | response.aggregations ().get ("名") | .sterms () 或 .lterms () → 
.buckets ().array () 遍历 | terms 必须区分字符串 (sterms) 和数值 (lterms) |
| 管道聚合 | bucket.aggregations ().get ("名") | 在父级分桶的每个桶内读取 | 没有顶层入口，结果附着在父级桶中 |

#### Lambda方式

```java
// 1. 查询部分（与之前完全一致）
Query boolQuery = BoolQuery.of(b -> b
    .must(m -> m.match(t -> t.field("name").query("laptop")))
    .filter(f -> f.range(r -> r.field("price").gte(JsonData.of(500)).lte(JsonData.of(1500))))
)._toQuery();

// 2. 执行搜索 + 聚合
SearchResponse<Void> response = esClient.search(s -> s
    .index("products")
    .query(boolQuery)
    .size(0)  // 纯分析场景，不返回文档
    .aggregations("price-histogram", a -> a
        .histogram(h -> h
            .field("price")
            .interval(50.0)  // 每 50 元一个桶
        )
    ),
    Void.class
);

// 3. 解析聚合结果
List<HistogramBucket> buckets = response.aggregations()
    .get("price-histogram")
    .histogram()
    .buckets()
    .array();

for (HistogramBucket bucket : buckets) {
    System.out.println(bucket.key() + " ~ " + (bucket.key() + 50) 
        + " 元之间：" + bucket.docCount() + " 件商品");
}
```

#### 显式 `SearchRequest`方式

```java
// 1. 查询部分（显式）
Query matchQuery = new MatchQuery.Builder()
    .field("name").query("laptop").build()._toQuery();
Query rangeQuery = new RangeQuery.Builder()
    .field("price").gte(JsonData.of(500)).lte(JsonData.of(1500)).build()._toQuery();
Query boolQuery = new BoolQuery.Builder()
    .must(matchQuery).filter(rangeQuery).build()._toQuery();

// 2. 显式构建聚合
Aggregation priceHistogram = new Aggregation.Builder()
    .histogram(h -> h.field("price").interval(50.0))
    .build();

// 3. 组装 SearchRequest
SearchRequest searchRequest = new SearchRequest.Builder()
    .index("products")
    .query(boolQuery)
    .size(0)
    .aggregations("price-histogram", priceHistogram)
    .build();

// 4. 执行并解析（与 Lambda 方式相同）
SearchResponse<Void> response = esClient.search(searchRequest, Void.class);
List<HistogramBucket> buckets = response.aggregations()
    .get("price-histogram").histogram().buckets().array();
for (HistogramBucket bucket : buckets) {
    System.out.println(bucket.key() + " 元：" + bucket.docCount() + " 件");
}
```

#### 多聚合与子聚合

**多聚合：**

```java
// 方式一：链式添加
SearchRequest request = SearchRequest.of(r -> r
    .index("products")
    .size(0)
    .aggregations("avg-price", a -> a.avg(av -> av.field("price")))
    .aggregations("max-price", a -> a.max(mx -> mx.field("price")))
    .aggregations("category-count", a -> a.cardinality(c -> c.field("category")))
);

// 方式二：Map 注入
Map<String, Aggregation> aggs = new HashMap<>();
aggs.put("avg-price", Aggregation.of(a -> a.avg(av -> av.field("price"))));
aggs.put("max-price", Aggregation.of(a -> a.max(mx -> mx.field("price"))));
SearchRequest request = SearchRequest.of(r -> r.aggregations(aggs));
```

**子聚合：**

```java
Aggregation byCategoryWithAvgPrice = Aggregation.of(a -> a
    .terms(t -> t.field("category"))  // 父聚合：按 category 分桶
    .aggregations("avg_price", sub -> sub  // 子聚合：每个桶内计算平均价格
        .avg(av -> av.field("price"))
    )
);

SearchResponse<Void> response = esClient.search(s -> s
    .index("products")
    .size(0)
    .aggregations("category-stats", byCategoryWithAvgPrice),
    Void.class
);

// 解析：每个分类桶里取出子聚合 "avg_price"
var termsResult = response.aggregations().get("category-stats").sterms();
for (var bucket : termsResult.buckets().array()) {
    double avg = bucket.aggregations().get("avg_price").avg().value();
    System.out.println(bucket.key().stringValue() + " 平均价格：" + avg);
}
```

### 批量操作

使用 `BulkRequest` 可以一次提交多个文档操作（Bulk）：

```java
BulkResponse bulkResponse = esClient.bulk(b -> b
    .index("products")  // ← 全局默认索引
    .operations(op -> op // ← 一个个操作
        .index(idx -> idx.id("1").document(product1))
    )
    .operations(op -> op // ← 一个个操作
        .index(idx -> idx.id("2").document(product2))
    )
    .operations(op -> op // ← 一个个操作
        .delete(del -> del.id("3"))
    )
);
```

最佳实践：批量大小建议控制在 5–15 MB，每批次文档数通常设为 1000–5000 条，需根据集群实际情况压测调优。

### 异步操作

所有 API 都提供异步版本，异步客户端的方法返回 `CompletableFuture`。同步和异步客户端可以共享同一个 `transport` 对象：

```java
// 异步客户端（与同步客户端共享 transport）
ElasticsearchAsyncClient asyncClient = new ElasticsearchAsyncClient(transport);

// 异步搜索
asyncClient.search(s -> s
        .index("products")
        .query(q -> q.match(t -> t.field("name").query("laptop"))),
    Product.class
).thenAccept(response -> {
    response.hits().hits().forEach(hit ->
        System.out.println(hit.source().getName()));
});
```


> 更新: 2026-10-19 14:40:47  
> 原文: <https://www.yuque.com/xiaoque-wqxrh/uetcbf/vxl5prdsg1cxzuup>