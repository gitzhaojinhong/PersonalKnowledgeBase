# MinIO Spring Boot 集成知识归档

> 版本信息：Spring Boot 3.x | io.minio:minio 8.x | JDK 17+

---

## Maven / Gradle 依赖
### Maven 依赖

**概念定义**：**MinIO Java SDK 提供对 MinIO 对象存储服务的完整客户端操作能力，包括 bucket 管理、对象上传下载、分片操作、生命周期策略等。Spring Boot Web Starter 提供 REST API 开发基础。**

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `minio.version` | MinIO Java SDK 版本 | `8.5.7` |
| `spring-boot.version` | Spring Boot 版本 | `3.2.x` |
| `okhttp3.version` | OkHttp 版本（SDK 传递依赖） | `4.12.0` |

```xml
<!-- pom.xml -->
<properties>
    <minio.version>8.5.7</minio.version>
</properties>

<dependencies>
    <!-- MinIO Java SDK -->
    <dependency>
        <groupId>io.minio</groupId>
        <artifactId>minio</artifactId>
        <version>${minio.version}</version>
    </dependency>

    <!-- Spring Boot Web -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <!-- 配置处理器 (可选，用于 @ConfigurationProperties 提示) -->
    <dependency>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-configuration-processor</artifactId>
        <optional>true</optional>
    </dependency>
</dependencies>
```

### Gradle 依赖

**概念定义**：**Gradle 依赖声明方式与 Maven 不同，适用于 Kotlin DSL 或 Groovy DSL 项目。**

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `minioVersion` | MinIO SDK 版本变量 | `"8.5.7"` |
| `implementation` | 编译期依赖 | `io.minio:minio` |

```groovy
// build.gradle
ext {
    minioVersion = '8.5.7'
}

dependencies {
    implementation "io.minio:minio:${minioVersion}"
    implementation 'org.springframework.boot:spring-boot-starter-web'
    annotationProcessor 'org.springframework.boot:spring-boot-configuration-processor'
}
```

**注意事项**：**MinIO Java SDK 内部依赖 OkHttp，若项目中已有 OkHttp 依赖，需检查版本兼容性。SDK 8.x 版本要求 OkHttp 4.x，与 Spring Boot 3.x 默认版本兼容。**

---

## application.yml 配置
**概念定义**：**Spring Boot 外部化配置，将 MinIO 连接参数集中管理，支持多环境 Profile 切换，便于运维与部署。**

| 参数 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `minio.endpoint` | String | MinIO 服务地址 | `http://192.168.1.100:9000` |
| `minio.access-key` | String | 访问密钥（Access Key） | `minioadmin` |
| `minio.secret-key` | String | 私有密钥（Secret Key） | `minioadmin` |
| `minio.bucket` | String | 默认 Bucket 名称 | `my-bucket` |
| `minio.secure` | Boolean | 是否使用 HTTPS | `false` |
| `minio.region` | String | 区域标识 | `us-east-1`（默认） |
| `minio.connect-timeout` | Duration | 连接超时 | `10s` |
| `minio.write-timeout` | Duration | 写入超时 | `60s` |
| `minio.read-timeout` | Duration | 读取超时 | `60s` |

```yaml
# application.yml
minio:
  endpoint: http://localhost:9000
  access-key: minioadmin
  secret-key: minioadmin
  bucket: default-bucket
  secure: false
  region: us-east-1
  connect-timeout: 10s
  write-timeout: 60s
  read-timeout: 60s

# 多环境示例
---
spring:
  config:
    activate:
      on-profile: prod

minio:
  endpoint: https://minio.prod.example.com:9000
  access-key: ${MINIO_ACCESS_KEY}
  secret-key: ${MINIO_SECRET_KEY}
  bucket: prod-bucket
  secure: true
```

**注意事项**：**生产环境建议通过环境变量注入敏感信息，避免密钥硬编码在配置文件中。endpoint 需包含协议前缀（http:// 或 https://），端口号不可省略。region 对 MinIO 单机部署无影响，但集群环境建议指定。**

---

## @ConfigurationProperties 配置类
**概念定义**：**使用 Spring Boot 类型安全绑定机制，将 application.yml 中的 minio.* 配置映射到 Java 配置类，支持 IDE 智能提示和校验。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `@ConfigurationProperties(prefix = "minio")` | 注解 | 绑定前缀 |
| `@Validated` | 注解 | 启用 JSR-303 校验 |
| `@NotEmpty` | 注解 | 必填校验 |

```java
package com.example.minio.config;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;

@Data
@Component
@Validated
@ConfigurationProperties(prefix = "minio")
public class MinioProperties {

    /** MinIO 服务地址 */
    @NotEmpty(message = "MinIO endpoint 不能为空")
    private String endpoint;

    /** 访问密钥 */
    @NotEmpty(message = "MinIO accessKey 不能为空")
    private String accessKey;

    /** 私有密钥 */
    @NotEmpty(message = "MinIO secretKey 不能为空")
    private String secretKey;

    /** 默认 Bucket */
    private String bucket = "default";

    /** 是否启用 HTTPS */
    private boolean secure = false;

    /** 区域 */
    private String region = "us-east-1";

    /** 连接超时 */
    private Duration connectTimeout = Duration.ofSeconds(10);

    /** 写入超时 */
    private Duration writeTimeout = Duration.ofSeconds(60);

    /** 读取超时 */
    private Duration readTimeout = Duration.ofSeconds(60);
}
```

**注意事项**：**必须添加 `spring-boot-configuration-processor` 依赖才能生成 `spring-configuration-metadata.json`，使 IDE 提供自动补全。`@Validated` 与 `@NotEmpty` 配合可在启动时校验必填配置项。**

---

## MinioClient Bean 注册
**概念定义**：**将 MinioClient 作为单例 Bean 注册到 Spring 容器，全局复用，避免重复创建连接。MinioClient 线程安全，适合单例模式。**

