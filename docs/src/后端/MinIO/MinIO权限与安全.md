# MinIO 权限与安全知识归档

> **版本基线**: MinIO RELEASE.2025-04-22T22-12-26Z
> **Java SDK**: io.minio:minio (官方 minio-java)

---

## IAM策略概述
### Policy结构
**概念定义**: MinIO采用基于策略的访问控制（PBAC），使用与AWS IAM兼容的JSON策略文档定义对MinIO服务器上资源的访问规则。单个策略文档最大容量为20KiB，对附加到用户或组的策略数量无限制。

**核心参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Version` | String | 是 | 策略语言版本，固定值 `"2012-10-17"` |
| `Statement` | Array | 是 | 策略语句数组，每个元素描述一条权限规则 |
| `Id` | String | 否 | 策略标识符（可选） |

**配置示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::my-bucket", "arn:aws:s3:::my-bucket/*"]
    }
  ]
}
```

**注意事项**: **Version必须为 `"2012-10-17"`，这是当前唯一支持的策略语言版本。Statement必须为数组格式，即使只有一条语句也需使用数组包装。Resource使用 `arn:aws:s3:::` 前缀格式，支持 `*` 和 `?` 通配符。**

---

### Statement元素
**概念定义**: Statement是策略文档的核心单元，每条Statement描述一个独立的权限声明，包含Effect（效果）、Action（操作）、Resource（资源）和Condition（条件）四个核心字段。

**核心参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Effect` | String | 是 | 授权效果：`Allow`（允许）或 `Deny`（拒绝） |
| `Action` | Array/String | 是 | S3 API操作列表，如 `s3:GetObject`、`s3:PutObject`、`s3:ListBucket` |
| `Resource` | Array/String | 是 | 资源ARN，格式 `arn:aws:s3:::bucket-name/object-prefix` |
| `Condition` | Object | 否 | 条件约束，限定策略生效场景 |
| `Principal` | Object | 否 | 主体标识（匿名访问策略中使用 `{"AWS": "*"}`） |
| `Sid` | String | 否 | 语句标识符（Statement ID） |

**支持的S3 Action（常用）**:

| 类别 | Action | 说明 |
|------|--------|------|
| 通用 | `s3:*` | 所有S3操作 |
| Bucket | `s3:CreateBucket` | 创建存储桶 |
| Bucket | `s3:DeleteBucket` | 删除存储桶 |
| Bucket | `s3:ListAllMyBuckets` | 列出所有存储桶 |
| Bucket | `s3:GetBucketLocation` | 获取存储桶位置 |
| Object | `s3:GetObject` | 下载对象 |
| Object | `s3:PutObject` | 上传对象 |
| Object | `s3:DeleteObject` | 删除对象 |
| Object | `s3:ListBucket` | 列出桶内对象 |
| 版本控制 | `s3:DeleteObjectVersion` | 删除指定版本 |
| 版本控制 | `s3:ListBucketVersions` | 列出所有版本 |
| 加密 | `s3:PutEncryptionConfiguration` | 设置加密配置 |
| 加密 | `s3:GetEncryptionConfiguration` | 获取加密配置 |
| 生命周期 | `s3:PutLifecycleConfiguration` | 设置生命周期 |
| 生命周期 | `s3:GetLifecycleConfiguration` | 获取生命周期 |
| 策略 | `s3:PutBucketPolicy` | 设置桶策略 |
| 策略 | `s3:GetBucketPolicy` | 获取桶策略 |
| 对象锁定 | `s3:PutObjectRetention` | 设置保留模式 |
| 对象锁定 | `s3:PutObjectLegalHold` | 设置依法保留 |
| 对象锁定 | `s3:BypassGovernanceRetention` | 绕过治理保留 |
| 复制 | `s3:ReplicateObject` | 复制对象 |
| 复制 | `s3:ReplicateDelete` | 同步删除 |
| 分片上传 | `s3:AbortMultipartUpload` | 取消分片上传 |
| 分片上传 | `s3:ListMultipartUploadParts` | 列出分片 |

**支持的Condition Key（全局）**:

| Condition Key | 说明 |
|---------------|------|
| `aws:Referer` | HTTP Referer头限制 |
| `aws:SourceIp` | 源IP地址限制 |
| `aws:UserAgent` | 用户代理限制 |
| `aws:SecureTransport` | 要求HTTPS传输 |
| `aws:CurrentTime` | 当前时间限制 |
| `aws:EpochTime` | Unix时间戳限制 |
| `aws:PrincipalType` | 主体类型 |
| `aws:userid` | 用户ID |
| `aws:username` | 用户名 |
| `s3:signatureAge` | 签名有效期限制 |
| `s3:prefix` | 对象前缀限制（ListBucket） |
| `s3:delimiter` | 分隔符限制（ListBucket） |
| `s3:max-keys` | 最大键数限制 |
| `s3:x-amz-server-side-encryption` | SSE算法限制 |
| `s3:versionid` | 版本ID限制 |

**配置示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ],
      "Condition": {
        "IpAddress": {
          "aws:SourceIp": "10.0.0.0/8"
        },
        "Bool": {
          "aws:SecureTransport": "true"
        }
      }
    }
  ]
}
```

**注意事项**: **Resource字段必须同时包含桶本身（`arn:aws:s3:::bucket`）和桶内对象（`arn:aws:s3:::bucket/*`）两个条目，否则ListBucket或GetObject可能因资源不匹配而失败。Condition支持 `IpAddress`、`Bool`、`StringEquals`、`StringLike`等运算符。`*` 通配符可能导致非预期匹配，例如 `arn:aws:s3:::data*` 会同时匹配 `data`、`data_private` 和 `data_internal`。**

---

### Deny优先原则
**概念定义**: MinIO遵循AWS IAM策略评估逻辑：显式Deny > 显式Allow > 隐式Deny。当同一操作或资源上同时存在Allow和Deny规则时，Deny规则优先。如果没有任何规则匹配，则默认拒绝访问。

**核心参数**:

| 评估层级 | 优先级 | 说明 |
|----------|--------|------|
| 显式Deny | 最高（1） | 任何策略中的Deny语句立即生效，不可被覆盖 |
| 显式Allow | 中间（2） | 至少一条策略中的Allow语句，且无Deny覆盖 |
| 隐式Deny | 最低（3） | 无任何策略匹配时的默认行为 |

