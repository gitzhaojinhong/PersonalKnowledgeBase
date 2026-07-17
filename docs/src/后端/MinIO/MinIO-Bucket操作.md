# MinIO Bucket 操作知识归档

> **版本基线**: MinIO RELEASE.2025-04-22T22-12-26Z
> **Java SDK**: io.minio:minio (官方 minio-java)

---

## Bucket 创建与删除
---

### Bucket 创建
**概念定义**: Bucket（存储桶）是 MinIO 中存储对象的逻辑容器，类似于文件系统中的顶层目录。每个 Bucket 内部的 Object 数据相互隔离。创建 Bucket 时，可同步启用对象锁定（`--with-lock`）和版本控制（`--with-versioning`），并指定区域（`--region`）。对象锁定和版本控制是后续高级特性（WORM、ILM、复制）的前置条件。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ALIAS` | 路径 | 是 | MinIO 别名及 Bucket 名称，如 `myminio/mybucket` |
| `--ignore-existing` | 标志 | 否 | 若 Bucket 已存在则静默跳过，不报错 |
| `--region` | 字符串 | 否 | 指定 Bucket 所在区域，默认 `us-east-1` |
| `--with-lock` | 标志 | 否 | 启用对象锁定（Object Lock），隐含启用版本控制 |
| `--with-versioning` | 标志 | 否 | 启用对象版本控制，允许每个对象保留多个历史版本 |

**配置示例**:

```bash
# 基本创建
mc mb myminio/my-bucket

# 创建并启用对象锁定（WORM 前置条件）
mc mb --with-lock myminio/secure-bucket

# 创建并启用版本控制
mc mb --with-versioning myminio/versioned-bucket

# 指定区域创建
mc mb --region us-west-2 myminio/us-west-bucket

# 忽略已存在错误（幂等创建）
mc mb --ignore-existing myminio/my-bucket
```

```java
// Java SDK - 基本创建 Bucket
import io.minio.MinioClient;
import io.minio.MakeBucketArgs;

MinioClient minioClient = MinioClient.builder()
    .endpoint("https://play.min.io")
    .credentials("accessKey", "secretKey")
    .build();

// 基本创建
minioClient.makeBucket(
    MakeBucketArgs.builder()
        .bucket("my-bucket")
        .build()
);

// 创建并启用对象锁定
minioClient.makeBucket(
    MakeBucketArgs.builder()
        .bucket("secure-bucket")
        .objectLock(true)
        .build()
);

// 指定区域创建
minioClient.makeBucket(
    MakeBucketArgs.builder()
        .bucket("us-west-bucket")
        .region("us-west-2")
        .build()
);
```

```java
// Java SDK - 检查 Bucket 是否存在
import io.minio.BucketExistsArgs;

boolean found = minioClient.bucketExists(
    BucketExistsArgs.builder()
        .bucket("my-bucket")
        .build()
);
```

**注意事项**: **对象锁定只能在创建 Bucket 时启用，创建后无法追加。** 未启用对象锁定的 Bucket 永远无法使用 WORM 保留或 Legal Hold 功能。MinIO 不限制每个部署的 Bucket 数量，但建议不超过 500,000 个。`--with-lock` 会隐式启用版本控制，因此在创建时无需同时指定 `--with-versioning`。

---

### Bucket 删除
**概念定义**: 删除 Bucket 会永久移除该 Bucket 及其所有对象版本、配置（生命周期规则、复制规则、策略等）。此操作不可逆。若仅需清空 Bucket 内容而保留 Bucket 本身，应使用 `mc rm`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ALIAS` | 路径 | 是 | MinIO 别名及 Bucket 路径，支持多个目标 |
| `--force` | 标志 | 是（安全确认） | 确认删除含对象的 Bucket，强制移除所有内容 |
| `--dangerous` | 标志 | 否 | 全局删除别名下所有 Bucket，等效于 `rm -rf` |

**配置示例**:

```bash
# 删除空 Bucket
mc rb myminio/empty-bucket

# 强制删除含对象的 Bucket
mc rb --force myminio/data-bucket

# 批量删除多个 Bucket
mc rb --force myminio/bucket1 myminio/bucket2
```

```java
// Java SDK - 删除 Bucket
import io.minio.RemoveBucketArgs;

minioClient.removeBucket(
    RemoveBucketArgs.builder()
        .bucket("data-bucket")
        .build()
);
```