| 参数 | 说明 |
|------|------|
| `@Bean` | 注册为 Spring Bean |
| `@Configuration` | 标注配置类 |
| `MinioClient.builder()` | 构建器模式创建客户端 |

```java
package com.example.minio.config;

import io.minio.MinioClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Slf4j
@Configuration
@RequiredArgsConstructor
public class MinioConfig {

    private final MinioProperties minioProperties;

    @Bean
    public MinioClient minioClient() {
        MinioClient client = MinioClient.builder()
                .endpoint(minioProperties.getEndpoint())
                .credentials(minioProperties.getAccessKey(), minioProperties.getSecretKey())
                .region(minioProperties.getRegion())
                .build();

        // 设置超时 (SDK 8.x 支持)
        client.setTimeout(
                minioProperties.getConnectTimeout().toMillis(),
                minioProperties.getWriteTimeout().toMillis(),
                minioProperties.getReadTimeout().toMillis()
        );

        log.info("MinioClient 初始化完成, endpoint: {}", minioProperties.getEndpoint());
        return client;
    }
}
```

**注意事项**：**MinioClient 对象是线程安全的，确保只注册一个单例 Bean。SDK 8.5.x 中 `setTimeout()` 参数为 `(long connectTimeout, long writeTimeout, long readTimeout)`，单位毫秒。若使用 HTTPS 自签名证书，需额外配置 `TrustManager`，生产环境推荐使用 CA 签发的正式证书。**

---

## 自动配置原理
**概念定义**：**Spring Boot 自动配置（Auto-Configuration）通过 `@ConditionalOnClass`、`@EnableConfigurationProperties` 等条件注解，在类路径存在 MinIO SDK 时自动装配 MinioClient Bean，无需手动编写配置类。**

| 机制 | 说明 |
|------|------|
| `@ConditionalOnClass({MinioClient.class})` | 类路径存在 MinioClient 时生效 |
| `@EnableConfigurationProperties(MinioProperties.class)` | 启用属性绑定 |
| `spring.factories` / `AutoConfiguration.imports` | 注册自动配置类 |
| `@ConditionalOnMissingBean` | 用户自定义 Bean 优先 |

```java
package com.example.minio.autoconfigure;

import io.minio.MinioClient;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;

@AutoConfiguration
@ConditionalOnClass({MinioClient.class})
@EnableConfigurationProperties(MinioProperties.class)
public class MinioAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MinioClient minioClient(MinioProperties properties) {
        return MinioClient.builder()
                .endpoint(properties.getEndpoint())
                .credentials(properties.getAccessKey(), properties.getSecretKey())
                .region(properties.getRegion())
                .build();
    }
}
```

```properties
# src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports
com.example.minio.autoconfigure.MinfoAutoConfiguration
```

**注意事项**：**Spring Boot 3.x 使用 `AutoConfiguration.imports` 文件替代了旧版 `spring.factories`。`@ConditionalOnMissingBean` 确保用户自定义的 MinioClient Bean 优先级高于自动配置。自动配置类需放在独立模块或 starter 中，业务代码应避免依赖自动配置的加载顺序。**

---

## 文件上传 REST API
**概念定义**：**通过 `@PostMapping` 接收前端 `MultipartFile`，调用 MinioClient 的 `putObject` 方法将文件写入 MinIO，返回访问 URL 或文件标识。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `@RequestParam("file")` | MultipartFile | 上传文件 |
| `bucketName` | String | 目标 Bucket |
| `objectName` | String | 对象路径（含文件名） |
| `contentType` | String | 文件 MIME 类型 |
| `PutObjectArgs` | 构建器 | 上传参数封装 |

```java
package com.example.minio.controller;

import com.example.minio.config.MinioProperties;
import com.example.minio.service.MinioService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileUploadController {

    private final MinioService minioService;

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "bizType", defaultValue = "common") String bizType) {

        String url = minioService.uploadFile(file, bizType);

        return ResponseEntity.ok(Map.of(
                "code", "200",
                "url", url,
                "fileName", file.getOriginalFilename(),
                "size", String.valueOf(file.getSize())
        ));
    }
}
```

```java
package com.example.minio.service;

import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    public String uploadFile(MultipartFile file, String bizType) {
        try {
            String originalName = file.getOriginalFilename();
            String ext = originalName.substring(originalName.lastIndexOf("."));
            String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
            String objectName = String.format("%s/%s/%s%s", bizType, datePath, UUID.randomUUID(), ext);

            try (InputStream is = file.getInputStream()) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(minioProperties.getBucket())
                        .object(objectName)
                        .stream(is, file.getSize(), -1)
                        .contentType(file.getContentType())
                        .build());
            }

            String url = String.format("%s/%s/%s", minioProperties.getEndpoint(),
                    minioProperties.getBucket(), objectName);
            log.info("文件上传成功: {}", url);
            return url;
        } catch (Exception e) {
            log.error("文件上传失败", e);
            throw new RuntimeException("文件上传失败: " + e.getMessage(), e);
        }
    }
}
```

**注意事项**：**`PutObjectArgs.stream()` 的第三个参数 `-1` 表示未知对象大小，SDK 自动分片上传；若已知文件大小，传入具体值可优化性能。大文件建议使用 `-1` 让 SDK 自动处理分片。上传后返回的 URL 需根据 MinIO 的访问策略判断是否可直接访问，若 Bucket 为私有，需通过预签名 URL 访问。**

---

## 文件下载 REST API
**概念定义**：**通过 `@GetMapping` 接收文件标识，调用 MinioClient 的 `getObject` 方法读取对象流，以 `ResponseEntity<InputStreamResource>` 或 `StreamingResponseBody` 方式返回给客户端。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `objectName` | String | 对象完整路径 |
| `GetObjectArgs` | 构建器 | 下载参数封装 |
| `ResponseEntity<InputStreamResource>` | 返回类型 | 流式响应 |
| `Content-Disposition` | 响应头 | 控制浏览器下载行为 |

