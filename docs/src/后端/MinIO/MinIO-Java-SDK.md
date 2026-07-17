# MinIO Java SDK 知识归档

> **SDK版本**: io.minio:minio 8.5.x  
> **MinIO版本基线**: RELEASE.2025-04-22T22-12-26Z  
> **JDK要求**: Java 1.8 及以上  
> **文档来源**: MinIO 官方 Java Client API Reference  

---

## 环境搭建与MinioClient初始化

### Maven依赖

**概念定义**：通过 Maven 坐标 `io.minio:minio` 引入 MinIO Java SDK，版本 8.5.x，提供 S3 兼容的对象存储客户端能力。

**核心参数**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| groupId | Maven 组织标识 | `io.minio` |
| artifactId | 构件标识 | `minio` |
| version | SDK 版本 | `8.5.x` |

**配置示例**：

```xml
<dependency>
    <groupId>io.minio</groupId>
    <artifactId>minio</artifactId>
    <version>8.5.7</version>
</dependency>
```

**注意事项**：**MinIO Java SDK 8.5.x 内部依赖 OkHttp 4.x 作为 HTTP 传输层，无需额外声明 OkHttp 依赖。若项目中已有 OkHttp 依赖，需确保版本兼容。**

---

### MinioClient-Builder模式

**概念定义**：`MinioClient.builder()` 是创建 MinIO 客户端的唯一推荐入口，采用 Builder 模式链式配置，最终通过 `.build()` 产出 `MinioClient` 实例。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| endpoint | `String` / `URL` / `HttpUrl` | 是 | S3 服务端点，支持 `https://play.min.io` 格式 |
| credentials | `(String, String)` | 否 | accessKey 与 secretKey；匿名访问可不填 |
| region | `String` | 否 | 区域名称，如 `us-east-1`；不指定则自动探测 |
| httpClient | `OkHttpClient` | 否 | 自定义 HTTP 客户端 |

**配置示例**：

```java
// 基础认证连接
MinioClient minioClient = MinioClient.builder()
    .endpoint("https://play.min.io")
    .credentials("Q3AM3UQ867SPQQA43P2F", "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG")
    .build();

// 指定区域
MinioClient minioClient = MinioClient.builder()
    .endpoint("https://play.min.io")
    .credentials("accessKey", "secretKey")
    .region("us-east-1")
    .build();

// 自定义 HTTP 客户端
OkHttpClient customHttpClient = new OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(30, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .build();

MinioClient minioClient = MinioClient.builder()
    .endpoint("https://play.min.io")
    .credentials("accessKey", "secretKey")
    .httpClient(customHttpClient)
    .build();

// 内网非 TLS 连接
MinioClient minioClient = MinioClient.builder()
    .endpoint("http://192.168.1.100:9000")
    .credentials("minioadmin", "minioadmin")
    .build();
```

**注意事项**：**endpoint 若以 `https://` 开头则自动启用 TLS；若以 `http://` 开头则使用明文连接。端口号可内嵌在 endpoint 字符串中（如 `https://play.min.io:9000`）。**

---

### 连接池配置

**概念定义**：通过自定义 `OkHttpClient` 配置连接池大小、超时等参数，控制 MinioClient 底层 HTTP 连接行为，直接影响并发吞吐量。

**核心参数**：

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| maxIdleConnections | 最大空闲连接数 | 与最大并发数一致 |
| keepAliveDuration | 空闲连接存活时间 | 5 分钟 |
| connectTimeout | 连接超时 | 10 秒 |
| readTimeout | 读取超时 | 60 秒 |
| writeTimeout | 写入超时 | 60 秒 |

**配置示例**：

```java
OkHttpClient httpClient = new OkHttpClient.Builder()
    .connectionPool(new ConnectionPool(50, 5, TimeUnit.MINUTES))
    .connectTimeout(Duration.ofSeconds(10))
    .readTimeout(Duration.ofSeconds(60))
    .writeTimeout(Duration.ofSeconds(60))
    .build();

MinioClient minioClient = MinioClient.builder()
    .endpoint("https://play.min.io")
    .credentials("accessKey", "secretKey")
    .httpClient(httpClient)
    .build();
```

**注意事项**：**`maxIdleConnections` 建议设置为预估最大并发请求数；连接池耗尽时请求会阻塞等待，务必根据业务峰值合理配置。**

---

### 线程安全

**概念定义**：`MinioClient` 实例是线程安全的，内部通过 OkHttpClient 的连接池和请求队列保证并发安全，因此推荐全局使用单例模式。

**配置示例**：

```java
// 单例模式（Spring Bean 示例）
@Configuration
public class MinioConfig {
    @Bean
    public MinioClient minioClient() {
        return MinioClient.builder()
            .endpoint("https://play.min.io")
            .credentials("accessKey", "secretKey")
            .build();
    }
}
```

**注意事项**：**每个 `MinioClient` 实例内部维护独立连接池，创建多个实例会导致连接资源浪费和端口耗尽。在 Spring 容器中务必声明为单例 Bean。**

---

### 资源释放

**概念定义**：`minioClient.close()` 用于释放 `MinioClient` 所持有的底层 HTTP 连接池资源，通常在应用关闭时调用。

**配置示例**：

```java
// try-with-resources 模式
try (MinioClient minioClient = MinioClient.builder()
        .endpoint("https://play.min.io")
        .credentials("accessKey", "secretKey")
        .build()) {
    // 执行操作
}

// Spring 销毁回调
@PreDestroy
public void destroy() {
    minioClient.close();
}
```

**注意事项**：**`close()` 会关闭底层 OkHttpClient 的线程池和连接池，一旦关闭不可再使用该实例。长生命周期（如 Spring 单例 Bean）中应在容器关闭回调中调用。**

---

### 错误处理

**概念定义**：MinIO Java SDK 所有 API 均可能抛出 `ErrorResponseException`（S3 服务端错误）、`IOException`（I/O 错误）、`IllegalArgumentException`（参数非法）等异常，调用方必须显式捕获。

**核心参数**：

| 异常类型 | 说明 |
|----------|------|
| `ErrorResponseException` | S3 服务返回的错误响应（含 HTTP 状态码和错误信息） |
| `IllegalArgumentException` | 传入参数不合法 |
| `InsufficientDataException` | InputStream 数据不足 |
| `InternalException` | SDK 内部错误 |
| `InvalidKeyException` | 缺少 HMAC SHA-256 库 |
| `InvalidResponseException` | S3 服务返回无效或缺失错误响应 |
| `IOException` | I/O 错误 |
| `NoSuchAlgorithmException` | 缺少 MD5 或 SHA-256 摘要库 |
| `ServerException` | HTTP 服务端错误（5xx） |
| `XmlParserException` | XML 解析错误 |

**配置示例**：

```java
try {
    boolean found = minioClient.bucketExists(
        BucketExistsArgs.builder().bucket("my-bucket").build());
} catch (ErrorResponseException e) {
    System.err.println("S3 Error: " + e.errorResponse().code() 
        + " - " + e.errorResponse().message());
    System.err.println("HTTP trace: " + e.httpTrace());
} catch (Exception e) {
    System.err.println("Unexpected error: " + e.getMessage());
}
```

**注意事项**：**`ErrorResponseException` 携带 `errorResponse()` 可获取 S3 错误码、Bucket 名、Object 名等详细信息；`httpTrace()` 返回请求/响应的完整 HTTP 追踪信息，便于排查问题。**

---

## Bucket-CRUD操作

### makeBucket

**概念定义**：`makeBucket` 在 S3 服务上创建一个新的存储桶（Bucket）。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称，全局唯一，3-63 字符，仅小写字母、数字、连字符、句点 |
| region | `String` | 否 | 桶所在区域 |
| objectLock | `Boolean` | 否 | 是否启用对象锁定 |

**配置示例**：

```java
minioClient.makeBucket(
    MakeBucketArgs.builder()
        .bucket("my-bucket")
        .region("us-east-1")
        .objectLock(true)
        .build()
);
```

