# MinIO 数据管理知识归档

> **版本基线**: MinIO RELEASE.2025-04-22T22-12-26Z  
> **Java SDK**: io.minio:minio（官方 minio-java）  
> **文档来源**: MinIO 官方文档（context7）

---

## Bucket复制（Bucket Replication）
### 基本复制
**概念定义**：Bucket复制是MinIO服务端级别的自动存储桶复制机制，在源存储桶和目标存储桶之间以对象级别同步数据。MinIO针对源存储桶的每次写入操作，检查所有已配置的复制规则，并应用具有最高优先级的匹配规则。复制过程同步新对象以及对象变更（包括新版本和元数据变更）。源和目标两端必须均为运行相同版本的MinIO集群。

**核心参数**（`mc replicate add`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | 必选 | 源MinIO部署别名及完整存储桶路径 |
| `--remote-bucket` | 必选 | 远程目标URL或别名，格式 `https://user:secret@host:port/bucket` |
| `--replicate` | 可选 | 复制特性列表，逗号分隔：`delete`、`delete-marker`、`existing-objects`、`metadata-sync` |
| `--priority` | 可选 | 规则优先级（整数），值越大优先级越高，默认 `0` |
| `--sync` | 可选 | 启用同步复制，默认异步 |
| `--bandwidth` | 可选 | 带宽限制，如 `1Gi` |
| `--path` | 可选 | 路径查找模式：`on`、`off`、`auto`（默认） |
| `--storage-class` | 可选 | 应用于复制对象的存储类 |
| `--tags` | 可选 | 以 `&` 分隔的键值对标签过滤，如 `"TAG1=VALUE1&TAG2=VALUE2"` |
| `--disable` | 可选 | 创建后处于禁用状态 |
| `--id` | 可选 | 规则唯一标识符，不指定则自动生成 |
| `--healthcheck-seconds` | 可选 | 健康检查间隔（秒），默认 60 |
| `--region` | 可选 | 目标桶所在区域 |
| `--limit-upload` | 可选 | 上传速率限制 |
| `--limit-download` | 可选 | 下载速率限制 |
| `--disable-proxy` | 可选 | 在active-active复制中禁用代理 |

**配置示例**：

```bash
# 基本复制规则：创建从 myminio/mybucket 到远程的复制
mc replicate add myminio/mybucket \
  --remote-bucket "https://minioadmin:minioadmin@remote-host:9000/remotebucket" \
  --replicate "delete,delete-marker,existing-objects"

# 使用别名作为远程目标（RELEASE.2024-03-03T00-13-08Z 起支持）
mc replicate add myminio/mybucket \
  --remote-bucket minio-remote/my-bucket \
  --replicate "existing-objects"

# 带优先级和带宽限制的复制规则
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --priority 10 \
  --bandwidth "1Gi" \
  --storage-class "STANDARD"
```

**Java SDK 配置示例**：

```java
import io.minio.MinioClient;
import io.minio.SetBucketReplicationArgs;
import io.minio.GetBucketReplicationArgs;
import io.minio.messages.ReplicationConfiguration;
import io.minio.messages.ReplicationRule;
import io.minio.messages.DeleteMarkerReplication;
import io.minio.messages.DeleteReplication;
import io.minio.messages.Destination;
import io.minio.messages.RuleFilter;
import io.minio.messages.Status;

// 构建复制配置
ReplicationConfiguration config = new ReplicationConfiguration(
    "ReplicationRole",
    List.of(
        new ReplicationRule(
            new DeleteMarkerReplication(Status.ENABLED),
            new Destination(
                null, null,
                "arn:aws:s3:::target-bucket"
            ),
            new DeleteReplication(Status.ENABLED),
            null,
            new RuleFilter(null, null, null),
            "rule-1",
            null,
            null,
            1,
            null,
            Status.ENABLED
        )
    )
);

// 设置Bucket复制
minioClient.setBucketReplication(
    SetBucketReplicationArgs.builder()
        .bucket("my-bucket")
        .config(config)
        .build()
);

// 获取Bucket复制配置
ReplicationConfiguration retrieved = minioClient.getBucketReplication(
    GetBucketReplicationArgs.builder()
        .bucket("my-bucket")
        .build()
);
```

**注意事项**：源和目标存储桶必须都启用版本控制（`mc version enable`）。MinIO服务端复制仅在MinIO部署之间工作，不支持其他S3兼容服务。加密对象复制需要源和目标都启用SSE-S3加密，MinIO在传输过程中解密对象，目标端重新加密。

---

### 同步选项（--replicate）
**概念定义**：`--replicate` 参数用于启用扩展复制功能，通过逗号分隔的值列表精确控制复制行为。当创建新规则或修改现有规则时，必须指定所有期望的复制特性，新规则会完全替换旧规则。

**核心参数**：

| 选项值 | 说明 |
|--------|------|
| `delete` | 将版本化删除操作同步到目标桶 |
| `delete-marker` | 将删除标记同步到目标桶 |
| `existing-objects` | 复制启用复制规则前已存在的对象 |
| `metadata-sync` | 仅用于active-active复制场景，复制对象元数据变更 |

**配置示例**：

```bash
# 启用全部同步选项
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "delete,delete-marker,existing-objects"

# 仅复制现有对象（历史数据快照）
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "existing-objects"

# 更新已存在的规则：添加existing-objects（注意：必须指定所有期望的特性）
mc replicate update myminio/mybucket \
  --id "rule-id" \
  --replicate "delete,delete-marker,existing-objects"
```

**注意事项**：如果不指定 `--replicate`，MinIO默认同步所有选项。更新规则时必须列出所有期望的特性，而非仅列出要添加的项，否则未列出的特性将被移除。`metadata-sync` 仅用于active-active双向复制场景。

---

### 规则优先级
**概念定义**：当源存储桶上配置了多条复制规则时，MinIO根据每条规则的`--priority`值决定匹配顺序。优先级值越大的规则越优先匹配。默认优先级为`0`。每条规则在源桶上的所有规则中必须具有唯一优先级值。

**核心参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| `--priority` | 可选 | 整数，值越大优先级越高，默认 `0`，必须唯一 |

**配置示例**：

```bash
# 高优先级规则：匹配特定标签的对象
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote1:9000/bucket" \
  --priority 10 \
  --tags "env=prod"

# 低优先级规则：默认规则，匹配所有其他对象
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote2:9000/bucket" \
  --priority 1
```

**注意事项**：优先级值必须在源桶上的所有规则中唯一。当一条规则匹配时，优先级较低的规则不会被评估。建议为标签过滤规则设置较高优先级，为默认规则设置较低优先级。

