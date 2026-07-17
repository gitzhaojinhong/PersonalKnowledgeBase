# MinIO Object 操作知识归档

> **版本基线**: MinIO RELEASE.2025-04-22T22-12-26Z
> **Java SDK**: io.minio:minio（官方 minio-java）
> **文档结构**: 知识分类树 —— 扁平并列、名词化标题

---

## 对象上传
### PutObject
**概念定义**：将数据作为对象写入指定 Bucket 的操作。支持本地文件路径、`InputStream`、字节数组等多种数据源。单次上传最大 5 TiB（若超过 5 GiB 建议使用分片上传）；默认情况下，若同名对象已存在且该对象未启用版本控制或锁定，则执行覆盖写。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称（路径） |
| `stream` | InputStream | 否 | 输入流（与 `filename` 二选一） |
| `objectSize` | long | 否 | 流大小（已知大小传实际值，未知大小传 `-1`） |
| `partSize` | long | 否 | 分片大小，未知大小流上传时需指定以启用自动分片 |
| `filename` | String | 否 | 本地文件路径（与 `stream` 二选一） |
| `contentType` | String | 否 | 对象 MIME 类型 |
| `headers` | Map | 否 | 自定义 HTTP 头（如 `X-Amz-Storage-Class`） |
| `userMetadata` | Map | 否 | 用户自定义元数据键值对 |
| `sse` | ServerSideEncryption | 否 | 服务端加密配置 |
| `tags` | Map | 否 | 对象标签 |

**配置示例**：

**mc 命令 —— 已知文件上传：**
```bash
# 上传本地文件到 Bucket
mc cp /data/report.pdf myminio/mybucket/reports/report.pdf

# 上传目录（递归）
mc cp --recursive /data/images/ myminio/mybucket/images/
```

**mc 命令 —— 流式上传与管道上传：**
```bash
# 管道上传（从标准输入读取）
cat /var/log/app.log | mc pipe myminio/mybucket/logs/app.log

# 管道上传并附带标签
cat /data/export.csv | mc pipe --tags "env=prod&type=report" myminio/mybucket/exports/export.csv
```

**Java SDK —— 已知大小流上传：**
```java
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import java.io.FileInputStream;
import java.io.InputStream;

MinioClient client = MinioClient.builder()
        .endpoint("http://minio.example.com:9000")
        .credentials("accessKey", "secretKey")
        .build();

try (InputStream is = new FileInputStream("/data/report.pdf")) {
    long size = new java.io.File("/data/report.pdf").length();
    client.putObject(
        PutObjectArgs.builder()
            .bucket("mybucket")
            .object("reports/report.pdf")
            .stream(is, size, -1)      // 已知大小，partSize=-1 表示不启用分片
            .contentType("application/pdf")
            .build()
    );
}
```

**Java SDK —— 未知大小流上传（自动分片）：**
```java
// 未知大小流：objectSize=-1，partSize 指定分片大小（如 10 MiB）
try (InputStream is = getUnknownSizeStream()) {
    client.putObject(
        PutObjectArgs.builder()
            .bucket("mybucket")
            .object("data/large-file.bin")
            .stream(is, -1, 10 * 1024 * 1024)  // 未知大小，partSize=10MiB 自动分片
            .contentType("application/octet-stream")
            .build()
    );
}
```

**Java SDK —— 创建目录对象（以 `/` 结尾的空对象）：**
```java
// 创建目录对象：对象名以 "/" 结尾，内容为空流
client.putObject(
    PutObjectArgs.builder()
        .bucket("mybucket")
        .object("projects/2025/")
        .stream(new java.io.ByteArrayInputStream(new byte[0]), 0, -1)
        .build()
);
```

**Java SDK —— 自定义 Headers 与用户元数据：**
```java
import java.util.HashMap;
import java.util.Map;

Map<String, String> headers = new HashMap<>();
headers.put("X-Amz-Storage-Class", "REDUCED_REDUNDANCY");

Map<String, String> userMetadata = new HashMap<>();
userMetadata.put("author", "zhangsan");
userMetadata.put("department", "engineering");
userMetadata.put("version", "1.0.0");

client.putObject(
    PutObjectArgs.builder()
        .bucket("mybucket")
        .object("docs/manual.pdf")
        .filename("/data/manual.pdf")
        .headers(headers)
        .userMetadata(userMetadata)
        .contentType("application/pdf")
        .build()
);
```