**注意事项**: **`mc rb --force` 会永久删除 Bucket 内所有对象版本，包括 DeleteMarker 和所有历史版本，不可恢复。** 在执行删除前，确保已备份关键数据。对于启用了对象锁定的 Bucket，若存在处于保留期内的对象，则无法删除该 Bucket 直至所有保留期过期。`--dangerous` 标志会删除部署上所有 Bucket，使用前务必二次确认。

---

## 版本控制
---

### 版本控制启用与暂停
**概念定义**: 版本控制（Versioning）是 MinIO 的一项 Bucket 级特性，用于保留对象的多个历史版本。启用后，每次对同名对象的 PUT 操作都会创建一个新版本，旧版本不会被覆盖。版本控制是 Bucket 复制、站点复制和对象锁定的前置条件。

| 子命令 | 说明 |
|--------|------|
| `mc version enable ALIAS` | 启用版本控制 |
| `mc version suspend ALIAS` | 暂停版本控制（已有版本保留，新上传不创建版本） |
| `mc version info ALIAS` | 查看当前版本控制状态 |

**配置示例**:

```bash
# 启用版本控制
mc version enable myminio/my-bucket

# 暂停版本控制
mc version suspend myminio/my-bucket

# 查看版本控制状态
mc version info myminio/my-bucket
```

```java
// Java SDK - 设置版本控制
import io.minio.SetBucketVersioningArgs;
import io.minio.GetBucketVersioningArgs;
import io.minio.messages.VersioningConfiguration;

// 启用版本控制 (Enabled)
minioClient.setBucketVersioning(
    SetBucketVersioningArgs.builder()
        .bucket("my-bucket")
        .config(new VersioningConfiguration(
            VersioningConfiguration.Status.ENABLED, null))
        .build()
);

// 暂停版本控制 (Suspended)
minioClient.setBucketVersioning(
    SetBucketVersioningArgs.builder()
        .bucket("my-bucket")
        .config(new VersioningConfiguration(
            VersioningConfiguration.Status.SUSPENDED, null))
        .build()
);
```

```java
// Java SDK - 获取版本控制状态
VersioningConfiguration config = minioClient.getBucketVersioning(
    GetBucketVersioningArgs.builder()
        .bucket("my-bucket")
        .build()
);
System.out.println("Status: " + config.status());
```

**注意事项**: **暂停版本控制不会删除已有版本，仅是停止为后续上传创建新版本。** 暂停期间，同名对象的 PUT 操作会覆盖当前版本（而不是创建新版本）。版本控制启用后，每个对象最多可保留 Int64 最大值（约 9.2 万亿）个版本，建议配合生命周期过期规则清理旧版本。

---

### 版本 ID 与 DeleteMarker
**概念定义**: 每个对象版本都有一个唯一的版本 ID，由 MinIO 自动分配，用于精确标识和操作特定版本。DeleteMarker（删除标记）是版本控制 Bucket 中的特殊对象——当用户对某个对象执行 DELETE 操作时，MinIO 并不物理删除数据，而是创建一个 DeleteMarker 作为最新版本，标记该对象为"已删除"。这保证了历史版本的可恢复性。

**核心概念**:

| 概念 | 说明 |
|------|------|
| **版本 ID（Version ID）** | 每个对象版本的唯一标识符，MinIO 自动分配，不可自定义 |
| **DeleteMarker** | 删除操作产生的特殊标记对象，使对象在列表中不可见，但历史版本仍保留 |
| **当前版本（Current Version）** | 对象的最新版本（若最新版本为 DeleteMarker，则对象表现为已删除） |
| **非当前版本（Noncurrent Version）** | 被新版本取代的历史版本 |

**配置示例**:

```bash
# 列出对象的所有版本（含 DeleteMarker）
mc ls --versions myminio/my-bucket/object.txt

# 删除特定版本
mc rm --version-id "VERSION_ID" myminio/my-bucket/object.txt

# 恢复被 DeleteMarker 标记的对象（删除 DeleteMarker 即可）
mc rm --version-id "DELETE_MARKER_VERSION_ID" myminio/my-bucket/object.txt
```

**注意事项**: **DeleteMarker 本身也是一个对象版本，拥有独立的版本 ID。** 要恢复被"删除"的对象，只需删除对应的 DeleteMarker 即可让上一个版本重新成为当前版本。若配合 ILM 生命周期管理，可使用 `--expire-delete-marker` 参数在对象无剩余版本时自动清理 DeleteMarker。

---

## 对象锁定（Object Lock / WORM）
---