---

### 远程目标（--remote-bucket）
**概念定义**：`--remote-bucket` 指定目标MinIO部署的连接信息，包括凭据、端点和目标存储桶。从RELEASE.2024-03-03T00-13-08Z版本起，除URL格式外还支持使用已配置的mc别名。

**核心参数**：

| 格式 | 示例 | 说明 |
|------|------|------|
| URL格式 | `https://user:secret@host:9000/bucket` | 直接指定凭据和端点 |
| 别名格式 | `minio-remote/my-bucket` | 使用已配置的mc别名 |

**配置示例**：

```bash
# URL格式（含凭据）
mc replicate add myminio/mybucket \
  --remote-bucket "https://minioadmin:minioadmin@10.0.0.2:9000/remotebucket"

# URL格式（仅域名）
mc replicate add myminio/mybucket \
  --remote-bucket "https://minio-remote.example.com/remotebucket"

# 别名格式
mc alias set remote-cluster https://10.0.0.2:9000 minioadmin minioadmin
mc replicate add myminio/mybucket \
  --remote-bucket remote-cluster/remotebucket
```

**注意事项**：远程目标必须是运行相同版本MinIO的集群。URL中包含凭据时，请确保使用HTTPS（TLS）保护传输安全。MinIO不支持在URL格式中使用路径风格的存储桶查找，如需路径风格请使用 `--path on`。

---

### 路径模式（--path）
**概念定义**：`--path` 参数控制MinIO在查找远程桶时使用的地址解析风格。路径式查找将桶名作为URL路径的一部分，而虚拟主机式查找将桶名作为子域名。

**核心参数**：

| 值 | 说明 |
|----|------|
| `on` | 强制使用路径式查找（如 `host/bucket`） |
| `off` | 强制使用虚拟主机式查找（如 `bucket.host`） |
| `auto` | 由MinIO自动判断（默认值） |

**配置示例**：

```bash
# 启用路径式查找
mc replicate add myminio/mybucket \
  --remote-bucket "https://10.0.0.2:9000/remotebucket" \
  --path on
```

**注意事项**：当远程目标使用IP地址或无法通过DNS解析子域名时，应使用 `--path on`。配置 `MINIO_DOMAIN` 后，虚拟主机式查找会使用域名子域名来定位存储桶。

---

### 现有对象复制（existing-objects）
**概念定义**：MinIO默认将源存储桶中在创建复制规则前已存在的对象复制到远程目标。通过在 `--replicate` 参数中包含 `existing-objects` 来启用此功能。MinIO会扫描所有满足复制规则的对象，并将它们加入复制队列。

**核心参数**：

| 参数 | 说明 |
|------|------|
| `--replicate "existing-objects"` | 启用现有对象复制 |

**配置示例**：

```bash
# 创建规则时启用现有对象复制
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "existing-objects"

# 对已有规则启用现有对象复制（需指定所有期望特性）
mc replicate update myminio/mybucket \
  --id "existing-rule-id" \
  --replicate "delete,delete-marker,existing-objects"

# 禁用现有对象复制：从列表中移除
mc replicate update myminio/mybucket \
  --id "existing-rule-id" \
  --replicate "delete,delete-marker"
```

**注意事项**：MinIO仅排除没有版本ID的对象（如在启用桶版本控制之前写入的对象）。禁用现有对象复制不会删除已复制到远程的对象。在复制规则禁用期间创建的对象，启用规则后不会自动符合复制条件，必须显式启用 `existing-objects`。

---

### 带历史数据复制（全量同步）
**概念定义**：当需要将源存储桶的全部历史数据同步到远程目标时，需要同时启用 `existing-objects` 选项，确保所有已存在的对象被纳入复制范围。这适用于灾难恢复场景或新搭建的远程目标。

**配置示例**：

```bash
# 全量同步：新对象 + 现有对象 + 删除操作 + 删除标记
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "delete,delete-marker,existing-objects"

# 仅历史数据快照（不复制删除操作）
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "existing-objects"
```

**注意事项**：远程目标上的副本代表源端对象的历史状态，源端的删除操作不会影响远程副本。全量同步可能产生大量复制流量，建议在低负载时段执行，并配合 `--bandwidth` 限制带宽。

---

### 删除操作同步（delete）
**概念定义**：`delete` 选项指示MinIO将版本化删除操作同步到目标存储桶。MinIO只复制客户端显式驱动的删除操作，**不复制**由生命周期管理过期规则删除的对象。删除操作复制使用与其他复制操作相同的复制队列系统。

**配置示例**：

```bash
# 启用删除操作同步
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "delete"

# 启用删除操作 + 删除标记同步
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "delete,delete-marker"
```

**注意事项**：MinIO不复制因ILM过期规则触发的删除。对于active-active配置，应在所有复制桶上设置相同的过期规则以确保一致性。删除操作会触发隐式前缀修剪行为：当删除操作移除桶前缀中的最后一个对象时，MinIO会递归删除该前缀的每个空部分（仅限隐式创建的前缀）。

---

### 删除标记同步（delete-marker）
**概念定义**：`delete-marker` 选项指示MinIO将删除标记（DeleteMarker）同步到目标存储桶。删除标记是在版本化存储桶中执行DELETE操作时创建的特殊标记，表示该对象已被"删除"。在active-active复制配置中，如果两个集群同时为同一对象创建删除标记，可能出现重复的删除标记。

**配置示例**：

```bash
# 启用删除标记同步
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "delete-marker"

# 同时启用删除操作和删除标记同步
mc replicate add myminio/mybucket \
  --remote-bucket "https://user:secret@remote:9000/bucket" \
  --replicate "delete,delete-marker"
```

**注意事项**：MinIO使用 `X-Minio-Replication-DeleteMarker-Status` 元数据字段跟踪删除标记复制状态。对于版本化删除操作，MinIO先将对象版本标记为 `PENDING` 直到复制完成，这可能导致列表操作在初始删除后仍然返回该对象。

---

## Site复制（Site Replication）
### 多站点复制（Active-Active模式）
**概念定义**：Site复制（站点复制）将多个独立的MinIO部署配置为对等站点网络，实现active-active级别的全站点同步。站点复制不仅同步对象数据，还同步IAM设置、安全令牌、访问密钥和存储桶级别配置。站点复制对所有存储桶强制实施版本控制。