**注意事项**：
- **已知大小流**，`objectSize` 传实际值，`partSize` 设为 `-1` 表示不触发自动分片。
- **未知大小流**，`objectSize` 传 `-1`，`partSize` 必须指定一个正数（如 `10 * 1024 * 1024`），此时 SDK 自动执行分片上传。
- 单次 `putObject` 最大支持 5 TiB；超过 5 GiB 建议显式使用分片上传。
- `mc pipe` 适合从管道读取数据，可以结合 `--tags` 参数在写入时打标签。
- 目录对象以 `/` 结尾，内容为空，用于组织 S3 前缀结构。

---

## 对象下载
### GetObject
**概念定义**：从 Bucket 中读取指定对象的全部或部分内容，返回一个可读取的 `InputStream`（Java SDK 中为 `GetObjectResponse`）。支持通过 HTTP Range 头实现部分下载（断点续传、分片下载）。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 源 Bucket 名称 |
| `object` | String | 是 | 源对象名称 |
| `offset` | Long | 否 | 起始字节偏移量（Range 下载） |
| `length` | Long | 否 | 读取字节数（Range 下载） |
| `versionId` | String | 否 | 对象版本 ID |
| `ssec` | ServerSideEncryptionCustomerKey | 否 | 客户端加密密钥 |

**配置示例**：

**mc 命令：**
```bash
# 下载对象到本地
mc cp myminio/mybucket/reports/report.pdf ./report.pdf

# 下载整个目录
mc cp --recursive myminio/mybucket/reports/ ./reports/
```

**Java SDK —— 完整下载对象：**
```java
import io.minio.GetObjectArgs;
import io.minio.GetObjectResponse;
import java.io.FileOutputStream;
import java.io.InputStream;

try (GetObjectResponse response = client.getObject(
        GetObjectArgs.builder()
            .bucket("mybucket")
            .object("reports/report.pdf")
            .build()
    )) {
    // GetObjectResponse 实现了 InputStream
    try (FileOutputStream fos = new FileOutputStream("/tmp/report.pdf")) {
        byte[] buf = new byte[8192];
        int n;
        while ((n = response.read(buf)) != -1) {
            fos.write(buf, 0, n);
        }
    }
}
```

**Java SDK —— 范围请求（Range 下载）：**
```java
// 从第 1024 字节开始，读取 2048 字节
try (GetObjectResponse response = client.getObject(
        GetObjectArgs.builder()
            .bucket("mybucket")
            .object("data/large-file.bin")
            .offset(1024L)      // 起始偏移
            .length(2048L)      // 读取长度
            .build()
    )) {
    // 处理部分数据
    byte[] chunk = response.readAllBytes();
    System.out.println("Downloaded " + chunk.length + " bytes");
}
```

**注意事项**：
- **`GetObjectResponse`** 是 `InputStream` 的子类，使用完毕后必须关闭以释放连接。
- Range 下载的 `offset` 和 `length` 必须同时指定，缺省时走完整下载。
- 大文件下载推荐使用 Range 分片策略，并行下载不同片段后合并。
- `mc cp` 下载默认覆盖本地同名文件，可通过 `--continue` 启用断点续传。

---

## 对象删除
### RemoveObject（单个删除）
**概念定义**：删除指定 Bucket 中的单个对象。若 Bucket 启用了版本控制，则生成一个删除标记（Delete Marker）而非物理删除；若要物理删除必须指定 `versionId`。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `versionId` | String | 否 | 版本 ID（指定后物理删除该版本） |
| `bypassGovernanceMode` | Boolean | 否 | 绕过治理模式保留 |

**配置示例**：

**mc 命令：**
```bash
# 基本删除
mc rm myminio/mybucket/temp-file.txt

# 递归删除（目录及其下所有对象）
mc rm --recursive myminio/mybucket/temp/

# 清理未完成的分片上传
mc rm --incomplete myminio/mybucket

# 强制删除 Bucket 及其所有对象
mc rb --force myminio/mybucket
```

**Java SDK —— 单个删除：**
```java
import io.minio.RemoveObjectArgs;

client.removeObject(
    RemoveObjectArgs.builder()
        .bucket("mybucket")
        .object("temp-file.txt")
        .build()
);
```