**配置示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::finance/*"]
    },
    {
      "Effect": "Deny",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::finance/secret/*"]
    }
  ]
}
```

**注意事项**: **Deny优先原则在用户组策略叠加时尤为重要——如果用户通过直接附加获得Allow权限，但所属组中有一条Deny策略覆盖同一资源，则Deny生效。建议审慎使用Deny规则，仅在需要明确排除特定子资源时使用。多策略评估时，MinIO取所有策略的并集（Allow累积），但Deny覆盖所有。**

---

### 内置策略
**概念定义**: MinIO提供一组预定义的内置策略，可直接附加到用户或组，无需手动编写JSON策略文档。

**核心参数**:

| 策略名称 | 等效权限 | 说明 |
|----------|----------|------|
| `consoleAdmin` | `s3:*` + `admin:*` | 完全管理权限，可执行所有S3和管理API操作 |
| `readonly` | `s3:GetBucketLocation` + `s3:GetObject` | 只读权限，不含列出桶/对象的能力 |
| `readwrite` | `s3:*` | 读写权限，对所有桶和对象完全访问 |
| `writeonly` | `s3:PutObject` | 仅写入权限，不含列出和读取 |
| `diagnostics` | `admin:ServerTrace`、`admin:Profiling`、`admin:ConsoleLog`、`admin:ServerInfo`、`admin:TopLocksInfo`、`admin:OBDInfo`、`admin:BandwidthMonitor`、`admin:Prometheus` | 诊断权限，用于运维监控 |

**配置示例**:

```bash
# 将readonly策略附加到用户
mc admin policy attach myminio readonly --user alice

# 将readwrite策略附加到组
mc admin policy attach myminio readwrite --group developers

# 将diagnostics策略附加到用户
mc admin policy attach myminio diagnostics --user ops-admin
```

**注意事项**: **`readonly` 策略有意排除了Listing权限（s3:ListBucket），因为典型场景中"只读"角色不应具备完整的可发现性。如需浏览目录，需额外添加 `s3:ListBucket` 权限。内置策略不可修改或删除，如需定制请使用自定义策略。**

---

### 自定义策略
**概念定义**: 通过 `mc admin policy create` 命令创建自定义策略，支持精细化的权限控制，满足企业级多租户场景需求。

**核心参数**:

| 参数 | 说明 |
|------|------|
| `ALIAS` | MinIO部署别名 |
| `POLICYNAME` | 策略名称（唯一标识） |
| `POLICYFILE` | 策略JSON文件路径 |

**配置示例**:

```bash
# 创建自定义策略JSON文件
cat > custom-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket", "s3:PutObject"],
      "Resource": [
        "arn:aws:s3:::project-alpha",
        "arn:aws:s3:::project-alpha/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": [
        "arn:aws:s3:::shared-assets",
        "arn:aws:s3:::shared-assets/*"
      ]
    }
  ]
}
EOF

# 创建自定义策略
mc admin policy create myminio project-alpha-policy custom-policy.json

# 列出所有策略
mc admin policy list myminio

# 查看策略详情
mc admin policy info myminio project-alpha-policy

# 删除自定义策略
mc admin policy remove myminio project-alpha-policy
```

**注意事项**: **策略名称必须是全局唯一的。策略文件必须是有效的JSON格式。策略文档单文件最大20KiB。删除策略前需确保该策略已从所有用户和组中分离，否则可能导致操作失败。**

---

### 策略变量
**概念定义**: MinIO支持在策略文档中使用变量，运行时动态替换为认证用户的属性值，实现基于用户身份的精细化资源隔离。支持 `${aws:username}` 和 `${jwt:*}` 两类变量。

**核心参数**:

| 变量 | 来源 | 说明 |
|------|------|------|
| `${aws:username}` | 内置用户 | 当前认证用户的用户名 |
| `${aws:userid}` | 内置用户 | 当前认证用户的用户ID |
| `${jwt:sub}` | OIDC JWT | JWT的sub声明 |
| `${jwt:preferred_username}` | OIDC JWT | 用户首选用户名 |
| `${jwt:email}` | OIDC JWT | 用户邮箱 |
| `${jwt:groups}` | OIDC JWT | 用户所属组 |
| `${jwt:iss}` | OIDC JWT | JWT签发者 |
| `${jwt:aud}` | OIDC JWT | JWT受众 |
| `${jwt:name}` | OIDC JWT | 用户全名 |
| `${jwt:given_name}` | OIDC JWT | 用户名字 |
| `${jwt:family_name}` | OIDC JWT | 用户姓氏 |
| `${jwt:client_id}` | OIDC JWT | 客户端ID |

**配置示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::mybucket"],
      "Condition": {
        "StringLike": {
          "s3:prefix": ["${jwt:preferred_username}/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::mybucket/${jwt:preferred_username}/*"]
    }
  ]
}
```

**注意事项**: **变量仅在策略评估时动态替换，策略存储时保留原始 `${...}` 表达式。变量替换后的值需与Resource模式匹配，如果变量值包含特殊字符可能导致非预期行为。JWT变量仅在OIDC认证流程中可用，内置用户认证时使用 `${aws:username}`。**

---

## 用户管理
### 内置用户
**概念定义**: MinIO内部用户（Internal User）是直接在MinIO部署中创建和管理的用户账户，通过Access Key/Secret Key进行身份认证，适用于不依赖外部身份提供商（IdP）的场景。

**核心参数**:

| 命令 | 说明 |
|------|------|
| `mc admin user add ALIAS ACCESSKEY SECRETKEY` | 添加用户 |
| `mc admin user list ALIAS` | 列出所有用户 |
| `mc admin user remove ALIAS ACCESSKEY` | 删除用户 |
| `mc admin user info ALIAS ACCESSKEY` | 查看用户信息 |

**配置示例**:

```bash
# 添加用户
mc admin user add myminio alice AliceSecretKey123!

# 列出所有用户
mc admin user list myminio

# 查看用户信息
mc admin user info myminio alice

# 删除用户
mc admin user remove myminio alice
```

**注意事项**: **AccessKey长度必须在3到20个字符之间。SecretKey长度必须在8到40个字符之间。强烈建议使用强密码策略（大小写字母、数字、特殊字符组合）。内置用户管理仅适用于MinIO内部用户，不适用于OIDC或LDAP外部用户。**

---

### 访问密钥
**概念定义**: 访问密钥（Access Key / Secret Key）是MinIO内置用户的核心凭证对，用于S3 API和mc客户端的身份认证。Access Key是公开标识符，Secret Key是私密密钥，两者配合完成签名认证。

**核心参数**:

| 参数 | 说明 |
|------|------|
| Access Key | 公钥标识符，3-20字符，用于API请求中的身份标识 |
| Secret Key | 私钥密钥，8-40字符，用于HMAC-SHA256签名计算 |
| 签名版本 | MinIO支持AWS Signature V2和V4（推荐V4） |

**配置示例**:

```bash
# 添加用户并指定访问密钥
mc admin user add myminio bob BobSecretKey456!

# 客户端配置使用访问密钥
mc alias set myminio http://192.168.1.100:9000 bob BobSecretKey456!
```

**注意事项**: **Secret Key仅在创建用户时返回一次，之后无法通过API查询。如需更换密钥，需删除并重新创建用户。访问密钥不应硬编码在应用代码中，推荐使用环境变量或密钥管理服务。访问密钥对所有S3操作均有效，务必通过策略限制其权限范围。**

---

### 用户启用与禁用
**概念定义**: 通过 `mc admin user enable/disable` 命令控制用户账户的激活状态。禁用的用户将无法通过其Access Key进行任何认证操作，但用户配置和附加策略保持不变。

**核心参数**:

| 命令 | 说明 |
|------|------|
| `mc admin user enable ALIAS ACCESSKEY` | 启用用户 |
| `mc admin user disable ALIAS ACCESSKEY` | 禁用用户 |

**配置示例**:

```bash
# 禁用用户
mc admin user disable myminio alice

# 启用用户
mc admin user enable myminio alice
```

**注意事项**: **禁用用户不会删除用户数据或策略绑定，仅是临时撤销认证能力。用户被禁用后，所有使用该用户凭证的客户端将立即失去访问权限。此操作不可逆地影响现有连接和会话。**

---

### 策略附加与分离
**概念定义**: 通过 `mc admin policy attach/detach` 命令将策略附加到用户或从用户分离策略，实现用户权限的动态管理。一个用户可以同时拥有多个策略，最终权限为所有策略的并集。

**核心参数**:

| 命令 | 说明 |
|------|------|
| `mc admin policy attach ALIAS POLICYNAME --user USERNAME` | 将策略附加到用户 |
| `mc admin policy detach ALIAS POLICYNAME --user USERNAME` | 从用户分离策略 |
| `mc admin policy entities ALIAS --policy POLICYNAME` | 查看策略关联的用户和组 |

**配置示例**:

```bash
# 将readonly策略附加到用户alice
mc admin policy attach myminio readonly --user alice

# 将自定义策略附加到用户bob
mc admin policy attach myminio project-alpha-policy --user bob

# 查看策略关联的实体
mc admin policy entities myminio --policy readonly

# 分离策略
mc admin policy detach myminio readonly --user alice
```

**注意事项**: **策略附加/分离操作立即生效，无需重启MinIO服务。用户可同时附加多个策略，权限取并集。分离策略后用户将立即失去该策略授予的所有权限。内置策略和自定义策略均可附加和分离。**

---

### Java SDK客户端凭证
**概念定义**: Java SDK通过 `MinioClient.builder().credentials()` 方法设置访问凭证，支持Access Key/Secret Key和STS临时凭证两种模式。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `endpoint` | String | MinIO服务端点URL |
| `accessKey` | String | Access Key |
| `secretKey` | String | Secret Key |
| `sessionToken` | String | STS会话令牌（可选，临时凭证时使用） |

**配置示例**:

```java
import io.minio.MinioClient;

// 方式一：使用长期凭证（Access Key + Secret Key）
MinioClient minioClient = MinioClient.builder()
    .endpoint("http://192.168.1.100:9000")
    .credentials("alice", "AliceSecretKey123!")
    .build();

// 方式二：使用STS临时凭证
MinioClient stsClient = MinioClient.builder()
    .endpoint("http://192.168.1.100:9000")
    .credentials(accessKey, secretKey, sessionToken)
    .build();

// 方式三：使用环境变量（推荐生产环境）
String accessKey = System.getenv("MINIO_ACCESS_KEY");
String secretKey = System.getenv("MINIO_SECRET_KEY");
MinioClient envClient = MinioClient.builder()
    .endpoint("http://192.168.1.100:9000")
    .credentials(accessKey, secretKey)
    .build();
```

**注意事项**: **生产环境严禁在代码中硬编码访问密钥。推荐使用环境变量、配置文件或密钥管理服务（如HashiCorp Vault）管理凭证。STS临时凭证必须在每次创建MinioClient时同时提供accessKey、secretKey和sessionToken三个参数。MinioClient实例是线程安全的，建议作为单例复用。**

---

## 组管理
### 组创建与成员管理
**概念定义**: MinIO组（Group）用于批量管理用户权限，将一组用户归入同一组，通过组级别的策略附加实现批量授权。组简化了大规模用户场景下的权限管理。

**核心参数**:

| 命令 | 说明 |
|------|------|
| `mc admin group add ALIAS GROUPNAME USERNAME...` | 添加用户到组（若组不存在则自动创建） |
| `mc admin group remove ALIAS GROUPNAME [USERNAME...]` | 从组移除用户（若不指定用户则删除组） |
| `mc admin group info ALIAS GROUPNAME` | 查看组信息（成员列表） |
| `mc admin group list ALIAS` | 列出所有组 |

**配置示例**:

```bash
# 创建组并添加成员
mc admin group add myminio developers alice bob

# 向已有组添加成员
mc admin group add myminio developers charlie

# 查看组信息
mc admin group info myminio developers

# 列出所有组
mc admin group list myminio

# 从组中移除成员
mc admin group remove myminio developers charlie

# 删除整个组（不指定成员）
mc admin group remove myminio developers
```

**注意事项**: **`mc admin group add` 在组不存在时会自动创建，在组存在时会追加成员。同一用户可以属于多个组。删除组不会删除组内用户，仅移除组和策略关联。组名区分大小写。**

---

### 策略继承
**概念定义**: 附加到组的策略会自动应用于组内所有成员，用户无需单独附加策略即可继承组权限。用户最终权限 = 直接附加策略 + 所有所属组继承策略的并集。

**核心参数**:

| 场景 | 权限计算 |
|------|----------|
| 用户直接附加策略A | 用户拥有策略A权限 |
| 用户所属组附加策略B | 用户拥有策略A + 策略B权限 |
| 用户所属组A/组B分别附加策略C/D | 用户拥有策略A + 策略C + 策略D权限 |
| 组策略含Deny，用户策略含Allow | Deny优先 |

**配置示例**:

```bash
# 创建组并附加策略
mc admin group add myminio data-team alice bob
mc admin policy attach myminio readonly --group data-team

# alice和bob自动继承readonly权限
# 同时可为alice单独附加额外权限
mc admin policy attach myminio diagnostics --user alice
```

**注意事项**: **策略继承是实时生效的。当用户从组中移除后，该组的策略权限立即失效。如用户同时存在于多个组，所有组的策略权限均生效（取并集）。Deny优先原则在组策略继承中同样适用——如果任一组的策略包含Deny，则覆盖所有Allow。**

---

### Java SDK对应操作
**概念定义**: MinIO Java SDK目前不直接提供用户/组管理的Admin API，组管理操作需通过mc命令行工具完成。Java SDK主要用于S3对象操作，权限配置通过mc命令或MinIO Console管理。

**配置示例**:

```java
// Java SDK专注于S3客户端操作，不直接管理用户/组
// 以下展示如何在应用中创建具有特定权限的客户端

// 场景：为用户创建隔离的客户端实例
public class MinioClientFactory {
    public static MinioClient createClientForUser(
            String endpoint, String accessKey, String secretKey) {
        return MinioClient.builder()
            .endpoint(endpoint)
            .credentials(accessKey, secretKey)
            .build();
    }
}

// 生产环境推荐通过STS临时凭证获取客户端
// 参见第5章节 STS临时凭证
```

**注意事项**: **Java SDK（io.minio:minio）的职责范围是S3 API操作，不包括Admin API。用户/组/策略管理必须通过mc命令行工具或MinIO Console完成。在应用代码中，应通过策略和服务账户控制权限，而非在代码中管理用户。**

---

## 服务账户
### 概念与架构
**概念定义**: 服务账户（Service Account）是主账户（Parent User）下的子身份实体，其权限范围不超过主账户的权限。服务账户拥有独立的Access Key和Secret Key，支持附加独立的策略以进一步限制权限。在较新版本中，`mc admin accesskey` 命令取代了 `mc admin user svcacct`。

**核心参数**:

| 参数 | 说明 |
|------|------|
| 主账户 | 服务账户的创建者，服务账户权限不超过主账户 |
| 独立凭证 | 服务账户拥有独立的Access Key/Secret Key |
| 子策略 | 可附加比主账户更严格的策略，实现最小权限原则 |
| 生命周期 | 服务账户可独立于主账户被删除 |

**配置示例**:

```bash
# 方式一：使用 mc admin user svcacct（旧版本）
# 创建服务账户
mc admin user svcacct add myminio alice \
    --access-key "svc-project-api" \
    --secret-key "svc-secret-key-789"

# 列出alice的所有服务账户
mc admin user svcacct list myminio alice

# 删除服务账户
mc admin user svcacct remove myminio svc-project-api

# 方式二：使用 mc admin accesskey（新版本，推荐）
# 创建服务账户
mc admin accesskey create myminio alice \
    --access-key "svc-project-api" \
    --secret-key "svc-secret-key-789" \
    --policy "readonly"

# 列出服务账户
mc admin accesskey list myminio alice
```

**注意事项**: **服务账户的权限是主账户权限和自身策略的交集——即主账户能做什么，服务账户最多也只能做什么，且可被进一步限制。服务账户适用于应用级隔离，每个微服务或应用模块使用独立的服务账户。主账户被删除或禁用时，其下所有服务账户同步失效。**

---

### 生命周期管理
**概念定义**: 服务账户拥有完整的生命周期管理能力，包括创建、列出、查询状态和删除操作。

**核心参数**:

| 操作 | 命令（旧版） | 命令（新版） |
|------|-------------|-------------|
| 创建 | `mc admin user svcacct add` | `mc admin accesskey create` |
| 列出 | `mc admin user svcacct list` | `mc admin accesskey list` |
| 删除 | `mc admin user svcacct remove` | `mc admin accesskey remove` |
| 信息 | `mc admin user svcacct info` | `mc admin accesskey info` |

**配置示例**:

```bash
# 创建服务账户时指定内联策略
mc admin accesskey create myminio alice \
    --name "app-order-service" \
    --policy '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["s3:GetObject","s3:PutObject","s3:ListBucket"],"Resource":["arn:aws:s3:::orders","arn:aws:s3:::orders/*"]}]}'

# 查看服务账户信息
mc admin accesskey info myminio app-order-service

# 列出所有服务账户
mc admin accesskey list myminio alice
```

**注意事项**: **创建服务账户时可通过 `--policy` 参数指定内联策略JSON或策略名称。服务账户的Access Key格式与普通用户相同，但权限模型不同。删除服务账户后，使用该凭证的所有客户端立即失效。建议定期轮换服务账户的Secret Key。**

---

### 使用场景
**概念定义**: 服务账户的核心价值在于实现应用级隔离和最小权限原则，避免多个应用共享同一套凭证。

**配置示例**:

```java
// 场景：订单服务使用专用的服务账户凭证
public class OrderServiceClient {
    private static final MinioClient client;

    static {
        // 使用服务账户凭证（权限受限在orders桶）
        client = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("svc-order-service", "order-svc-secret-key")
            .build();
    }

    public void uploadOrderFile(String orderId, InputStream data, long size) {
        client.putObject(PutObjectArgs.builder()
            .bucket("orders")
            .object("order-" + orderId + "/data.json")
            .stream(data, size, -1)
            .build());
    }
}
```

**注意事项**: **建议为每个微服务、每个部署环境（dev/staging/prod）创建独立的服务账户。服务账户的Secret Key应存入Vault或K8s Secret，不要硬编码。定期审计服务账户的权限，确保符合最小权限原则。主账户应使用强密码且仅用于管理操作，日常S3操作使用服务账户。**

---

## STS临时凭证
### AssumeRoleWithWebIdentity
**概念定义**: AssumeRoleWithWebIdentity是MinIO安全令牌服务（STS）的API端点，允许客户端通过OIDC JWT令牌换取临时S3访问凭证。适用于OIDC认证后的应用获取短期、受限的MinIO访问权限。

**核心参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Action` | String | 是 | 固定值 `AssumeRoleWithWebIdentity` |
| `WebIdentityToken` | String | 是 | OIDC Provider签发的JWT令牌 |
| `DurationSeconds` | Integer | 否 | 临时凭证有效期（秒），范围900-604800（15分钟-7天），默认3600（1小时） |
| `Policy` | String | 否 | 内联会话策略（JSON），用于进一步限制权限 |
| `RoleArn` | String | 否 | 角色ARN，与RolePolicy配置关联 |
| `RoleSessionName` | String | 否 | 会话名称标识 |
| `Version` | String | 是 | 固定值 `2011-06-15` |

**响应参数**:

| 字段 | 说明 |
|------|------|
| `Credentials.AccessKeyId` | 临时Access Key |
| `Credentials.SecretAccessKey` | 临时Secret Key |
| `Credentials.SessionToken` | 会话令牌（必须与临时凭证配合使用） |
| `Credentials.Expiration` | 凭证过期时间（ISO 8601格式） |
| `AssumedRoleUser.Arn` | 假设角色ARN |
| `AssumedRoleUser.AssumedRoleId` | 假设角色ID |

**配置示例**:

```bash
# 通过curl调用STS API
curl -X POST "http://192.168.1.100:9000" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "Action=AssumeRoleWithWebIdentity" \
  --data-urlencode "Version=2011-06-15" \
  --data-urlencode "WebIdentityToken=eyJhbGciOi..." \
  --data-urlencode "DurationSeconds=3600" \
  --data-urlencode "Policy=$(cat session-policy.json)"
```

**注意事项**: **WebIdentityToken必须是有效的JWT令牌，且需在有效期内。DurationSeconds默认1小时，最长7天，建议根据安全需求设置最小必要时长。Policy参数为内联会话策略，其权限不能超过JWT中声明的策略，且不支持Resource字段（详见5.3节）。**

---

### AssumeRoleWithLDAPIdentity
**概念定义**: AssumeRoleWithLDAPIdentity是MinIO STS的API端点，允许通过LDAP/AD用户名和密码换取临时S3访问凭证。用户通过AD/LDAP凭据认证后，MinIO根据AD/LDAP组成员关系匹配策略。

**核心参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Action` | String | 是 | 固定值 `AssumeRoleWithLDAPIdentity` |
| `LDAPUsername` | String | 是 | AD/LDAP用户名 |
| `LDAPPassword` | String | 是 | AD/LDAP密码 |
| `DurationSeconds` | Integer | 否 | 临时凭证有效期，默认3600秒 |
| `Policy` | String | 否 | 内联会话策略 |
| `Version` | String | 是 | 固定值 `2011-06-15` |

**配置示例**:

```bash
# 通过curl调用LDAP STS API
curl -X POST "http://192.168.1.100:9000" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "Action=AssumeRoleWithLDAPIdentity" \
  --data-urlencode "Version=2011-06-15" \
  --data-urlencode "LDAPUsername=aduser@company.com" \
  --data-urlencode "LDAPPassword=userpassword" \
  --data-urlencode "DurationSeconds=7200"
```

**注意事项**: **LDAPPassword以明文形式传输，必须通过HTTPS调用STS API端点。MinIO会验证LDAP凭据并在AD/LDAP服务器上执行绑定操作。策略匹配基于AD/LDAP用户的组成员关系，策略名称需与AD组名一致。如果AD/LDAP服务器不可用，STS API将返回认证失败。**

---

### STS策略格式
**概念定义**: STS内联会话策略（Session Policy）的格式与IAM策略文档不同，不支持 `Resource` 字段，仅支持 `Effect`、`Action` 和 `Condition` 字段。会话策略的权限范围是用户原有策略的子集，不能扩大权限。

**核心参数**:

| 字段 | 支持 | 说明 |
|------|------|------|
| `Version` | 是 | 固定值 `"2012-10-17"` |
| `Statement` | 是 | 策略语句数组 |
| `Effect` | 是 | `Allow` 或 `Deny` |
| `Action` | 是 | S3操作列表 |
| `Resource` | **否** | 不支持，会话策略应用于所有资源 |
| `Condition` | 是 | 条件约束 |

**配置示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket",
        "s3:PutObject"
      ]
    },
    {
      "Effect": "Deny",
      "Action": [
        "s3:DeleteObject"
      ]
    }
  ]
}
```

**注意事项**: **STS会话策略不支持Resource字段，策略应用于用户所有可访问的资源。会话策略不能扩大用户原有权限，只能做减法。会话策略通过Policy参数传递，需做URL编码。如果不指定Policy参数，临时凭证将继承用户（或JWT声明）的全部权限。**

---

### Java SDK集成
**概念定义**: MinIO Java SDK通过 `STSAssumeRoleWithWebIdentity` 方式获取临时凭证，适用于OIDC认证后的应用场景。

**配置示例**:

```java
import io.minio.MinioClient;
import io.minio.credentials.*;
import okhttp3.OkHttpClient;

// 方式一：使用WebIdentity凭证提供者
public class STSWebIdentityExample {
    public static void main(String[] args) {
        // 假设已从OIDC Provider获取JWT令牌
        String jwtToken = "eyJhbGciOi...";

        // 使用WebIdentity凭证提供者
        WebIdentityProvider provider = new WebIdentityProvider(
            () -> jwtToken,  // JWT令牌供应函数
            "http://192.168.1.100:9000",  // MinIO STS端点
            null,  // RoleArn（可选）
            null,  // RoleSessionName（可选）
            3600,  // DurationSeconds
            null   // 自定义OkHttpClient（可选）
        );

        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentialsProvider(provider)
            .build();

        // 使用临时凭证执行S3操作
        // 凭证会自动刷新...
    }
}

// 方式二：使用环境变量凭据链
public class ChainedCredentialsExample {
    public static void main(String[] args) {
        // MinIO SDK支持凭据链自动选择
        // 优先级：环境变量 > 配置文件 > WebIdentity
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentialsProvider(new ChainedProvider(
                new EnvironmentProvider(),
                new MinioEnvironmentProvider(),
                new AwsEnvironmentProvider()
            ))
            .build();
    }
}
```

**注意事项**: **WebIdentityProvider会自动在凭证过期前刷新，无需手动管理。JWT令牌供应函数在每次凭证刷新时被调用，确保JWT令牌在有效期内。生产环境建议使用 `ChainedProvider` 凭据链，按优先级自动选择可用的凭证来源。OkHttpClient应配置合理的超时和重试策略。**

---

## OIDC集成
### OIDC Provider配置
**概念定义**: MinIO通过 `mc admin config set identity_openid` 或 `mc idp openid` 命令配置OpenID Connect身份提供商，实现与企业SSO系统的集成。支持Authorization Code流程，不支持Implicit流程。

**核心参数**:

| 配置项 | 说明 |
|--------|------|
| `config_url` | OIDC Provider的 `.well-known/openid-configuration` URL |
| `client_id` | 在OIDC Provider注册的客户端ID |
| `client_secret` | 客户端密钥 |
| `claim_name` | 用于策略匹配的JWT声明名称（默认 `policy`） |
| `display_name` | 登录页面显示名称 |
| `scopes` | 请求的OIDC范围（如 `openid,profile,email`） |
| `redirect_uri` | 回调URI |
| `role_policy` | RolePolicy配置（RoleArn模式） |

**配置示例**:

```bash
# 配置OIDC Provider（Keycloak示例）
mc admin config set myminio identity_openid \
  config_url="https://keycloak.example.com/realms/myrealm/.well-known/openid-configuration" \
  client_id="minio-client" \
  client_secret="client-secret-value" \
  display_name="Company SSO" \
  scopes="openid,profile,email"

# 重启MinIO使配置生效
mc admin service restart myminio

# 查看当前OIDC配置
mc admin config get myminio identity_openid

# 配置RolePolicy（RoleArn模式）
mc admin config set myminio identity_openid \
  role_policy="readonly"
```

**注意事项**: **OIDC配置修改后需要重启MinIO服务才能生效。仅支持Authorization Code流程，不支持Implicit流程。config_url必须指向有效的 `.well-known/openid-configuration` 端点。JWT Claim模式每个部署仅支持一个OIDC Provider，RolePolicy模式支持多个Provider。**

---

### OIDC策略变量
**概念定义**: MinIO支持在策略文档中使用 `${jwt:*}` 变量，在策略评估时动态替换为认证用户的JWT声明值，实现基于用户属性的资源隔离。

**核心参数**:

| 变量 | JWT声明 | 典型用途 |
|------|---------|----------|
| `${jwt:sub}` | `sub` | 用户唯一标识 |
| `${jwt:preferred_username}` | `preferred_username` | 用户首选用户名，常用于前缀隔离 |
| `${jwt:email}` | `email` | 用户邮箱 |
| `${jwt:groups}` | `groups` | 用户所属组，用于组级别隔离 |
| `${jwt:iss}` | `iss` | 签发者，用于多Provider区分 |
| `${jwt:name}` | `name` | 用户全名 |
| `${jwt:given_name}` | `given_name` | 用户名字 |
| `${jwt:family_name}` | `family_name` | 用户姓氏 |
| `${jwt:client_id}` | `client_id` | 客户端ID |

**配置示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::mybucket"],
      "Condition": {
        "StringLike": {
          "s3:prefix": ["${jwt:preferred_username}/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": ["arn:aws:s3:::mybucket/${jwt:preferred_username}/*"]
    }
  ]
}
```

**注意事项**: **变量替换发生在策略评估时，策略存储时保留原始表达式。如果JWT中不存在对应声明，变量替换为空字符串，可能导致权限匹配失败。`${jwt:groups}` 返回的是数组，在条件表达式中行为可能因Provider实现而异。建议在创建策略前使用JWT调试工具确认JWT令牌中包含的声明字段。**

---

### 支持的Provider与策略示例
**概念定义**: MinIO OIDC集成兼容所有标准OIDC Provider，包括Keycloak、Auth0、Okta、Azure AD、Google Identity等。每个Provider的配置略有差异，但核心流程一致。

**核心参数**:

| Provider | 配置要点 |
|----------|----------|
| Keycloak | 使用Realm级别的 `.well-known/openid-configuration` 端点 |
| Auth0 | 使用Tenant域名作为OIDC端点 |
| Okta | 使用Authorization Server的OIDC端点 |
| Azure AD | 使用v2.0端点，注意tenant ID |
| Google | 使用Google的OIDC发现端点 |

**配置示例**:

```bash
# Keycloak配置示例
mc admin config set myminio identity_openid:keycloak \
  config_url="https://keycloak.example.com/realms/minio-realm/.well-known/openid-configuration" \
  client_id="minio" \
  client_secret="abc123def456" \
  display_name="Keycloak SSO" \
  scopes="openid,profile,email"

# Auth0配置示例
mc admin config set myminio identity_openid:auth0 \
  config_url="https://mytenant.auth0.com/.well-known/openid-configuration" \
  client_id="minio-app-client-id" \
  client_secret="auth0-client-secret" \
  claim_name="https://minio.io/policy" \
  display_name="Auth0 SSO"
```

**用户前缀隔离策略示例**:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": ["arn:aws:s3:::mybucket"],
      "Condition": {
        "StringLike": {
          "s3:prefix": ["${jwt:preferred_username}/*"]
        }
      }
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:PutObjectTagging",
        "s3:GetObjectTagging"
      ],
      "Resource": ["arn:aws:s3:::mybucket/${jwt:preferred_username}/*"]
    }
  ]
}
```

**注意事项**: **不同OIDC Provider的JWT声明字段名称可能不同，例如 `preferred_username` 在某些Provider中可能为 `username` 或 `email`。使用JWT调试工具确认声明字段后再编写策略。当使用多个OIDC Provider时，建议使用RolePolicy模式而非JWT Claim模式。配置完成后务必测试认证流程。**

---

## LDAP/AD集成
### LDAP Provider配置
**概念定义**: MinIO通过 `mc idp ldap add` 命令配置LDAP/AD身份提供商，实现与企业Active Directory或LDAP目录服务的集成。配置后，AD/LDAP用户可通过其域凭据访问MinIO。

**核心参数**:

| 配置项 | 说明 |
|--------|------|
| `server_addr` | LDAP/AD服务器地址，格式 `ldap.example.com:636` |
| `lookup_bind_dn` | 查询绑定DN（用于搜索用户） |
| `lookup_bind_password` | 查询绑定密码 |
| `user_dn_search_base_dn` | 用户搜索基础DN |
| `user_dn_search_filter` | 用户搜索过滤器，如 `(&(objectClass=user)(sAMAccountName=%s))` |
| `group_search_base_dn` | 组搜索基础DN |
| `group_search_filter` | 组搜索过滤器 |
| `tls_skip_verify` | 是否跳过TLS证书验证（`on`/`off`） |
| `server_insecure` | 是否允许非TLS连接（`on`/`off`） |
| `sts_expiry` | STS临时凭证过期时间 |

**配置示例**:

```bash
# 添加LDAP配置（Active Directory）
mc idp ldap add myminio \
  server_addr="ldap.company.com:636" \
  lookup_bind_dn="CN=minio-bind,CN=Users,DC=company,DC=com" \
  lookup_bind_password="bind-password" \
  user_dn_search_base_dn="CN=Users,DC=company,DC=com" \
  user_dn_search_filter="(&(objectClass=user)(sAMAccountName=%s))" \
  group_search_base_dn="CN=Users,DC=company,DC=com" \
  group_search_filter="(&(objectClass=group)(member=%d))" \
  tls_skip_verify="off"

# 查看LDAP配置
mc idp ldap list myminio

# 删除LDAP配置
mc idp ldap remove myminio
```

**注意事项**: **生产环境务必使用LDAPS（端口636）或StartTLS，设置 `tls_skip_verify=off`。`user_dn_search_filter` 中的 `%s` 占位符会被替换为用户名。`group_search_filter` 中的 `%d` 占位符会被替换为用户的完整DN。配置完成后需重启MinIO服务。LDAP配置同时支持Active Directory和标准LDAP（如OpenLDAP）。**

---

### AssumeRoleWithLDAPIdentity API
**概念定义**: 通过STS API `AssumeRoleWithLDAPIdentity` 端点，AD/LDAP用户使用其域凭据换取临时S3访问凭证。用户认证成功后，MinIO根据AD/LDAP组成员关系匹配同名策略。

**核心参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `Action` | String | 是 | `AssumeRoleWithLDAPIdentity` |
| `LDAPUsername` | String | 是 | AD/LDAP用户名（sAMAccountName或UPN） |
| `LDAPPassword` | String | 是 | AD/LDAP密码 |
| `DurationSeconds` | Integer | 否 | 凭证有效期（秒），默认3600（1小时） |
| `Policy` | String | 否 | 内联会话策略JSON |
| `Version` | String | 是 | `2011-06-15` |

**配置示例**:

```bash
# 调用LDAP STS API
curl -X POST "https://minio.company.com" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data-urlencode "Action=AssumeRoleWithLDAPIdentity" \
  --data-urlencode "Version=2011-06-15" \
  --data-urlencode "LDAPUsername=jdoe" \
  --data-urlencode "LDAPPassword=UserPassword123" \
  --data-urlencode "DurationSeconds=7200"
```

**响应示例**:

```xml
<AssumeRoleWithLDAPIdentityResponse>
  <AssumeRoleWithLDAPIdentityResult>
    <Credentials>
      <AccessKeyId>AKIAIOSFODNN7EXAMPLE</AccessKeyId>
      <SecretAccessKey>wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY</SecretAccessKey>
      <SessionToken>IQoJb3JpZ2luX2VjE...</SessionToken>
      <Expiration>2025-04-23T10:00:00Z</Expiration>
    </Credentials>
  </AssumeRoleWithLDAPIdentityResult>
</AssumeRoleWithLDAPIdentityResponse>
```

**注意事项**: **必须通过HTTPS调用STS API，因为LDAPPassword以明文传输。凭证过期后需重新调用API获取新凭证。AD/LDAP密码变更后，现有临时凭证不受影响，但新凭证获取需使用新密码。如果AD/LDAP服务器不可用，API返回 `LDAPServerError`。**

---

### AD用户组映射
**概念定义**: MinIO将AD/LDAP组名与策略名称进行自动映射。当AD用户通过LDAP认证后，MinIO查找与用户所属AD组同名的策略并自动附加。策略名称必须与AD组名完全一致。

**核心参数**:

| 映射关系 | 说明 |
|----------|------|
| AD组名 -> 策略名 | 策略名称必须与AD组名完全一致（区分大小写） |
| 用户 -> 多个AD组 | 用户属于多个AD组时，所有匹配的策略均生效 |
| 无匹配策略 | 若AD组名无对应策略，该组不授予任何权限 |

**配置示例**:

```bash
# 假设AD中有组: "Engineering-Data", "Finance-ReadOnly"
# 创建与AD组同名的策略

# 创建策略文件 engineering-data-policy.jsoncat > engineering-data-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket", "s3:DeleteObject"],
      "Resource": [
        "arn:aws:s3:::engineering-data",
        "arn:aws:s3:::engineering-data/*"
      ]
    }
  ]
}
EOF

# 创建与AD组同名的策略mc admin policy create myminio "Engineering-Data" engineering-data-policy.json

# 创建Finance-ReadOnly策略mc admin policy create myminio "Finance-ReadOnly" finance-readonly-policy.json

# 验证策略已创建mc admin policy list myminio
```

**注意事项**: **策略名称与AD组名必须完全一致（包括大小写）。如果AD组名包含特殊字符，可能需要在创建策略时进行转义处理。建议在AD中预定义好组名规范，再创建对应的MinIO策略。用户从AD组中移除后，对应权限在当前临时凭证过期后自动失效（新凭证不再包含该组权限）。**

---

## 预签名URL
### GET预签名
**概念定义**: GET预签名URL允许客户端在无需AWS凭证的情况下，通过带签名的临时URL下载私有存储桶中的对象。URL包含认证签名和过期时间，到期后自动失效。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `bucket` | String | 目标存储桶名称 |
| `object` | String | 对象路径 |
| `expiry` | Duration | 过期时间，默认7天（168小时），最大7天 |
| `method` | Method | HTTP方法，固定 `Method.GET` |
| `extraQueryParams` | Map | 附加查询参数（如 `response-content-type`） |

**配置示例**:

```bash
# mc命令：生成GET预签名URL（7天有效期）
mc share download myminio/mybucket/file.pdf

# mc命令：指定过期时间（30分钟）
mc share download --expire 30m myminio/mybucket/file.pdf

# mc命令：递归生成所有对象的URL
mc share download --recursive --expire 1h myminio/mybucket/
```

```java
// Java SDK：生成GET预签名URL
import io.minio.MinioClient;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class PresignedGetExample {
    public static void main(String[] args) throws Exception {
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();

        // 基础GET预签名URL
        String url = minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.GET)
                .bucket("mybucket")
                .object("path/to/file.pdf")
                .expiry(1, TimeUnit.HOURS)  // 1小时过期
                .build()
        );

        // 带附加查询参数的GET预签名URL
        Map<String, String> queryParams = new HashMap<>();
        queryParams.put("response-content-type", "application/pdf");
        queryParams.put("response-content-disposition",
            "attachment; filename=\"download.pdf\"");

        String urlWithParams = minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.GET)
                .bucket("mybucket")
                .object("path/to/file.pdf")
                .expiry(30, TimeUnit.MINUTES)
                .extraQueryParams(queryParams)
                .build()
        );

        System.out.println("Download URL: " + urlWithParams);
    }
}
```

**注意事项**: **GET预签名URL默认7天（168小时）过期，最大有效期7天。过期时间以秒为单位，需在URL生成后开始计时。生成的URL包含签名信息，任何持有URL的人都可以在有效期内下载对象。建议根据业务场景设置最短必要过期时间，减少安全风险。`extraQueryParams` 可设置 `response-content-type`、`response-content-disposition` 等响应头参数。**

---

### PUT预签名
**概念定义**: PUT预签名URL允许客户端在无需AWS凭证的情况下，通过带签名的临时URL直接上传对象到私有存储桶。适用于Web前端直传、移动端上传等场景。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `bucket` | String | 目标存储桶名称 |
| `object` | String | 对象路径 |
| `expiry` | Duration | 过期时间，默认7天 |
| `method` | Method | HTTP方法，固定 `Method.PUT` |

**配置示例**:

```bash
# mc命令：生成PUT预签名URL（上传）
mc share upload --expire 30m myminio/mybucket/uploads/
```

```java
// Java SDK：生成PUT预签名URL
import io.minio.MinioClient;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import java.util.concurrent.TimeUnit;

public class PresignedPutExample {
    public static void main(String[] args) throws Exception {
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();

        // 生成PUT预签名URL
        String putUrl = minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.PUT)
                .bucket("mybucket")
                .object("uploads/photo.jpg")
                .expiry(10, TimeUnit.MINUTES)  // 10分钟过期
                .build()
        );

        System.out.println("Upload URL: " + putUrl);

        // 客户端可使用该URL执行HTTP PUT上传
        // curl -X PUT -T photo.jpg "PUT_PRESIGNED_URL"
    }
}
```

**注意事项**: **PUT预签名URL仅允许上传操作，不能用于下载或列出。过期的PUT URL将返回403错误。应确保存储桶的IAM策略允许上传用户的 `s3:PutObject` 权限。使用PUT预签名URL上传时，客户端自动继承URL生成者的权限范围。**

---

### HEAD预签名
**概念定义**: HEAD预签名URL用于获取对象的元数据信息（如大小、Content-Type、ETag等），不传输对象内容。适用于在下载前检查对象是否存在或获取文件大小。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `bucket` | String | 目标存储桶名称 |
| `object` | String | 对象路径 |
| `expiry` | Duration | 过期时间 |
| `method` | Method | HTTP方法，固定 `Method.HEAD` |

**配置示例**:

```java
// Java SDK：生成HEAD预签名URL
String headUrl = minioClient.getPresignedObjectUrl(
    GetPresignedObjectUrlArgs.builder()
        .method(Method.HEAD)
        .bucket("mybucket")
        .object("path/to/large-file.zip")
        .expiry(5, TimeUnit.MINUTES)
        .build()
);

// 客户端可通过HEAD请求获取元数据
// curl -I "HEAD_PRESIGNED_URL"
```

**注意事项**: **HEAD预签名URL仅返回HTTP响应头，不返回响应体。适用于获取Content-Length、ETag、Last-Modified等元数据。过期时间建议设置较短（如5分钟），因为HEAD请求通常是瞬时操作。**

---

### POST表单上传策略
**概念定义**: POST表单上传策略（Post Policy）允许通过HTML表单直接上传文件到MinIO，支持在前端控制上传条件和限制（如文件大小、Content-Type）。策略以Base64编码的JSON格式嵌入表单。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `bucket` | String | 目标存储桶 |
| `expiry` | Duration | 策略过期时间 |
| `conditions` | List | 上传条件限制（如 `["content-length-range", 1, 10485760]`） |

**配置示例**:

```java
import io.minio.MinioClient;
import io.minio.PostPolicy;
import java.time.ZonedDateTime;
import java.util.concurrent.TimeUnit;

public class PostPolicyExample {
    public static void main(String[] args) throws Exception {
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();

        // 创建POST上传策略
        PostPolicy policy = new PostPolicy(
            "mybucket",                           // 桶名
            "uploads/",                           // 对象前缀
            ZonedDateTime.now().plusMinutes(10)   // 10分钟过期
        );

        // 添加条件限制
        policy.addEqualsCondition("key", "uploads/${filename}");  // 文件名变量
        policy.addStartsWithCondition("Content-Type", "image/");  // 仅允许图片
        policy.addContentLengthRangeCondition(1, 10 * 1024 * 1024);  // 1B-10MB

        // 生成表单数据
        Map<String, String> formData = minioClient.getPresignedPostFormData(policy);

        // formData中包含：action URL、签名、策略等字段
        // 前端可直接使用这些字段构建HTML表单
    }
}
```

**HTML表单示例**:

```html
<form action="http://192.168.1.100:9000/mybucket" method="post"
      enctype="multipart/form-data">
  <input type="hidden" name="key" value="uploads/${filename}">
  <input type="hidden" name="policy" value="BASE64_ENCODED_POLICY">
  <input type="hidden" name="x-amz-algorithm" value="AWS4-HMAC-SHA256">
  <input type="hidden" name="x-amz-credential" value="CREDENTIAL_STRING">
  <input type="hidden" name="x-amz-date" value="DATE_STRING">
  <input type="hidden" name="x-amz-signature" value="SIGNATURE">
  <input type="file" name="file">
  <input type="submit" value="Upload">
</form>
```

**注意事项**: **POST策略的过期时间在策略JSON中指定，过期后表单提交将被拒绝。条件限制（如文件大小、Content-Type）在服务端验证，不满足条件的上传将被拒绝。服务端签名在策略生成时完成，如需修改条件需重新生成策略。POST表单上传策略适用于浏览器端直传场景。**

---

### mc share命令
**概念定义**: `mc share` 命令提供命令行方式的预签名URL管理，包括生成下载/上传URL、列出活跃URL等操作。

**核心参数**:

| 命令 | 说明 |
|------|------|
| `mc share download ALIAS/PATH` | 生成GET预签名URL |
| `mc share upload ALIAS/PATH` | 生成PUT预签名URL |
| `mc share list ALIAS` | 列出活跃的预签名URL |
| `--expire DURATION` | 过期时间，格式 `##h##m##s` |
| `--recursive` | 递归处理所有对象 |
| `--version-id VID` | 指定对象版本 |
| `--custom-header HEADER` | 自定义HTTP头 |

**配置示例**:

```bash
# 生成单个对象下载URL（30分钟过期）
mc share download --expire 30m myminio/mybucket/report.pdf

# 生成递归下载URL（所有对象）
mc share download --recursive --expire 1h myminio/mybucket/

# 生成上传URL（15分钟过期）
mc share upload --expire 15m myminio/mybucket/uploads/

# 指定版本下载
mc share download --version-id "abc123" myminio/mybucket/old-file.txt

# 添加自定义Header
mc share download --custom-header "Content-Disposition:attachment" \
  myminio/mybucket/file.pdf
```

**注意事项**: **过期时间格式为 `##h##m##s`，例如 `12h34m56s`。默认过期时间为168小时（7天）。`--recursive` 参数对桶或前缀路径必需。`mc share list` 仅显示当前活跃（未过期）的URL。版本ID参数需要在启用版本控制的桶上使用。**

---

### Java SDK实现
**概念定义**: MinIO Java SDK的 `getPresignedObjectUrl` 方法提供统一的预签名URL生成接口，支持GET、PUT、HEAD、DELETE等HTTP方法，以及版本控制、自定义查询参数和自定义Header。

**核心参数**:

| 方法 | 参数 | 说明 |
|------|------|------|
| `.method()` | Method | HTTP方法：GET/PUT/HEAD/DELETE |
| `.bucket()` | String | 存储桶名称 |
| `.object()` | String | 对象路径 |
| `.expiry()` | int, TimeUnit | 过期时间和单位 |
| `.versionId()` | String | 对象版本ID |
| `.extraQueryParams()` | Map | 附加查询参数 |
| `.extraHeaders()` | Map | 附加自定义Header |

**配置示例**:

```java
import io.minio.MinioClient;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.http.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

public class PresignedUrlFullExample {

    private final MinioClient minioClient;

    public PresignedUrlFullExample() {
        this.minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();
    }

    // 生成下载URL
    public String getDownloadUrl(String bucket, String object, int expiryMinutes)
            throws Exception {
        return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.GET)
                .bucket(bucket)
                .object(object)
                .expiry(expiryMinutes, TimeUnit.MINUTES)
                .build()
        );
    }

    // 生成带响应头的下载URL
    public String getDownloadUrlWithHeaders(String bucket, String object,
            String fileName, String contentType) throws Exception {
        Map<String, String> queryParams = new HashMap<>();
        queryParams.put("response-content-type", contentType);
        queryParams.put("response-content-disposition",
            "attachment; filename=\"" + fileName + "\"");

        return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.GET)
                .bucket(bucket)
                .object(object)
                .expiry(1, TimeUnit.HOURS)
                .extraQueryParams(queryParams)
                .build()
        );
    }

    // 生成上传URL
    public String getUploadUrl(String bucket, String object, int expiryMinutes)
            throws Exception {
        return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.PUT)
                .bucket(bucket)
                .object(object)
                .expiry(expiryMinutes, TimeUnit.MINUTES)
                .build()
        );
    }

    // 生成指定版本的下载URL
    public String getVersionedDownloadUrl(String bucket, String object,
            String versionId) throws Exception {
        return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.GET)
                .bucket(bucket)
                .object(object)
                .versionId(versionId)
                .expiry(1, TimeUnit.HOURS)
                .build()
        );
    }

    // 生成HEAD URL（获取元数据）
    public String getHeadUrl(String bucket, String object) throws Exception {
        return minioClient.getPresignedObjectUrl(
            GetPresignedObjectUrlArgs.builder()
                .method(Method.HEAD)
                .bucket(bucket)
                .object(object)
                .expiry(5, TimeUnit.MINUTES)
                .build()
        );
    }
}
```

**注意事项**: **`getPresignedObjectUrl` 方法仅在服务端生成URL签名，不执行实际的HTTP请求。过期时间使用 `TimeUnit` 指定，支持 `SECONDS`、`MINUTES`、`HOURS`、`DAYS`。`extraQueryParams` 中的参数会附加到URL查询字符串中。`extraHeaders` 中的Header会包含在签名计算中，客户端请求时需携带相同Header。版本ID参数仅在启用版本控制的桶上有效。**

---

## SSE-S3加密
**概念定义**: SSE-S3（Server-Side Encryption with MinIO-Managed Keys）是MinIO服务端管理的加密方式，由MinIO/KES自动生成、管理和轮换加密密钥，对客户端完全透明。MinIO SSE使用Key Encryption Service（KES）和外部KMS执行大规模加密操作。

**核心参数**:

| 参数 | 说明 |
|------|------|
| 密钥管理 | MinIO通过KES自动管理密钥，无需用户干预 |
| 加密范围 | 对象数据和元数据 |
| 加密算法 | AES-256-GCM（默认） |
| 自动加密 | 可通过配置启用自动加密所有对象 |
| 客户端请求头 | `x-amz-server-side-encryption: AES256` |

**配置示例**:

```bash
# 启用SSE-S3自动加密（MinIO环境变量）
export MINIO_KMS_KES_ENDPOINT=https://kes.example.com:7373
export MINIO_KMS_KES_KEY_NAME=minio-default-key
export MINIO_KMS_KES_CERT_FILE=/path/to/client.crt
export MINIO_KMS_KES_KEY_FILE=/path/to/client.key
export MINIO_KMS_KES_CA_PATH=/path/to/ca.crt

# 启动MinIO时自动加密所有对象
minio server /data --auto-encrypt
```

```java
// Java SDK：使用SSE-S3加密上传对象
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.ServerSideEncryption;
import io.minio.ServerSideEncryptionS3;

public class SSES3Example {
    public static void main(String[] args) throws Exception {
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();

        // 使用SSE-S3加密上传
        ServerSideEncryption sseS3 = new ServerSideEncryptionS3();

        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket("secure-bucket")
                .object("encrypted-file.txt")
                .stream(inputStream, fileSize, -1)
                .sse(sseS3)
                .build()
        );
    }
}
```

**注意事项**: **SSE-S3在MinIO开源版中需配合KES和外部KMS使用。启用 `--auto-encrypt` 后所有对象自动加密，无需客户端指定。SSE-S3加密密钥由MinIO通过KES管理，用户无法直接访问加密密钥。加密仅保护静态数据，传输中的加密需通过TLS保证。没有KES/KMS时，MinIO社区版不支持SSE-S3。**

---

## SSE-C加密
**概念定义**: SSE-C（Server-Side Encryption with Customer-Provided Keys）是客户端管理密钥的加密方式，由客户端提供加密密钥，MinIO使用该密钥加密对象后丢弃密钥，不会存储密钥。密钥管理责任完全在客户端。

**核心参数**:

| 参数 | 说明 |
|------|------|
| 密钥提供方 | 客户端 |
| 密钥长度 | 256位（32字节） |
| 密钥存储 | MinIO不存储密钥，仅存储密钥的HMAC-SHA256哈希用于验证 |
| 请求头 | `x-amz-server-side-encryption-customer-algorithm: AES256` |
|  | `x-amz-server-side-encryption-customer-key: <Base64Key>` |
|  | `x-amz-server-side-encryption-customer-key-MD5: <Base64MD5>` |

**配置示例**:

```java
// Java SDK：使用SSE-C加密上传和下载
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.GetObjectArgs;
import io.minio.ServerSideEncryptionCustomerKey;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.security.SecureRandom;

public class SSECExample {
    public static void main(String[] args) throws Exception {
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();

        // 生成256位AES密钥
        KeyGenerator keyGen = KeyGenerator.getInstance("AES");
        keyGen.init(256, new SecureRandom());
        SecretKey secretKey = keyGen.generateKey();

        // 创建SSE-C加密对象
        ServerSideEncryptionCustomerKey sseC =
            new ServerSideEncryptionCustomerKey(secretKey.getEncoded());

        // 使用SSE-C加密上传
        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket("secure-bucket")
                .object("sse-c-encrypted.dat")
                .stream(inputStream, fileSize, -1)
                .sse(sseC)
                .build()
        );

        // 使用SSE-C下载（必须提供相同的密钥）
        minioClient.getObject(
            GetObjectArgs.builder()
                .bucket("secure-bucket")
                .object("sse-c-encrypted.dat")
                .sse(sseC)
                .build()
        );
    }
}
```

**注意事项**: **客户端必须安全保管密钥，MinIO不存储密钥。如果密钥丢失，加密对象将永久无法解密。每次请求（上传/下载/HEAD）都必须携带相同的密钥。密钥通过HTTPS请求头传输，必须使用TLS保护传输安全。SSE-C不支持自动加密，每个对象需单独指定加密。密钥的MD5校验和用于传输完整性验证。**

---

## SSE-KMS与KES
**概念定义**: SSE-KMS（Server-Side Encryption with KMS-Managed Keys）通过Key Encryption Service（KES）连接外部KMS（如HashiCorp Vault、AWS KMS、Azure Key Vault等），实现企业级密钥管理和加密。KES是MinIO开发的轻量级密钥加密服务，作为MinIO与外部KMS之间的桥梁。

**核心参数**:

| 组件 | 说明 |
|------|------|
| KES | MinIO Key Encryption Service，连接外部KMS的中间服务 |
| 外部KMS | HashiCorp Vault、AWS KMS、Azure Key Vault、GCP Secret Manager等 |
| `MINIO_KMS_KES_ENDPOINT` | KES服务端点URL |
| `MINIO_KMS_KES_KEY_NAME` | KES默认密钥名称 |
| `MINIO_KMS_KES_CERT_FILE` | KES客户端证书 |
| `MINIO_KMS_KES_KEY_FILE` | KES客户端私钥 |
| `MINIO_KMS_KES_CA_PATH` | KES CA证书路径 |

**KES架构**:

```
┌─────────┐     ┌─────────┐     ┌──────────────────┐
│  MinIO  │────>│   KES   │────>│  External KMS     │
│  Server │<────│ Service │<────│  (HashiCorp Vault, │
│         │     │         │     │   AWS KMS, etc.)  │
└─────────┘     └─────────┘     └──────────────────┘
```

**配置示例**:

```bash
# 部署KES服务kes server --config=/etc/kes/config.yml

# 配置MinIO连接KESexport MINIO_KMS_KES_ENDPOINT=https://kes.example.com:7373
export MINIO_KMS_KES_KEY_NAME=minio-default-key
export MINIO_KMS_KES_CERT_FILE=/etc/minio/certs/client.crt
export MINIO_KMS_KES_KEY_FILE=/etc/minio/certs/client.key
export MINIO_KMS_KES_CA_PATH=/etc/minio/certs/ca.crt

# 启动MinIO（KES用于加密后端数据）minio server /data \
  --address ":9000" \
  --console-address ":9001"
```

```java
// Java SDK：使用SSE-KMS加密上传
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.ServerSideEncryptionKms;
import java.util.HashMap;
import java.util.Map;

public class SSEKMSExample {
    public static void main(String[] args) throws Exception {
        MinioClient minioClient = MinioClient.builder()
            .endpoint("http://192.168.1.100:9000")
            .credentials("alice", "AliceSecretKey123!")
            .build();

        // 方式一：使用默认KMS密钥
        ServerSideEncryptionKms sseKms = new ServerSideEncryptionKms();

        // 方式二：使用指定KMS密钥ID
        Map<String, String> context = new HashMap<>();
        context.put("department", "engineering");
        ServerSideEncryptionKms sseKmsWithContext = new ServerSideEncryptionKms(
            "my-custom-key-id",  // 指定密钥ID
            context              // 加密上下文
        );

        // 使用SSE-KMS加密上传
        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket("secure-bucket")
                .object("kms-encrypted.dat")
                .stream(inputStream, fileSize, -1)
                .sse(sseKmsWithContext)
                .build()
        );
    }
}
```

**KES配置示例** (config.yml):

```yaml
address: 0.0.0.0:7373
root: disabled

tls:
  key: /etc/kes/certs/server.key
  cert: /etc/kes/certs/server.crt

policy:
  minio:
    paths:
      - /v1/key/create/*
      - /v1/key/generate/*
      - /v1/key/decrypt/*
    identities:
      - MINIO_CLIENT_CERT_IDENTITY

keystore:
  vault:
    endpoint: https://vault.example.com:8200
    prefix: minio-keys
    approle:
      engine: approle
      id: VAULT_APPROLE_ID
      secret: VAULT_APPROLE_SECRET
      retry: 15s
    status:
      ping: 10s
```

**注意事项**: **KES是MinIO加密架构的核心组件，负责密钥生命周期管理（生成、加密、解密、轮换）。MinIO需要访问KES和外部KMS以解密后端并正常启动，KMS必须维护并提供对 `MINIO_KMS_KES_KEY_NAME` 的访问。KES支持的KMS后端包括：HashiCorp Vault（推荐）、AWS Secrets Manager、Azure Key Vault、GCP Secret Manager、Fortanix SDKMS。KES与MinIO之间通过mTLS双向认证通信。在生产环境中，KES应部署为高可用集群。加密上下文（context）可用于实现密钥用途隔离和审计追溯。**

---

## 交叉引用
- [MinIO核心概念](./MinIO核心概念.md)
- [MinIO部署与配置](./MinIO部署与配置.md)
- [MinIO-Bucket操作](./MinIO-Bucket操作.md)
- [MinIO-Object操作](./MinIO-Object操作.md)
- [MinIO数据管理](./MinIO数据管理.md)
- [MinIO-Java-SDK](./MinIO-Java-SDK.md)
- [MinIO运维监控](./MinIO运维监控.md)
- [MinIO-Spring-Boot集成](./MinIO-Spring-Boot集成.md)

---

> **文档版本**: v1.0
> **最后更新**: 2025-07-17
> **MinIO版本基线**: RELEASE.2025-04-22T22-12-26Z
> **Java SDK**: io.minio:minio (minio-java)