**核心参数**（`mc admin replicate add`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS1 ALIAS2 [ALIAS3 ...]` | 必选 | 参与站点复制的MinIO部署别名，至少两个 |
| `--replicate-ilm-expiry` | 可选 | 在对等站点间复制ILM过期规则 |

**核心参数**（`mc admin replicate update`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `--mode` | 可选 | 复制模式：`sync` 或 `async`（默认） |
| `--deployment-id` | 必选 | 要修改的部署唯一ID |
| `--endpoint` | 必选 | 对等站点的新端点URL |
| `--bucket-bandwidth` | 可选 | 桶带宽限制 |
| `--enable-ilm-expiry-replication` | 可选 | 启用ILM过期规则复制 |
| `--disable-ilm-expiry-replication` | 可选 | 禁用ILM过期规则复制 |

**配置示例**：

```bash
# 创建三站点Site复制
mc admin replicate add minio1 minio2 minio3

# 创建带ILM过期规则同步的Site复制
mc admin replicate add minio1 minio2 minio3 --replicate-ilm-expiry

# 扩展已有站点复制（添加新站点minio5）
mc admin replicate add minio1 minio2 minio3 minio4 minio5

# 启用同步Site复制
mc admin replicate update minio1 \
  --deployment-id c1758167-4426-454f-9aae-5c3dfdf6df64 \
  --mode sync

# 设置带宽限制
mc admin replicate update minio1 \
  --deployment-id c1758167-4426-454f-9aae-5c3dfdf6df64 \
  --bucket-bandwidth "2G"
```

**注意事项**：Site复制仅支持分布式部署。初始化时只能有一个站点包含数据，其他站点必须为空。所有站点必须使用相同的外部身份提供商（IDP）。Site复制与Bucket复制互斥，不能同时使用。

---

### 与Bucket复制的区别
**概念定义**：Bucket复制和Site复制是两种不同层级的复制机制，彼此互斥，不能在同一部署中同时使用。

**核心区别**：

| 维度 | Bucket复制 | Site复制 |
|------|-----------|----------|
| 复制粒度 | 存储桶级别（对象、前缀） | 整个站点级别（所有存储桶、IAM、策略） |
| 复制内容 | 对象数据、删除标记、元数据 | 对象数据 + IAM设置 + 安全令牌 + 访问密钥 + 桶配置 |
| 初始数据 | 远程目标可有已有数据 | 初始时仅一个站点有数据，其余必须为空 |
| 版本控制 | 需手动启用 | 自动强制启用 |
| 配置命令 | `mc replicate add` | `mc admin replicate add` |
| 适用场景 | 特定桶的数据同步、备份 | 多站点容灾、全局部署 |

**注意事项**：在配置Site复制前，必须先删除所有已存在的Bucket复制规则。切换需谨慎，因为两者互斥且Site复制一旦配置将影响所有存储桶。

---

### 删除Bucket复制规则（mc replicate rm）
**概念定义**：在切换到Site复制之前，必须删除所有现有的Bucket复制规则。`mc replicate rm` 命令用于删除指定存储桶上的复制规则。

**配置示例**：

```bash
# 删除指定存储桶上的所有复制规则
mc replicate rm myminio/mybucket --all --force

# 删除指定ID的复制规则
mc replicate rm myminio/mybucket --id "rule-id"
```

**注意事项**：删除复制规则不会删除已复制到远程目标的对象。使用 `--force` 标志强制执行删除操作，无需确认。

---

### 监控（mc admin replicate status）
**概念定义**：`mc admin replicate status` 命令显示站点复制配置中各个站点、存储桶、用户、组、策略和ILM过期规则的复制状态。该命令支持按维度筛选查看。

**配置示例**：

```bash
# 查看整体站点复制状态
mc admin replicate status minio1

# 查看所有存储桶的复制状态
mc admin replicate status minio1 --buckets

# 查看特定存储桶的复制状态
mc admin replicate status minio1 --bucket images

# 查看用户复制状态
mc admin replicate status minio1 --user janedoe

# 查看ILM过期规则复制状态
mc admin replicate status minio1 --ilm-expiry-rules

# 查看所有状态信息
mc admin replicate status minio1 --all

# 查看站点复制配置信息
mc admin replicate info minio1
```

**注意事项**：输出包含各维度的同步计数和对象复制摘要（已复制、排队中、已接收的对象数和字节数）。状态信息有助于监控复制延迟和发现同步问题。

---

## 复制高级特性
### 边缘复制
**概念定义**：边缘复制是指MinIO在多站点复制拓扑中，将数据推向网络边缘的能力。通过配置多站点复制，可以让数据分布在多个地理位置，使客户端应用程序可以就近访问数据。边缘复制依赖于Site复制或Bucket复制的基础设施。

**注意事项**：边缘复制的延迟取决于站点间的网络条件。异步复制（默认）在完成原始PUT操作后才将对象放入复制队列，客户端可能先看到成功的PUT操作。同步复制 (`--sync`) 尝试在完成PUT操作前先复制对象，但无论复制是否成功都会返回成功的PUT操作。

---

### 删除复制
**概念定义**：删除复制涵盖两个维度的删除操作同步：(1) 版本化对象删除操作，在目标端删除对应版本；(2) 删除标记复制，在目标端创建对应的删除标记。MinIO使用 `X-Minio-Replication-Delete-Status` 和 `X-Minio-Replication-DeleteMarker-Status` 元数据字段跟踪删除复制状态。

**复制状态流转**：

| 状态 | 说明 |
|------|------|
| `PENDING` | 对象尚未复制，正在等待处理 |
| `COMPLETED` | 对象已成功复制到远程 |
| `FAILED` | 对象复制失败，将被重新排队 |
| `REPLICA` | 该对象本身是从远程源复制的副本 |

**注意事项**：典型流程为 `PENDING -> COMPLETED` 或 `PENDING -> FAILED -> COMPLETED`。MinIO在RELEASE.2022-07-18T17-49-40Z版本后，对失败的复制操作最多重试3次。在RELEASE.2022-08-11T04-37-28Z版本后，执行列表操作或GET/HEAD API时，失败的复制操作会自动重新排队。

---

### 重同步（Resync）
**概念定义**：重同步是MinIO提供的灾难恢复机制，用于在数据部分或全部丢失后，从健康的部署恢复数据。`mc replicate resync` 命令在存储桶级别操作，检查源存储桶中的所有对象，将满足复制规则的对象重新放入复制队列。

**配置示例**：

```bash
# 启动重同步：从minio1恢复minio2
mc replicate resync start minio1 minio2

# 查看重同步状态
mc replicate resync status minio1 minio2

