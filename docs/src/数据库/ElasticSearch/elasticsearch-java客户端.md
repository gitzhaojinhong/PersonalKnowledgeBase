

## 客户端演进

### TransportClient

TransportClient 是 Elasticsearch 最早的 Java 客户端，基于 Netty 直接与 ES 节点通信（TCP 9300 端口）。ES 7.x 起标记为 `@Deprecated`，ES 8.x 彻底移除，不兼容。

| 特性 | 说明 |
|------|------|
| 通信协议 | TCP（9300），直连 ES 节点 |
| 序列化 | 内部二进制协议 |
| 版本兼容 | 必须与集群版本 **严格一致** |
| 线程模型 | 基于 Netty 的异步模型 |
| 生命周期 | ES 5.x 及更早，ES 7.x 废弃，ES 8.x 移除 |

**迁移须知**：TransportClient 不兼容 HTTP 协议，无法与 8.x 集群通信。任何仍有引用 `org.elasticsearch.client.transport` 的项目必须升级到 elasticsearch-java。

### Java High Level REST Client

ES 7.x 官方推荐的 Java 客户端，基于 Apache HTTP Async Client 封装，通过 HTTP/HTTPS 与 ES 通信。ES 8.x 起标记为废弃，不再新增功能，建议迁移。

| 特性 | 说明 |
|------|------|
| 通信协议 | HTTP/HTTPS（9200） |
| 底层依赖 | Apache HTTP Async Client |
| 版本兼容 | 与 ES 集群版本 **强绑定**（同大版本） |
| 线程模型 | 异步回调 |
| 生命周期 | ES 7.x 主流，ES 8.x 废弃 |
| 包路径 | `org.elasticsearch.client` |

**典型问题**：
- 依赖版本必须与 ES 集群版本一一对应，升级困难
- 缺少强类型 Builder，DSL 构建靠 Map/String 拼接，易出错
- 异步回调嵌套深，难以维护

### elasticsearch-java（新 API Client）

ES 8.x 官方推荐，从 ES 7.17 起也可使用。基于 ES 官方 JSON Schema 生成代码，提供强类型 DSL、Fluent Builder、Lambda 链式 API。

| 特性 | 说明 |
|------|------|
| 通信协议 | HTTP/HTTPS |
| 底层传输 | Elasticsearch Low-Level REST Client（`elasticsearch-rest-client`） |
| 代码生成 | 由 ES 官方 JSON Schema 自动生成，API 表面与 REST API 一一对应 |
| DSL 风格 | Fluent Builder + Lambda 表达式，强类型 |
| 序列化 | Jackson / JSON-B（默认 Jackson） |
| 版本兼容 | 兼容 ES 7.17 / 8.x，**向后兼容** |
| 包路径 | `co.elastic.clients` |

### 选型建议

| 场景 | 推荐 |
|------|------|
| 新项目（2024+） | **elasticsearch-java**（强制） |
| 已有 HLRC 项目 | 逐步迁移到 elasticsearch-java |
| 仍在使用 TransportClient | 立即迁移，先迁到 HLRC 再迁到 elasticsearch-java |
| Spring Boot 3.x + Spring Data ES | 底层已默认使用 elasticsearch-java |

---

## 环境配置

### Maven / Gradle 依赖

**Maven**：

```xml
<properties>
    <es.version>8.15.0</es.version>
    <jackson.version>2.17.2</jackson.version>
</properties>

<dependencies>
    <!-- elasticsearch-java（新 API Client） -->
    <dependency>
        <groupId>co.elastic.clients</groupId>
        <artifactId>elasticsearch-java</artifactId>
        <version>${es.version}</version>
    </dependency>

    <!-- 底层 HTTP 传输 -->
    <dependency>
        <groupId>org.elasticsearch.client</groupId>
        <artifactId>elasticsearch-rest-client</artifactId>
        <version>${es.version}</version>
    </dependency>

    <!-- Jackson（默认 JSON 序列化） -->
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-databind</artifactId>
        <version>${jackson.version}</version>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.core</groupId>
        <artifactId>jackson-core</artifactId>
        <version>${jackson.version}</version>
    </dependency>

    <!-- Jakarta JSON（若不使用 Jackson，可改用 JSON-B） -->
    <dependency>
        <groupId>jakarta.json</groupId>
        <artifactId>jakarta.json-api</artifactId>
        <version>2.1.3</version>
    </dependency>
</dependencies>
```

**Gradle**：

```groovy
ext {
    esVersion = '8.15.0'
}

dependencies {
    implementation("co.elastic.clients:elasticsearch-java:${esVersion}")
    implementation("org.elasticsearch.client:elasticsearch-rest-client:${esVersion}")
    implementation("com.fasterxml.jackson.core:jackson-databind:2.17.2")
}
```

### 客户端初始化（ElasticsearchClient）

```java
import co.elastic.clients.elasticsearch.ElasticsearchClient;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import co.elastic.clients.transport.ElasticsearchTransport;
import co.elastic.clients.transport.rest_client.RestClientTransport;
import org.apache.http.HttpHost;
import org.apache.http.auth.AuthScope;
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.elasticsearch.client.RestClient;
import org.elasticsearch.client.RestClientBuilder;

public class EsClientFactory {

    public static ElasticsearchClient create() {
        RestClient restClient = RestClient.builder(new HttpHost("localhost", 9200, "http"))
                .build();

        ElasticsearchTransport transport = new RestClientTransport(
                restClient, new JacksonJsonpMapper()
        );

        return new ElasticsearchClient(transport);
    }
}
```