**Java SDK —— 物理删除指定版本：**
```java
client.removeObject(
    RemoveObjectArgs.builder()
        .bucket("mybucket")
        .object("temp-file.txt")
        .versionId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")
        .build()
);
```

### RemoveObjects（批量删除）
**概念定义**：一次请求删除多个对象，支持静默模式和详细模式。返回删除结果列表（成功/失败）。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `objects` | Iterable\<DeleteObject\> | 是 | 待删除对象列表 |
| `quiet` | Boolean | 否 | 静默模式（不返回成功删除列表） |
| `bypassGovernanceMode` | Boolean | 否 | 绕过治理模式保留 |

**Java SDK：**
```java
import io.minio.RemoveObjectsArgs;
import io.minio.messages.DeleteObject;
import java.util.LinkedList;
import java.util.List;

List<DeleteObject> objects = new LinkedList<>();
objects.add(new DeleteObject("logs/2025-01.log"));
objects.add(new DeleteObject("logs/2025-02.log"));
objects.add(new DeleteObject("logs/2025-03.log"));

Iterable<io.minio.Result<io.minio.messages.DeleteError>> results =
    client.removeObjects(
        RemoveObjectsArgs.builder()
            .bucket("mybucket")
            .objects(objects)
            .build()
    );

for (io.minio.Result<io.minio.messages.DeleteError> result : results) {
    io.minio.messages.DeleteError error = result.get();
    System.out.println("Error: " + error.objectName() + " - " + error.message());
}
```

**注意事项**：
- **删除标记（Delete Marker）**：启用版本控制后，`removeObject` 不传 `versionId` 仅插入删除标记，对象仍可通过 `versionId` 恢复。
- **`mc rm --recursive`** 会遍历并删除所有匹配对象，操作不可逆，执行前建议先 `mc ls` 确认范围。
- **`mc rm --incomplete`** 用于清理因中断而残留的未完成分片上传，避免产生存储费用。
- **`mc rb --force`** 会先清空 Bucket 内所有对象再删除 Bucket，操作极危险，请谨慎使用。
- 批量删除 `removeObjects` 单次最多支持 1000 个对象。

---

## 对象列表
### ListObjects
**概念定义**：列出 Bucket 中满足指定条件的对象列表。支持前缀过滤（`prefix`）和目录层级分隔（`delimiter`），以实现按目录结构浏览或递归列出所有对象。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `prefix` | String | 否 | 前缀过滤（目录路径） |
| `delimiter` | String | 否 | 分隔符（`/`）用于目录层级折叠 |
| `maxKeys` | Integer | 否 | 单次返回最大对象数（分页大小） |
| `startAfter` | String | 否 | 从指定对象名之后开始列出 |
| `recursive` | Boolean | 否 | 是否递归列出（忽略 delimiter） |
| `includeVersions` | Boolean | 否 | 是否包含对象版本 |
| `includeUserMetadata` | Boolean | 否 | 是否在结果中附带用户元数据 |

**配置示例**：

**mc 命令：**
```bash
# 列出 Bucket 根目录
mc ls myminio/mybucket

# 递归列出所有对象
mc ls --recursive myminio/mybucket

# 按前缀过滤
mc ls myminio/mybucket/logs/2025/
```

**Java SDK —— 递归列出所有对象：**
```java
import io.minio.ListObjectsArgs;
import io.minio.Result;
import io.minio.messages.Item;

Iterable<Result<Item>> results = client.listObjects(
    ListObjectsArgs.builder()
        .bucket("mybucket")
        .recursive(true)          // 递归列出所有子目录
        .maxKeys(100)             // 每页最多 100 个
        .build()
);

for (Result<Item> result : results) {
    Item item = result.get();
    System.out.println(
        item.objectName() + " | " +
        item.size() + " | " +
        item.lastModified()
    );
}
```

**Java SDK —— 前缀过滤 + 目录层级（非递归）：**
```java
Iterable<Result<Item>> results = client.listObjects(
    ListObjectsArgs.builder()
        .bucket("mybucket")
        .prefix("logs/2025/")     // 只列出该前缀下的对象
        .delimiter("/")           // 折叠子目录，只返回当前层级
        .maxKeys(50)
        .startAfter("logs/2025/app-06.log")  // 分页游标
        .build()
);
```