# 取消重同步
mc replicate resync cancel minio1 minio2
```

**注意事项**：重同步不支持前缀级别的细粒度操作。在大型存储桶上启动重同步可能导致复制负载和流量的显著增加，请谨慎使用。对于已配置对象转换（分层）的存储桶，重同步会将对象还原为未转换状态，先前转换到远程存储的数据将永久断开连接。

---

### 复制状态监控
**概念定义**：MinIO提供多种方式监控复制状态，包括`mc replicate status`命令、`mc admin replicate status`命令，以及通过事件通知机制订阅复制相关事件。

**事件类型**：

| 事件 | 说明 |
|------|------|
| `s3:Replication:OperationCompletedReplication` | 复制操作完成 |
| `s3:Replication:OperationFailedReplication` | 复制操作失败 |
| `s3:Replication:OperationMissedThreshold` | 复制操作未达到阈值 |
| `s3:Replication:OperationNotTracked` | 复制操作未被跟踪 |
| `s3:Replication:OperationReplicatedAfterThreshold` | 复制操作超过阈值后完成 |

**配置示例**：

```bash
# 查看Bucket复制状态
mc replicate status myminio/mybucket

# 查看Site复制状态
mc admin replicate status minio1 --all
```

**注意事项**：监控复制状态有助于及时发现复制延迟、失败和积压情况。建议配合告警系统使用，当复制延迟超过预设阈值时触发告警。

---

## ILM深度解析
### 规则语法
**概念定义**：ILM（对象生命周期管理）规则用于定义基于时间或日期的自动对象转换或过期策略。MinIO采用JSON格式描述生命周期管理规则，与S3生命周期管理兼容，支持规则的导入和导出。MinIO使用内置扫描器主动检查对象是否符合配置的规则。

**核心参数**（`mc ilm rule add`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | 必选 | MinIO部署别名及完整存储桶路径 |
| `--expiry-days` | 可选 | 对象过期天数（当前版本） |
| `--noncurrent-expiry-days` | 可选 | 非当前版本过期天数 |
| `--expire-delete-marker` | 可选 | 当无剩余版本时，过期删除标记 |
| `--transition-days` | 可选 | 转换到远程层的天数（当前版本） |
| `--transition-tier` | 可选 | 转换的目标远程层名称 |
| `--noncurrent-transition-days` | 可选 | 非当前版本转换天数 |
| `--noncurrent-transition-tier` | 可选 | 非当前版本转换的目标层名称 |
| `--filter` | 可选 | 按前缀/标签过滤适用的对象 |
| `--disable` | 可选 | 创建后处于禁用状态 |

**配置示例**：

```bash
# 基本过期规则：30天后删除
mc ilm rule add myminio/mybucket --expiry-days 30

# 带非当前版本过期的规则
mc ilm rule add myminio/mybucket \
  --expiry-days 90 \
  --noncurrent-expiry-days 30 \
  --expire-delete-marker

# 带转换的规则：30天后转换到warm层，90天后过期
mc ilm rule add myminio/mybucket \
  --transition-days 30 \
  --transition-tier warm-tier \
  --expiry-days 90

# 带前缀过滤的规则
mc ilm rule add myminio/mybucket/logs \
  --expiry-days 7
```

**注意事项**：扫描器是一个低优先级进程，会为高I/O工作负载让路，因此可能在生命周期规则期限过后才检测到对象符合条件。扫描器性能取决于节点资源、集群大小和桶层次结构复杂度。

---

### 过期规则
**概念定义**：过期规则定义了对象在指定天数后自动执行DELETE操作的条件。对于版本化存储桶，MinIO采用S3行为：默认仅对当前对象版本创建删除标记，不会删除非当前版本，也不会删除无剩余版本的删除标记。

**核心参数**：

| 参数 | 说明 |
|------|------|
| `--expiry-days` | 当前版本对象过期天数 |
| `--noncurrent-expiry-days` | 非当前版本对象过期天数 |
| `--expire-delete-marker` | 当无剩余版本时，删除删除标记 |

**配置示例**：

```bash
# 当前版本365天后过期
mc ilm rule add myminio/mybucket --expiry-days 365

# 非当前版本30天后过期
mc ilm rule add myminio/mybucket --noncurrent-expiry-days 30

# 综合过期规则
mc ilm rule add myminio/mybucket \
  --expiry-days 365 \
  --noncurrent-expiry-days 90 \
  --expire-delete-marker
```

**注意事项**：MinIO不复制由ILM过期规则删除的对象。对于active-active复制配置，应在所有复制桶上设置相同的过期规则以确保一致性。`--expire-delete-marker` 仅在无剩余版本时删除删除标记，这是不同于S3默认行为的MinIO扩展特性。

---

### 转换规则
**概念定义**：转换规则定义了对象在指定天数后自动移动到远程存储层（Tier）的行为。MinIO在转换时自动将对象移动到配置的远程存储目标，并在应用程序请求时即时检索分层对象，无需额外的应用层逻辑。

**核心参数**：

| 参数 | 说明 |
|------|------|
| `--transition-days` | 当前版本对象转换天数 |
| `--transition-tier` | 转换的目标远程层名称 |
| `--noncurrent-transition-days` | 非当前版本对象转换天数 |
| `--noncurrent-transition-tier` | 非当前版本转换的目标层名称 |

**配置示例**：

```bash
# 30天后转换到warm层
mc ilm rule add myminio/mybucket \
  --transition-days 30 \
  --transition-tier warm-tier

# 非当前版本7天后转换到cold层
mc ilm rule add myminio/mybucket \
  --noncurrent-transition-days 7 \
  --noncurrent-transition-tier cold-tier

# 综合转换规则：30天转warm，90天过期
mc ilm rule add myminio/mybucket \
  --transition-days 30 \
  --transition-tier warm-tier \
  --expiry-days 90
```

**注意事项**：转换规则依赖于已配置的远程存储层。必须先使用 `mc ilm tier add` 创建层，然后才能在规则中引用它。MinIO对远程存储层上的数据需要独占访问权限，禁止外部修改、迁移或删除远程层上的对象。

---

### 规则JSON格式
**概念定义**：MinIO使用JSON格式描述生命周期管理规则，这在规则的导入/导出和跨平台迁移时尤其有用。MinIO兼容S3生命周期XML格式，但内部使用JSON处理。

**规则JSON结构示例**：

```json
{
  "Rules": [
    {
      "ID": "expire-30-days",
      "Status": "Enabled",
      "Filter": {
        "Prefix": "logs/"
      },
      "Expiration": {
        "Days": 30,
        "DeleteMarker": false
      },
      "NoncurrentVersionExpiration": {
        "NoncurrentDays": 7
      }
    },
    {
      "ID": "transition-to-warm",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Transition": {
        "Days": 90,
        "StorageClass": "warm-tier"
      }
    }
  ]
}
```

**配置示例**：

```bash
# 导出规则到JSON文件
mc ilm rule export myminio/mybucket