```java
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileDownloadController {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    @GetMapping("/download")
    public ResponseEntity<InputStreamResource> download(@RequestParam("objectName") String objectName) {
        try {
            InputStream stream = minioClient.getObject(GetObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectName)
                    .build());

            // 获取文件元数据，提取原始文件名
            StatObjectResponse stat = minioClient.statObject(StatObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectName)
                    .build());

            String fileName = objectName.substring(objectName.lastIndexOf("/") + 1);
            String encodedFileName = URLEncoder.encode(fileName, StandardCharsets.UTF_8)
                    .replaceAll("\\+", "%20");

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
            headers.set(HttpHeaders.CONTENT_DISPOSITION,
                    "attachment; filename*=UTF-8''" + encodedFileName);

            return ResponseEntity.ok()
                    .headers(headers)
                    .body(new InputStreamResource(stream));
        } catch (Exception e) {
            throw new RuntimeException("文件下载失败: " + e.getMessage(), e);
        }
    }
}
```

**注意事项**：**`InputStreamResource` 在下载完成后不会自动关闭流，需配合 `finally` 块或 try-with-resources 确保资源释放。`Content-Disposition` 使用 `filename*=UTF-8''` 编码可正确处理中文文件名。大文件下载建议使用 `StreamingResponseBody` 替代 `InputStreamResource`，避免内存溢出。**

---

## 文件删除 REST API
**概念定义**：**通过 `@DeleteMapping` 接收对象路径，调用 MinioClient 的 `removeObject` 方法删除指定对象。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `objectName` | String | 待删除对象路径 |
| `RemoveObjectArgs` | 构建器 | 删除参数封装 |

```java
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileDeleteController {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    @DeleteMapping("/delete")
    public ResponseEntity<Map<String, String>> delete(@RequestParam("objectName") String objectName) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(objectName)
                    .build());

            return ResponseEntity.ok(Map.of("code", "200", "message", "删除成功"));
        } catch (Exception e) {
            throw new RuntimeException("文件删除失败: " + e.getMessage(), e);
        }
    }
}
```

**注意事项**：**`removeObject` 为异步删除（MinIO 服务端），立即返回成功不代表磁盘空间已释放。MinIO 不支持删除非空目录，需先删除目录下所有对象。批量删除建议使用 `removeObjects` 方法，避免循环调用带来的性能开销。**

---

## 文件列表 REST API
**概念定义**：**分页查询 MinIO 中指定前缀的对象列表，通过 `listObjects` 方法获取对象迭代器，返回文件名、大小、修改时间等元数据。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `prefix` | String | 对象前缀（目录） |
| `pageNum` | int | 当前页码 |
| `pageSize` | int | 每页大小 |
| `ListObjectsArgs` | 构建器 | 列表查询参数 |

```java
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileListController {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(value = "prefix", defaultValue = "") String prefix,
            @RequestParam(value = "pageNum", defaultValue = "1") int pageNum,
            @RequestParam(value = "pageSize", defaultValue = "20") int pageSize) {

        List<FileInfo> allFiles = new ArrayList<>();

        Iterable<Result<Item>> results = minioClient.listObjects(
                ListObjectsArgs.builder()
                        .bucket(minioProperties.getBucket())
                        .prefix(prefix)
                        .recursive(true)
                        .build());

        for (Result<Item> result : results) {
            Item item = result.get();
            if (!item.isDir()) {
                allFiles.add(new FileInfo(
                        item.objectName(),
                        item.size(),
                        item.lastModified()
                ));
            }
        }

        // 手动分页
        int total = allFiles.size();
        int fromIndex = (pageNum - 1) * pageSize;
        int toIndex = Math.min(fromIndex + pageSize, total);
        List<FileInfo> pageData = fromIndex < total
                ? allFiles.subList(fromIndex, toIndex)
                : Collections.emptyList();

        return ResponseEntity.ok(Map.of(
                "code", "200",
                "data", pageData,
                "total", total,
                "pageNum", pageNum,
                "pageSize", pageSize
        ));
    }

    @Data
    @AllArgsConstructor
    public static class FileInfo {
        private String objectName;
        private long size;
        private ZonedDateTime lastModified;
    }
}
```

**注意事项**：**MinIO SDK 的 `listObjects` 不支持原生分页，需先拉取全部符合前缀的结果再内存分页，对象数量巨大时考虑使用 `maxKeys` 限制或改用 `listObjects` 的 `useApiVersion1(false)` 模式。`recursive(true)` 表示递归列出子目录，设为 `false` 则仅列出一级目录。**

---

## 文件预览
**概念定义**：**返回可公开访问的文件 URL 或预签名 URL，前端通过 `<img>`、`<video>` 或 `<iframe>` 直接预览文件内容，无需下载。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `objectName` | String | 对象路径 |
| `expiry` | int | 预签名 URL 有效期（秒） |
| `GetPresignedObjectUrlArgs` | 构建器 | 预签名参数 |

```java
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FilePreviewController {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    @GetMapping("/preview")
    public ResponseEntity<Map<String, String>> preview(
            @RequestParam("objectName") String objectName,
            @RequestParam(value = "expiry", defaultValue = "3600") int expiry) {

        try {
            String url = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(objectName)
                            .method(Method.GET)
                            .expiry(expiry)
                            .build());

            return ResponseEntity.ok(Map.of("code", "200", "url", url));
        } catch (Exception e) {
            throw new RuntimeException("获取预览链接失败: " + e.getMessage(), e);
        }
    }

    /** 直接预览模式（Bucket 为公开读） */
    @GetMapping("/preview/public")
    public ResponseEntity<Map<String, String>> previewPublic(
            @RequestParam("objectName") String objectName) {

        String url = String.format("%s/%s/%s",
                minioProperties.getEndpoint(),
                minioProperties.getBucket(),
                objectName);

        return ResponseEntity.ok(Map.of("code", "200", "url", url));
    }
}
```