**注意事项**：
- **`delimiter="/"` + `recursive=false`** 模拟传统文件系统的目录层级结构，结果中 `isDir()` 为 `true` 表示目录。
- **`recursive=true`** 忽略 `delimiter`，返回所有层级的对象，适合全量遍历。
- 分页参数 `maxKeys` 和 `startAfter` 配合使用可实现游标分页；`startAfter` 的值应为上一页最后一条记录的 `objectName`。
- `mc ls` 默认非递归，加 `--recursive` 递归列出。

---

## 对象复制
### CopyObject
**概念定义**：在同一 Bucket 内或跨 Bucket 复制对象，属于服务端复制（无需下载再上传）。可同时替换元数据、存储类、加密方式等。复制操作依据源对象大小，大对象自动走分片复制。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `source` | CopySource | 是 | 源对象（Bucket + 对象名 + 可选版本 ID） |
| `headers` | Map | 否 | 目标对象自定义 HTTP 头 |
| `userMetadata` | Map | 否 | 目标对象用户元数据（替换源元数据） |
| `metadataDirective` | Directive | 否 | `COPY`（保留源元数据） / `REPLACE`（替换元数据） |
| `sse` | ServerSideEncryption | 否 | 目标对象加密配置 |

**配置示例**：

**mc 命令：**
```bash
# 同 Bucket 复制
mc cp myminio/mybucket/src/file.txt myminio/mybucket/dst/file.txt

# 跨 Bucket 复制
mc cp myminio/source-bucket/data.csv myminio/target-bucket/archive/data.csv
```

**Java SDK —— 同 Bucket 复制：**
```java
import io.minio.CopyObjectArgs;
import io.minio.CopySource;

client.copyObject(
    CopyObjectArgs.builder()
        .bucket("mybucket")
        .object("archive/report-2025.pdf")
        .source(CopySource.builder()
            .bucket("mybucket")
            .object("reports/report-2025.pdf")
            .build())
        .build()
);
```

**Java SDK —— 跨 Bucket 复制并替换元数据：**
```java
import io.minio.messages.Directive;
import java.util.HashMap;
import java.util.Map;

Map<String, String> newMetadata = new HashMap<>();
newMetadata.put("copied-by", "batch-job");
newMetadata.put("archive-date", "2025-07-17");

client.copyObject(
    CopyObjectArgs.builder()
        .bucket("archive-bucket")
        .object("backups/report-2025.pdf")
        .source(CopySource.builder()
            .bucket("source-bucket")
            .object("reports/report-2025.pdf")
            .build())
        .metadataDirective(Directive.REPLACE)   // 替换元数据
        .userMetadata(newMetadata)
        .build()
);
```

**注意事项**：
- **服务端复制**：数据不经过客户端，直接在 MinIO 集群内部完成，效率远高于"下载-上传"。
- 复制时 `metadataDirective` 默认为 `COPY`，即保留源对象元数据；设为 `REPLACE` 则用新元数据覆盖。
- `mc cp` 在不同路径间执行即为服务端复制（同一个 `myminio` 别名下不会触发下载）。
- 大对象复制会自动使用分片复制，无需手动干预。

---

## 分片上传
### MultipartUpload
**概念定义**：将大文件拆分为多个 Part 并行上传，最后合并为一个完整对象。适合超过 5 GiB 的文件或网络不稳定场景。支持断点续传和并发加速。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `uploadId` | String | 是（手动） | 上传 ID（由 `createMultipartUpload` 返回） |
| `partNumber` | Integer | 是（手动） | 分片序号（从 1 开始） |
| `stream` | InputStream | 是（手动） | 分片数据流 |
| `partSize` | long | 是（手动） | 分片大小（字节） |
| `parallel` | Integer | 否（mc） | 并发上传线程数 |
| `part-size` | String | 否（mc） | 分片大小（mc 格式，如 `20MiB`） |

**配置示例**：

**mc 命令 —— 自动分片上传：**
```bash
# 并行上传大文件，分片大小 20 MiB，8 个线程
mc put --parallel 8 --part-size 20MiB /data/large-video.mp4 myminio/mybucket/videos/large-video.mp4

# 管道上传 + 分片
cat /data/huge-file.bin | mc pipe --part-size 50MiB myminio/mybucket/data/huge-file.bin
```