### 对象锁定概述
**概念定义**: 对象锁定（Object Lock）实现 WORM（Write Once Read Many）模型，对已版本化的对象施加不可变性保护，防止对象在保留期内被删除或覆盖。MinIO 遵循 AWS S3 的对象锁定规范，支持两种锁定模式：Governance 和 Compliance。对象锁定必须在创建 Bucket 时通过 `--with-lock` 启用。

| 模式 | 说明 |
|------|------|
| **Governance（治理模式）** | 普通用户无法删除/覆盖，但拥有 `s3:BypassGovernanceRetention` 权限的管理员可以绕过 |
| **Compliance（合规模式）** | 任何用户（包括 root）在保留期内均无法删除或覆盖，满足最严格的合规要求 |

**注意事项**: **对象锁定是 Bucket 级别的不可逆配置——创建 Bucket 时必须使用 `--with-lock` 启用，否则该 Bucket 永远无法使用 WORM 功能。** 启用对象锁定会隐式启用版本控制。对象锁定设置后，在保留期内任何删除或覆盖操作都会收到 `AccessDenied` 错误。

---

### 保留期限设置
**概念定义**: 保留期限（Retention Period）定义对象在创建后受保护的时间长度。支持按天（`Nd`）或按年（`Ny`）设置。可针对单个对象、特定版本或整个 Bucket 设置默认保留策略。

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `MODE` | 枚举 | 是 | 锁定模式：`GOVERNANCE` 或 `COMPLIANCE` |
| `VALIDITY` | 字符串 | 是 | 保留期限，格式 `Nd`（天）或 `Ny`（年），如 `30d`、`1y` |
| `--default` | 标志 | 否 | 设为 Bucket 默认保留策略，新对象自动继承 |
| `--recursive` | 标志 | 否 | 递归应用于 Bucket 内所有对象 |
| `--version-id` | 字符串 | 否 | 应用于特定版本 ID |
| `--bypass` | 标志 | 否 | 仅 Governance 模式，允许管理员绕过 |

**配置示例**:

```bash
# 为 Bucket 设置默认保留策略（Governance 30天）
mc retention set --default GOVERNANCE "30d" myminio/my-bucket

# 为 Bucket 设置默认保留策略（Compliance 1年）
mc retention set --default COMPLIANCE "1y" myminio/my-bucket

# 递归设置所有对象的保留期限
mc retention set --recursive GOVERNANCE "90d" myminio/my-bucket

# 为特定版本设置保留
mc retention set --version-id "VERSION_ID" COMPLIANCE "180d" myminio/my-bucket/object.txt
```

```java
// Java SDK - 设置对象锁定配置
import io.minio.SetObjectLockConfigurationArgs;
import io.minio.GetObjectLockConfigurationArgs;
import io.minio.messages.ObjectLockConfiguration;
import io.minio.messages.RetentionDurationDays;
import io.minio.messages.RetentionMode;

// 设置 Bucket 默认对象锁定
minioClient.setObjectLockConfiguration(
    SetObjectLockConfigurationArgs.builder()
        .bucket("secure-bucket")
        .config(new ObjectLockConfiguration(
            RetentionMode.GOVERNANCE,
            new RetentionDurationDays(30)))
        .build()
);

// 获取对象锁定配置
ObjectLockConfiguration lockConfig = minioClient.getObjectLockConfiguration(
    GetObjectLockConfigurationArgs.builder()
        .bucket("secure-bucket")
        .build()
);
System.out.println("Mode: " + lockConfig.mode());
System.out.println("Duration: " + lockConfig.duration().days() + " days");
```

**注意事项**: **Compliance 模式下的对象在保留期内任何人均无法删除，包括 root 用户。** 这是最严格的合规级别，适用于金融、医疗等监管行业。Governance 模式提供灵活性，管理员可通过 `s3:BypassGovernanceRetention` 权限在必要时删除。默认保留策略仅对设置后新创建的对象生效，不会追溯应用于已有对象。

---

## 合法保留（Legal Hold）
---

### Legal Hold 设置与清除
**概念定义**: 合法保留（Legal Hold）是一种独立于保留期限的对象锁定机制，用于无限期阻止对象被删除或修改。与保留期限不同，Legal Hold 没有过期时间，始终保持有效直到显式清除。Legal Hold 通常用于诉讼保留、审计调查等场景中需要无限期保护特定对象的场合。