**Spring Boot 集成**（手动注册 Bean）：

```java
@Configuration
public class ElasticsearchConfig {

    @Value("${elasticsearch.host:localhost}")
    private String host;

    @Value("${elasticsearch.port:9200}")
    private int port;

    @Bean(destroyMethod = "close")
    public RestClient restClient() {
        return RestClient.builder(new HttpHost(host, port, "http")).build();
    }

    @Bean(destroyMethod = "close")
    public ElasticsearchTransport transport(RestClient restClient) {
        return new RestClientTransport(restClient, new JacksonJsonpMapper());
    }

    @Bean
    public ElasticsearchClient elasticsearchClient(ElasticsearchTransport transport) {
        return new ElasticsearchClient(transport);
    }
}
```

### 连接配置（URL / 超时 / 压缩）

```java
RestClient restClient = RestClient.builder(
        new HttpHost("es-node-1", 9200, "https"),
        new HttpHost("es-node-2", 9200, "https"),
        new HttpHost("es-node-3", 9200, "https")
)
    .setHttpClientConfigCallback(httpClientBuilder -> httpClientBuilder
        // 连接超时（TCP 三次握手）
        .setConnectTimeout(Timeout.of(5, TimeUnit.SECONDS))
        // Socket 超时（等待数据）
        .setDefaultSocketConfig(SocketConfig.custom()
                .setSoTimeout(Timeout.of(30, TimeUnit.SECONDS)).build())
        // 连接池
        .setConnectionManager(PoolingAsyncClientConnectionManagerBuilder.create()
                .setMaxConnTotal(100)
                .setMaxConnPerRoute(30)
                .build())
        // 请求压缩（Gzip）
        .setDefaultRequestConfig(RequestConfig.custom()
                .setContentCompressionEnabled(true)
                .build())
        // 认证
        .setDefaultCredentialsProvider(credentialsProvider)
    )
    .setRequestConfigCallback(requestConfigBuilder -> requestConfigBuilder
        .setConnectTimeout(5000)          // 连接超时（ms）
        .setSocketTimeout(60000)          // 读写超时（ms）
        .setConnectionRequestTimeout(3000) // 从连接池获取连接超时（ms）
    )
    .build();
```

| 参数 | 默认值 | 建议值 | 说明 |
|------|--------|--------|------|
| `connectTimeout` | 1000ms | 5000ms | TCP 连接建立超时 |
| `socketTimeout` | 30000ms | 60000ms | 等待响应数据超时 |
| `connectionRequestTimeout` | 500ms | 3000ms | 从连接池获取连接超时 |
| `maxConnTotal` | 动态 | 100-200 | 连接池最大连接数 |
| `maxConnPerRoute` | 动态 | 30-50 | 每个地址最大连接数 |
| `contentCompressionEnabled` | false | true | 是否启用 Gzip 压缩 |

### 版本兼容性

| elasticsearch-java 版本 | 兼容 ES 版本 | 最低 Java 版本 |
|--------------------------|-------------|--------------|
| 8.15.x | 8.15.x | Java 8 |
| 8.x | 8.x | Java 8 |
| 7.17.x | 7.17.x | Java 8 |

> **注意**：elasticsearch-java 8.x 客户端向前兼容 ES 7.17 集群，但部分 8.x 新增 API 在 7.17 集群上不可用。建议生产环境保持客户端与集群大版本一致。

---

## 安全认证

### TLS/SSL 配置

```java
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManagerFactory;
import java.io.FileInputStream;
import java.security.KeyStore;

public class SslConfig {

    public static SSLContext createSslContext(String caCertPath) throws Exception {
        KeyStore trustStore = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(caCertPath)) {
            trustStore.load(fis, "changeit".toCharArray());
        }

        TrustManagerFactory tmf = TrustManagerFactory.getInstance(
                TrustManagerFactory.getDefaultAlgorithm()
        );
        tmf.init(trustStore);

        SSLContext sslContext = SSLContext.getInstance("TLSv1.3");
        sslContext.init(null, tmf.getTrustManagers(), null);
        return sslContext;
    }

    public static RestClient createHttpsClient() throws Exception {
        SSLContext sslContext = createSslContext("/path/to/ca-cert.p12");

        return RestClient.builder(new HttpHost("es-cluster", 9200, "https"))
                .setHttpClientConfigCallback(httpClientBuilder ->
                        httpClientBuilder.setSSLContext(sslContext))
                .build();
    }
}
```

### Basic Auth 认证

```java
import org.apache.http.auth.UsernamePasswordCredentials;
import org.apache.http.impl.client.BasicCredentialsProvider;
import org.apache.http.auth.AuthScope;

CredentialsProvider credentialsProvider = new BasicCredentialsProvider();
credentialsProvider.setCredentials(
        AuthScope.ANY,
        new UsernamePasswordCredentials("elastic", "your-password")
);

RestClient restClient = RestClient.builder(
        new HttpHost("localhost", 9200, "https"))
        .setHttpClientConfigCallback(httpClientBuilder ->
                httpClientBuilder.setDefaultCredentialsProvider(credentialsProvider))
        .build();
```