**mc 命令 —— 清理未完成分片：**
```bash
mc rm --incomplete myminio/mybucket
```

**Java SDK —— 自动分片（PutObjectArgs 指定 partSize）：**
```java
try (InputStream is = new FileInputStream("/data/large-video.mp4")) {
    client.putObject(
        PutObjectArgs.builder()
            .bucket("mybucket")
            .object("videos/large-video.mp4")
            .stream(is, -1, 20 * 1024 * 1024)  // objectSize=-1, partSize=20MiB 自动分片
            .contentType("video/mp4")
            .build()
    );
}
```

**Java SDK —— 手动分片上传流程：**
```java
import io.minio.*;
import io.minio.messages.Part;
import java.io.*;
import java.util.*;

// 1. 创建分片上传
String uploadId = client.createMultipartUpload(
    "mybucket", null, "videos/huge-file.mp4", null, null
);

// 2. 上传各个分片
List<Part> parts = new ArrayList<>();
File file = new File("/data/huge-file.mp4");
long partSize = 20 * 1024 * 1024; // 20 MiB
long fileSize = file.length();
int partNumber = 1;

for (long offset = 0; offset < fileSize; offset += partSize) {
    long currentPartSize = Math.min(partSize, fileSize - offset);
    try (InputStream partStream = new FileInputStream(file)) {
        partStream.skip(offset);

        UploadPartResponse response = client.uploadPart(
            "mybucket", null, "videos/huge-file.mp4",
            partStream, currentPartSize, uploadId, partNumber, null
        );
        parts.add(new Part(partNumber, response.etag()));
        partNumber++;
    }
}

// 3. 完成分片上传
client.completeMultipartUpload(
    "mybucket", null, "videos/huge-file.mp4", uploadId,
    parts.toArray(new Part[0]), null, null
);
```

**Java SDK —— 中止分片上传（清理残留）：**
```java
// 因错误或其他原因中止上传，清理已上传的分片
client.abortMultipartUpload(
    "mybucket", null, "videos/huge-file.mp4", uploadId, null, null
);
```

**注意事项**：
- **自动分片**：`PutObjectArgs` 中 `objectSize=-1` 且 `partSize>0` 时，SDK 自动执行分片上传，无需手动管理。
- **手动分片**：三步流程 `createMultipartUpload` -> `uploadPart` -> `completeMultipartUpload`，适合需要精细控制进度的场景。
- **断点续传**：若上传中断，可通过 `uploadId` 查询已上传的 Part 列表，从中断处继续上传。
- **残留清理**：未完成的 `completeMultipartUpload` 或 `abortMultipartUpload` 会产生残留分片持续占用存储，务必通过 `mc rm --incomplete` 或 `abortMultipartUpload` 清理。
- 分片序号从 1 开始，最大 10000 片；每个分片最小 5 MiB（最后一片除外）。

---

## 对象元数据
### StatObject
**概念定义**：获取对象的系统元数据和用户自定义元数据，不下载对象内容。返回信息包括对象大小、Content-Type、ETag、最后修改时间、用户元数据键值对等。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `versionId` | String | 否 | 版本 ID |

**系统元数据字段**：

| 字段 | 说明 |
|------|------|
| `size` | 对象大小（字节） |
| `contentType` | MIME 类型 |
| `etag` | 实体标签（MD5 哈希） |
| `lastModified` | 最后修改时间 |
| `versionId` | 版本 ID（若启用版本控制） |
| `userMetadata` | 用户自定义元数据 Map |

**配置示例**：

**mc 命令：**
```bash
mc stat myminio/mybucket/reports/report.pdf
```

**Java SDK：**
```java
import io.minio.StatObjectArgs;
import io.minio.StatObjectResponse;

StatObjectResponse stat = client.statObject(
    StatObjectArgs.builder()
        .bucket("mybucket")
        .object("reports/report.pdf")
        .build()
);

System.out.println("Size: " + stat.size());
System.out.println("Content-Type: " + stat.contentType());
System.out.println("ETag: " + stat.etag());
System.out.println("Last Modified: " + stat.lastModified());
System.out.println("User Metadata: " + stat.userMetadata());
```