| 子命令 | 说明 |
|--------|------|
| `mc legalhold set ALIAS` | 对指定对象设置 Legal Hold |
| `mc legalhold clear ALIAS` | 清除指定对象的 Legal Hold |
| `mc legalhold info ALIAS` | 查看对象的 Legal Hold 状态 |

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `ALIAS` | 路径 | 是 | 对象路径，如 `myminio/my-bucket/object.txt` |
| `--recursive` | 标志 | 否 | 递归应用于指定前缀下的所有对象 |
| `--version-id` | 字符串 | 否 | 应用于特定版本 ID |

**配置示例**:

```bash
# 设置合法保留
mc legalhold set myminio/my-bucket/important-file.pdf

# 递归设置合法保留
mc legalhold set --recursive myminio/my-bucket/legal-docs/

# 清除合法保留
mc legalhold clear myminio/my-bucket/important-file.pdf

# 查看合法保留状态
mc legalhold info myminio/my-bucket/important-file.pdf
```

```java
// Java SDK - 启用对象 Legal Hold
import io.minio.EnableObjectLegalHoldArgs;
import io.minio.DisableObjectLegalHoldArgs;

minioClient.enableObjectLegalHold(
    EnableObjectLegalHoldArgs.builder()
        .bucket("secure-bucket")
        .object("important-file.pdf")
        .build()
);

// 禁用对象 Legal Hold
minioClient.disableObjectLegalHold(
    DisableObjectLegalHoldArgs.builder()
        .bucket("secure-bucket")
        .object("important-file.pdf")
        .build()
);
```

**注意事项**: **Legal Hold 与 Retention 的关系：Legal Hold 优先级高于 Retention。** 即使对象的保留期限已过期，只要 Legal Hold 仍然有效，对象就持续受保护。同时，Legal Hold 生效期间，对保留期限的修改或清除操作不会产生任何效果。**Legal Hold 也需要 Bucket 在创建时启用对象锁定。** Legal Hold 无过期概念，必须手动清除，适合临时性法律调查场景。

---

## 生命周期管理（ILM）
---

### ILM 概念与过期规则
**概念定义**: 对象生命周期管理（ILM, Intelligent Lifecycle Management）允许自动管理对象的生命周期，根据时间或日期规则自动执行对象过期（删除）或转换（分层到远程存储）。MinIO 内置扫描器定期检查对象是否符合规则，并自动执行相应操作。ILM 规则以 JSON 格式描述，兼容 AWS S3 生命周期规则语法。

**过期规则核心参数**:

| 参数 | 说明 |
|------|------|
| `--expiry-days N` | 对象创建 N 天后自动过期（删除） |
| `--expiry-date YYYY-MM-DD` | 在指定日期后自动过期（删除） |
| `--noncurrent-expiry-days N` | 非当前版本在变为非当前 N 天后过期 |
| `--expire-delete-marker` | 当对象无剩余版本时自动清理 DeleteMarker |
| `--expire-all-object-versions` | 使所有无可删除标记的对象版本在指定天数后过期 |

**配置示例**:

```bash
# 添加过期规则：30天后自动删除日志文件
mc ilm rule add myminio/logs-bucket \
    --name "expire-logs" \
    --prefix "app-logs/" \
    --expiry-days 30

# 非当前版本 90 天后过期
mc ilm rule add myminio/versioned-bucket \
    --name "cleanup-old-versions" \
    --noncurrent-expiry-days 90

# 清理孤儿 DeleteMarker
mc ilm rule add myminio/versioned-bucket \
    --name "cleanup-deletemarkers" \
    --expire-delete-marker

# 查看所有 ILM 规则
mc ilm rule list myminio/my-bucket

# 删除指定 ILM 规则
mc ilm rule remove --id "RULE_ID" myminio/my-bucket
```

```java
// Java SDK - 设置生命周期
import io.minio.SetBucketLifecycleArgs;
import io.minio.GetBucketLifecycleArgs;
import io.minio.messages.*;

// 创建过期规则
LifecycleRule expireRule = new LifecycleRule(
    Status.ENABLED,
    null,
    new Expiration((ZonedDateTime) null, 30, null),
    new RuleFilter("app-logs/"),
    "expire-logs",
    null,
    null,
    null
);

minioClient.setBucketLifecycle(
    SetBucketLifecycleArgs.builder()
        .bucket("my-bucket")
        .config(new LifecycleConfiguration(Arrays.asList(expireRule)))
        .build()
);

// 获取生命周期配置
LifecycleConfiguration lifecycleConfig = minioClient.getBucketLifecycle(
    GetBucketLifecycleArgs.builder()
        .bucket("my-bucket")
        .build()
);
```