**注意事项**：**预签名 URL 包含临时鉴权信息，过期后自动失效，推荐默认有效期 1 小时。Bucket 策略为公开读时可直接拼接 URL 访问，但需注意数据安全。预签名 URL 的 `method` 参数必须与前端实际请求方法一致，否则会返回 403。**

---

## 大文件分片上传（前端）
**概念定义**：**前端将大文件按固定大小（如 5MB）切割为多个分片，逐个上传至后端，后端汇聚后合并为完整文件。核心优势：降低单次请求内存压力，支持断点续传。**

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `chunkSize` | 分片大小 | `5 * 1024 * 1024`（5MB） |
| `maxConcurrency` | 并发上传数 | `3` |
| `file.slice()` | 前端切片 API | 浏览器原生 |

```javascript
// 前端分片上传核心逻辑 (JavaScript)
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadInChunks(file) {
    const fileId = generateFileId(); // UUID
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const uploadedChunks = new Set();

    // 1. 检查已上传分片
    const progress = await fetch(`/api/chunk/progress?fileId=${fileId}`);
    const { uploaded } = await progress.json();
    uploaded.forEach(i => uploadedChunks.add(i));

    // 2. 并发上传未完成的分片
    const tasks = [];
    for (let i = 0; i < totalChunks; i++) {
        if (uploadedChunks.has(i)) continue;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('fileId', fileId);
        formData.append('chunkIndex', i);
        formData.append('totalChunks', totalChunks);
        formData.append('fileName', file.name);
        formData.append('file', chunk);

        tasks.push(fetch('/api/chunk/upload', { method: 'POST', body: formData }));
    }

    await Promise.all(tasks);

    // 3. 触发合并
    await fetch(`/api/chunk/merge?fileId=${fileId}&fileName=${encodeURIComponent(file.name)}`);
}
```

**注意事项**：**`file.slice()` 是浏览器原生 API，无需额外依赖。分片大小建议 5MB-10MB，过小导致请求过多，过大失去分片意义。并发数控制在 3-6 之间，避免浏览器同域名连接数限制。每个分片上传失败需支持重试，建议重试 3 次。**

---

## 大文件分片上传（后端合并）
**概念定义**：**后端接收分片暂存于 MinIO 临时目录，全部接收完毕后调用 MinIO 的 `composeObject` 方法合并分片，最终生成完整对象。三步流程：初始化 → 上传分片 → 合并。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `fileId` | String | 文件唯一标识 |
| `chunkIndex` | int | 分片序号 |
| `totalChunks` | int | 分片总数 |
| `ComposeSource` | 类 | 合并源对象 |
| `ComposeObjectArgs` | 构建器 | 合并参数 |

```java
@RestController
@RequestMapping("/api/chunk")
@RequiredArgsConstructor
public class ChunkUploadController {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    private static final String CHUNK_DIR = "chunks/";

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadChunk(
            @RequestParam("fileId") String fileId,
            @RequestParam("chunkIndex") int chunkIndex,
            @RequestParam("totalChunks") int totalChunks,
            @RequestParam("fileName") String fileName,
            @RequestParam("file") MultipartFile file) {

        try {
            String chunkObjectName = String.format("%s%s/%s_%05d",
                    CHUNK_DIR, fileId, fileId, chunkIndex);

            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(minioProperties.getBucket())
                    .object(chunkObjectName)
                    .stream(file.getInputStream(), file.getSize(), -1)
                    .build());

            return ResponseEntity.ok(Map.of("code", "200", "chunk", String.valueOf(chunkIndex)));
        } catch (Exception e) {
            throw new RuntimeException("分片上传失败: " + e.getMessage(), e);
        }
    }

    @PostMapping("/merge")
    public ResponseEntity<Map<String, String>> merge(
            @RequestParam("fileId") String fileId,
            @RequestParam("fileName") String fileName) {

        try {
            String chunkPrefix = CHUNK_DIR + fileId + "/";
            String extension = fileName.substring(fileName.lastIndexOf("."));
            String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
            String targetObject = String.format("files/%s/%s%s", datePath, UUID.randomUUID(), extension);

            // 收集所有分片
            List<ComposeSource> sources = new ArrayList<>();
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .prefix(chunkPrefix)
                            .build());

            for (Result<Item> result : results) {
                sources.add(ComposeSource.builder()
                        .bucket(minioProperties.getBucket())
                        .object(result.get().objectName())
                        .build());
            }

            // 排序确保顺序
            sources.sort(Comparator.comparing(s -> s.object()));

            // 合并 (MinIO compose 单次最多 1000 个源)
            minioClient.composeObject(
                    ComposeObjectArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .object(targetObject)
                            .sources(sources)
                            .build());

            // 清理分片
            for (ComposeSource source : sources) {
                minioClient.removeObject(RemoveObjectArgs.builder()
                        .bucket(minioProperties.getBucket())
                        .object(source.object())
                        .build());
            }

            String url = String.format("%s/%s/%s",
                    minioProperties.getEndpoint(), minioProperties.getBucket(), targetObject);
            return ResponseEntity.ok(Map.of("code", "200", "url", url));
        } catch (Exception e) {
            throw new RuntimeException("分片合并失败: " + e.getMessage(), e);
        }
    }
}
```

**注意事项**：**MinIO 的 `composeObject` 单次最多合并 1000 个源对象，超大文件分片超过 1000 个时需分批合并。合并后务必将临时分片清理，避免产生存储成本。分片暂存于独立目录（如 `chunks/`），便于统一管理。建议设置分片过期生命周期策略，自动清理未合并的残留分片。**

---

## 断点续传
**概念定义**：**上传中断后，客户端通过查询服务端已上传的分片列表，跳过已完成的片段，只上传缺失部分，实现“断点续传”效果。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `fileId` | String | 文件唯一标识 |
| `uploadedChunks` | Set<Integer> | 已上传分片序号集合 |
| `chunkPrefix` | String | 分片目录前缀 |