**注意事项**：**桶名称必须全局唯一且符合 DNS 命名规范；创建同名桶会抛出 `BucketAlreadyOwnedByYou` 异常。建议在创建前先调用 `bucketExists` 检查。**

---

### bucketExists

**概念定义**：`bucketExists` 检查指定 Bucket 是否存在，返回布尔值。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |

**配置示例**：

```java
boolean found = minioClient.bucketExists(
    BucketExistsArgs.builder().bucket("my-bucket").build()
);
if (found) {
    System.out.println("my-bucket exists");
} else {
    System.out.println("my-bucket does not exist");
}
```

**注意事项**：**无权限访问的桶也返回 `false`，不会抛出权限异常。返回值仅表示"当前凭证可访问该桶"。**

---

### listBuckets

**概念定义**：`listBuckets` 列出当前凭证下所有可访问的 Bucket 信息。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| extraHeaders | `Map<String, String>` | 否 | 额外请求头 |

**配置示例**：

```java
// 无参数
List<Bucket> bucketList = minioClient.listBuckets();
for (Bucket bucket : bucketList) {
    System.out.println(bucket.creationDate() + ", " + bucket.name());
}

// 带额外请求头
List<Bucket> bucketList = minioClient.listBuckets(
    ListBucketsArgs.builder().extraHeaders(headers).build()
);
```

**注意事项**：**返回的 `Bucket` 对象包含 `name()` 和 `creationDate()` 方法。`listBuckets()` 无参数重载为便捷方法，内部调用 `listBuckets(ListBucketsArgs.builder().build())`。**

---

### removeBucket

**概念定义**：`removeBucket` 删除一个空 Bucket。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |

**配置示例**：

```java
minioClient.removeBucket(
    RemoveBucketArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**Bucket 必须为空（无对象）才能删除，否则抛出 `BucketNotEmpty` 异常。删除前需先清空桶内所有对象。**

---

### Bucket版本控制

**概念定义**：`setBucketVersioning` / `getBucketVersioning` 管理 Bucket 级别版本控制，启用后同一对象保留所有历史版本。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `VersioningConfiguration` | 是（set） | 版本控制状态：`ENABLED` / `SUSPENDED` / `OFF` |

**配置示例**：

```java
// 启用版本控制
minioClient.setBucketVersioning(
    SetBucketVersioningArgs.builder()
        .bucket("my-bucket")
        .config(new VersioningConfiguration(VersioningConfiguration.Status.ENABLED, null))
        .build()
);

// 获取版本控制配置
VersioningConfiguration config = minioClient.getBucketVersioning(
    GetBucketVersioningArgs.builder().bucket("my-bucket").build()
);
System.out.println("Status: " + config.status());
```

**注意事项**：**版本控制一旦启用不可完全关闭，仅可切换为 `SUSPENDED`（暂停）。启用版本控制后删除对象会生成删除标记而非物理删除。**

---

### Bucket生命周期

**概念定义**：`setBucketLifecycle` / `getBucketLifecycle` / `deleteBucketLifecycle` 管理 Bucket 生命周期规则，自动执行对象过期删除或存储层级转换。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `LifecycleConfiguration` | 是（set） | 生命周期规则配置 |

**配置示例**：

```java
// 设置生命周期规则：30天后删除
LifecycleRule rule = new LifecycleRule(
    Status.ENABLED,
    null,
    new Expiration((ZonedDateTime) null, 30, null),
    new RuleFilter("logs/"),
    "rule-1",
    null,
    null,
    null
);
LifecycleConfiguration config = new LifecycleConfiguration(Arrays.asList(rule));

minioClient.setBucketLifecycle(
    SetBucketLifecycleArgs.builder()
        .bucket("my-bucket")
        .config(config)
        .build()
);

// 获取生命周期配置
LifecycleConfiguration config = minioClient.getBucketLifecycle(
    GetBucketLifecycleArgs.builder().bucket("my-bucket").build()
);