| 参数 | 说明 |
|------|------|
| `AuthScope.ANY` | 所有主机/端口/协议均使用相同凭据 |
| `AuthScope(host, port, realm, scheme)` | 精确指定认证范围，多集群场景推荐 |

### API Key 认证

API Key 通过 Base64 编码的 `Authorization` 头传递，格式为 `ApiKey <base64(id:api_key)>`。

```java
// 方式一：通过 RestClient Header 拦截器
RestClient restClient = RestClient.builder(
        new HttpHost("localhost", 9200, "https"))
        .setDefaultHeaders(new Header[]{
                new BasicHeader("Authorization",
                        "ApiKey " + Base64.getEncoder().encodeToString(
                                "id:api_key_value".getBytes(StandardCharsets.UTF_8)))
        })
        .build();

// 方式二：创建 API Key（通过客户端）
ElasticsearchClient client = /* ... */;

CreateApiKeyResponse apiKeyResponse = client.security().createApiKey(
        CreateApiKeyRequest.of(c -> c
                .name("my-app-key")
                .expiration(JsonData.of("30d"))
                .roleDescriptors(Map.of(
                        "my-role", RoleDescriptor.of(r -> r
                                .cluster("all")
                                .indices(i -> i
                                        .names("my-index-*")
                                        .privileges("read", "write")
                                )
                        ))))
);

String apiKey = Base64.getEncoder().encodeToString(
        (apiKeyResponse.id() + ":" + apiKeyResponse.apiKey())
                .getBytes(StandardCharsets.UTF_8)
);
System.out.println("API Key: " + apiKey);
```

| 特性 | Basic Auth | API Key |
|------|-----------|---------|
| 权限粒度 | 用户级 | 按 Role 细粒度控制 |
| 过期时间 | 无 | 支持过期 |
| 吊销 | 只能改密码 | 可单独吊销 |
| 审计 | 用户操作 | 可按 Key 追踪 |
| 推荐场景 | 开发/管理 | 生产应用 |

### 证书指纹认证

```java
import org.apache.http.conn.ssl.NoopHostnameVerifier;
import org.apache.http.ssl.SSLContexts;

SSLContext sslContext = SSLContexts.custom()
        .loadTrustMaterial(null, (chain, authType) -> true) // 信任所有证书（仅开发）
        .build();

RestClient restClient = RestClient.builder(
        new HttpHost("localhost", 9200, "https"))
        .setHttpClientConfigCallback(httpClientBuilder ->
                httpClientBuilder
                        .setSSLContext(sslContext)
                        .setSSLHostnameVerifier(NoopHostnameVerifier.INSTANCE))
        .build();
```

> **警告**：`NoopHostnameVerifier` 和 trust-all 仅用于开发环境。生产环境必须使用正式 CA 证书或自签名证书进行严格校验。

### 自签名证书处理

```java
// 从 PEM 文件加载自签名证书
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;

CertificateFactory cf = CertificateFactory.getInstance("X.509");
X509Certificate caCert;
try (FileInputStream fis = new FileInputStream("/path/to/ca.crt")) {
    caCert = (X509Certificate) cf.generateCertificate(fis);
}

KeyStore trustStore = KeyStore.getInstance(KeyStore.getDefaultType());
trustStore.load(null, null);
trustStore.setCertificateEntry("ca", caCert);

TrustManagerFactory tmf = TrustManagerFactory.getInstance(
        TrustManagerFactory.getDefaultAlgorithm()
);
tmf.init(trustStore);

SSLContext sslContext = SSLContext.getInstance("TLSv1.3");
sslContext.init(null, tmf.getTrustManagers(), null);

RestClient restClient = RestClient.builder(
        new HttpHost("es-node", 9200, "https"))
        .setHttpClientConfigCallback(hcb -> hcb.setSSLContext(sslContext))
        .build();
```

---

## 索引操作

### 创建索引（CreateIndexRequest）

```java
// 基础创建
CreateIndexResponse createResponse = client.indices().create(
        CreateIndexRequest.of(c -> c.index("orders"))
);

// 带 Settings 和 Mappings 的创建
CreateIndexResponse createResponse = client.indices().create(
        CreateIndexRequest.of(c -> c
                .index("orders")
                .settings(s -> s
                        .numberOfShards("3")
                        .numberOfReplicas("1")
                        .refreshInterval(ri -> ri.time("5s"))
                        .analysis(an -> an
                                .analyzer("my_analyzer", a -> a
                                        .custom(ca -> ca
                                                .tokenizer("standard")
                                                .filter("lowercase", "asciifolding")
                                        ))))
                .mappings(m -> m
                        .properties("order_id", p -> p.keyword(k -> k))
                        .properties("user_id", p -> p.keyword(k -> k))
                        .properties("amount", p -> p.double_(d -> d))
                        .properties("status", p -> p.keyword(k -> k))
                        .properties("created_at", p -> p.date(d -> d.format("yyyy-MM-dd HH:mm:ss")))
                        .properties("description", p -> p.text(t -> t.analyzer("my_analyzer")))
                )
        )
);
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `numberOfShards` | int | 主分片数（创建后不可修改） |
| `numberOfReplicas` | int | 副本分片数（可动态修改） |
| `refreshInterval` | Time | 近实时刷新间隔 |
| `analysis` | AnalysisConfig | 自定义分析器/分词器/过滤器 |

### 删除索引

```java
// 删除单个索引
DeleteIndexResponse deleteResponse = client.indices().delete(
        DeleteIndexRequest.of(d -> d.index("orders"))
);