**注意事项**：
- **`statObject`** 是轻量级操作，仅获取元数据，不会产生对象内容传输费用。
- `ETag` 通常为对象内容的 MD5 哈希值（分片上传对象为复合值），可用于校验完整性。
- 用户自定义元数据键名在返回时自动转为小写。
- 若对象不存在，`statObject` 抛出 `ErrorResponseException`（HTTP 404）。

---

## 对象标签
### ObjectTagging
**概念定义**：为对象附加键值对标签，用于分类、计费归属、生命周期策略匹配、访问控制等。每个对象最多 10 个标签，标签键和值区分大小写。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `tags` | Map\<String, String\> | 是 | 标签键值对 |
| `versionId` | String | 否 | 版本 ID |

**配置示例**：

**mc 命令：**
```bash
# 设置标签
mc tag set myminio/mybucket/reports/report.pdf "env=prod&department=finance&confidential=true"

# 查看标签
mc tag list myminio/mybucket/reports/report.pdf

# 管道上传时打标签
cat /data/export.csv | mc pipe --tags "env=prod&type=export" myminio/mybucket/exports/export.csv
```

**Java SDK —— 设置对象标签：**
```java
import io.minio.SetObjectTagsArgs;
import java.util.HashMap;
import java.util.Map;

Map<String, String> tags = new HashMap<>();
tags.put("env", "prod");
tags.put("department", "finance");
tags.put("confidential", "true");

client.setObjectTags(
    SetObjectTagsArgs.builder()
        .bucket("mybucket")
        .object("reports/report.pdf")
        .tags(tags)
        .build()
);
```

**Java SDK —— 获取对象标签：**
```java
import io.minio.GetObjectTagsArgs;
import io.minio.messages.Tags;

Tags tags = client.getObjectTags(
    GetObjectTagsArgs.builder()
        .bucket("mybucket")
        .object("reports/report.pdf")
        .build()
);

System.out.println("Tags: " + tags.get());
```

**注意事项**：
- 每个对象最多 **10 个标签**，每个键最长 128 字符，每个值最长 256 字符。
- 标签键和值区分大小写，建议使用小写加连字符命名。
- 对象标签可与生命周期策略联动，自动将匹配标签的对象转换存储类或过期删除。
- `mc pipe --tags` 在写入时同步打标签，避免二次 API 调用。

---

## 对象保留
### ObjectRetention
**概念定义**：在启用 Object Lock 的 Bucket 中，对对象设置保留策略，防止其在保留期内被删除或覆盖。支持两种模式：`GOVERNANCE`（治理模式，特权用户可绕过）和 `COMPLIANCE`（合规模式，任何用户不可绕过）。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `mode` | RetentionMode | 是 | `GOVERNANCE` 或 `COMPLIANCE` |
| `retainUntilDate` | ZonedDateTime | 是 | 保留截止日期 |
| `bypassGovernance` | Boolean | 否 | 绕过治理模式（删除时） |
| `versionId` | String | 否 | 版本 ID |

**配置示例**：

**mc 命令：**
```bash
# 设置对象保留至 2027-01-01（治理模式）
mc retention set myminio/mybucket/reports/report.pdf \
  --mode GOVERNANCE \
  --retain-until-date "2027-01-01T00:00:00Z"
```

**Java SDK —— 设置对象保留：**
```java
import io.minio.SetObjectRetentionArgs;
import io.minio.messages.RetentionMode;
import java.time.ZonedDateTime;

client.setObjectRetention(
    SetObjectRetentionArgs.builder()
        .bucket("mybucket")
        .object("reports/report.pdf")
        .mode(RetentionMode.COMPLIANCE)
        .retainUntilDate(ZonedDateTime.now().plusYears(3))
        .build()
);
```

**Java SDK —— 获取对象保留配置：**
```java
import io.minio.GetObjectRetentionArgs;
import io.minio.messages.Retention;

Retention retention = client.getObjectRetention(
    GetObjectRetentionArgs.builder()
        .bucket("mybucket")
        .object("reports/report.pdf")
        .build()
);

System.out.println("Mode: " + retention.mode());
System.out.println("Retain Until: " + retention.retainUntilDate());
```

**注意事项**：
- **前提条件**：Bucket 必须启用 Object Lock（创建时指定 `--with-lock`）。
- **GOVERNANCE**：普通用户不能删除，但拥有 `bypassGovernance` 权限的用户可以删除。
- **COMPLIANCE**：保留期内任何用户（包括 root）均无法删除或覆盖，是最高级别的合规保护。
- 对象保留与 Bucket 默认保留策略互斥：对象级保留优先于 Bucket 级默认保留。