```java
@RestController
@RequestMapping("/api/chunk")
@RequiredArgsConstructor
public class ChunkProgressController {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    @GetMapping("/progress")
    public ResponseEntity<Map<String, Object>> getProgress(@RequestParam("fileId") String fileId) {
        try {
            Set<Integer> uploadedChunks = new TreeSet<>();
            String chunkPrefix = "chunks/" + fileId + "/";

            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(minioProperties.getBucket())
                            .prefix(chunkPrefix)
                            .build());

            for (Result<Item> result : results) {
                String objectName = result.get().objectName();
                // 从 objectName 中提取分片序号
                String chunkIndexStr = objectName.substring(objectName.lastIndexOf("_") + 1);
                uploadedChunks.add(Integer.parseInt(chunkIndexStr));
            }

            return ResponseEntity.ok(Map.of(
                    "code", "200",
                    "fileId", fileId,
                    "uploaded", uploadedChunks
            ));
        } catch (Exception e) {
            throw new RuntimeException("查询进度失败: " + e.getMessage(), e);
        }
    }
}
```

```javascript
// 前端断点续传逻辑
async function resumeUpload(file, fileId) {
    // 1. 查询已上传分片
    const res = await fetch(`/api/chunk/progress?fileId=${fileId}`);
    const { uploaded } = await res.json();

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    // 2. 只上传缺失的分片
    for (let i = 0; i < totalChunks; i++) {
        if (uploaded.includes(i)) continue;
        await uploadChunk(file, fileId, i, totalChunks);
    }

    // 3. 触发合并
    await fetch(`/api/chunk/merge?fileId=${fileId}&fileName=${encodeURIComponent(file.name)}`);
}
```

**注意事项**：**`fileId` 需由前端生成（UUID）并持久化，页面刷新后能恢复上传上下文。分片序号从分片对象名中提取，命名需保持一致性（如 `{fileId}_{chunkIndex:05d}`）。建议在 localStorage 中存储 `fileId`，避免页面刷新后丢失上下文。**

---

## 进度追踪
**概念定义**：**实时监控分片上传进度，通过 WebSocket 或轮询方式将进度信息推送给前端，展示上传百分比、速度、剩余时间等。**

| 参数 | 类型 | 说明 |
|------|------|------|
| `uploadedChunks` | int | 已完成分片数 |
| `totalChunks` | int | 总分片数 |
| `progress` | double | 进度百分比 |
| `uploadSpeed` | long | 上传速率（bytes/s） |

```java
@Service
@Slf4j
public class ChunkProgressService {

    private final ConcurrentHashMap<String, UploadProgress> progressMap = new ConcurrentHashMap<>();

    public void updateProgress(String fileId, int chunkIndex, int totalChunks) {
        progressMap.compute(fileId, (k, v) -> {
            if (v == null) {
                v = new UploadProgress(totalChunks);
            }
            v.completeChunk(chunkIndex);
            return v;
        });
    }

    public UploadProgress getProgress(String fileId) {
        return progressMap.getOrDefault(fileId, new UploadProgress(0));
    }

    @Data
    public static class UploadProgress {
        private final int totalChunks;
        private final Set<Integer> completedChunks = ConcurrentHashMap.newKeySet();
        private long startTime = System.currentTimeMillis();

        public UploadProgress(int totalChunks) {
            this.totalChunks = totalChunks;
        }

        public void completeChunk(int index) {
            completedChunks.add(index);
        }

        public double getPercentage() {
            return totalChunks == 0 ? 0 :
                    (double) completedChunks.size() / totalChunks * 100;
        }

        public long getElapsedSeconds() {
            return (System.currentTimeMillis() - startTime) / 1000;
        }
    }

    @GetMapping("/progress/detail")
    public ResponseEntity<Map<String, Object>> getProgressDetail(
            @RequestParam("fileId") String fileId) {

        UploadProgress progress = progressMap.get(fileId);
        if (progress == null) {
            return ResponseEntity.ok(Map.of("code", "200", "percentage", 0));
        }

        return ResponseEntity.ok(Map.of(
                "code", "200",
                "percentage", String.format("%.1f", progress.getPercentage()),
                "completed", progress.getCompletedChunks().size(),
                "total", progress.getTotalChunks(),
                "elapsedSeconds", progress.getElapsedSeconds()
        ));
    }
}
```

**注意事项**：**`ConcurrentHashMap` 是内存存储，服务重启后进度丢失。生产环境建议使用 Redis 存储进度信息，配合 TTL 自动过期。前端轮询间隔建议 1-2 秒，避免过于频繁。WebSocket 方案可减少轮询开销，但需额外处理断线重连。**

---

## 图片处理与缩略图（上传生成）
**概念定义**：**图片上传时自动生成缩略图，使用 Thumbnailator 或 ImgScalr 库对图片进行缩放、裁剪、水印等处理，将缩略图与原图一同存储至 MinIO。**

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `thumbnailWidth` | 缩略图宽度 | `200px` |
| `thumbnailHeight` | 缩略图高度 | `200px` |
| `thumbnailQuality` | 缩略图质量 | `0.8` |
| Maven GAV | Thumbnailator 依赖 | `net.coobird:thumbnailator:0.4.20` |

```xml
<dependency>
    <groupId>net.coobird</groupId>
    <artifactId>thumbnailator</artifactId>
    <version>0.4.20</version>
</dependency>
```