// 通配符删除（谨慎！）
DeleteIndexResponse deleteResponse = client.indices().delete(
        DeleteIndexRequest.of(d -> d.index("log-2024-*"))
);
```

### 判断索引是否存在

```java
// 返回 boolean
boolean exists = client.indices().exists(
        ExistsRequest.of(e -> e.index("orders"))
).value();

// 也可用于通配符判断
boolean anyExists = client.indices().exists(
        ExistsRequest.of(e -> e.index("log-*"))
).value();
```

### 索引别名管理

```java
// 创建别名
PutAliasResponse putAlias = client.indices().putAlias(
        PutAliasRequest.of(p -> p
                .index("orders")
                .name("orders_alias")
        )
);

// 原子交换别名（零停机切换）
UpdateAliasesResponse swapResponse = client.indices().updateAliases(
        UpdateAliasesRequest.of(u -> u
                .actions(
                        a -> a.remove(r -> r.index("orders").alias("orders_alias")),
                        a -> a.add(add -> add.index("orders_v2").alias("orders_alias"))
                )
        )
);

// 获取别名指向的索引
GetAliasResponse aliasResponse = client.indices().getAlias(
        GetAliasRequest.of(g -> g.name("orders_alias"))
);

// 删除别名
DeleteAliasResponse deleteAlias = client.indices().deleteAlias(
        DeleteAliasRequest.of(d -> d
                .index("orders")
                .name("orders_alias")
        )
);
```

### 获取索引映射

```java
GetMappingResponse mappingResponse = client.indices().getMapping(
        GetMappingRequest.of(g -> g.index("orders"))
);

// 遍历映射信息
mappingResponse.result().forEach((indexName, indexMapping) -> {
    System.out.println("Index: " + indexName);
    indexMapping.mappings().properties().forEach((field, property) -> {
        System.out.println("  Field: " + field + " -> " + property._kind());
    });
});
```

---

## 文档 CRUD

### Index（创建/全量替换）

```java
// 创建文档（指定 ID）
IndexResponse response = client.index(IndexRequest.of(i -> i
        .index("orders")
        .id("1001")
        .document(Map.of(
                "order_id", "1001",
                "user_id", "U001",
                "amount", 299.99,
                "status", "pending",
                "created_at", "2024-01-15 10:30:00"
        ))
));

// 使用 POJO
public class Order {
    private String orderId;
    private String userId;
    private Double amount;
    private String status;
    // getters / setters ...
}

Order order = new Order();
order.setOrderId("1001");
order.setUserId("U001");
order.setAmount(299.99);
order.setStatus("pending");

IndexResponse response = client.index(IndexRequest.of(i -> i
        .index("orders")
        .id(order.getOrderId())
        .document(order)
));

// 不指定 ID（ES 自动生成）
IndexResponse response = client.index(IndexRequest.of(i -> i
        .index("orders")
        .document(order)
));
String generatedId = response.id();
```

| 参数 | 必填 | 说明 |
|------|------|------|
| `index` | 是 | 目标索引名 |
| `id` | 否 | 文档 ID，不传则自动生成 |
| `document` | 是 | 文档内容（Map / POJO / JSON） |
| `routing` | 否 | 路由值，影响分片分配 |
| `version` | 否 | 乐观锁版本号 |
| `refresh` | 否 | 写入后立即刷新（Refresh.True / False / WaitFor） |

### Get（单条查询）

```java
// 按 ID 获取
GetResponse<Order> getResponse = client.get(
        GetRequest.of(g -> g.index("orders").id("1001")),
        Order.class
);

if (getResponse.found()) {
    Order order = getResponse.source();
    System.out.println("Found: " + order.getOrderId());
} else {
    System.out.println("Document not found");
}

// 只获取部分字段（_source filtering）
GetResponse<Order> getResponse = client.get(
        GetRequest.of(g -> g
                .index("orders")
                .id("1001")
                .sourceIncludes("order_id", "amount", "status")
        ),
        Order.class
);
```

### Update（部分更新）

```java
// 更新指定字段
UpdateResponse<Order> updateResponse = client.update(
        UpdateRequest.of(u -> u
                .index("orders")
                .id("1001")
                .doc(Map.of(
                        "status", "shipped",
                        "updated_at", LocalDateTime.now().toString()
                ))
        ),
        Order.class
);

// Script 更新
UpdateResponse<Order> updateResponse = client.update(
        UpdateRequest.of(u -> u
                .index("orders")
                .id("1001")
                .script(s -> s
                        .inline(i -> i
                                .source("ctx._source.amount += params.increment")
                                .params("increment", JsonData.of(50.0))
                        ))
        ),
        Order.class
);