# 从JSON文件导入规则
mc ilm rule import myminio/mybucket < lifecycle-rules.json

# 列出当前规则
mc ilm rule ls myminio/mybucket

# 以JSON格式列出规则
mc ilm rule ls --json myminio/mybucket
```

**注意事项**：导入规则会覆盖目标存储桶上的现有规则。导出/导入功能可用于在S3和MinIO之间迁移生命周期配置，但可能需要进行XML到JSON的格式转换。

---

## 存储分层（Tiering）
### 远程存储转换
**概念定义**：存储分层（Tiering）是MinIO对象生命周期管理中关于对象转换的机制。通过创建远程存储层，MinIO可以将老化数据自动从本地高性能存储迁移到低成本的远程存储方案。MinIO管理分层对象的即时检索，无需应用程序侧额外的逻辑处理。

**核心参数**（`mc ilm tier add`）：

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | 必选 | MinIO部署别名 |
| `NAME` | 必选 | 远程层名称 |
| `TYPE` | 必选 | 层类型，如 `minio` 表示远程MinIO集群 |
| `--endpoint` | 必选 | 远程存储端点URL |
| `--access-key` | 必选 | 访问密钥 |
| `--secret-key` | 必选 | 秘密密钥 |
| `--bucket` | 必选 | 远程存储桶名称 |
| `--prefix` | 可选 | 远程桶中的对象前缀（便于运维识别） |
| `--region` | 可选 | 远程存储区域 |
| `--storage-class` | 可选 | 存储类 |

**所需权限**：

| 权限 | 说明 |
|------|------|
| `admin:SetTier` | 创建和修改远程层 |
| `admin:ListTier` | 列出远程层 |
| `s3:PutLifecycleConfiguration` | 配置生命周期规则 |
| `s3:GetLifecycleConfiguration` | 获取生命周期配置 |

**配置示例**：

```bash
# 创建远程MinIO层
mc ilm tier add minio myminio warm-tier \
  --endpoint https://warm-storage.example.com:9000 \
  --access-key minioadmin \
  --secret-key minioadmin \
  --bucket warm-bucket \
  --prefix "deployment-a/" \
  --region us-east-1

# 列出所有远程层
mc ilm tier ls myminio

# 查看层详细信息
mc ilm tier info myminio warm-tier

# 验证层配置
mc ilm tier check myminio warm-tier
```

**注意事项**：MinIO对远程存储层上的数据需要独占访问权限，禁止在远程层上配置生命周期管理规则。MinIO在远程存储桶中为每个部署生成唯一的部署前缀值，可选的人可读前缀便于诊断、维护和灾难恢复。远程层桶不应启用版本控制，否则每个源对象版本都会在远程层中转换为唯一对象。

---

### 分层类型
**概念定义**：MinIO支持多种远程存储层类型，`minio` 类型表示以远程MinIO集群作为分层目标。此外还支持Azure Blob Storage和Amazon S3作为分层目标。

**支持的层类型**：

| 类型 | 说明 |
|------|------|
| `minio` | 远程MinIO集群 |
| Azure Blob Storage | 微软Azure Blob存储 |
| Amazon S3 | AWS S3兼容存储 |

**配置示例**：

```bash
# MinIO类型的远程层
mc ilm tier add minio myminio archive-tier \
  --endpoint https://archive-minio.example.com:9000 \
  --access-key AKIAIOSFODNN7EXAMPLE \
  --secret-key wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY \
  --bucket archive-bucket \
  --prefix "prod-deployment/"

# 更新远程层配置
mc ilm tier update myminio archive-tier \
  --endpoint https://new-archive.example.com:9000 \
  --access-key NEWACCESSKEY \
  --secret-key NEWSECRETKEY
```

**注意事项**：远程层必须支持即时返回对象（毫秒到秒级别），不支持需要重新水化、等待期或手动干预的存储方案。分层数据的高可用性依赖于MinIO部署本身的纠删码和分布式拓扑保护，分层本身不提供额外的业务连续性或灾难恢复优势。

---

### 成本优化策略
**概念定义**：通过ILM分层策略实现热/温/冷数据的三层存储架构，将高频访问数据保留在本地MinIO集群（热层），将低频访问数据迁移到低成本远程存储（温/冷层），从而在满足性能要求的同时降低总体存储成本。

**配置示例**：

```bash
# 步骤1：创建温层（远程MinIO集群）
mc ilm tier add minio myminio warm-tier \
  --endpoint https://warm.example.com:9000 \
  --access-key minioadmin \
  --secret-key minioadmin \
  --bucket warm-bucket

# 步骤2：创建冷层（远程MinIO集群或云存储）
mc ilm tier add minio myminio cold-tier \
  --endpoint https://cold.example.com:9000 \
  --access-key minioadmin \
  --secret-key minioadmin \
  --bucket cold-bucket

# 步骤3：配置ILM规则 - 30天后转温层，90天后转冷层，365天后过期
mc ilm rule add myminio/mybucket \
  --transition-days 30 \
  --transition-tier warm-tier

mc ilm rule add myminio/mybucket \
  --transition-days 90 \
  --transition-tier cold-tier

mc ilm rule add myminio/mybucket \
  --expiry-days 365