```java
@Service
@Slf4j
@RequiredArgsConstructor
public class ImageService {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    private static final int THUMB_WIDTH = 200;
    private static final int THUMB_HEIGHT = 200;

    public Map<String, String> uploadImage(MultipartFile file, String bizType) {
        try {
            String originalName = file.getOriginalFilename();
            String ext = originalName.substring(originalName.lastIndexOf("."));
            String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
            String uuid = UUID.randomUUID().toString();

            // 1. 上传原图
            String originalObject = String.format("images/original/%s/%s/%s%s",
                    bizType, datePath, uuid, ext);
            try (InputStream is = file.getInputStream()) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(minioProperties.getBucket())
                        .object(originalObject)
                        .stream(is, file.getSize(), -1)
                        .contentType(file.getContentType())
                        .build());
            }

            // 2. 生成并上传缩略图
            byte[] thumbnailBytes = generateThumbnail(file, THUMB_WIDTH, THUMB_HEIGHT);
            String thumbObject = String.format("images/thumb/%s/%s/%s_thumb%s",
                    bizType, datePath, uuid, ext);

            try (ByteArrayInputStream bis = new ByteArrayInputStream(thumbnailBytes)) {
                minioClient.putObject(PutObjectArgs.builder()
                        .bucket(minioProperties.getBucket())
                        .object(thumbObject)
                        .stream(bis, thumbnailBytes.length, -1)
                        .contentType(file.getContentType())
                        .build());
            }

            return Map.of(
                    "original", originalObject,
                    "thumbnail", thumbObject
            );
        } catch (Exception e) {
            log.error("图片上传处理失败", e);
            throw new RuntimeException("图片处理失败", e);
        }
    }

    private byte[] generateThumbnail(MultipartFile file, int width, int height) throws IOException {
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        Thumbnails.of(file.getInputStream())
                .size(width, height)
                .keepAspectRatio(true)          // 保持宽高比
                .outputFormat("jpg")
                .outputQuality(0.8)
                .toOutputStream(outputStream);
        return outputStream.toByteArray();
    }
}
```

**注意事项**：**Thumbnailator 的 `keepAspectRatio(true)` 会以最长边适配，另一条边可能小于设定值，适合大多数场景。缩略图以 `byte[]` 在内存中处理，原图过大会导致 OOM，建议上传前限制原图尺寸。生产环境可将缩略图生成放入异步任务（`@Async`），避免阻塞上传响应。**

---

## 图片处理与缩略图（分离存储）
**概念定义**：**原图与缩略图存储于不同的目录或 Bucket，通过命名约定或元数据关联，实现分层访问和生命周期管理。**

| 策略 | 原图路径 | 缩略图路径 |
|------|----------|------------|
| 同 Bucket 不同目录 | `images/original/{bizType}/{date}/{uuid}.{ext}` | `images/thumb/{bizType}/{date}/{uuid}_thumb.{ext}` |
| 不同 Bucket | `original-bucket/{path}` | `thumb-bucket/{path}` |

```java
@Service
@RequiredArgsConstructor
public class ImageStorageService {

    private final MinioClient minioClient;
    private final MinioProperties minioProperties;

    private static final String ORIGINAL_BUCKET = "original-images";
    private static final String THUMB_BUCKET = "thumb-images";

    /**
     * 构建原图存储路径
     */
    public String buildOriginalPath(String bizType, String uuid, String ext) {
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        return String.format("%s/%s/%s%s", bizType, datePath, uuid, ext);
    }

    /**
     * 构建缩略图存储路径
     */
    public String buildThumbPath(String bizType, String uuid, String ext) {
        String datePath = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy/MM/dd"));
        return String.format("%s/%s/%s_thumb%s", bizType, datePath, uuid, ext);
    }

    /**
     * 获取图片访问 URL（公开读）
     */
    public String getOriginalUrl(String objectName) {
        return String.format("%s/%s/%s",
                minioProperties.getEndpoint(), ORIGINAL_BUCKET, objectName);
    }

    public String getThumbUrl(String objectName) {
        return String.format("%s/%s/%s",
                minioProperties.getEndpoint(), THUMB_BUCKET, objectName);
    }
}
```

**注意事项**：**分离存储的优势：缩略图 Bucket 可设置更短的过期策略节省成本；原图 Bucket 可配置低频存储；缩略图 Bucket 可设置为公开读，原图 Bucket 保持私有。不同 Bucket 的数据一致性需由应用层保证，删除原图时应同步删除对应缩略图。**

---

## 分布式文件存储架构设计
**概念定义**：**通过分目录、分层级、分 Bucket 的存储策略，实现文件的有序管理、快速检索和精细化权限控制。**

### 存储策略

**概念定义**：**按业务模块、日期、用户维度组织目录结构，使文件路径具有可读性和可预测性。**

| 维度 | 示例 | 适用场景 |
|------|------|----------|
| 按日期 | `2025/07/17/` | 日志、备份、通用文件 |
| 按业务 | `order/`、`product/`、`avatar/` | 业务文件分类 |
| 按用户 | `user/10001/` | 用户私有文件 |
| 组合 | `order/2025/07/17/` | 业务+日期 |

### 文件命名

**概念定义**：**使用 UUID 作为文件名前缀，防止重名覆盖，保留原始扩展名以支持 MIME 类型识别。**

| 规则 | 示例 |
|------|------|
| UUID + 扩展名 | `a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg` |
| 雪花ID + 扩展名 | `1734567890123456789.jpg` |
| 原始文件名（URL编码） | `%E6%B5%8B%E8%AF%95.jpg`（不推荐） |

### 路径设计

**概念定义**：**标准化的路径模板，确保所有文件遵循统一的层级结构。**

```
/{bucket}/{业务类型}/{日期}/{uuid}.{ext}
```

示例：
```
default-bucket/order/2025/07/17/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg
default-bucket/avatar/user/10001/c3d4e5f6-7890-abcd-ef12-345678901234.png
default-bucket/product/2025/07/17/e5f6a1b2-c3d4-5678-90ab-cdef12345678.jpg
```

### 公私有分离

**概念定义**：**公开资源（头像、商品图、静态资源）存放于公开读 Bucket，私有资源（合同、用户文件、内部文档）存放于私有 Bucket，通过策略或预签名 URL 控制访问。**

| Bucket 类型 | 访问策略 | 典型内容 |
|-------------|----------|----------|
| `public` | 公开读 | 头像、商品图、Banner、静态资源 |
| `private` | 仅 Owner 可读写 | 合同、用户文件、内部文档 |
| `protected` | 登录用户可读 | 会员文件、付费内容 |

```java
public enum BucketType {
    PUBLIC("public-bucket"),
    PRIVATE("private-bucket"),
    PROTECTED("protected-bucket");

    private final String bucketName;
}
```