**注意事项**: **ILM 扫描器是低优先级进程，可能在实际规则期限过后才检测到符合条件的对象。** 因此不应依赖 ILM 实现精确到秒的过期。对于版本化 Bucket，默认过期规则仅作用于当前版本（创建 DeleteMarker），对非当前版本需使用 `--noncurrent-expiry-days`。生命周期规则删除的对象不会被复制到复制目标。

---

### 转换规则（Tiering / 分层）
**概念定义**: 对象转换（Transition）将指定天数后的对象自动迁移到远程存储层（如 Amazon S3、Google Cloud Storage、Azure Blob Storage 或其他 MinIO 集群），以降低存储成本。转换后的对象元数据仍保留在源 MinIO 集群上，MinIO 透明地管理分层对象的检索，无需应用程序感知。

| 参数 | 说明 |
|------|------|
| `--transition-days N` | 当前版本创建 N 天后转换到远程层 |
| `--transition-tier TIER_NAME` | 转换目标层名称（由 `mc ilm tier add` 定义） |
| `--noncurrent-transition-days N` | 非当前版本在变为非当前 N 天后转换 |
| `--noncurrent-transition-tier TIER_NAME` | 非当前版本的转换目标层 |

**配置示例**:

```bash
# 添加远程存储层（MinIO 到 MinIO）
mc ilm tier add minio WARM_TIER \
    --endpoint https://backup-minio.example.com \
    --access-key ACCESS_KEY \
    --secret-key SECRET_KEY \
    --bucket backup-bucket \
    --prefix warm-data/

# 添加转换规则：90天后转换到 WARM_TIER，365天后过期
mc ilm rule add myminio/production-bucket \
    --name "tier-then-expire" \
    --prefix "archive/" \
    --transition-days 90 \
    --transition-tier WARM_TIER \
    --expiry-days 365

# 非当前版本 30 天后转换到 COLD_TIER
mc ilm rule add myminio/versioned-bucket \
    --name "noncurrent-tier" \
    --noncurrent-transition-days 30 \
    --noncurrent-transition-tier COLD_TIER

# 查看远程层列表
mc ilm tier list myminio
```

```java
// Java SDK - 设置含转换规则的生命周期
Transition transition = new Transition(
    ZonedDateTime.now().plusDays(90),
    90,
    "WARM_TIER"
);

LifecycleRule transitionRule = new LifecycleRule(
    Status.ENABLED,
    null,
    null,
    new RuleFilter("archive/"),
    "tier-rule",
    null,
    transition,
    null
);

minioClient.setBucketLifecycle(
    SetBucketLifecycleArgs.builder()
        .bucket("production-bucket")
        .config(new LifecycleConfiguration(Arrays.asList(transitionRule)))
        .build()
);
```

**注意事项**: **对象转换不提供备份/恢复功能。** 远程层存储的是对象数据，元数据仍在源 MinIO，二者紧密耦合。对远程层的任何外部修改都可能导致数据丢失。所有对转换对象的访问必须通过源 MinIO 的 S3 API 进行。MinIO 不支持需要重新水合（rehydration）或人工干预的远程存储类型（如 Glacier Deep Archive）。目录对象（名称以 `/` 结尾的 0 字节对象）不会被分层。

---

## Bucket Policy（IAM JSON 策略）
---

### Policy 结构与 Action
**概念定义**: Bucket Policy 是基于 JSON 的 IAM 访问控制策略，用于定义谁可以访问 Bucket 中的哪些资源以及执行哪些操作。策略以 AWS S3 兼容的 JSON 格式编写，遵循 `Version`、`Statement`（包含 `Effect`、`Action`、`Resource`、`Condition`）的结构。

**Policy 核心字段**:

| 字段 | 说明 |
|------|------|
| `Version` | 策略语言版本，固定为 `"2012-10-17"` |
| `Statement` | 策略语句数组，每条语句由 Effect、Action、Resource、Condition 组成 |
| `Effect` | 效果：`Allow`（允许）或 `Deny`（显式拒绝，优先级高于 Allow） |
| `Action` | S3 操作列表，如 `s3:GetObject`、`s3:PutObject`、`s3:ListBucket` |
| `Resource` | 资源 ARN，格式 `arn:aws:s3:::bucketname/object-prefix` |
| `Condition` | 可选的条件表达式，如 IP 限制、用户代理限制等 |