# 查看对象分层状态
mc ls myminio/mybucket
# 输出包含存储层：STANDARD（本地）或 WARM（远程层）
```

**注意事项**：分层对象在 `mc ls` 输出中标记为 `STANDARD`（本地存储）或 `WARM`（远程层）。MinIO即时检索分层对象对应用程序透明。分层不能替代BC/DR方案，需要业务连续性和灾难恢复保护的工作负载应同时实施MinIO服务端复制。

---

## 事件通知
### 事件类型
**概念定义**：MinIO存储桶通知允许在发生特定对象或存储桶事件时，向支持的外部服务发送通知。MinIO支持与Amazon S3事件通知兼容的S3事件类型，包括对象事件、复制事件、ILM转换事件和扫描器事件。

**核心事件类型**：

| 事件类别 | 事件名称 | 触发场景 |
|----------|----------|----------|
| 对象创建 | `s3:ObjectCreated:Put` | PUT操作创建对象 |
| 对象创建 | `s3:ObjectCreated:Post` | POST操作创建对象 |
| 对象创建 | `s3:ObjectCreated:Copy` | COPY操作创建对象 |
| 对象创建 | `s3:ObjectCreated:CompleteMultipartUpload` | 完成分片上传 |
| 对象创建 | `s3:ObjectCreated:PutTagging` | 设置对象标签 |
| 对象创建 | `s3:ObjectCreated:DeleteTagging` | 删除对象标签 |
| 对象创建 | `s3:ObjectCreated:PutLegalHold` | 设置依法保留 |
| 对象创建 | `s3:ObjectCreated:PutRetention` | 设置保留期限 |
| 对象删除 | `s3:ObjectRemoved:Delete` | 删除对象 |
| 对象删除 | `s3:ObjectRemoved:DeleteMarkerCreated` | 创建删除标记 |
| 对象访问 | `s3:ObjectAccessed:Get` | GET操作 |
| 对象访问 | `s3:ObjectAccessed:Head` | HEAD操作 |
| 对象访问 | `s3:ObjectAccessed:GetLegalHold` | 获取依法保留 |
| 对象访问 | `s3:ObjectAccessed:GetRetention` | 获取保留期限 |
| 复制事件 | `s3:Replication:OperationCompletedReplication` | 复制完成 |
| 复制事件 | `s3:Replication:OperationFailedReplication` | 复制失败 |
| ILM转换 | `s3:ObjectTransition:Complete` | 转换完成 |
| ILM转换 | `s3:ObjectTransition:Failed` | 转换失败 |
| ILM还原 | `s3:ObjectRestore:Post` | 还原请求 |
| ILM还原 | `s3:ObjectRestore:Completed` | 还原完成 |
| 扫描器 | `s3:Scanner:ManyVersions` | 对象超过1000个版本 |
| 扫描器 | `s3:Scanner:BigPrefix` | 前缀超过50000个子文件夹 |
| 全局事件 | `s3:BucketCreated` | 创建存储桶 |
| 全局事件 | `s3:BucketRemoved` | 删除存储桶 |

**通配符选择**：

```bash
s3:ObjectCreated:*     # 选择所有对象创建事件
s3:ObjectRemoved:*     # 选择所有对象删除事件
s3:ObjectAccessed:*    # 选择所有对象访问事件
s3:Replication:*       # 选择所有复制事件
s3:ObjectTransition:*  # 选择所有ILM转换事件
```

**注意事项**：全局事件（`s3:BucketCreated`、`s3:BucketRemoved`）只能通过 `listenBucketNotification` API 监听，不能通过配置的外部服务目标接收。

---

### 过滤规则
**概念定义**：事件通知支持通过 `prefix`（前缀）和 `suffix`（后缀）过滤规则，精确控制哪些对象的事件触发通知。过滤规则在配置事件通知时指定。

**核心参数**：

| 过滤条件 | 说明 | 示例 |
|----------|------|------|
| `prefix` | 按对象键前缀过滤 | `images/`、`logs/2025/` |
| `suffix` | 按对象键后缀过滤 | `.jpg`、`.log`、`.json` |

**配置示例**：

```bash
# 带前缀过滤的事件通知
mc event add myminio/mybucket arn:minio:sqs::PRIMARY:kafka \
  --prefix "images/" \
  --suffix ".jpg" \
  --event "s3:ObjectCreated:Put"

# 添加多个事件类型
mc event add myminio/mybucket arn:minio:sqs::PRIMARY:webhook \
  --prefix "data/" \
  --event "s3:ObjectCreated:Put,s3:ObjectRemoved:Delete"
```

**注意事项**：前缀和后缀过滤是事件通知配置的一部分，需要在配置通知目标时同时指定。如果未指定过滤条件，则存储桶中所有对象的事件都会触发通知。

---

### 通知目标
**概念定义**：MinIO支持将事件通知发布到多种外部服务，包括消息队列、数据库、搜索引擎和Webhook。每种通知目标通过 `mc admin config set` 进行配置，使用 `notify_<target>` 作为配置键前缀。

**支持的通知目标一览**：

| 目标 | 配置键 | 适用场景 |
|------|--------|----------|
| Kafka | `notify_kafka` | 高吞吐量消息队列，实时数据管道 |
| Webhook | `notify_webhook` | HTTP回调，与任意HTTP服务集成 |
| AMQP (RabbitMQ) | `notify_amqp` | 消息队列，企业级消息传递 |
| Redis | `notify_redis` | 内存数据库，高速缓存/消息 |
| MySQL | `notify_mysql` | 关系型数据库，事件审计 |
| PostgreSQL | `notify_postgresql` | 关系型数据库，事件审计 |
| Elasticsearch | `notify_elasticsearch` | 搜索引擎，日志分析 |
| NATS | `notify_nats` | 轻量级消息系统 |
| MQTT | `notify_mqtt` | IoT消息协议 |
| NSQ | `notify_nsq` | 实时分布式消息平台 |

---

#### Kafka 通知目标
**概念定义**：Kafka通知目标将MinIO存储桶事件发布到Apache Kafka主题，适用于高吞吐量的实时数据管道和事件驱动架构。

**核心参数**（`notify_kafka`）：

| 参数 | 说明 |
|------|------|
| `brokers` | Kafka broker地址列表，逗号分隔 |
| `topic` | 目标Kafka主题 |
| `sasl_username` | SASL认证用户名（可选） |
| `sasl_password` | SASL认证密码（可选） |
| `tls_client_auth` | TLS客户端认证类型（可选） |
| `sasl_mechanism` | SASL机制（可选） |
| `queue_limit` | 事件队列大小限制，默认100000 |
| `queue_dir` | 队列持久化目录（可选） |

**配置示例**：

```bash
# 配置Kafka通知
mc admin config set myminio notify_kafka:1 \
  brokers="kafka1:9092,kafka2:9092" \
  topic="minio-events"

# 启用Kafka通知
mc admin config set myminio notify_kafka:1 \
  enable=on

# 查看Kafka配置
mc admin config get myminio notify_kafka

# 重启服务使配置生效
mc admin service restart myminio

# 添加事件通知到Kafka
mc event add myminio/mybucket arn:minio:sqs::PRIMARY:kafka \
  --event "s3:ObjectCreated:Put,s3:ObjectRemoved:Delete"
```

**注意事项**：配置后需要重启MinIO服务使配置生效。`queue_limit` 默认为100000，当队列满时MinIO会丢弃新事件。建议根据事件产生速率和消费速率调整队列大小。

---

#### Webhook 通知目标
**概念定义**：Webhook通知目标将MinIO存储桶事件以HTTP POST方式发送到指定的Webhook端点，适用于与任意HTTP服务集成。

**核心参数**（`notify_webhook`）：

| 参数 | 说明 |
|------|------|
| `endpoint` | Webhook接收端点URL |
| `auth_token` | 认证令牌（作为Authorization头） |
| `client_cert` | 客户端TLS证书路径 |
| `client_key` | 客户端TLS私钥路径 |
| `queue_limit` | 事件队列大小限制，默认100000 |
| `queue_dir` | 队列持久化目录（可选） |

**配置示例**：

```bash
# 配置Webhook通知
mc admin config set myminio notify_webhook:1 \
  endpoint="https://webhook.example.com/events" \
  auth_token="Bearer eyJhbGciOiJIUzI1NiIs..." \
  queue_limit="10000"