**注意事项**：**路径规划需在项目初期确定，后期变更成本高。目录层级不宜过深（建议不超过 5 层），避免 listObjects 性能下降。公开 Bucket 需定期审计，防止敏感文件误放。使用 MinIO Policy 可在 Bucket 级别设置 `public` 或 `download` 策略。**

---

## 数据迁移方案
**概念定义**：**在不同存储系统之间批量迁移数据，包括本地到 MinIO、MinIO 到 MinIO、跨云存储迁移等场景。**

### mc mirror

**概念定义**：**MinIO 官方命令行工具 `mc` 的 `mirror` 子命令，支持本地目录与 MinIO 之间的双向同步，增量复制，保留对象元数据。**

| 参数 | 说明 | 示例 |
|------|------|------|
| `--overwrite` | 覆盖已存在对象 | `mc mirror --overwrite` |
| `--remove` | 删除目标多余对象（镜像模式） | `mc mirror --remove` |
| `--watch` | 持续监听并同步 | `mc mirror --watch` |
| `--attr` | 保留文件属性 | `mc mirror --attr` |

```bash
# 本地 → MinIO
mc mirror /data/files/ myminio/my-bucket/

# MinIO → MinIO（跨集群）
mc mirror source-minio/source-bucket/ target-minio/target-bucket/ --overwrite

# 持续同步（监控模式）
mc mirror --watch /data/upload/ myminio/my-bucket/upload/
```

### rclone

**概念定义**：**rclone 是开源跨云存储同步工具，支持 40+ 存储后端，可实现 MinIO 与 AWS S3、阿里云 OSS、Google Cloud Storage 等之间的数据迁移。**

| 参数 | 说明 |
|------|------|
| `rclone config` | 配置存储后端 |
| `rclone sync` | 单向同步（删除目标多余文件） |
| `rclone copy` | 双向复制（保留目标多余文件） |
| `--transfers` | 并发传输数 |
| `--checkers` | 并发检查数 |

```bash
# 配置 MinIO 源
rclone config

# 同步 MinIO → AWS S3
rclone sync minio:my-bucket s3:aws-bucket \
    --transfers 16 \
    --checkers 32 \
    --progress

# 增量复制
rclone copy minio:my-bucket s3:aws-bucket \
    --ignore-existing \
    --verbose
```

### 批量迁移脚本

**概念定义**：**基于 MinIO SDK 编写 Java 批量迁移脚本，适用于需要自定义迁移逻辑（如路径转换、过滤、格式转换）的场景。**

```java
@Component
@Slf4j
@RequiredArgsConstructor
public class BatchMigrationService {

    private final MinioClient sourceClient;
    private final MinioClient targetClient;

    public void migrate(String sourceBucket, String targetBucket, String prefix) {
        Iterable<Result<Item>> objects = sourceClient.listObjects(
                ListObjectsArgs.builder()
                        .bucket(sourceBucket)
                        .prefix(prefix)
                        .recursive(true)
                        .build());

        int total = 0;
        int failed = 0;

        for (Result<Item> result : objects) {
            try {
                Item item = result.get();
                if (item.isDir()) continue;

                // 复制对象
                targetClient.copyObject(CopyObjectArgs.builder()
                        .source(CopySource.builder()
                                .bucket(sourceBucket)
                                .object(item.objectName())
                                .build())
                        .bucket(targetBucket)
                        .object(item.objectName()) // 可按需转换路径
                        .build());

                total++;
                if (total % 100 == 0) {
                    log.info("已迁移 {} 个对象...", total);
                }
            } catch (Exception e) {
                failed++;
                log.error("迁移失败: {}", e.getMessage());
            }
        }

        log.info("迁移完成: 成功={}, 失败={}", total, failed);
    }
}
```

**注意事项**：**`mc mirror` 适合简单迁移场景，不依赖额外工具。`rclone` 功能最强大，适合跨云迁移。批量迁移脚本需注意速率控制，避免打满带宽或触发 MinIO 限流。大规模迁移（百万级以上）建议使用分布式任务调度（如 XXL-JOB）分批执行，配合断点记录。**

---

## MinioTemplate 封装
**概念定义**：**将 MinIO 常用操作封装为 `MinioTemplate` 工具类，提供统一 API、异常处理和链路追踪，降低业务代码与 MinIO SDK 的耦合度。**

### 通用 MinioTemplate 类设计

| 方法 | 功能 | 返回值 |
|------|------|--------|
| `upload(String bucket, String object, InputStream, long size, String contentType)` | 上传文件 | `String` URL |
| `download(String bucket, String object)` | 下载文件流 | `InputStream` |
| `delete(String bucket, String object)` | 删除文件 | `void` |
| `exists(String bucket, String object)` | 检查是否存在 | `boolean` |
| `getPresignedUrl(String bucket, String object, int expiry)` | 获取预签名 URL | `String` |
| `listObjects(String bucket, String prefix)` | 列出对象 | `List<Item>` |
| `batchDelete(String bucket, List<String> objects)` | 批量删除 | `int` |