---

## 对象归档恢复
### RestoreObject
**概念定义**：对处于归档存储类（如 Glacier）的对象发起临时恢复请求，使其在指定天数内可被访问。归档对象不可直接下载，必须先恢复。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `days` | Integer | 是 | 恢复后保持可访问的天数 |
| `tier` | String | 否 | 恢复速度：`Standard`（3-5 小时）、`Expedited`（1-5 分钟）、`Bulk`（5-12 小时） |
| `versionId` | String | 否 | 版本 ID |

**Java SDK：**
```java
import io.minio.RestoreObjectArgs;

client.restoreObject(
    RestoreObjectArgs.builder()
        .bucket("archive-bucket")
        .object("logs/2020/access.log")
        .days(7)                    // 恢复后保持 7 天可访问
        .tier("Expedited")          // 快速恢复
        .build()
);
```

**注意事项**：
- 归档对象恢复**不是即时操作**，`Expedited` 模式 1-5 分钟，`Standard` 模式 3-5 小时。
- `days` 指定恢复副本保留天数，到期后副本自动删除，原始归档对象不受影响。
- 恢复期间会产生临时副本存储费用，建议按需恢复并在使用完毕后不再依赖副本。
- 多次恢复同一对象不会延长保留期，而是重置为最新的 `days` 值。

---

## 对象组合
### ComposeObject
**概念定义**：将多个源对象合并为一个新对象，属于服务端合并操作。源对象可来自不同 Bucket。合并后对象大小不得超过 5 TiB。适用于日志聚合、文件拼接等场景。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `sources` | List\<ComposeSource\> | 是 | 源对象列表（至少 1 个） |
| `headers` | Map | 否 | 目标对象自定义 HTTP 头 |
| `userMetadata` | Map | 否 | 目标对象用户元数据 |
| `contentType` | String | 否 | 目标对象 MIME 类型 |

**ComposeSource 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 源 Bucket 名称 |
| `object` | String | 是 | 源对象名称 |
| `offset` | Long | 否 | 源对象起始偏移 |
| `length` | Long | 否 | 读取长度 |
| `versionId` | String | 否 | 源对象版本 ID |

**Java SDK：**
```java
import io.minio.ComposeObjectArgs;
import io.minio.ComposeSource;
import java.util.ArrayList;
import java.util.List;

List<ComposeSource> sources = new ArrayList<>();
sources.add(
    ComposeSource.builder()
        .bucket("logs-bucket")
        .object("2025/01/access.log")
        .build()
);
sources.add(
    ComposeSource.builder()
        .bucket("logs-bucket")
        .object("2025/02/access.log")
        .build()
);
sources.add(
    ComposeSource.builder()
        .bucket("logs-bucket")
        .object("2025/03/access.log")
        .build()
);

client.composeObject(
    ComposeObjectArgs.builder()
        .bucket("aggregated-bucket")
        .object("quarterly/Q1-2025-access.log")
        .sources(sources)
        .contentType("text/plain")
        .build()
);
```

**Java SDK —— 合并源对象的指定片段：**
```java
// 只取每个源对象的前 1 GiB 数据合并
sources.add(
    ComposeSource.builder()
        .bucket("logs-bucket")
        .object("2025/01/access.log")
        .offset(0L)
        .length(1024L * 1024 * 1024)  // 1 GiB
        .build()
);
```

**注意事项**：
- 合并操作是**服务端操作**，不经过客户端，非常高效。
- 合并后对象大小上限为 **5 TiB**。
- 源对象列表至少包含 1 个，最多 10000 个源对象。
- 若源对象是加密对象，目标对象也必须加密。
- 合并过程中各源对象按顺序拼接，可通过 `offset` 和 `length` 精确控制每个源对象的参与范围。

---

## SQL SELECT
### SelectObjectContent
**概念定义**：使用标准 SQL 语法对对象内容进行服务端查询，仅返回匹配的行/列，无需下载整个对象。支持 CSV、JSON、Parquet 输入格式，输出为 CSV 或 JSON。适用于对大型结构化对象进行即席查询。