# 使用TLS客户端证书的Webhook配置
mc admin config set myminio notify_webhook:1 \
  endpoint="https://secure-webhook.example.com/events" \
  client_cert="/etc/minio/certs/client.crt" \
  client_key="/etc/minio/certs/client.key"

# 启用并重启
mc admin service restart myminio

# 添加事件通知
mc event add myminio/mybucket arn:minio:sqs::PRIMARY:webhook \
  --event "s3:ObjectCreated:Put,s3:ObjectRemoved:Delete"
```

**注意事项**：`auth_token` 会作为 `Authorization` 请求头发送。在高安全要求场景中，建议使用 `client_cert` 和 `client_key` 进行双向TLS认证。

---

#### AMQP（RabbitMQ）通知目标
**概念定义**：AMQP通知目标将MinIO事件发布到支持AMQP协议的消息队列服务（如RabbitMQ）。

**配置示例**：

```bash
mc admin config set myminio notify_amqp:1 \
  url="amqp://user:password@rabbitmq:5672" \
  exchange="minio-events" \
  exchange_type="fanout" \
  routing_key="bucket-events" \
  mandatory="off" \
  durable="on" \
  no_wait="off" \
  internal="off"
```

---

#### Redis 通知目标
**配置示例**：

```bash
mc admin config set myminio notify_redis:1 \
  address="redis:6379" \
  key="minio-events" \
  format="access"
```

---

#### MySQL 通知目标
**配置示例**：

```bash
mc admin config set myminio notify_mysql:1 \
  dsn_string="user:password@tcp(mysql:3306)/minio_events" \
  table="bucket_events" \
  format="namespace"
```

---

#### PostgreSQL 通知目标
**配置示例**：

```bash
mc admin config set myminio notify_postgresql:1 \
  connection_string="host=postgresql port=5432 dbname=minio_events user=postgres password=secret sslmode=disable" \
  table="bucket_events" \
  format="namespace"
```

---

#### Elasticsearch 通知目标
**配置示例**：

```bash
mc admin config set myminio notify_elasticsearch:1 \
  url="https://elasticsearch:9200" \
  index="minio-events" \
  format="namespace"
```

---

#### NATS 通知目标
**配置示例**：

```bash
mc admin config set myminio notify_nats:1 \
  address="nats:4222" \
  subject="minio-events"
```

---

### Java SDK 事件通知
**概念定义**：MinIO Java SDK 提供 `setBucketNotification`、`getBucketNotification` 和 `listenBucketNotification` 方法，用于以编程方式管理和监听存储桶事件通知。

**配置示例**：

```java
import io.minio.MinioClient;
import io.minio.SetBucketNotificationArgs;
import io.minio.GetBucketNotificationArgs;
import io.minio.ListenBucketNotificationArgs;
import io.minio.NotificationResult;
import io.minio.messages.NotificationConfiguration;
import io.minio.messages.QueueConfiguration;
import io.minio.messages.TopicConfiguration;
import io.minio.messages.CloudFunctionConfiguration;
import io.minio.messages.FilterRule;
import io.minio.messages.SuffixFilter;
import io.minio.messages.PrefixFilter;

// 构建通知配置
NotificationConfiguration notificationConfig = new NotificationConfiguration(
    null,  // topicConfigurations
    List.of(
        new QueueConfiguration(
            "arn:minio:sqs::PRIMARY:kafka",
            List.of(
                new FilterRule("suffix", ".jpg"),
                new FilterRule("prefix", "images/")
            ),
            List.of("s3:ObjectCreated:Put"),
            null
        )
    ),
    null   // cloudFunctionConfigurations
);

// 设置Bucket通知
minioClient.setBucketNotification(
    SetBucketNotificationArgs.builder()
        .bucket("my-bucket")
        .config(notificationConfig)
        .build()
);

// 获取Bucket通知配置
NotificationConfiguration retrieved = minioClient.getBucketNotification(
    GetBucketNotificationArgs.builder()
        .bucket("my-bucket")
        .build()
);