// 删除生命周期配置
minioClient.deleteBucketLifecycle(
    DeleteBucketLifecycleArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**生命周期规则中的 `RuleFilter` 支持 `prefix` 和 `tag` 过滤；`Expiration` 支持按天数（`days`）或指定日期（`date`）。**

---

### Bucket策略

**概念定义**：`setBucketPolicy` / `getBucketPolicy` / `deleteBucketPolicy` 管理 Bucket 的 IAM 访问策略（JSON 格式）。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `String` | 是（set） | JSON 格式的策略字符串 |

**配置示例**：

```java
// 设置公开读策略
String policy = "{\"Version\":\"2012-10-17\","
    + "\"Statement\":[{\"Effect\":\"Allow\","
    + "\"Principal\":{\"AWS\":[\"*\"]},"
    + "\"Action\":[\"s3:GetObject\"],"
    + "\"Resource\":[\"arn:aws:s3:::my-bucket/*\"]}]}";

minioClient.setBucketPolicy(
    SetBucketPolicyArgs.builder()
        .bucket("my-bucket")
        .config(policy)
        .build()
);

// 获取桶策略
String policy = minioClient.getBucketPolicy(
    GetBucketPolicyArgs.builder().bucket("my-bucket").build()
);

// 删除桶策略
minioClient.deleteBucketPolicy(
    DeleteBucketPolicyArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**策略 JSON 必须符合 AWS IAM Policy 语法。删除策略后桶恢复为默认私有访问。**

---

### Bucket加密

**概念定义**：`setBucketEncryption` / `getBucketEncryption` / `deleteBucketEncryption` 管理 Bucket 级别的默认服务端加密（SSE）配置。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `SseConfiguration` | 是（set） | SSE 配置 |

**配置示例**：

```java
// 设置 SSE-S3 默认加密
SseConfiguration sseConfig = new SseConfiguration(
    SseConfiguration.Rule.newSseS3Rule()
);
minioClient.setBucketEncryption(
    SetBucketEncryptionArgs.builder()
        .bucket("my-bucket")
        .config(sseConfig)
        .build()
);

// 获取加密配置
SseConfiguration config = minioClient.getBucketEncryption(
    GetBucketEncryptionArgs.builder().bucket("my-bucket").build()
);

// 删除加密配置
minioClient.deleteBucketEncryption(
    DeleteBucketEncryptionArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**桶加密配置仅影响未指定 `sse` 参数的上传操作；若 PutObject 时显式指定了 SSE，则以对象级别 SSE 为准。**

---

### Bucket复制

**概念定义**：`setBucketReplication` / `getBucketReplication` / `deleteBucketReplication` 管理 Bucket 跨区域复制（CRR）规则。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `ReplicationConfiguration` | 是（set） | 复制规则配置 |

**配置示例**：

```java
ReplicationRule rule = new ReplicationRule(
    new DeleteMarkerReplication(Status.ENABLED),
    null,
    new ReplicationDestination(null, null, "arn:aws:s3:::dest-bucket", null, null, null),
    null,
    null,
    new RuleFilter(""),
    "rule-1",
    1,
    null,
    Status.ENABLED,
    null
);
ReplicationConfiguration config = new ReplicationConfiguration("replication-role-arn", Arrays.asList(rule));

minioClient.setBucketReplication(
    SetBucketReplicationArgs.builder()
        .bucket("my-bucket")
        .config(config)
        .build()
);
```

**注意事项**：**复制功能需要源桶和目标桶均启用版本控制；目标桶必须位于不同区域。配置中的 `role` 需有足够的 S3 复制权限。**

---

### Bucket事件通知

**概念定义**：`setBucketNotification` / `getBucketNotification` / `deleteBucketNotification` 管理 Bucket 事件通知配置，将对象事件发送到指定的 SQS、SNS 或 Lambda 目标。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `NotificationConfiguration` | 是（set） | 通知配置 |

**配置示例**：

```java
NotificationConfiguration config = new NotificationConfiguration();
// 配置 SQS 队列通知
config.setQueueConfigurationList(Arrays.asList(
    new QueueConfiguration(
        "arn:aws:sqs:us-east-1:123456789012:my-queue",
        Arrays.asList("s3:ObjectCreated:*"),
        new Filter(new S3Key(Arrays.asList(new FilterRule("prefix", "images/"))), null)
    )
));

minioClient.setBucketNotification(
    SetBucketNotificationArgs.builder()
        .bucket("my-bucket")
        .config(config)
        .build()
);

// 获取通知配置
NotificationConfiguration config = minioClient.getBucketNotification(
    GetBucketNotificationArgs.builder().bucket("my-bucket").build()
);

// 删除通知配置
minioClient.deleteBucketNotification(
    DeleteBucketNotificationArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**MinIO 支持的事件通知目标包括 Kafka、NATS、MySQL、PostgreSQL、Redis、Elasticsearch、Webhook 等；事件类型如 `s3:ObjectCreated:*`、`s3:ObjectRemoved:*` 等。**

---

### Bucket标签

**概念定义**：`setBucketTags` / `getBucketTags` / `deleteBucketTags` 管理 Bucket 级别标签（键值对），用于成本分摊、访问控制等。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| tags | `Tags` | 是（set） | 标签集合 |

**配置示例**：

```java
// 设置标签
Map<String, String> map = new HashMap<>();
map.put("Project", "MyProject");
map.put("Environment", "Production");
minioClient.setBucketTags(
    SetBucketTagsArgs.builder().bucket("my-bucket").tags(map).build()
);

// 获取标签
Tags tags = minioClient.getBucketTags(
    GetBucketTagsArgs.builder().bucket("my-bucket").build()
);

// 删除标签
minioClient.deleteBucketTags(
    DeleteBucketTagsArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**每个 Bucket 最多 10 个标签；标签键和值区分大小写。**

---

### Bucket对象锁定配置

**概念定义**：`setObjectLockConfiguration` / `getObjectLockConfiguration` / `deleteObjectLockConfiguration` 管理 Bucket 级别的对象锁定（WORM）默认配置。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| config | `ObjectLockConfiguration` | 是（set） | 锁定配置，含 `mode` 和 `duration` |

**配置示例**：

```java
// 设置默认保留策略（GOVERNANCE 模式，30天）
ObjectLockConfiguration config = new ObjectLockConfiguration(
    RetentionMode.GOVERNANCE,
    new RetentionDurationDays(30)
);
minioClient.setObjectLockConfiguration(
    SetObjectLockConfigurationArgs.builder()
        .bucket("my-bucket")
        .config(config)
        .build()
);

// 获取配置
ObjectLockConfiguration config = minioClient.getObjectLockConfiguration(
    GetObjectLockConfigurationArgs.builder().bucket("my-bucket").build()
);
System.out.println("Mode: " + config.mode());
System.out.println("Duration: " + config.duration().duration() + " " + config.duration().unit());

// 删除配置
minioClient.deleteObjectLockConfiguration(
    DeleteObjectLockConfigurationArgs.builder().bucket("my-bucket").build()
);
```

**注意事项**：**对象锁定必须在创建 Bucket 时启用 `objectLock(true)`；`RetentionMode` 有 `GOVERNANCE` 和 `COMPLIANCE` 两种模式，后者不可被任何用户覆盖。**

---

## Object-CRUD操作

### putObject

**概念定义**：`putObject` 上传对象到指定 Bucket，支持 InputStream、本地文件路径、已知大小、未知大小等多种模式。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名（路径） |
| stream | `InputStream` | 是（stream模式） | 输入流 |
| objectSize | `long` | 是（stream模式） | 对象大小（-1 表示未知） |
| partSize | `long` | 是（stream模式） | 分片大小（-1 表示不指定） |
| filename | `String` | 是（file模式） | 本地文件路径 |
| contentType | `String` | 否 | 内容类型 |
| headers | `Map<String, String>` | 否 | 自定义请求头 |
| userMetadata | `Map<String, String>` | 否 | 用户自定义元数据 |
| sse | `ServerSideEncryption` | 否 | 服务端加密方式 |

**配置示例**：

```java
// 已知大小上传
try (InputStream is = new FileInputStream("/path/to/file.txt")) {
    minioClient.putObject(
        PutObjectArgs.builder()
            .bucket("my-bucket")
            .object("path/to/file.txt")
            .stream(is, file.length(), -1)
            .contentType("text/plain")
            .build()
    );
}

// 未知大小上传（自动分片，使用自定义 partSize 5MB）
try (InputStream is = new FileInputStream("/path/to/large-file.bin")) {
    minioClient.putObject(
        PutObjectArgs.builder()
            .bucket("my-bucket")
            .object("path/to/large-file.bin")
            .stream(is, -1, 5 * 1024 * 1024)  // objectSize=-1, partSize=5MB
            .build()
    );
}

// 本地文件上传（便捷方法）
minioClient.uploadObject(
    UploadObjectArgs.builder()
        .bucket("my-bucket")
        .object("path/to/file.zip")
        .filename("/home/user/file.zip")
        .build()
);

// 带元数据和 SSE 加密上传
Map<String, String> userMetadata = new HashMap<>();
userMetadata.put("author", "John");
userMetadata.put("version", "1.0");

try (InputStream is = new FileInputStream("/path/to/file.txt")) {
    minioClient.putObject(
        PutObjectArgs.builder()
            .bucket("my-bucket")
            .object("secure/file.txt")
            .stream(is, file.length(), -1)
            .userMetadata(userMetadata)
            .sse(ServerSideEncryptionS3.withManagedKeys())
            .build()
    );
}

// 上传目录（创建空目录占位符）
minioClient.putObject(
    PutObjectArgs.builder()
        .bucket("my-bucket")
        .object("folder/")
        .stream(new ByteArrayInputStream(new byte[]{}), 0, -1)
        .build()
);
```

**注意事项**：**`objectSize=-1` 时 SDK 自动缓冲并进行分片上传，适用于无法预知大小的流；`partSize` 建议 5MB-5GB（最小 5MB，最大 5GiB）。`objectSize` 已知时建议明确指定，避免额外内存开销。上传目录时对象键以 `/` 结尾即可。**

---

### getObject

**概念定义**：`getObject` 下载对象，返回 `GetObjectResponse`（继承自 `InputStream`），支持范围读取和版本控制。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| offset | `Long` | 否 | 起始字节偏移 |
| length | `Long` | 否 | 读取字节数 |
| versionId | `String` | 否 | 指定版本ID |
| ssec | `ServerSideEncryptionCustomerKey` | 否 | SSE-C 解密密钥 |

**配置示例**：

```java
// 基础下载
try (GetObjectResponse response = minioClient.getObject(
        GetObjectArgs.builder()
            .bucket("my-bucket")
            .object("path/to/file.txt")
            .build()
    )) {
    byte[] content = response.readAllBytes();
    // 或写入文件
    Files.copy(response, Paths.get("/local/path/file.txt"));
}

// 范围下载（字节 0-1023）
try (GetObjectResponse response = minioClient.getObject(
        GetObjectArgs.builder()
            .bucket("my-bucket")
            .object("path/to/file.txt")
            .offset(0L)
            .length(1024L)
            .build()
    )) {
    // 处理分片数据
}

// 下载指定版本
try (GetObjectResponse response = minioClient.getObject(
        GetObjectArgs.builder()
            .bucket("my-bucket")
            .object("path/to/file.txt")
            .versionId("version-uuid")
            .build()
    )) {
    // 处理版本数据
}
```

**注意事项**：**`GetObjectResponse` 必须使用 try-with-resources 确保连接释放；`offset` 和 `length` 配合实现 HTTP Range 请求，可用于断点续传下载。**

---

### removeObject/removeObjects

**概念定义**：`removeObject` 删除单个对象；`removeObjects` 批量删除多个对象。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是（单对象） | 对象键名 |
| objects | `Iterable<DeleteObject>` | 是（批量） | 待删除对象列表 |
| versionId | `String` | 否 | 删除指定版本 |
| bypassGovernance | `Boolean` | 否 | 绕过 Governance 保留模式 |

**配置示例**：

```java
// 删除单个对象
minioClient.removeObject(
    RemoveObjectArgs.builder()
        .bucket("my-bucket")
        .object("path/to/file.txt")
        .build()
);

// 删除指定版本
minioClient.removeObject(
    RemoveObjectArgs.builder()
        .bucket("my-bucket")
        .object("path/to/file.txt")
        .versionId("version-uuid")
        .build()
);

// 批量删除
List<DeleteObject> objects = Arrays.asList(
    new DeleteObject("file1.txt"),
    new DeleteObject("file2.txt"),
    new DeleteObject("file3.txt")
);
Iterable<Result<DeleteError>> results = minioClient.removeObjects(
    RemoveObjectsArgs.builder()
        .bucket("my-bucket")
        .objects(objects)
        .build()
);
for (Result<DeleteError> result : results) {
    DeleteError error = result.get();
    System.out.println("Failed to delete: " + error.objectName() + " - " + error.message());
}
```

**注意事项**：**在未启用版本控制的 Bucket 中，`removeObject` 直接物理删除对象。启用版本控制后，不指定 `versionId` 则创建删除标记，指定 `versionId` 则永久删除该版本。批量删除没有事务性保证。**

---

### listObjects

**概念定义**：`listObjects` 列出 Bucket 中对象，支持前缀过滤、分隔符（模拟目录层级）、分页。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| prefix | `String` | 否 | 对象键前缀过滤 |
| delimiter | `String` | 否 | 分隔符（`/` 模拟目录） |
| maxKeys | `int` | 否 | 每页最大返回数（默认 1000） |
| startAfter | `String` | 否 | 起始对象键（分页游标） |
| recursive | `Boolean` | 否 | 是否递归（默认 true） |
| includeUserMetadata | `Boolean` | 否 | 是否包含用户元数据 |
| includeVersions | `Boolean` | 否 | 是否包含历史版本 |

**配置示例**：

```java
// 列出所有对象
Iterable<Result<Item>> results = minioClient.listObjects(
    ListObjectsArgs.builder()
        .bucket("my-bucket")
        .build()
);
for (Result<Item> result : results) {
    Item item = result.get();
    System.out.println(item.objectName() + " - " + item.size());
}

// 按前缀过滤 + 分页
Iterable<Result<Item>> results = minioClient.listObjects(
    ListObjectsArgs.builder()
        .bucket("my-bucket")
        .prefix("logs/2025/")
        .maxKeys(100)
        .startAfter("logs/2025/01/01/")
        .build()
);

// 模拟目录层级（非递归）
Iterable<Result<Item>> results = minioClient.listObjects(
    ListObjectsArgs.builder()
        .bucket("my-bucket")
        .delimiter("/")
        .recursive(false)  // 仅返回当前层级
        .build()
);
for (Result<Item> result : results) {
    Item item = result.get();
    if (item.isDir()) {
        System.out.println("Dir: " + item.objectName());
    } else {
        System.out.println("File: " + item.objectName());
    }
}

// 包含版本
Iterable<Result<Item>> results = minioClient.listObjects(
    ListObjectsArgs.builder()
        .bucket("my-bucket")
        .includeVersions(true)
        .build()
);
```

**注意事项**：**`listObjects` 返回懒加载迭代器，实时从服务端拉取数据；`delimiter="/"` 配合 `recursive=false` 模拟传统文件系统目录层级；大量对象时注意 `maxKeys` 分页控制内存。**

---

### copyObject

**概念定义**：`copyObject` 在桶内或跨桶复制对象，服务端操作，无需下载再上传。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 目标桶名称 |
| object | `String` | 是 | 目标对象键名 |
| source | `CopySource` | 是 | 源对象标识 |
| metadataDirective | `Directive` | 否 | 元数据复制策略（`COPY`/`REPLACE`） |
| sse | `ServerSideEncryption` | 否 | 目标对象加密方式 |

**配置示例**：

```java
// 桶内复制
minioClient.copyObject(
    CopyObjectArgs.builder()
        .bucket("my-bucket")
        .object("destination/file.txt")
        .source(CopySource.builder()
            .bucket("my-bucket")
            .object("source/file.txt")
            .build())
        .build()
);

// 跨桶复制 + 替换元数据
Map<String, String> userMetadata = new HashMap<>();
userMetadata.put("copied", "true");

minioClient.copyObject(
    CopyObjectArgs.builder()
        .bucket("dest-bucket")
        .object("copied-file.txt")
        .source(CopySource.builder()
            .bucket("source-bucket")
            .object("original-file.txt")
            .build())
        .metadataDirective(Directive.REPLACE)
        .userMetadata(userMetadata)
        .build()
);
```

**注意事项**：**对象大小超过 5GB 时 SDK 自动使用 Multipart Copy；`Directive.COPY` 保留源对象元数据，`Directive.REPLACE` 使用新元数据。**

---

### statObject

**概念定义**：`statObject` 获取对象元数据（大小、ETag、最后修改时间、Content-Type 等），不下载对象内容。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| versionId | `String` | 否 | 指定版本ID |

**配置示例**：

```java
StatObjectResponse stat = minioClient.statObject(
    StatObjectArgs.builder()
        .bucket("my-bucket")
        .object("path/to/file.txt")
        .build()
);

System.out.println("Size: " + stat.size());
System.out.println("ETag: " + stat.etag());
System.out.println("ContentType: " + stat.contentType());
System.out.println("LastModified: " + stat.lastModified());
System.out.println("UserMetadata: " + stat.userMetadata());
```

**注意事项**：**`StatObjectResponse` 提供 `size()`、`etag()`、`contentType()`、`lastModified()`、`userMetadata()`、`versionId()` 等方法；若对象不存在抛出 `ErrorResponseException`。**

---

### Object标签

**概念定义**：`setObjectTags` / `getObjectTags` / `deleteObjectTags` 管理对象级别标签，用于分类、生命周期规则匹配等。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| tags | `Tags` | 是（set） | 标签集合 |
| versionId | `String` | 否 | 指定版本 |

**配置示例**：

```java
// 设置标签
Map<String, String> map = new HashMap<>();
map.put("Status", "Archived");
map.put("Department", "Finance");
minioClient.setObjectTags(
    SetObjectTagsArgs.builder()
        .bucket("my-bucket")
        .object("report.pdf")
        .tags(map)
        .build()
);

// 获取标签
Tags tags = minioClient.getObjectTags(
    GetObjectTagsArgs.builder()
        .bucket("my-bucket")
        .object("report.pdf")
        .build()
);

// 删除标签
minioClient.deleteObjectTags(
    DeleteObjectTagsArgs.builder()
        .bucket("my-bucket")
        .object("report.pdf")
        .build()
);
```

**注意事项**：**每个对象最多 10 个标签；更新标签时会覆盖全部现有标签（非增量更新）。**

---

### Object保留策略

**概念定义**：`setObjectRetention` / `getObjectRetention` 管理对象级别的保留策略（WORM），支持 GOVERNANCE 和 COMPLIANCE 两种模式。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| config | `Retention` | 是（set） | 保留配置（mode + retainUntilDate） |
| bypassGovernance | `Boolean` | 否 | 是否绕过 Governance 模式 |

**配置示例**：

```java
// 设置保留至指定日期
ZonedDateTime retainUntil = ZonedDateTime.now().plusDays(365);
minioClient.setObjectRetention(
    SetObjectRetentionArgs.builder()
        .bucket("my-bucket")
        .object("legal-doc.pdf")
        .config(new Retention(RetentionMode.GOVERNANCE, retainUntil))
        .build()
);

// 获取保留策略
Retention retention = minioClient.getObjectRetention(
    GetObjectRetentionArgs.builder()
        .bucket("my-bucket")
        .object("legal-doc.pdf")
        .build()
);
System.out.println("Mode: " + retention.mode());
System.out.println("Retain Until: " + retention.retainUntilDate());
```

**注意事项**：**Bucket 必须启用对象锁定；`COMPLIANCE` 模式下保留期不可被任何用户缩短或删除。**

---

### Object依法保留

**概念定义**：`enableObjectLegalHold` / `disableObjectLegalHold` / `isObjectLegalHoldEnabled` 管理对象级别的依法保留（Legal Hold），防止对象被删除或修改。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| versionId | `String` | 否 | 指定版本 |

**配置示例**：

```java
// 启用依法保留
minioClient.enableObjectLegalHold(
    EnableObjectLegalHoldArgs.builder()
        .bucket("my-bucket")
        .object("legal-doc.pdf")
        .build()
);

// 检查依法保留状态
boolean enabled = minioClient.isObjectLegalHoldEnabled(
    IsObjectLegalHoldEnabledArgs.builder()
        .bucket("my-bucket")
        .object("legal-doc.pdf")
        .build()
);

// 禁用依法保留
minioClient.disableObjectLegalHold(
    DisableObjectLegalHoldArgs.builder()
        .bucket("my-bucket")
        .object("legal-doc.pdf")
        .build()
);
```

**注意事项**：**Legal Hold 是独立于保留策略的 WORM 机制；启用后对象无法被删除或覆盖，直到显式移除 Legal Hold。Bucket 必须启用对象锁定。**

---

## 分片上传与断点续传

### 自动分片上传

**概念定义**：`PutObjectArgs.stream(stream, -1, partSize)` 中 `objectSize=-1` 时 SDK 自动将流数据缓冲并分片上传，适用于无法预知大小的流式数据源。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| stream | `InputStream` | 是 | 输入流 |
| objectSize | `long` | 是 | `-1` 表示未知大小 |
| partSize | `long` | 是 | 分片大小（字节），最小 5MB，最大 5GiB |

**配置示例**：

```java
// 自动分片上传（每片 10MB）
try (InputStream is = new BufferedInputStream(new FileInputStream("large-file.zip"))) {
    minioClient.putObject(
        PutObjectArgs.builder()
            .bucket("my-bucket")
            .object("large-file.zip")
            .stream(is, -1, 10 * 1024 * 1024)  // 10MB partSize
            .contentType("application/zip")
            .build()
    );
}
```

**注意事项**：**`objectSize=-1` 时 SDK 将数据缓冲到内存中再分片，可能导致内存占用较高；适合流式数据源（如 HTTP 请求体），但不推荐用于超大文件。已知大小的文件应明确指定 `objectSize`。**

---

### 手动分片上传

**概念定义**：通过 `createMultipartUpload` → `uploadPart` → `completeMultipartUpload` 三步实现手动控制的分片上传，支持并行上传和断点续传。

**核心参数**：

| API | 参数 | 说明 |
|-----|------|------|
| `createMultipartUpload` | bucket, object, headers, sse | 初始化分片上传，返回 uploadId |
| `uploadPart` | bucket, object, uploadId, partNumber, stream, partSize | 上传单个分片，返回 Part 对象（含 ETag） |
| `completeMultipartUpload` | bucket, object, uploadId, parts | 合并所有分片 |
| `abortMultipartUpload` | bucket, object, uploadId | 取消分片上传 |

**配置示例**：

```java
// 1. 初始化分片上传
String uploadId = minioClient.createMultipartUpload(
    CreateMultipartUploadArgs.builder()
        .bucket("my-bucket")
        .object("large-file.bin")
        .build()
).result().uploadId();

// 2. 上传分片
int partSize = 5 * 1024 * 1024; // 5MB
File file = new File("large-file.bin");
long fileSize = file.length();
int partCount = (int) Math.ceil((double) fileSize / partSize);

List<Part> parts = new ArrayList<>();
for (int partNumber = 1; partNumber <= partCount; partNumber++) {
    long startByte = (partNumber - 1L) * partSize;
    long endByte = Math.min(startByte + partSize, fileSize) - 1;
    long currentPartSize = endByte - startByte + 1;

    try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
        raf.seek(startByte);
        byte[] buffer = new byte[(int) currentPartSize];
        raf.readFully(buffer);

        UploadPartResponse uploadPartResponse = minioClient.uploadPart(
            UploadPartArgs.builder()
                .bucket("my-bucket")
                .object("large-file.bin")
                .uploadId(uploadId)
                .partNumber(partNumber)
                .stream(new ByteArrayInputStream(buffer), currentPartSize, -1)
                .build()
        );
        parts.add(new Part(partNumber, uploadPartResponse.etag()));
    }
}

// 3. 合并分片
minioClient.completeMultipartUpload(
    CompleteMultipartUploadArgs.builder()
        .bucket("my-bucket")
        .object("large-file.bin")
        .uploadId(uploadId)
        .parts(parts.toArray(new Part[0]))
        .build()
);
```

**注意事项**：**分片编号从 1 开始，必须连续；`completeMultipartUpload` 中 `parts` 必须按 `partNumber` 升序排列；除最后一个分片外，每个分片至少 5MB。单次上传最多 10000 个分片。并行上传分片可显著提升吞吐量。**

---

### 取消分片上传

**概念定义**：`abortMultipartUpload` 取消进行中的分片上传，释放已上传的分片存储空间。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| uploadId | `String` | 是 | 分片上传ID |

**配置示例**：

```java
minioClient.abortMultipartUpload(
    AbortMultipartUploadArgs.builder()
        .bucket("my-bucket")
        .object("large-file.bin")
        .uploadId("upload-id-string")
        .build()
);
```

**注意事项**：**取消后已上传的分片数据会被删除且不可恢复。建议在异常处理中调用 `abortMultipartUpload` 清理未完成的分片上传，避免存储浪费。**

---

### 列出分片上传

**概念定义**：`listMultipartUploads` 列出 Bucket 中所有未完成的分片上传，用于发现和清理遗留的分片上传。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| prefix | `String` | 否 | 对象键前缀过滤 |
| delimiter | `String` | 否 | 分隔符 |
| maxUploads | `int` | 否 | 最大返回数（默认 1000） |
| keyMarker | `String` | 否 | 分页标记 |
| uploadIdMarker | `String` | 否 | 分页标记 |

**配置示例**：

```java
Iterable<Result<Upload>> results = minioClient.listMultipartUploads(
    ListMultipartUploadsArgs.builder()
        .bucket("my-bucket")
        .prefix("large-files/")
        .maxUploads(100)
        .build()
);

for (Result<Upload> result : results) {
    Upload upload = result.get();
    System.out.println("Object: " + upload.objectName());
    System.out.println("UploadId: " + upload.uploadId());
    System.out.println("Initiated: " + upload.initiated());
}
```

**注意事项**：**未完成的分片上传会持续占用存储空间，建议定期清理超过一定时间的遗留分片上传。**

---

## 预签名URL操作

### getPresignedObjectUrl

**概念定义**：`getPresignedObjectUrl` 生成预签名 URL，允许持有人在不持有凭证的情况下执行指定 HTTP 方法（GET/PUT/HEAD）访问对象，URL 有时效性。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| method | `Method` | 是 | HTTP 方法（`GET`/`PUT`/`HEAD`/`DELETE`） |
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| expiry | `(int, TimeUnit)` | 是 | 过期时间，最大 7 天 |
| versionId | `String` | 否 | 指定版本ID |
| extraQueryParams | `Map<String, String>` | 否 | 额外查询参数（如 `response-content-type`） |

**配置示例**：

```java
// 生成下载预签名 URL（2小时有效）
String downloadUrl = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.GET)
        .bucket("my-bucket")
        .object("path/to/file.pdf")
        .expiry(2, TimeUnit.HOURS)
        .build()
);

// 生成上传预签名 URL（1小时有效）
String uploadUrl = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.PUT)
        .bucket("my-bucket")
        .object("path/to/upload.pdf")
        .expiry(1, TimeUnit.HOURS)
        .build()
);

// 带额外查询参数（控制响应行为）
Map<String, String> queryParams = new HashMap<>();
queryParams.put("response-content-type", "application/octet-stream");
queryParams.put("response-content-disposition", "attachment; filename=\"download.pdf\"");

String url = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.GET)
        .bucket("my-bucket")
        .object("path/to/file.pdf")
        .expiry(2, TimeUnit.HOURS)
        .extraQueryParams(queryParams)
        .build()
);

// 指定版本
String versionedUrl = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.GET)
        .bucket("my-bucket")
        .object("path/to/file.txt")
        .versionId("version-uuid")
        .expiry(1, TimeUnit.HOURS)
        .build()
);
```

**注意事项**：**预签名 URL 有效期满后返回 403 错误；最大有效期 7 天（604800 秒）；URL 中包含签名信息，应通过 HTTPS 传输避免泄露。`extraQueryParams` 可覆盖 `response-content-type`、`response-content-disposition` 等响应头。**

---

## 对象组合

### composeObject

**概念定义**：`composeObject` 将多个源对象在服务端合并为一个目标对象，无需下载再上传，适用于日志合并、文件拼接等场景。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 目标桶名称 |
| object | `String` | 是 | 目标对象键名 |
| sources | `List<ComposeSource>` | 是 | 源对象列表（至少 1 个） |
| sse | `ServerSideEncryption` | 否 | 目标对象加密方式 |

**配置示例**：

```java
// 合并多个对象
List<ComposeSource> sources = Arrays.asList(
    ComposeSource.builder()
        .bucket("my-bucket")
        .object("logs/part-001.log")
        .build(),
    ComposeSource.builder()
        .bucket("my-bucket")
        .object("logs/part-002.log")
        .build(),
    ComposeSource.builder()
        .bucket("my-bucket")
        .object("logs/part-003.log")
        .build()
);

minioClient.composeObject(
    ComposeObjectArgs.builder()
        .bucket("my-bucket")
        .object("logs/combined.log")
        .sources(sources)
        .build()
);

// 指定源对象范围
ComposeSource source = ComposeSource.builder()
    .bucket("my-bucket")
    .object("large-file.bin")
    .offset(1024L)          // 起始偏移
    .length(1024 * 1024L)   // 读取长度
    .build();

minioClient.composeObject(
    ComposeObjectArgs.builder()
        .bucket("my-bucket")
        .object("extracted-chunk.bin")
        .sources(Collections.singletonList(source))
        .build()
);
```

**注意事项**：**源对象和目标对象必须在同一 Bucket 或至少同一区域；单个 `composeObject` 最多合并 1000 个源对象；每个源对象大小建议在 5MB 以上（除最后一个）。目标对象超过 5GB 时 SDK 自动使用 Multipart 方式。**

---

## SQL-SELECT查询

### selectObjectContent

**概念定义**：`selectObjectContent` 使用 SQL 表达式直接在服务端查询对象内容（CSV/JSON/Parquet），仅返回匹配的行，减少数据传输量。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| object | `String` | 是 | 对象键名 |
| sqlExpression | `String` | 是 | SQL 查询表达式 |
| inputSerialization | `InputSerialization` | 是 | 输入格式（CSV/JSON/Parquet） |
| outputSerialization | `OutputSerialization` | 是 | 输出格式（CSV/JSON） |
| requestProgress | `Boolean` | 否 | 是否启用进度通知 |

**配置示例**：

```java
// CSV 查询
String sql = "SELECT s._1, s._2, s._3 FROM S3Object s WHERE s._3 > 100";

InputSerialization is = InputSerialization.csv(
    CSVInput.builder()
        .fileHeaderInfo(FileHeaderInfo.USE)
        .allowQuotedRecordDelimiter(true)
        .build()
);
OutputSerialization os = OutputSerialization.csv(
    CSVOutput.builder()
        .quoteFields(QuoteFields.ASNEEDED)
        .build()
);

SelectResponseStream response = minioClient.selectObjectContent(
    SelectObjectContentArgs.builder()
        .bucket("my-bucket")
        .object("data.csv")
        .sqlExpression(sql)
        .inputSerialization(is)
        .outputSerialization(os)
        .build()
);

// 读取结果
byte[] result = response.readAllBytes();
System.out.println(new String(result));

// JSON 查询
String jsonSql = "SELECT s.name, s.age FROM S3Object[*].persons[*] s WHERE s.age > 18";

InputSerialization jsonIs = InputSerialization.json(
    JSONInput.builder().type(JSONType.DOCUMENT).build()
);
OutputSerialization jsonOs = OutputSerialization.json(
    JSONOutput.builder().recordDelimiter("\n").build()
);

SelectResponseStream jsonResponse = minioClient.selectObjectContent(
    SelectObjectContentArgs.builder()
        .bucket("my-bucket")
        .object("data.json")
        .sqlExpression(jsonSql)
        .inputSerialization(jsonIs)
        .outputSerialization(jsonOs)
        .build()
);
```

**注意事项**：**SQL 查询中表名固定为 `S3Object`，CSV 列引用为 `_1`、`_2` 等（无表头时）或使用列名（有表头时）；JSON 路径使用 `S3Object[*].key` 语法；Parquet 输入支持列名直接引用。仅在 MinIO 企业版和 AWS S3 中可用。**

---

## 事件监听

### listenBucketNotification

**概念定义**：`listenBucketNotification` 监听 Bucket 对象事件（创建、删除、访问等），返回 `CloseableIterator`，实时推送事件通知。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bucket | `String` | 是 | 桶名称 |
| prefix | `String` | 否 | 对象键前缀过滤 |
| suffix | `String` | 否 | 对象键后缀过滤 |
| events | `String[]` | 否 | 事件类型过滤 |

**配置示例**：

```java
// 监听指定前缀和事件类型
String[] events = {
    "s3:ObjectCreated:*",
    "s3:ObjectRemoved:*"
};

try (CloseableIterator<Result<NotificationRecords>> iterator = minioClient.listenBucketNotification(
        ListenBucketNotificationArgs.builder()
            .bucket("my-bucket")
            .prefix("uploads/")
            .suffix(".jpg")
            .events(events)
            .build()
    )) {
    while (iterator.hasNext()) {
        NotificationRecords records = iterator.next().get();
        for (Event event : records.events()) {
            System.out.println("Event: " + event.eventType());
            System.out.println("Object: " + event.objectName());
            System.out.println("Time: " + event.eventTime());
        }
    }
}
```

**注意事项**：**`CloseableIterator` 必须使用 try-with-resources 确保网络资源释放；事件监听依赖于 MinIO 服务端的事件通知配置（如 Kafka、NATS、Webhook 等）。事件类型包括 `s3:ObjectCreated:Put`、`s3:ObjectCreated:CompleteMultipartUpload`、`s3:ObjectRemoved:Delete` 等。**

---

## 加密操作

### SSE-S3

**概念定义**：`ServerSideEncryptionS3` 使用 MinIO/S3 服务管理的密钥进行服务端加密（SSE-S3），对象在写入时由服务端自动加密，读取时自动解密。

**核心参数**：

| 参数 | 说明 |
|------|------|
| 无额外参数 | 使用 `ServerSideEncryptionS3.withManagedKeys()` 创建实例 |

**配置示例**：

```java
// 上传时启用 SSE-S3 加密
minioClient.putObject(
    PutObjectArgs.builder()
        .bucket("my-bucket")
        .object("encrypted-file.txt")
        .stream(inputStream, fileSize, -1)
        .sse(ServerSideEncryptionS3.withManagedKeys())
        .build()
);

// 复制时启用 SSE-S3 加密
minioClient.copyObject(
    CopyObjectArgs.builder()
        .bucket("my-bucket")
        .object("encrypted-copy.txt")
        .source(CopySource.builder()
            .bucket("my-bucket")
            .object("original.txt")
            .build())
        .sse(ServerSideEncryptionS3.withManagedKeys())
        .build()
);
```

**注意事项**：**SSE-S3 是最简单的加密方式，无需管理密钥；MinIO 自动使用 KMS 管理加密密钥；下载时无须指定解密参数，服务端自动解密。**

---

### SSE-C

**概念定义**：`ServerSideEncryptionCustomerKey` 使用客户提供的密钥进行服务端加密（SSE-C），服务端使用该密钥加密/解密，但密钥本身不存储。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| key | `byte[]` | 是 | 256 位（32 字节）AES 密钥 |

**配置示例**：

```java
// 生成 256 位密钥
KeyGenerator keyGen = KeyGenerator.getInstance("AES");
keyGen.init(256);
SecretKey secretKey = keyGen.generateKey();

// 上传时使用 SSE-C 加密
minioClient.putObject(
    PutObjectArgs.builder()
        .bucket("my-bucket")
        .object("sse-c-file.txt")
        .stream(inputStream, fileSize, -1)
        .sse(new ServerSideEncryptionCustomerKey(secretKey.getEncoded()))
        .build()
);

// 下载时提供 SSE-C 密钥解密
try (GetObjectResponse response = minioClient.getObject(
        GetObjectArgs.builder()
            .bucket("my-bucket")
            .object("sse-c-file.txt")
            .ssec(new ServerSideEncryptionCustomerKey(secretKey.getEncoded()))
            .build()
    )) {
    byte[] content = response.readAllBytes();
}
```

**注意事项**：**SSE-C 密钥必须由客户端妥善保管，丢失密钥意味着数据无法解密；下载时必须提供相同密钥；密钥必须为 256 位 AES 密钥。密钥通过 HTTPS 传输（TLS 加密），服务端不存储密钥。**

---

### SSE-KMS

**概念定义**：`ServerSideEncryptionKms` 使用外部 KMS（Key Management Service）管理的密钥进行服务端加密，适用于合规性要求较高的场景。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| keyId | `String` | 否 | KMS 密钥 ID（不指定则使用默认密钥） |
| context | `Map<String, String>` | 否 | 加密上下文（用于审计和授权） |

**配置示例**：

```java
// 使用指定 KMS 密钥
minioClient.putObject(
    PutObjectArgs.builder()
        .bucket("my-bucket")
        .object("kms-encrypted-file.txt")
        .stream(inputStream, fileSize, -1)
        .sse(ServerSideEncryptionKms.withKeyId("arn:aws:kms:us-east-1:123456789012:key/my-key-id"))
        .build()
);

// 使用默认 KMS 密钥 + 加密上下文
Map<String, String> context = new HashMap<>();
context.put("department", "finance");
context.put("project", "audit");

minioClient.putObject(
    PutObjectArgs.builder()
        .bucket("my-bucket")
        .object("kms-context-file.txt")
        .stream(inputStream, fileSize, -1)
        .sse(ServerSideEncryptionKms.withKeyId("key-id", context))
        .build()
);
```

**注意事项**：**SSE-KMS 需要 MinIO 配置 KMS 后端（如 HashiCorp Vault 或 AWS KMS）；加密上下文（context）记录在审计日志中，不影响加密过程；下载时无需指定解密参数。**

---

## 异常处理体系

### ErrorResponseException

**概念定义**：`ErrorResponseException` 是 MinIO Java SDK 核心异常类，封装了 S3 服务返回的错误响应，包含 HTTP 状态码、错误码、错误消息、Bucket 名、Object 名等详细信息。

**核心参数**：

| 方法 | 返回类型 | 说明 |
|------|----------|------|
| `errorResponse().code()` | `String` | S3 错误码（如 `NoSuchBucket`） |
| `errorResponse().message()` | `String` | 错误描述 |
| `errorResponse().bucketName()` | `String` | 涉及的 Bucket 名称 |
| `errorResponse().objectName()` | `String` | 涉及的 Object 名称 |
| `errorResponse().resource()` | `String` | 资源路径 |
| `errorResponse().requestId()` | `String` | 请求 ID |
| `errorResponse().hostId()` | `String` | 主机 ID |
| `httpTrace()` | `String` | 完整 HTTP 请求/响应追踪 |

**配置示例**：

```java
try {
    minioClient.getObject(
        GetObjectArgs.builder()
            .bucket("non-existent-bucket")
            .object("file.txt")
            .build()
    );
} catch (ErrorResponseException e) {
    ErrorResponse errorResponse = e.errorResponse();
    System.err.println("Code: " + errorResponse.code());
    System.err.println("Message: " + errorResponse.message());
    System.err.println("Bucket: " + errorResponse.bucketName());
    System.err.println("Object: " + errorResponse.objectName());
    System.err.println("RequestId: " + errorResponse.requestId());
    System.err.println("HTTP Trace: " + e.httpTrace());
}
```

**注意事项**：**`httpTrace()` 输出包含完整的请求头和响应头，注意不要在生产日志中泄露敏感凭证信息。**

---

### 常见异常与重试策略

**概念定义**：MinIO Java SDK 常见异常包含 `NoSuchBucket`（桶不存在）、`AccessDenied`（权限不足）、`SignatureDoesNotMatch`（签名不匹配）、`NoSuchKey`（对象不存在）等。重试策略通过捕获特定异常并重新执行操作实现。

**常见异常表**：

| 错误码 | HTTP 状态码 | 说明 | 处理建议 |
|--------|-------------|------|----------|
| `NoSuchBucket` | 404 | 桶不存在 | 检查桶名或创建桶 |
| `NoSuchKey` | 404 | 对象不存在 | 检查对象键名 |
| `AccessDenied` | 403 | 访问被拒绝 | 检查凭证和策略 |
| `SignatureDoesNotMatch` | 403 | 签名不匹配 | 检查 accessKey/secretKey |
| `BucketAlreadyExists` | 409 | 桶已存在 | 更换桶名 |
| `BucketNotEmpty` | 409 | 桶非空 | 先清空桶内对象 |
| `SlowDown` | 503 | 请求速率过高 | 退避重试 |
| `InternalError` | 500 | 服务端内部错误 | 退避重试 |
| `ServiceUnavailable` | 503 | 服务不可用 | 退避重试 |

**配置示例**：

```java
// 带重试的上传操作（指数退避）
public void uploadWithRetry(MinioClient client, String bucket, String object, 
        InputStream stream, long size, int maxRetries) throws Exception {
    int retries = 0;
    while (true) {
        try {
            client.putObject(
                PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(object)
                    .stream(stream, size, -1)
                    .build()
            );
            return;
        } catch (ErrorResponseException e) {
            String code = e.errorResponse().code();
            if (("SlowDown".equals(code) || "InternalError".equals(code) 
                    || "ServiceUnavailable".equals(code)) && retries < maxRetries) {
                retries++;
                long waitMs = (long) Math.pow(2, retries) * 100; // 指数退避
                Thread.sleep(waitMs);
                continue;
            }
            throw e;
        }
    }
}
```

**注意事项**：**重试仅适用于可恢复错误（`SlowDown`、`InternalError`、`ServiceUnavailable`）；幂等操作（GET、HEAD）可安全重试；非幂等操作（PUT）需确保 stream 支持 `mark/reset` 或重新创建流。指数退避间隔建议从 100ms 开始，上限 30 秒。**

---

## 最佳实践

### 连接池配置

**概念定义**：通过 OkHttpClient 的连接池配置优化 MinioClient 的并发性能，连接池大小直接影响并发请求的吞吐量。

**核心参数**：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| maxIdleConnections | CPU 核心数 * 4 | 空闲连接数，与并发请求数匹配 |
| keepAliveDuration | 5 分钟 | 空闲连接保持时间 |
| connectTimeout | 10 秒 | 连接建立超时 |
| readTimeout | 60 秒 | 数据读取超时 |
| writeTimeout | 60 秒 | 数据写入超时 |

**配置示例**：

```java
@Configuration
public class MinioConfig {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Bean
    public MinioClient minioClient() {
        int maxConnections = Runtime.getRuntime().availableProcessors() * 4;
        
        OkHttpClient httpClient = new OkHttpClient.Builder()
            .connectionPool(new ConnectionPool(maxConnections, 5, TimeUnit.MINUTES))
            .connectTimeout(Duration.ofSeconds(10))
            .readTimeout(Duration.ofSeconds(60))
            .writeTimeout(Duration.ofSeconds(60))
            .retryOnConnectionFailure(true)  // 连接失败自动重试
            .build();

        return MinioClient.builder()
            .endpoint(endpoint)
            .credentials(accessKey, secretKey)
            .httpClient(httpClient)
            .build();
    }
}
```

**注意事项**：**`retryOnConnectionFailure(true)` 启用 OkHttp 的连接失败自动重试（最多 1 次），适用于网络抖动场景。生产环境建议将连接池参数外部化到配置文件中。**

---

### 线程安全

**概念定义**：`MinioClient` 是线程安全的，推荐全局使用单例模式，避免创建多个实例导致连接池碎片化和资源浪费。

**配置示例**：

```java
// Spring 单例 Bean（推荐）
@Bean
public MinioClient minioClient() {
    return MinioClient.builder()
        .endpoint("https://play.min.io")
        .credentials("accessKey", "secretKey")
        .build();
}

// 静态单例（非 Spring 环境）
public class MinioClientHolder {
    private static volatile MinioClient INSTANCE;
    
    public static MinioClient getInstance() {
        if (INSTANCE == null) {
            synchronized (MinioClientHolder.class) {
                if (INSTANCE == null) {
                    INSTANCE = MinioClient.builder()
                        .endpoint("https://play.min.io")
                        .credentials("accessKey", "secretKey")
                        .build();
                }
            }
        }
        return INSTANCE;
    }
}
```

**注意事项**：**单例模式下注意 `MinioClient` 的 `close()` 仅在应用关闭时调用一次。在多 MinIO 集群场景下，可为每个集群创建独立的单例 `MinioClient`，但总数应控制在少数几个。**

---

### 性能调优

**概念定义**：通过调整 `partSize`、并行度、缓冲区大小等参数优化 MinIO 上传/下载性能。

**核心参数**：

| 参数 | 推荐值 | 说明 |
|------|--------|------|
| partSize | 10MB - 64MB | 分片大小，大文件建议 64MB |
| 并行度 | 4 - 8 | 手动分片时的并行上传线程数 |
| 缓冲区 | 8KB - 64KB | 流式传输缓冲区大小 |

**配置示例**：

```java
// 大文件上传调优
long partSize = 64 * 1024 * 1024;  // 64MB 分片
try (InputStream is = new BufferedInputStream(
        new FileInputStream("large-file.bin"), 64 * 1024)) {  // 64KB 缓冲区
    minioClient.putObject(
        PutObjectArgs.builder()
            .bucket("my-bucket")
            .object("large-file.bin")
            .stream(is, fileSize, partSize)
            .build()
    );
}

// 并行手动分片上传（使用线程池）
ExecutorService executor = Executors.newFixedThreadPool(8);
List<Future<Part>> futures = new ArrayList<>();

for (int partNumber = 1; partNumber <= partCount; partNumber++) {
    final int pn = partNumber;
    futures.add(executor.submit(() -> {
        UploadPartResponse response = minioClient.uploadPart(
            UploadPartArgs.builder()
                .bucket("my-bucket")
                .object("large-file.bin")
                .uploadId(uploadId)
                .partNumber(pn)
                .stream(partStream, partSize, -1)
                .build()
        );
        return new Part(pn, response.etag());
    }));
}

List<Part> parts = new ArrayList<>();
for (Future<Part> future : futures) {
    parts.add(future.get());
}
parts.sort(Comparator.comparingInt(Part::partNumber));
executor.shutdown();
```

**注意事项**：**`partSize` 越大，分片数越少，HTTP 请求开销越低，但内存占用越高。10000 个分片限制意味着 64MB 分片可支持最大 640GB 单文件上传。并行度建议不超过 CPU 核心数的 2 倍。**

---

### 大文件上传策略

**概念定义**：针对超大文件（>5GB）的上传策略，结合自动分片、断点续传、并行上传和完整性校验。

**配置示例**：

```java
public class LargeFileUploadService {
    private final MinioClient minioClient;
    private final int partSize = 64 * 1024 * 1024; // 64MB
    private final int parallelUploads = 8;

    public void uploadLargeFile(String bucket, String objectName, File file) throws Exception {
        long fileSize = file.length();
        
        // 文件小于 partSize，直接上传
        if (fileSize <= partSize) {
            minioClient.uploadObject(
                UploadObjectArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .filename(file.getAbsolutePath())
                    .build()
            );
            return;
        }

        // 大文件：手动分片并行上传
        String uploadId = minioClient.createMultipartUpload(
            CreateMultipartUploadArgs.builder()
                .bucket(bucket)
                .object(objectName)
                .build()
        ).result().uploadId();

        try {
            int partCount = (int) Math.ceil((double) fileSize / partSize);
            ExecutorService executor = Executors.newFixedThreadPool(parallelUploads);
            List<Future<Part>> futures = new ArrayList<>();

            for (int i = 1; i <= partCount; i++) {
                final int partNumber = i;
                futures.add(executor.submit(() -> uploadPart(bucket, objectName, 
                    uploadId, partNumber, file, partSize)));
            }

            List<Part> parts = new ArrayList<>();
            for (Future<Part> future : futures) {
                parts.add(future.get());
            }
            parts.sort(Comparator.comparingInt(Part::partNumber));
            executor.shutdown();

            // 完成分片上传
            minioClient.completeMultipartUpload(
                CompleteMultipartUploadArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .uploadId(uploadId)
                    .parts(parts.toArray(new Part[0]))
                    .build()
            );
        } catch (Exception e) {
            // 异常时取消上传
            minioClient.abortMultipartUpload(
                AbortMultipartUploadArgs.builder()
                    .bucket(bucket)
                    .object(objectName)
                    .uploadId(uploadId)
                    .build()
            );
            throw e;
        }
    }

    private Part uploadPart(String bucket, String object, String uploadId, 
            int partNumber, File file, int partSize) throws Exception {
        long startByte = (partNumber - 1L) * partSize;
        long endByte = Math.min(startByte + partSize, file.length()) - 1;
        long currentPartSize = endByte - startByte + 1;

        try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
            raf.seek(startByte);
            byte[] buffer = new byte[(int) currentPartSize];
            raf.readFully(buffer);

            UploadPartResponse response = minioClient.uploadPart(
                UploadPartArgs.builder()
                    .bucket(bucket)
                    .object(object)
                    .uploadId(uploadId)
                    .partNumber(partNumber)
                    .stream(new ByteArrayInputStream(buffer), currentPartSize, -1)
                    .build()
            );
            return new Part(partNumber, response.etag());
        }
    }
}
```

**注意事项**：**大文件上传应始终在 finally 或 catch 块中调用 `abortMultipartUpload` 清理失败的分片上传；生产环境建议引入 Redis 等外部存储记录上传进度，实现真正的断点续传。单文件最大支持 5TB（10000 分片 x 5GiB）。**

---

## 交叉引用

本文档覆盖以下 MinIO 相关文档的交叉引用：

| 序号 | 文档标题 | 关联说明 |
|------|----------|----------|
| 1 | MinIO Java Client API Reference | 官方 Java SDK API 完整参考（https://min.io/docs/minio/linux/developers/java/API.html） |
| 2 | MinIO Java SDK GitHub | 源代码及示例（https://github.com/minio/minio-java） |
| 3 | MinIO Java SDK Javadoc | 类和方法级别 Javadoc（https://minio-java.min.io/） |
| 4 | MinIO Bucket Notification Guide | 事件通知配置指南（https://min.io/docs/minio/linux/administration/monitoring/bucket-notifications.html） |
| 5 | MinIO Server-Side Encryption Guide | SSE-S3/SSE-C/SSE-KMS 加密指南（https://min.io/docs/minio/linux/administration/server-side-encryption/） |
| 6 | MinIO Object Locking Guide | 对象锁定与 WORM 合规（https://min.io/docs/minio/linux/administration/object-management/object-locking.html） |
| 7 | MinIO Lifecycle Management Guide | 生命周期规则配置（https://min.io/docs/minio/linux/administration/object-management/lifecycle-management.html） |
| 8 | MinIO Replication Guide | 跨区域复制配置（https://min.io/docs/minio/linux/administration/bucket-replication.html） |

---

> **文档版本**：v1.0  
> **生成日期**：2025-07-17  
> **SDK版本**：io.minio:minio 8.5.x  
> **MinIO基线**：RELEASE.2025-04-22T22-12-26Z