// Upsert（不存在则插入）
UpdateResponse<Order> updateResponse = client.update(
        UpdateRequest.of(u -> u
                .index("orders")
                .id("9999")
                .doc(Map.of("status", "new"))
                .upsert(Map.of(
                        "order_id", "9999",
                        "user_id", "U001",
                        "amount", 100.0,
                        "status", "new"
                ))
        ),
        Order.class
);
```

### Delete（删除）

```java
DeleteResponse deleteResponse = client.delete(
        DeleteRequest.of(d -> d.index("orders").id("1001"))
);
System.out.println("Deleted: " + deleteResponse.result().jsonValue());

// 按查询条件删除
DeleteByQueryResponse deleteByQuery = client.deleteByQuery(
        DeleteByQueryRequest.of(d -> d
                .index("orders")
                .query(q -> q.term(t -> t.field("status").value("cancelled")))
        )
);
System.out.println("Deleted count: " + deleteByQuery.deleted());
```

### Bulk（批量操作）

```java
import co.elastic.clients.elasticsearch.core.BulkRequest;
import co.elastic.clients.elasticsearch.core.BulkResponse;
import co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import co.elastic.clients.elasticsearch.core.bulk.BulkResponseItem;

List<Order> orders = fetchOrders(); // 从业务获取

BulkRequest.Builder bulkBuilder = new BulkRequest.Builder();

for (Order order : orders) {
    bulkBuilder.operations(op -> op
            .index(idx -> idx
                    .index("orders")
                    .id(order.getOrderId())
                    .document(order)
            )
    );
}

BulkResponse bulkResponse = client.bulk(bulkBuilder.build());

// 检查错误
if (bulkResponse.errors()) {
    for (BulkResponseItem item : bulkResponse.items()) {
        if (item.error() != null) {
            System.err.printf("Failed [%s] %s: %s%n",
                    item.id(), item.error().type(), item.error().reason());
        }
    }
}
```

**混合操作**（Index / Update / Delete 混合）：

```java
BulkResponse bulkResponse = client.bulk(b -> b
        .operations(
                op -> op.index(i -> i.index("orders").id("1").document(order1)),
                op -> op.update(u -> u.index("orders").id("2").doc(Map.of("status", "done"))),
                op -> op.delete(d -> d.index("orders").id("3")),
                op -> op.create(c -> c.index("orders").id("4").document(order4))
        )
);
```

### 批量操作最佳实践

| 维度 | 建议值 | 说明 |
|------|--------|------|
| 单批次大小 | 5MB - 15MB | 按字节计，而非文档数 |
| 单批次文档数 | 1000 - 5000 | 取决于文档平均大小 |
| 并发写线程数 | CPU 核数 x 2 | 避免过多线程导致上下文切换 |
| 重试次数 | 3 次 | 指数退避（1s / 2s / 4s） |
| 异常处理 | 逐条检查 `items[].error` | bulk 整体 200 不代表每条都成功 |

```java
// 分批批量写入工具方法
public void bulkWithRetry(ElasticsearchClient client, List<Order> orders,
                          int batchSize, int maxRetries) {
    for (int i = 0; i < orders.size(); i += batchSize) {
        int end = Math.min(i + batchSize, orders.size());
        List<Order> batch = orders.subList(i, end);

        int retry = 0;
        while (retry <= maxRetries) {
            try {
                BulkResponse response = client.bulk(b -> {
                    b.index("orders");
                    for (Order order : batch) {
                        b.operations(op -> op.index(
                                idx -> idx.id(order.getOrderId()).document(order)));
                    }
                    return b;
                });

                if (response.errors()) {
                    // 收集失败的文档 ID，仅重试失败项
                    List<Order> failedDocs = new ArrayList<>();
                    for (BulkResponseItem item : response.items()) {
                        if (item.error() != null) {
                            failedDocs.add(batch.stream()
                                    .filter(o -> o.getOrderId().equals(item.id()))
                                    .findFirst().orElse(null));
                        }
                    }
                    batch = failedDocs; // 下一轮仅重试失败项
                } else {
                    break; // 成功
                }
            } catch (IOException e) {
                // 网络异常，整体重试
            }
            retry++;
            if (retry <= maxRetries) {
                try {
                    Thread.sleep((long) Math.pow(2, retry) * 1000); // 指数退避
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }
}
```

---

## 查询操作

### SearchRequest 构建

```java
SearchResponse<Order> response = client.search(
        SearchRequest.of(s -> s
                .index("orders")
                .query(q -> q.matchAll(ma -> ma))
                .size(10)
        ),
        Order.class
);

// 获取结果
List<Order> orders = response.hits().hits().stream()
        .map(Hit::source)
        .collect(Collectors.toList());

long totalHits = response.hits().total().value();
System.out.println("Total hits: " + totalHits);
```

### Query Builders（match / term / bool / range）

```java
// --- match（全文搜索，分词后匹配）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.match(m -> m.field("description").query("wireless headphones")))
        .size(10),
        Order.class
);

// --- match_phrase（精确短语匹配）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.matchPhrase(mp -> mp.field("description").query("noise cancelling")))
        .size(10),
        Order.class
);

// --- multi_match（多字段搜索）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.multiMatch(mm -> mm
                .fields("description^3", "user_name") // ^3 字段权重
                .query("wireless")))
        .size(10),
        Order.class
);