```java
@Component
@Slf4j
@RequiredArgsConstructor
public class MinioTemplate {

    private final MinioClient minioClient;

    // ==================== 上传 ====================

    public String upload(String bucket, String object, InputStream stream,
                         long size, String contentType) {
        try {
            minioClient.putObject(PutObjectArgs.builder()
                    .bucket(bucket)
                    .object(object)
                    .stream(stream, size, -1)
                    .contentType(contentType)
                    .build());
            log.debug("上传成功: {}/{}", bucket, object);
            return object;
        } catch (Exception e) {
            throw new MinioOperationException("上传失败: " + object, e);
        }
    }

    // ==================== 下载 ====================

    public InputStream download(String bucket, String object) {
        try {
            return minioClient.getObject(GetObjectArgs.builder()
                    .bucket(bucket)
                    .object(object)
                    .build());
        } catch (Exception e) {
            throw new MinioOperationException("下载失败: " + object, e);
        }
    }

    // ==================== 删除 ====================

    public void delete(String bucket, String object) {
        try {
            minioClient.removeObject(RemoveObjectArgs.builder()
                    .bucket(bucket)
                    .object(object)
                    .build());
        } catch (Exception e) {
            throw new MinioOperationException("删除失败: " + object, e);
        }
    }

    // ==================== 存在性检查 ====================

    public boolean exists(String bucket, String object) {
        try {
            minioClient.statObject(StatObjectArgs.builder()
                    .bucket(bucket)
                    .object(object)
                    .build());
            return true;
        } catch (ErrorResponseException e) {
            if ("NoSuchKey".equals(e.errorResponse().code())) {
                return false;
            }
            throw new MinioOperationException("检查文件存在性失败: " + object, e);
        } catch (Exception e) {
            throw new MinioOperationException("检查文件存在性失败: " + object, e);
        }
    }

    // ==================== 预签名 URL ====================

    public String getPresignedUrl(String bucket, String object, int expirySeconds) {
        try {
            return minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .bucket(bucket)
                            .object(object)
                            .method(Method.GET)
                            .expiry(expirySeconds)
                            .build());
        } catch (Exception e) {
            throw new MinioOperationException("获取预签名URL失败: " + object, e);
        }
    }

    // ==================== 列表查询 ====================

    public List<Item> listObjects(String bucket, String prefix) {
        List<Item> items = new ArrayList<>();
        try {
            Iterable<Result<Item>> results = minioClient.listObjects(
                    ListObjectsArgs.builder()
                            .bucket(bucket)
                            .prefix(prefix)
                            .recursive(true)
                            .build());
            for (Result<Item> result : results) {
                items.add(result.get());
            }
        } catch (Exception e) {
            throw new MinioOperationException("列出对象失败: prefix=" + prefix, e);
        }
        return items;
    }

    // ==================== 批量删除 ====================

    public int batchDelete(String bucket, List<String> objects) {
        if (objects == null || objects.isEmpty()) return 0;

        List<DeleteObject> deleteObjects = objects.stream()
                .map(DeleteObject::new)
                .collect(Collectors.toList());

        try {
            Iterable<Result<DeleteError>> results = minioClient.removeObjects(
                    RemoveObjectsArgs.builder()
                            .bucket(bucket)
                            .objects(deleteObjects)
                            .build());

            int errorCount = 0;
            for (Result<DeleteError> result : results) {
                DeleteError error = result.get();
                log.error("批量删除失败: {} - {}", error.objectName(), error.message());
                errorCount++;
            }
            return objects.size() - errorCount;
        } catch (Exception e) {
            throw new MinioOperationException("批量删除失败", e);
        }
    }
}
```

### 统一异常处理

**概念定义**：**定义 MinioOperationException 作为 MinIO 操作的统一异常，通过 `@ControllerAdvice` 全局捕获，返回标准错误响应。**

| 异常类型 | 说明 | HTTP 状态码 |
|----------|------|-------------|
| `MinioOperationException` | 自定义统一异常 | 500 |
| `ErrorResponseException` | MinIO SDK 响应异常 | 根据 code 映射 |
| `InsufficientDataException` | 数据不完整 | 400 |
| `InternalException` | SDK 内部异常 | 500 |

```java
public class MinioOperationException extends RuntimeException {
    public MinioOperationException(String message, Throwable cause) {
        super(message, cause);
    }
}

@RestControllerAdvice
@Slf4j
public class MinioExceptionHandler {

    @ExceptionHandler(MinioOperationException.class)
    public ResponseEntity<Map<String, String>> handleMinioException(MinioOperationException e) {
        log.error("MinIO 操作异常", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("code", "500", "message", e.getMessage()));
    }

    @ExceptionHandler(ErrorResponseException.class)
    public ResponseEntity<Map<String, String>> handleErrorResponse(ErrorResponseException e) {
        log.error("MinIO 服务端异常: code={}, message={}", e.errorResponse().code(), e.errorResponse().message());
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("code", e.errorResponse().code(), "message", e.errorResponse().message()));
    }
}
```

**注意事项**：**`MinioTemplate` 中 `statObject` 方法用于文件存在检查，`NoSuchKey` 错误码表示文件不存在，需精确捕获 `ErrorResponseException` 判断。批量删除的 `removeObjects` 返回的是 `Iterable<Result<DeleteError>>`，仅包含失败项，成功项不会出现在结果中。`MinioTemplate` 应保持无状态，所有状态通过参数传递。**

---

## 交叉引用
本文档涉及以下关联知识文档，可根据需要查阅：

| 序号 | 文档名称 | 关联说明 |
|------|----------|----------|
| 1 | `MinIO-Spring-Boot集成.md` | 本文档，MinIO 与 Spring Boot 3.x 集成的完整知识归档 |
| 2 | `MinIO集群部署运维.md` | MinIO 集群搭建、纠删码配置、TLS 证书、性能调优、监控告警 |
| 3 | `MinIO-API参考.md` | MinIO Java SDK 完整 API 参考，Bucket 操作、对象操作、策略管理 |
| 4 | `Spring-Boot文件上传最佳实践.md` | Spring Boot 文件上传的通用最佳实践，大小限制、异常处理、安全校验 |
| 5 | `分布式存储架构设计.md` | 分布式存储架构全局视角，包含 Ceph、MinIO、FastDFS 对比选型 |
| 6 | `大文件分片上传方案.md` | 大文件分片上传的完整方案设计，包含前端 SDK、后端服务、进度追踪 |
| 7 | `图片处理服务设计.md` | 图片处理整体方案，包括缩略图、水印、格式转换、CDN 加速 |
| 8 | `数据迁移与备份策略.md` | 数据迁移与备份的完整策略，包括 mc、rclone、快照、多活方案 |

---

> **文档版本**：v1.0  
> **最后更新**：2025-07-17  
> **适用版本**：Spring Boot 3.2.x | io.minio:minio 8.5.x | JDK 17+