**核心参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `bucket` | String | 是 | 目标 Bucket 名称 |
| `object` | String | 是 | 目标对象名称 |
| `sqlExpression` | String | 是 | SQL 查询语句 |
| `inputSerialization` | InputSerialization | 是 | 输入格式（CSV/JSON/Parquet） |
| `outputSerialization` | OutputSerialization | 是 | 输出格式（CSV/JSON） |
| `requestProgress` | Boolean | 否 | 是否启用进度通知 |

**SQL 语法要点**：
- 基础格式：`SELECT * FROM S3Object [WHERE ...] [LIMIT ...]`
- `FROM S3Object` 是固定表名，不可更改
- 支持 `SELECT`、`WHERE`、`LIMIT` 子句
- 不支持 `JOIN`、`GROUP BY`、`ORDER BY`

**Java SDK：**
```java
import io.minio.SelectObjectContentArgs;
import io.minio.messages.*;

// 输入序列化配置（CSV，逗号分隔，含表头）
InputSerialization inputSerialization = new InputSerialization(
    new CsvInputSerialization(
        CsvInputSerialization.builder()
            .fileHeaderInfo(FileHeaderInfo.USE)  // 使用第一行作为列名
            .fieldDelimiter(",")
            .quoteCharacter("\"")
            .build()
    ),
    CompressionType.NONE
);

// 输出序列化配置（CSV）
OutputSerialization outputSerialization = new OutputSerialization(
    new CsvOutputSerialization(
        CsvOutputSerialization.builder()
            .fieldDelimiter(",")
            .quoteCharacter("\"")
            .build()
    )
);

// 执行 SQL 查询
SelectResponseStream response = client.selectObjectContent(
    SelectObjectContentArgs.builder()
        .bucket("mybucket")
        .object("data/employees.csv")
        .sqlExpression("SELECT s.name, s.salary FROM S3Object s WHERE s.salary > 50000 LIMIT 100")
        .inputSerialization(inputSerialization)
        .outputSerialization(outputSerialization)
        .requestProgress(true)
        .build()
);

// 读取查询结果
byte[] result = response.readAllBytes();
System.out.println(new String(result));
response.close();
```

**Java SDK —— JSON 输入 + JSON 输出：**
```java
InputSerialization jsonInput = new InputSerialization(
    new JsonInputSerialization(
        JsonInputSerialization.builder()
            .type(JsonType.DOCUMENT)  // 或 LINES
            .build()
    ),
    CompressionType.NONE
);

OutputSerialization jsonOutput = new OutputSerialization(
    new JsonOutputSerialization(
        JsonOutputSerialization.builder()
            .recordDelimiter("\n")
            .build()
    )
);

SelectResponseStream response = client.selectObjectContent(
    SelectObjectContentArgs.builder()
        .bucket("mybucket")
        .object("data/events.json")
        .sqlExpression("SELECT s.eventType, s.timestamp FROM S3Object s WHERE s.eventType = 'error'")
        .inputSerialization(jsonInput)
        .outputSerialization(jsonOutput)
        .build()
);
```

**注意事项**：
- **S3 Select 是服务端操作**：数据在 MinIO 服务端完成过滤和投影，仅返回结果集，大幅减少网络传输。
- 固定表名 `S3Object` 必须大写，且别名（如 `s`）不能省略。
- CSV 输入建议设置 `FileHeaderInfo.USE` 以使用第一行作为列名，否则列名为 `_1`、`_2` 等。
- JSON 输入支持 `DOCUMENT`（单个 JSON 对象）和 `LINES`（每行一个 JSON 对象，适合日志文件）。
- SQL 不支持 `JOIN`、`GROUP BY`、`ORDER BY` 等高级操作，仅适用于简单过滤和投影。
- 查询超时默认 60 秒，可通过 `requestProgress` 获取进度信息。

---

## 交叉引用

- [MinIO核心概念](./MinIO核心概念.md)
- [MinIO部署与配置](./MinIO部署与配置.md)
- [MinIO-Bucket操作](./MinIO-Bucket操作.md)
- [MinIO权限与安全](./MinIO权限与安全.md)
- [MinIO数据管理](./MinIO数据管理.md)
- [MinIO-Java-SDK](./MinIO-Java-SDK.md)
- [MinIO运维监控](./MinIO运维监控.md)
- [MinIO-Spring-Boot集成](./MinIO-Spring-Boot集成.md)