// --- term（精确匹配，不分词）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.term(t -> t.field("status").value("shipped")))
        .size(10),
        Order.class
);

// --- terms（多值精确匹配）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.terms(t -> t.field("status")
                .terms(terms -> terms.value(List.of("shipped", "delivered")))))
        .size(10),
        Order.class
);

// --- range（范围查询）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.range(r -> r
                .field("amount")
                .gte(JsonData.of(100.0))
                .lte(JsonData.of(500.0))))
        .size(10),
        Order.class
);

// --- bool（布尔组合查询）---
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.bool(b -> b
                .must(m -> m.term(t -> t.field("status").value("shipped")))
                .filter(f -> f.range(r -> r
                        .field("amount").gte(JsonData.of(100.0))))
                .mustNot(mn -> mn.term(t -> t.field("status").value("cancelled")))
                .should(sh -> sh.match(m -> m.field("description").query("express")))
                .minimumShouldMatch("1")
        ))
        .size(10),
        Order.class
);
```

| 子句 | 语义 | 影响评分 |
|------|------|---------|
| `must` | 必须匹配（AND 逻辑） | 是 |
| `filter` | 必须匹配，但不评分 | 否 |
| `should` | 可选匹配（OR 逻辑） | 是 |
| `must_not` | 必须不匹配 | 否 |

### 高亮配置

```java
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.match(m -> m.field("description").query("headphones")))
        .highlight(h -> h
                .fields("description", hf -> hf
                        .preTags("<em>")
                        .postTags("</em>")
                        .fragmentSize(150)
                        .numberOfFragments(3)
                )
        )
        .size(10),
        Order.class
);

// 提取高亮片段
for (Hit<Order> hit : response.hits().hits()) {
    Order order = hit.source();
    List<String> highlights = hit.highlight().get("description");
    System.out.println("Order: " + order.getOrderId());
    if (highlights != null) {
        highlights.forEach(h -> System.out.println("  -> " + h));
    }
}
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `preTags` | `<em>` | 高亮前缀标签 |
| `postTags` | `</em>` | 高亮后缀标签 |
| `fragmentSize` | 100 | 片段字符数 |
| `numberOfFragments` | 5 | 返回片段数 |
| `type` | `unified` | 高亮器类型（unified / plain / fvh） |

### 排序与分页

```java
// 排序 + 分页
SearchResponse<Order> response = client.search(s -> s
        .index("orders")
        .query(q -> q.matchAll(ma -> ma))
        .sort(sort -> sort.field(f -> f.field("amount").order(SortOrder.Desc)))
        .sort(sort -> sort.field(f -> f.field("created_at").order(SortOrder.Asc)))
        .from(0)   // 偏移量
        .size(20), // 每页大小
        Order.class
);

// 翻页计算
// from = (pageNum - 1) * pageSize
// 深度分页上限：from + size <= 10000（默认 max_result_window）
```

### search_after 与 PIT

**search_after** 用于深度分页，绕过 `from + size <= 10000` 限制。

```java
// 步骤一：创建 PIT（Point In Time）
OpenPointInTimeResponse pitResponse = client.openPointInTime(
        OpenPointInTimeRequest.of(o -> o
                .index("orders")
                .keepAlive(ka -> ka.time("5m"))
        )
);
String pitId = pitResponse.id();

// 步骤二：首轮查询
SearchResponse<Order> response = client.search(s -> s
        .pit(p -> p.id(pitId).keepAlive(ka -> ka.time("5m")))
        .query(q -> q.matchAll(ma -> ma))
        .sort(sort -> sort.field(f -> f.field("order_id").order(SortOrder.Asc)))
        .sort(sort -> sort.field(f -> f.field("_shard_doc").order(SortOrder.Asc))) // 决胜字段
        .size(100),
        Order.class
);

// 步骤三：后续翻页
List<SortOptions> lastSort = response.hits().hits()
        .get(response.hits().hits().size() - 1).sort();

SearchResponse<Order> nextResponse = client.search(s -> s
        .pit(p -> p.id(pitId).keepAlive(ka -> ka.time("5m")))
        .query(q -> q.matchAll(ma -> ma))
        .sort(sort -> sort.field(f -> f.field("order_id").order(SortOrder.Asc)))
        .sort(sort -> sort.field(f -> f.field("_shard_doc").order(SortOrder.Asc)))
        .searchAfter(lastSort) // 传入上一页最后一条的 sort 值
        .size(100),
        Order.class
);

// 步骤四：关闭 PIT
client.closePointInTime(ClosePointInTimeRequest.of(c -> c.id(pitId)));
```

| 关键点 | 说明 |
|--------|------|
| 排序字段必须唯一 | 使用 `_shard_doc` 或 `_id` 作为决胜字段 |
| PIT 有效期 | 默认 5 分钟，每次查询后可续期 |
| 不支持跳页 | 只能顺序翻页，无法直接跳到第 N 页 |
| 游标状态 | 客户端维护 `search_after` 值，无服务端游标 |