**常用 Action 列表**:

| Action | 说明 |
|--------|------|
| `s3:GetObject` | 下载/读取对象 |
| `s3:PutObject` | 上传/创建对象 |
| `s3:DeleteObject` | 删除对象 |
| `s3:ListBucket` | 列出 Bucket 内对象 |
| `s3:GetBucketLocation` | 获取 Bucket 区域 |
| `s3:ListAllMyBuckets` | 列出所有 Bucket |
| `s3:GetBucketPolicy` | 读取 Bucket 策略 |
| `s3:PutBucketPolicy` | 设置 Bucket 策略 |
| `s3:AbortMultipartUpload` | 中止分片上传 |
| `s3:ListBucketMultipartUploads` | 列出进行中的分片上传 |

**配置示例**:

```bash
# 公共只读策略（公开 GetObject）
mc anonymous set download myminio/public-bucket

# 私有读写策略（移除匿名访问）
mc anonymous set private myminio/private-bucket

# 通过 JSON 文件设置策略
mc policy set-json policy.json myminio/my-bucket

# 导出当前策略
mc policy get-json myminio/my-bucket > policy.json
```

**公共只读策略 JSON**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::public-bucket/*"]
    }
  ]
}
```

**用户前缀策略（`${aws:username}` 变量）**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::user-bucket/${aws:username}/*"]
    }
  ]
}
```

**IP 限制条件策略**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Principal": { "AWS": ["*"] },
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::secure-bucket/*"],
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": ["10.0.0.0/8", "192.168.0.0/16"]
        }
      }
    }
  ]
}
```

```java
// Java SDK - 设置 Bucket Policy
import io.minio.SetBucketPolicyArgs;
import io.minio.GetBucketPolicyArgs;

String policyJson = "{\n" +
    "  \"Version\": \"2012-10-17\",\n" +
    "  \"Statement\": [\n" +
    "    {\n" +
    "      \"Effect\": \"Allow\",\n" +
    "      \"Principal\": { \"AWS\": [\"*\"] },\n" +
    "      \"Action\": [\"s3:GetObject\"],\n" +
    "      \"Resource\": [\"arn:aws:s3:::public-bucket/*\"]\n" +
    "    }\n" +
    "  ]\n" +
    "}";

minioClient.setBucketPolicy(
    SetBucketPolicyArgs.builder()
        .bucket("public-bucket")
        .config(policyJson)
        .build()
);

// 获取 Bucket Policy
String currentPolicy = minioClient.getBucketPolicy(
    GetBucketPolicyArgs.builder()
        .bucket("public-bucket")
        .build()
);
System.out.println(currentPolicy);
```

**注意事项**: **`Deny` 效果优先级高于 `Allow`，显式拒绝会覆盖任何允许规则。** 公共读策略（`mc anonymous set download`）仅开放 `s3:GetObject`，不开放 `s3:ListBucket`，因此无法直接列出 Bucket 内容。`${aws:username}` 变量动态替换为当前 IAM 用户名，实现用户级目录隔离。AR 资源格式区分 Bucket 级别（`arn:aws:s3:::bucketname`）和对象级别（`arn:aws:s3:::bucketname/*`）。

---

## Bucket 加密
---

### 默认加密配置
**概念定义**: Bucket 加密（Server-Side Encryption, SSE）确保所有上传到 Bucket 的对象自动使用服务端加密，无需客户端显式指定加密头。MinIO 支持 SSE-S3（MinIO 管理的密钥），对象在写入磁盘前自动加密，读取时自动解密。

| 加密模式 | 说明 |
|----------|------|
| **SSE-S3** | MinIO 自动管理加密密钥（AES-256），对用户透明 |
| **SSE-C** | 客户提供密钥（Customer Key），MinIO 不存储密钥 |

**配置示例**:

```bash
# 通过 mc 设置默认加密（SSE-S3）
mc encrypt set sse-s3 myminio/my-bucket

# 查看加密配置
mc encrypt info myminio/my-bucket

# 清除加密配置
mc encrypt clear myminio/my-bucket
```

```java
// Java SDK - 设置 Bucket 加密
import io.minio.SetBucketEncryptionArgs;
import io.minio.GetBucketEncryptionArgs;
import io.minio.messages.SseConfiguration;
import io.minio.messages.SseConfigurationRule;
import io.minio.messages.SseS3Rule;

// 设置 SSE-S3 默认加密
SseConfiguration sseConfig = new SseConfiguration(
    Arrays.asList(
        new SseConfigurationRule(
            null,
            new SseS3Rule()
        )
    )
);

minioClient.setBucketEncryption(
    SetBucketEncryptionArgs.builder()
        .bucket("my-bucket")
        .config(sseConfig)
        .build()
);

// 获取加密配置
SseConfiguration currentSse = minioClient.getBucketEncryption(
    GetBucketEncryptionArgs.builder()
        .bucket("my-bucket")
        .build()
);
```

**注意事项**: **默认加密设置后，仅对后续上传的对象生效，不会追溯加密已有对象。** 若已有对象需要加密，必须通过 COPY 操作（同 Bucket 内复制）触发加密。SSE-S3 模式下，MinIO 内部使用 AES-256-GCM 加密算法，密钥由 MinIO 的 KES（Key Encryption Service）管理。删除加密配置不会解密已有对象。

---

## Bucket 标签
---

### 标签管理
**概念定义**: Bucket 标签（Tags）是键值对形式的元数据标注，用于分类、成本分配、访问控制和自动化管理。每个 Bucket 最多支持 50 个标签，标签键和值区分大小写。

| 子命令 | 说明 |
|--------|------|
| `mc tag set ALIAS "KEY=VALUE"` | 设置标签（覆盖已有标签） |
| `mc tag list ALIAS` | 列出所有标签 |
| `mc tag remove ALIAS` | 移除所有标签 |

**配置示例**:

```bash
# 设置标签
mc tag set myminio/my-bucket "Environment=Production"
mc tag set myminio/my-bucket "Department=Engineering&CostCenter=CC-123"

# 查看标签
mc tag list myminio/my-bucket

# 移除所有标签
mc tag remove myminio/my-bucket
```

```java
// Java SDK - 设置 Bucket 标签
import io.minio.SetBucketTagsArgs;
import io.minio.GetBucketTagsArgs;
import java.util.Map;
import java.util.HashMap;

Map<String, String> tags = new HashMap<>();
tags.put("Environment", "Production");
tags.put("Department", "Engineering");
tags.put("CostCenter", "CC-123");

minioClient.setBucketTags(
    SetBucketTagsArgs.builder()
        .bucket("my-bucket")
        .tags(tags)
        .build()
);

// 获取 Bucket 标签
Map<String, String> retrievedTags = minioClient.getBucketTags(
    GetBucketTagsArgs.builder()
        .bucket("my-bucket")
        .build()
);
System.out.println("Tags: " + retrievedTags);
```

**注意事项**: **`mc tag set` 会覆盖所有已有标签，而非追加。** 如需追加标签，需要先 `mc tag list` 获取现有标签，再与新标签合并后重新设置。每个 Bucket 最多 50 个标签，每个标签键最大 128 字符，每个标签值最大 256 字符。Bucket 标签不计入对象标签，二者独立管理。

---

## Bucket 通知
---

### 通知配置
**概念定义**: Bucket 通知（Bucket Notification）允许在特定事件发生时异步发送通知到外部系统。MinIO 支持多种通知目标（Kafka、Webhook、AMQP、Redis、NATS、MySQL、PostgreSQL、Elasticsearch），通过事件类型和前缀/后缀过滤规则精确控制通知范围。

**支持的通知目标**:

| 目标类型 | 说明 |
|----------|------|
| **Kafka** | 推送到 Apache Kafka Topic |
| **Webhook** | HTTP POST 到指定 URL |
| **AMQP** | 推送到 RabbitMQ 等 AMQP 消息队列 |
| **Redis** | 发布到 Redis Pub/Sub 频道 |
| **NATS** | 推送到 NATS Subject |
| **MySQL** | 写入 MySQL 数据库表 |
| **PostgreSQL** | 写入 PostgreSQL 数据库表 |
| **Elasticsearch** | 索引到 Elasticsearch 集群 |

**事件类型**:

| 事件类型 | 说明 |
|----------|------|
| `s3:ObjectCreated:*` | 所有对象创建事件（Put、Post、Copy、CompleteMultipartUpload） |
| `s3:ObjectCreated:Put` | PUT 操作创建对象 |
| `s3:ObjectCreated:Post` | POST 操作创建对象 |
| `s3:ObjectCreated:Copy` | COPY 操作创建对象 |
| `s3:ObjectRemoved:*` | 所有对象删除事件 |
| `s3:ObjectRemoved:Delete` | DELETE 操作删除对象 |
| `s3:ObjectAccessed:*` | 所有对象访问事件 |
| `s3:ObjectAccessed:Get` | GET 操作访问对象 |
| `s3:ObjectAccessed:Head` | HEAD 操作访问对象 |
| `s3:Replication:*` | 复制相关事件 |

**配置示例**:

```bash
# 配置 Kafka 通知目标
mc admin config set myminio notify_kafka:primary \
    brokers="kafka1:9092,kafka2:9092" \
    topic="minio-events"

# 配置 Webhook 通知目标
mc admin config set myminio notify_webhook:webhook1 \
    endpoint="https://webhook.example.com/events" \
    auth_token="Bearer TOKEN"

# 配置 Bucket 通知事件（Kafka）
mc event add myminio/my-bucket \
    arn:minio:sqs::primary:kafka \
    --event "s3:ObjectCreated:*,s3:ObjectRemoved:*" \
    --prefix "uploads/" \
    --suffix ".jpg"

# 配置 Bucket 通知事件（Webhook）
mc event add myminio/my-bucket \
    arn:minio:sqs::webhook1:webhook \
    --event "s3:ObjectCreated:Put" \
    --prefix "transactions/"

# 查看 Bucket 通知配置
mc event list myminio/my-bucket

# 移除 Bucket 通知
mc event remove myminio/my-bucket \
    arn:minio:sqs::primary:kafka
```

**重启服务使通知配置生效**:

```bash
mc admin service restart myminio
```

```java
// Java SDK - 设置 Bucket 通知
import io.minio.SetBucketNotificationArgs;
import io.minio.GetBucketNotificationArgs;
import io.minio.messages.*;

// 构建通知配置
NotificationConfiguration notificationConfig = new NotificationConfiguration();

// 配置 Kafka 通知
CloudFunctionConfiguration kafkaConfig = new CloudFunctionConfiguration(
    "arn:minio:sqs::primary:kafka"
);
kafkaConfig.addEvents(Arrays.asList(
    EventType.OBJECT_CREATED_PUT,
    EventType.OBJECT_CREATED_COPY
));
kafkaConfig.addFilterRule(
    new FilterRule("prefix", "uploads/")
);
kafkaConfig.addFilterRule(
    new FilterRule("suffix", ".jpg")
);
notificationConfig.addCloudFunctionConfiguration(kafkaConfig);

minioClient.setBucketNotification(
    SetBucketNotificationArgs.builder()
        .bucket("my-bucket")
        .config(notificationConfig)
        .build()
);

// 获取通知配置
NotificationConfiguration currentNotify = minioClient.getBucketNotification(
    GetBucketNotificationArgs.builder()
        .bucket("my-bucket")
        .build()
);
```

**注意事项**: **通知目标配置（如 Kafka brokers、Webhook URL）是通过 `mc admin config set` 在服务器级别配置的，修改后需要重启 MinIO 服务才能生效。** Bucket 级别的事件订阅通过 `mc event add` 配置，无需重启。前缀和后缀过滤支持同时使用，二者为 AND 关系。通知至少保证一次送达（at-least-once），不保证严格一次（exactly-once），消费者需实现幂等处理。

---

## 交叉引用
| 文档 | 说明 |
|------|------|
| [MinIO核心概念](./MinIO核心概念.md) | Bucket、Object、版本控制等基础概念详解 |
| [MinIO部署与配置](./MinIO部署与配置.md) | MinIO 服务端部署、mc 客户端配置、通知目标配置 |
| [MinIO-Object操作](./MinIO-Object操作.md) | 对象上传、下载、删除、预签名 URL、分片上传 |
| [MinIO权限与安全](./MinIO权限与安全.md) | IAM 策略、用户管理、TLS 加密、SSE-C 加密 |
| [MinIO数据管理](./MinIO数据管理.md) | 对象锁定、ILM、复制、分层存储综合管理 |
| [MinIO-Java-SDK](./MinIO-Java-SDK.md) | Java SDK 完整 API 参考、最佳实践 |
| [MinIO运维监控](./MinIO运维监控.md) | Prometheus 监控、日志审计、性能调优 |
| [MinIO-Spring-Boot集成](./MinIO-Spring-Boot集成.md) | Spring Boot 自动配置、健康检查、模板封装 |

---

> **文档版本**: v1.0
> **适用版本**: MinIO RELEASE.2025-04-22T22-12-26Z
> **Java SDK**: io.minio:minio