// 监听Bucket通知（实时事件流）
try (CloseableIterator<Result<NotificationRecords>> events =
    minioClient.listenBucketNotification(
        ListenBucketNotificationArgs.builder()
            .bucket("my-bucket")
            .prefix("images/")
            .suffix(".jpg")
            .events(List.of("s3:ObjectCreated:Put", "s3:ObjectRemoved:Delete"))
            .build()
    )) {
    while (events.hasNext()) {
        NotificationRecords records = events.next().get();
        for (NotificationRecord record : records.records()) {
            System.out.println("Event: " + record.eventName());
            System.out.println("Bucket: " + record.s3().bucket().name());
            System.out.println("Object: " + record.s3().object().key());
        }
    }
}
```

**注意事项**：`listenBucketNotification` 返回的是一个阻塞迭代器，在生产环境中应在独立线程中运行。全局事件（`s3:BucketCreated`、`s3:BucketRemoved`）只能通过 `listenBucketNotification` API 监听。

---

## 数据压缩
### 服务端压缩配置
**概念定义**：MinIO服务端数据压缩在对象上传（PUT）到磁盘之前进行压缩，在下载（GET）发送到客户端之前进行解压缩。压缩过程对客户端应用程序和服务完全透明。启用压缩可以减少磁盘使用，并根据数据类型可能提高整体吞吐量。

**核心参数**（`compression` 配置键）：

| 参数 | 环境变量 | 说明 |
|------|----------|------|
| `enable` | `MINIO_COMPRESSION_ENABLE` | 启用压缩：`on`/`off`（默认 `off`） |
| `allow_encryption` | `MINIO_COMPRESSION_ALLOW_ENCRYPTION` | 压缩后加密：`on`/`off`（默认 `off`） |
| `extensions` | `MINIO_COMPRESSION_EXTENSIONS` | 压缩文件扩展名列表，逗号分隔 |
| `mime_types` | `MINIO_COMPRESSION_MIME_TYPES` | 压缩MIME类型列表，逗号分隔 |

**默认压缩类型**：

| 文件扩展名 | MIME类型 |
|-----------|----------|
| `.txt` `.log` `.csv` `.json` `.tar` `.xml` `.bin` | `text/*` `application/json` `application/xml` `binary/octet-stream` |

**配置示例**：

```bash
# 启用默认类型的压缩
mc admin config set myminio compression enable=on

# 查看当前压缩配置
mc admin config get myminio compression

# 禁用压缩
mc admin config set myminio compression enable=off

# 指定压缩扩展名
mc admin config set myminio compression extensions=".txt,.log,.csv,.json"

# 指定压缩MIME类型
mc admin config set myminio compression mime_types="application/json,text/*"

# 压缩所有可压缩对象（排除默认排除类型）
mc admin config set myminio compression extensions= mime_types=

# 通过环境变量启用（需重启MinIO）
# 设置 MINIO_COMPRESSION_ENABLE=on
# 设置 MINIO_COMPRESSION_EXTENSIONS=.txt,.log,.csv,.json
# 设置 MINIO_COMPRESSION_MIME_TYPES=text/*,application/json,application/xml,binary/octet-stream
```

**注意事项**：启用、禁用或更新压缩设置不会修改现有对象。新对象将根据创建时生效的设置进行压缩。压缩配置是全局的，应用于部署中的所有存储桶。写入吞吐量通常为每个可用CPU核心每秒500MB或更高，解压缩速度约为每个CPU核心每秒1GB或更高。

---

### 可压缩内容类型
**概念定义**：MinIO基于文件扩展名和MIME类型判断是否压缩对象。某些文件类型由于无法有效压缩（如已压缩的媒体文件），即使明确指定也会被MinIO排除。

**默认排除类型（永不压缩）**：

| 对象类型 | 文件扩展名 | MIME类型 |
|----------|-----------|----------|
| 音频 | - | `audio/*` |
| 视频 | `*.mp4` `*.mkv` `*.mov` | `video/*` |
| 图像 | `*.jpg` `*.png` `*.gif` | - |
| LZW压缩 | - | `application/x-compress` |
| 7ZIP压缩 | `*.7z` | - |
| BZIP2压缩 | `*.bz2` | `application/x-bz2` |
| GZIP压缩 | `*.gz` | `application/x-gzip` |
| RAR压缩 | `*.rar` | - |
| LZMA压缩 | `*.xz` | `application/x-xz` |
| ZIP压缩 | `*.zip` | `application/zip` `application-x-zip-compressed` |
| 小于4KiB | - | - |

**注意事项**：MinIO从RELEASE.2024-03-15T01-07-19Z版本起，支持在 `extensions` 参数中指定 `*` 以压缩所有支持的文件类型（排除默认排除类型）。压缩和加密同时使用可能带来安全风险，MinIO强烈建议不要对已压缩对象进行加密，如需加密请先进行风险评估。

---

## Java SDK 生命周期管理
### setBucketLifecycle
**概念定义**：`setBucketLifecycle` 方法用于在指定存储桶上配置生命周期管理规则，支持对象过期、分层转换等操作。

**配置示例**：

```java
import io.minio.MinioClient;
import io.minio.SetBucketLifecycleArgs;
import io.minio.messages.*;
import java.time.ZonedDateTime;

// 构建生命周期配置
LifecycleConfiguration lifecycleConfig = new LifecycleConfiguration(
    List.of(
        // 规则1：30天后过期
        new LifecycleRule(
            Status.ENABLED,
            null,
            new Expiration((ZonedDateTime) null, 30, null),
            new RuleFilter("logs/", null, null),
            "expire-30-days",
            null,
            null,
            null,
            null
        ),
        // 规则2：90天后转换到warm层，365天后过期
        new LifecycleRule(
            Status.ENABLED,
            null,
            new Expiration((ZonedDateTime) null, 365, null),
            new RuleFilter("", null, null),
            "transition-expire",
            null,
            null,
            null,
            new Transition((ZonedDateTime) null, 90, "warm-tier")
        ),
        // 规则3：非当前版本管理
        new LifecycleRule(
            Status.ENABLED,
            null,
            null,
            new RuleFilter("", null, null),
            "noncurrent-cleanup",
            new NoncurrentVersionExpiration(7, null),
            null,
            null,
            null
        )
    )
);

// 设置生命周期
minioClient.setBucketLifecycle(
    SetBucketLifecycleArgs.builder()
        .bucket("my-bucket")
        .config(lifecycleConfig)
        .build()
);
```

---

### getBucketLifecycle
**概念定义**：`getBucketLifecycle` 方法用于获取指定存储桶上当前配置的生命周期管理规则。

**配置示例**：

```java
import io.minio.MinioClient;
import io.minio.GetBucketLifecycleArgs;
import io.minio.messages.LifecycleConfiguration;
import io.minio.messages.LifecycleRule;

// 获取生命周期配置
LifecycleConfiguration config = minioClient.getBucketLifecycle(
    GetBucketLifecycleArgs.builder()
        .bucket("my-bucket")
        .build()
);

// 遍历规则
for (LifecycleRule rule : config.rules()) {
    System.out.println("Rule ID: " + rule.id());
    System.out.println("Status: " + rule.status());
    if (rule.expiration() != null) {
        System.out.println("Expiry Days: " + rule.expiration().days());
    }
    if (rule.transition() != null) {
        System.out.println("Transition Days: " + rule.transition().days());
        System.out.println("Transition Tier: " + rule.transition().storageClass());
    }
}
```

---

### deleteBucketLifecycle
**概念定义**：`deleteBucketLifecycle` 方法用于删除指定存储桶上的所有生命周期管理规则。

**配置示例**：

```java
import io.minio.MinioClient;
import io.minio.DeleteBucketLifecycleArgs;

// 删除生命周期配置
minioClient.deleteBucketLifecycle(
    DeleteBucketLifecycleArgs.builder()
        .bucket("my-bucket")
        .build()
);
```

**注意事项**：删除生命周期配置后，之前已转换或已过期的对象不受影响。正在进行的生命周期操作（如扫描器正在处理的过期任务）可能会继续执行直到完成。

---

## 交叉引用

- [MinIO核心概念](./MinIO核心概念.md)
- [MinIO部署与配置](./MinIO部署与配置.md)
- [MinIO-Bucket操作](./MinIO-Bucket操作.md)
- [MinIO-Object操作](./MinIO-Object操作.md)
- [MinIO权限与安全](./MinIO权限与安全.md)
- [MinIO-Java-SDK](./MinIO-Java-SDK.md)
- [MinIO运维监控](./MinIO运维监控.md)
- [MinIO-Spring-Boot集成](./MinIO-Spring-Boot集成.md)