### 聚合查询

```java
// --- 指标聚合：按状态统计金额总和 ---
SearchResponse<Void> response = client.search(s -> s
        .index("orders")
        .size(0) // 不返回文档，只返回聚合
        .aggregations("by_status", a -> a
                .terms(t -> t.field("status").size(10))
                .aggregations("total_amount", sa -> sa
                        .sum(sum -> sum.field("amount"))
                )
                .aggregations("avg_amount", sa -> sa
                        .avg(avg -> avg.field("amount"))
                )
        ),
        Void.class
);

// 提取聚合结果
StringTermsAggregate byStatus = response.aggregations()
        .get("by_status").sterms();
for (StringTermsBucket bucket : byStatus.buckets().array()) {
    double totalAmount = bucket.aggregations().get("total_amount").sum().value();
    double avgAmount = bucket.aggregations().get("avg_amount").avg().value();
    System.out.printf("Status: %s, Count: %d, Total: %.2f, Avg: %.2f%n",
            bucket.key(), bucket.docCount(), totalAmount, avgAmount);
}

// --- 日期直方图：按天统计 ---
SearchResponse<Void> response = client.search(s -> s
        .index("orders")
        .size(0)
        .aggregations("by_day", a -> a
                .dateHistogram(dh -> dh
                        .field("created_at")
                        .calendarInterval(CalendarInterval.Day)
                        .format("yyyy-MM-dd")
                )
                .aggregations("daily_count", sa -> sa
                        .valueCount(vc -> vc.field("order_id"))
                )
        ),
        Void.class
);

// --- 嵌套聚合：统计 + 排序 ---
SearchResponse<Void> response = client.search(s -> s
        .index("orders")
        .size(0)
        .aggregations("top_users", a -> a
                .terms(t -> t
                        .field("user_id")
                        .size(20)
                        .order(NamedValue.of("total_spent", SortOrder.Desc))
                )
                .aggregations("total_spent", sa -> sa
                        .sum(sum -> sum.field("amount"))
                )
        ),
        Void.class
);
```

| 聚合类型 | 说明 | 典型场景 |
|----------|------|---------|
| `terms` | 分组统计 | 按状态/类别分组 |
| `sum` / `avg` / `min` / `max` | 指标聚合 | 金额统计 |
| `dateHistogram` | 日期直方图 | 按天/周/月统计 |
| `range` | 范围分组 | 价格区间 |
| `nested` | 嵌套文档聚合 | 子文档统计 |
| `cardinality` | 基数（去重计数） | UV 统计 |

### 异步搜索

```java
// 提交异步搜索
SubmitAsyncSearchResponse asyncResponse = client.asyncSearch().submit(
        SubmitRequest.of(s -> s
                .index("orders")
                .query(q -> q.matchAll(ma -> ma))
                .aggregations("by_status", a -> a
                        .terms(t -> t.field("status"))
                )
                .waitForCompletionTimeout(wt -> wt.time("1s"))
                .keepAlive(ka -> ka.time("1h"))
        ),
        Order.class
);

String asyncId = asyncResponse.id();

// 查询异步搜索状态
AsyncSearchStatusResponse statusResponse = client.asyncSearch().status(
        AsyncSearchStatusRequest.of(s -> s.id(asyncId))
);

// 获取异步搜索结果
AsyncSearchGetResponse<Order> getResponse = client.asyncSearch().get(
        AsyncSearchGetRequest.of(g -> g
                .id(asyncId)
                .waitForCompletionTimeout(wt -> wt.time("30s"))
        ),
        Order.class
);

// 删除异步搜索
client.asyncSearch().delete(
        AsyncSearchDeleteRequest.of(d -> d.id(asyncId))
);
```

---

## 高级操作

### 异步客户端（ElasticsearchAsyncClient）

```java
import co.elastic.clients.elasticsearch.ElasticsearchAsyncClient;
import co.elastic.clients.elasticsearch.core.SearchResponse;
import java.util.concurrent.CompletableFuture;

ElasticsearchAsyncClient asyncClient = new ElasticsearchAsyncClient(transport);

CompletableFuture<SearchResponse<Order>> future = asyncClient.search(
        s -> s.index("orders").query(q -> q.matchAll(ma -> ma)).size(10),
        Order.class
);

future.thenAccept(response -> {
    response.hits().hits().forEach(hit -> {
        System.out.println("Order: " + hit.source().getOrderId());
    });
}).exceptionally(ex -> {
    System.err.println("Search failed: " + ex.getMessage());
    return null;
});
```

### 响应式封装

配合 Spring WebFlux / Reactor 使用：

```java
import reactor.core.publisher.Mono;
import reactor.core.publisher.Flux;

// 将异步客户端包装为 Reactor Mono
public Mono<SearchResponse<Order>> searchReactive(
        ElasticsearchAsyncClient asyncClient, String keyword) {
    return Mono.fromFuture(() ->
            asyncClient.search(s -> s
                    .index("orders")
                    .query(q -> q.match(m -> m.field("description").query(keyword)))
                    .size(10),
                    Order.class)
    );
}

// 使用示例
searchReactive(asyncClient, "headphones")
        .flatMapIterable(response -> response.hits().hits())
        .map(hit -> hit.source())
        .doOnNext(order -> System.out.println(order.getOrderId()))
        .subscribe();
```

### 连接池配置

```java
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.http.io.SocketConfig;
import org.apache.hc.core5.util.Timeout;

RestClient restClient = RestClient.builder(
        new HttpHost("es-1", 9200, "https"),
        new HttpHost("es-2", 9200, "https"),
        new HttpHost("es-3", 9200, "https")
)
    .setHttpClientConfigCallback(httpClientBuilder -> httpClientBuilder
            .setConnectionManager(
                    PoolingHttpClientConnectionManagerBuilder.create()
                            .setMaxConnTotal(200)          // 总连接数
                            .setMaxConnPerRoute(50)        // 每个路由最大连接数
                            .setDefaultSocketConfig(
                                    SocketConfig.custom()
                                            .setSoTimeout(Timeout.of(30, TimeUnit.SECONDS))
                                            .build()
                            )
                            .build()
            )
            // 连接保活策略
            .setKeepAliveStrategy((response, context) -> {
                // 默认保活 3 分钟
                return 3 * 60 * 1000;
            })
    )
    .build();
```

| 参数 | 建议值 | 推导逻辑 |
|------|--------|---------|
| `maxConnTotal` | 200 | 按峰值 QPS = 1000，平均 RT = 50ms，并发连接 ~50 计算，留 4x 余量 |
| `maxConnPerRoute` | 50 | 多节点集群，每个节点分配合理连接数 |
| `soTimeout` | 30s | 查询超时上限，按最慢查询 P99 RT 设置 |
| `keepAlive` | 3min | 避免频繁 TCP 握手 |

### 超时与重试策略

```java
RestClient restClient = RestClient.builder(
        new HttpHost("es-1", 9200, "https"),
        new HttpHost("es-2", 9200, "https")
)
    .setRequestConfigCallback(requestConfigBuilder -> requestConfigBuilder
            .setConnectTimeout(5000)          // 连接超时
            .setSocketTimeout(30000)          // 读写超时
            .setConnectionRequestTimeout(3000) // 从连接池获取连接超时
    )
    // 节点选择器：失败重试时跳过已失败的节点
    .setNodeSelector(NodeSelector.SKIP_DEDICATED_MASTERS)
    // 失败监听器
    .setFailureListener(new RestClient.FailureListener() {
        @Override
        public void onFailure(Node node) {
            // 记录失败节点，可接入监控告警
            System.err.println("Node failed: " + node.getHost());
        }
    })
    .build();
```

**重试策略最佳实践**：

```java
public <T> T executeWithRetry(ElasticsearchClient client,
                               Function<ElasticsearchClient, T> action,
                               int maxRetries) {
    int attempt = 0;
    while (true) {
        try {
            return action.apply(client);
        } catch (ElasticsearchException e) {
            if (e.status() == 429 || e.status() >= 500) {
                // 可重试：限流 / 服务端错误
                if (++attempt > maxRetries) throw e;
                long backoff = (long) Math.pow(2, attempt) * 100; // 200ms, 400ms, 800ms
                try {
                    Thread.sleep(backoff);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException(ie);
                }
            } else {
                throw e; // 4xx（除 429）不可重试
            }
        } catch (IOException e) {
            // 网络异常可重试
            if (++attempt > maxRetries) throw new RuntimeException(e);
            try {
                Thread.sleep((long) Math.pow(2, attempt) * 100);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(ie);
            }
        }
    }
}
```

### 异常处理

```java
import co.elastic.clients.elasticsearch._types.ElasticsearchException;
import co.elastic.clients.elasticsearch._types.ErrorCause;

try {
    SearchResponse<Order> response = client.search(s -> s
            .index("orders")
            .query(q -> q.match(m -> m.field("description").query("headphones")))
            .size(10),
            Order.class
    );
} catch (ElasticsearchException e) {
    // ES 服务端返回的错误
    int status = e.status();           // HTTP 状态码
    ErrorCause error = e.error();      // 详细错误信息
    System.err.printf("ES Error [%d] %s: %s%n",
            status, error.type(), error.reason());

    switch (status) {
        case 404:
            // 索引不存在
            break;
        case 429:
            // 限流，需降级或重试
            break;
        case 400:
            // 请求参数错误，检查 DSL
            break;
        default:
            break;
    }
} catch (IOException e) {
    // 网络层异常（连接超时、连接拒绝等）
    System.err.println("Network error: " + e.getMessage());
} catch (Exception e) {
    // 其他未知异常
    System.err.println("Unexpected error: " + e.getMessage());
}
```

| 异常类型 | 场景 | 处理策略 |
|----------|------|---------|
| `ElasticsearchException` (status=404) | 索引/文档不存在 | 创建索引 or 忽略 |
| `ElasticsearchException` (status=429) | 集群限流 | 指数退避重试 |
| `ElasticsearchException` (status=400) | 查询语法错误 | 修复 DSL，记录日志 |
| `IOException` | 网络中断 | 重试，切换节点 |
| `ResponseException` | 底层 HTTP 异常 | 重试，切换节点 |
| `SocketTimeoutException` | 查询超时 | 增加超时 or 优化查询 |

---

