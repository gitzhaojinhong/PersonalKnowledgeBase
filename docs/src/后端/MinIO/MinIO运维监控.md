# MinIO 运维监控知识归档

> **版本基线**: RELEASE.2025-04-22T22-12-26Z
> **文档性质**: 运维监控知识分类树
> **更新时间**: 2026-07-17

---

## mc命令行工具
### 安装与别名配置
**概念定义**: MinIO Client (`mc`) 是 MinIO 官方命令行工具，提供与 S3 兼容对象存储交互的类 UNIX 命令集。`mc alias set` 用于建立与 MinIO 服务端的持久化连接别名，所有后续操作通过别名引用目标集群。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | string | 目标集群的本地别名标识 |
| `URL` | string | MinIO 服务端点，格式 `http(s)://HOST:PORT` |
| `ACCESS_KEY` | string | 访问密钥（Access Key） |
| `SECRET_KEY` | string | 私有密钥（Secret Key） |
| `--api` | string | API 签名版本，可选 `S3v4` 或 `S3v2` |
| `--path` | string | 路径风格，可选 `on`（路径寻址）或 `off`（DNS 寻址） |

**配置示例**:

```bash
# 添加 MinIO 别名
mc alias set myminio http://192.168.1.100:9000 minioadmin minioadmin

# 添加启用 TLS 的别名
mc alias set myminio-tls https://minio.example.com:9000 AKIAIOSFODNN7EXAMPLE wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# 添加别名并指定 API 签名版本
mc alias set myminio http://192.168.1.100:9000 ACCESS_KEY SECRET_KEY --api S3v4

# 列出所有已配置的别名
mc alias list

# 移除别名
mc alias remove myminio
```

**注意事项**: 别名信息存储在本地 `~/.mc/config.json` 文件中，**请勿在生产环境 Shell 历史中暴露密钥**；建议使用 `set +o history` / `set -o history` 或 PowerShell 的 `$env:HISTCONTROL` 规避凭据泄露。使用 TLS 时需确保证书受信任，否则需通过 `--insecure` 跳过验证。

---

### 基本对象操作
**概念定义**: `mc` 提供与 S3 兼容的 CRUD 操作命令，用于管理桶（Bucket）和对象（Object），涵盖创建、复制、列表、删除、同步、差异比较和管道操作。

#### 桶操作（mb）
**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `TARGET` | string | 目标桶路径，格式 `ALIAS/BUCKET` |
| `--region` | string | 指定桶的区域 |
| `--with-lock` | flag | 启用对象锁定（Object Lock）支持 |

**配置示例**:

```bash
# 创建桶
mc mb myminio/mybucket

# 创建带区域和锁定的桶
mc mb --region us-east-1 --with-lock myminio/secure-bucket
```

**注意事项**: 桶名称必须全局唯一且符合 DNS 命名规范（3-63 字符，仅小写字母、数字、连字符）；**启用 --with-lock 后不可撤销**，桶将永久开启对象锁定。

#### 对象复制（cp）
**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `SOURCE` | string | 源路径，支持本地或 `ALIAS/BUCKET/OBJECT` |
| `TARGET` | string | 目标路径 |
| `--recursive` / `-r` | flag | 递归复制目录 |
| `--preserve` | flag | 保留文件系统属性和元数据 |
| `--attr` | string | 自定义元数据键值对 |

**配置示例**:

```bash
# 上传本地文件到 MinIO
mc cp ./local-file.txt myminio/mybucket/

# 从 MinIO 下载文件
mc cp myminio/mybucket/remote-file.txt ./local-dir/

# MinIO 桶间复制
mc cp --recursive myminio/source-bucket/ myminio/target-bucket/

# 保留元数据复制
mc cp --preserve myminio/bucket1/file.txt myminio/bucket2/
```

**注意事项**: 跨桶复制**不会自动保留对象元数据**，需显式指定 `--preserve`；大文件复制使用分片上传机制，网络中断时需重新执行。

#### 对象列表（ls）
**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `TARGET` | string | 目标路径 |
| `--recursive` / `-r` | flag | 递归列出所有层级 |
| `--versions` | flag | 列出所有版本（含删除标记） |
| `--rewind` | string | 按时间回溯列出对象 |

**配置示例**:

```bash
# 列出桶内对象
mc ls myminio/mybucket

# 递归列出所有对象
mc ls --recursive myminio/mybucket

# 列出版本化对象
mc ls --versions myminio/mybucket

# 回溯到指定时间点
mc ls --rewind "2025-01-01T00:00:00Z" myminio/mybucket
```

#### 对象删除（rm）
**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `TARGET` | string | 目标路径 |
| `--recursive` / `-r` | flag | 递归删除 |
| `--force` | flag | 强制删除（跳过确认） |
| `--versions` | flag | 删除所有版本 |
| `--incomplete` | flag | 删除未完成的分片上传 |
| `--dry-run` | flag | 仅模拟，不实际删除 |

**配置示例**:

```bash
# 删除单个对象
mc rm myminio/mybucket/object.txt

# 递归强制删除
mc rm --recursive --force myminio/mybucket/

# 清理所有版本和未完成上传
mc rm --recursive --force --versions --incomplete myminio/mybucket/

# 模拟删除
mc rm --recursive --dry-run myminio/mybucket/
```

**注意事项**: **删除操作不可逆**；在版本化桶中，不含 `--versions` 的删除仅创建删除标记而不物理删除；建议先在非生产环境使用 `--dry-run` 验证范围。

#### 管道操作（pipe）
**概念定义**: `mc pipe` 将标准输入（stdin）的内容流式传输到目标对象，适用于动态生成内容或管道输出直接写入对象存储。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `TARGET` | string | 目标对象路径 |
| `--encrypt` | string | SSE 加密密钥 |

**配置示例**:

```bash
# 将标准输入写入对象
echo "Hello MinIO" | mc pipe myminio/mybucket/greeting.txt

# 将命令输出写入对象
mysqldump -u root mydb | mc pipe myminio/backups/mydb.sql

# 流式压缩写入
tar czf - /data | mc pipe myminio/backups/data.tar.gz
```

**注意事项**: pipe 操作**不支持断点续传**，适合小文件或流式数据；对于大文件建议使用 `mc cp` 命令。

---

### 文件同步（mc mirror）
**概念定义**: `mc mirror` 实现源端与目标端的单向同步，以目标端镜像源端内容。支持本地到 MinIO、MinIO 到本地、MinIO 到 MinIO 三种方向，基于文件大小和修改时间进行增量同步。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `SOURCE` | string | 源路径 |
| `TARGET` | string | 目标路径 |
| `--overwrite` | flag | 覆盖目标端已存在的对象 |
| `--remove` | flag | 删除目标端中源端不存在的对象 |
| `--watch` / `-w` | flag | 持续监控并同步变更 |
| `--preserve` / `-a` | flag | 保留文件属性 |
| `--exclude` | string | 排除匹配模式的文件 |
| `--attr` | string | 自定义元数据 |
| `--dry-run` | flag | 仅模拟，不实际同步 |

**配置示例**:

```bash
# 本地目录同步到 MinIO（增量）
mc mirror ./local-photos/ myminio/photos/

# MinIO 桶同步到本地
mc mirror myminio/backups/ ./local-backups/

# MinIO 到 MinIO 全量镜像（含删除）
mc mirror --overwrite --remove myminio/source-bucket/ myminio/dest-bucket/

# 持续监控同步（实时同步）
mc mirror --watch --overwrite ./app-logs/ myminio/logs/

# 排除指定文件模式
mc mirror --exclude "*.tmp" --exclude ".DS_Store" ./data/ myminio/data/

# 模拟同步
mc mirror --dry-run --overwrite myminio/bucket-a/ myminio/bucket-b/
```

**注意事项**: `--remove` 会使目标端**严格镜像源端**，目标端独有的文件将被删除，生产环境慎用；`--watch` 模式持续运行，建议使用 systemd 或 supervisor 管理进程；大量小文件同步时建议调大 `--concurrent` 并发数。

---

### 差异比较（mc diff）
**概念定义**: `mc diff` 计算源端与目标端之间的差异，列出仅在源端存在、仅在目标端存在或内容不同的对象，用于数据一致性校验。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `FIRST` | string | 第一个路径 |
| `SECOND` | string | 第二个路径 |
| `--recursive` / `-r` | flag | 递归比较 |

**配置示例**:

```bash
# 比较两个桶的差异
mc diff myminio/bucket-a myminio/bucket-b

# 递归比较本地与远程
mc diff --recursive ./local-dir/ myminio/remote-bucket/

# 输出格式说明：
# FIRST > SECOND  -- 仅在 FIRST 中存在
# FIRST < SECOND  -- 仅在 SECOND 中存在
# FIRST <> SECOND -- 两边均存在但内容不同
```

**注意事项**: diff 基于**文件大小和修改时间**比较，不进行逐字节校验；对于版本化桶，默认比较当前版本；如需深度校验，建议结合 `mc admin heal` 或外部校验工具。

---

## mc admin管理命令
### 集群信息（info）
**概念定义**: `mc admin info` 显示 MinIO 集群的整体信息，包括节点数、存储容量、使用量、对象数、版本等，是运维排障的首要入口。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | string | 目标集群别名 |

**配置示例**:

```bash
# 查看集群信息
mc admin info myminio

# 输出示例：
# ●  minio1.example.net:9000
#    Uptime: 30 days
#    Version: RELEASE.2025-04-22T22-12-26Z
#    Drives: 16/16 Healthy
#    Pool-0: 4 nodes, 4 drives each
#    Buckets: 12
#    Objects: 1,234,567
#    Usage: 2.5 TiB / 10 TiB
```

**注意事项**: 分布式部署中会显示**每个节点的信息**；Drive 状态为 Healthy 表示磁盘正常，Offline 或 Healing 需关注。

---

### 用户管理（user）
**概念定义**: `mc admin user` 管理 MinIO 内部身份提供商（IDP）的用户，支持创建、列表、查看、启用、禁用和删除操作，配合策略实现 RBAC 访问控制。

**核心参数**:

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `add` | `ALIAS USERNAME PASSWORD` | 添加用户 |
| `list` | `ALIAS` | 列出所有用户 |
| `info` | `ALIAS USERNAME` | 查看用户详细信息 |
| `enable` | `ALIAS USERNAME` | 启用用户 |
| `disable` | `ALIAS USERNAME` | 禁用用户 |
| `remove` | `ALIAS USERNAME` | 删除用户 |

**配置示例**:

```bash
# 添加用户
mc admin user add myminio alice MySecureP@ss123

# 列出所有用户
mc admin user list myminio

# 查看用户详情
mc admin user info myminio alice

# 禁用用户
mc admin user disable myminio alice

# 启用用户
mc admin user enable myminio alice

# 删除用户
mc admin user remove myminio alice
```

**注意事项**: **禁用用户不等于删除**，禁用的用户保留其策略关联和访问密钥，可随时恢复；删除用户不可逆且会解除所有策略关联；用户密码需满足复杂度要求。

---

### 策略管理（policy）
**概念定义**: `mc admin policy` 管理 IAM 兼容的策略 JSON 文档，实现基于策略的访问控制（PBAC）。策略定义了对资源的允许/拒绝操作，通过 `attach`/`detach` 绑定到用户或组。

**核心参数**:

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `create` | `ALIAS POLICYNAME POLICY_FILE` | 从 JSON 文件创建策略 |
| `list` | `ALIAS` | 列出所有策略 |
| `info` | `ALIAS POLICYNAME` | 查看策略内容 |
| `attach` | `ALIAS POLICYNAME --user USER \| --group GROUP` | 绑定策略到用户或组 |
| `detach` | `ALIAS POLICYNAME --user USER \| --group GROUP` | 解除绑定 |
| `remove` | `ALIAS POLICYNAME` | 删除策略 |

**配置示例**:

```bash
# 创建只读策略（readonly.json）
cat > readonly.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::mybucket", "arn:aws:s3:::mybucket/*"]
    }
  ]
}
EOF
mc admin policy create myminio readonly readonly.json

# 列出所有策略
mc admin policy list myminio

# 查看策略内容
mc admin policy info myminio readonly

# 绑定策略到用户
mc admin policy attach myminio readonly --user alice

# 绑定策略到组
mc admin policy attach myminio readonly --group developers

# 解除绑定
mc admin policy detach myminio readonly --user alice

# 删除策略
mc admin policy remove myminio readonly
```

**注意事项**: 策略使用 **IAM 兼容 JSON 格式**，Resource 字段使用 ARN 格式；`attach` 前需确保策略和目标用户/组已存在；内置策略 `readwrite`、`readonly`、`writeonly` 不可删除。

---

### 配置管理（config）
**概念定义**: `mc admin config` 提供 MinIO 服务端运行时配置的查询、设置和重置功能，配置按子系统（如 `api`、`scanner`、`heal`、`audit_webhook` 等）组织。

**核心参数**:

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `get` | `ALIAS [SUBSYSTEM]` | 获取当前配置 |
| `set` | `ALIAS SUBSYSTEM KEY=VALUE ...` | 设置配置项 |
| `reset` | `ALIAS SUBSYSTEM [KEY]` | 重置配置为默认值 |
| `history` | `ALIAS` | 查看配置变更历史 |

**配置示例**:

```bash
# 查看所有子系统配置
mc admin config get myminio

# 查看特定子系统配置
mc admin config get myminio api

# 设置 API 子系统配置
mc admin config set myminio api \
  requests_max=1600 \
  cors_allow_origin="https://example.com"

# 设置扫描器速度
mc admin config set myminio scanner speed=fast

# 重置子系统配置
mc admin config reset myminio scanner

# 重置特定配置项
mc admin config reset myminio api requests_max

# 应用配置变更（重启服务）
mc admin service restart myminio
```

**注意事项**: 配置变更后**必须重启 MinIO 服务**才能生效（`mc admin service restart`）；生产环境建议在维护窗口内操作；可通过 `mc admin config history` 审计配置变更。

---

### 修复管理（heal）
**概念定义**: `mc admin heal` 检查并修复对象存储中受损或缺失的数据分片，基于纠删码（Erasure Code）的冗余信息重建损坏数据，确保数据完整性和可用性。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS/[BUCKET]/[PREFIX]` | string | 目标路径，可指定桶或前缀 |
| `--recursive` / `-r` | flag | 递归修复 |
| `--dry-run` / `-n` | flag | 仅检查不修复 |
| `--scan` | string | 扫描模式：`normal`/`deep` |
| `--force-start` / `-f` | flag | 强制启动（即使已有修复任务） |
| `--remove` | flag | 移除悬空对象 |

**配置示例**:

```bash
# 扫描并修复整个集群
mc admin heal --recursive myminio

# 修复特定桶
mc admin heal --recursive myminio/mybucket

# 仅检查（不修复）
mc admin heal --recursive --dry-run myminio/mybucket

# 深度扫描
mc admin heal --scan deep --recursive myminio/mybucket

# 查看修复进度
watch mc admin heal --recursive --dry-run myminio
```

**注意事项**: heal 操作**消耗 I/O 资源**，生产环境建议在低负载时段执行；`--scan deep` 会逐字节校验，速度较慢但更彻底；修复过程中集群仍可正常提供读写服务。

---

### 退役管理（decommission）
**概念定义**: `mc admin decommission` 管理 Server Pool 的退役流程，将数据从旧 Pool 迁移到其余 Pool，完成后可安全移除旧硬件。这是 MinIO 推荐的集群缩容方案。

**核心参数**:

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `start` | `ALIAS POOL_NAME` | 启动退役 |
| `status` | `ALIAS POOL_NAME` | 查看退役状态 |
| `cancel` | `ALIAS POOL_NAME` | 取消退役 |

**配置示例**:

```bash
# 启动退役
mc admin decommission start myminio http://minio{1...4}.example.com:9000/data{1...4}

# 查看退役状态
mc admin decommission status myminio http://minio{1...4}.example.com:9000/data{1...4}

# 取消退役
mc admin decommission cancel myminio http://minio{1...4}.example.com:9000/data{1...4}
```

**注意事项**: 退役过程**不可中断**（仅可取消后重新开始）；数据迁移速度取决于网络带宽和集群负载；退役中的 Pool 仍可写入但不再接受新对象的路由分配；退役完成后需手动从启动参数中移除该 Pool。

---

### 扫描器状态（scanner）
**概念定义**: `mc admin scanner info` 展示 MinIO 内置扫描器的运行状态，包括最后一次全扫描时间、当前周期、活跃驱动器数及每分钟扫描统计，用于评估扫描器性能和集群健康巡检覆盖率。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | string | 目标集群别名 |

**配置示例**:

```bash
# 查看扫描器状态
mc admin scanner info myminio

# 输出示例：
# Overall Statistics
# ------------------
# Last full scan time: 0d0h14m; Estimated 2885.28/month
# Current cycle: 70464; Started: 2025-04-19 20:02:34 +0000 UTC
# Active drives: 2
#
# Last Minute Statistics
# ----------------------
# Objects Scanned: 620 objects; Avg: 124.929µs; Rate: 892800/day
# Versions Scanned: 620 versions; Avg: 2.801µs; Rate: 892800/day
# Versions Heal Checked: 0 versions; Avg: 0ms
# Read Metadata: 621 objects; Avg: 88.416µs
# ILM checks: 656 versions; Avg: 663ns
# Check Replication: 656 versions; Avg: 1.061µs
# Verify Deleted: 0 folders; Avg: 0ms
# Yield: 3.086s total; Avg: 4.705ms/obj
```

**注意事项**: 扫描器是**后台任务**，主动让出 I/O 给读写请求；`Last full scan time` 过长可能表示集群规模大或扫描速度设置过低；通过 `mc admin config set myminio scanner speed=fast` 可调整扫描速度。

---

### Prometheus 集成（prometheus）
**概念定义**: `mc admin prometheus` 提供 Prometheus 监控集成的生成和管理功能，包括生成 scrape 配置、管理 Bearer Token 认证和查看可用指标。

**核心参数**:

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `generate` | `ALIAS [TYPE]` | 生成 Prometheus scrape 配置 |
| `metrics` | `ALIAS [TYPE]` | 列出可用指标 |

**TYPE 可选值**: `cluster`（集群级）、`node`（节点级）、`bucket`（桶级）、`resource`（资源级）

**配置示例**:

```bash
# 生成集群级别 scrape 配置
mc admin prometheus generate myminio

# 生成节点级别 scrape 配置
mc admin prometheus generate myminio node

# 生成桶级别 scrape 配置
mc admin prometheus generate myminio bucket

# 生成资源级别 scrape 配置
mc admin prometheus generate myminio resource

# 列出可用指标
mc admin prometheus metrics myminio
```

**注意事项**: 生成的配置包含 **Bearer Token**，默认24小时有效；MinIO 默认要求认证访问 metrics 端点，设置 `MINIO_PROMETHEUS_AUTH_TYPE=public` 可禁用认证。

---

### 请求追踪（trace）
**概念定义**: `mc admin trace` 实时展示目标 MinIO 部署上发生的所有 API 操作，用于调试请求、排查性能瓶颈和审计操作行为。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | string | 目标集群别名 |
| `--verbose` / `-v` | flag | 详细输出模式 |
| `--all` / `-a` | flag | 追踪所有 API 调用（含内部调用） |
| `--errors` / `-e` | flag | 仅追踪错误请求 |
| `--call` | string | 过滤指定 API 调用类型 |
| `--status-code` | string | 按 HTTP 状态码过滤 |

**配置示例**:

```bash
# 追踪所有请求
mc admin trace myminio

# 仅追踪错误请求
mc admin trace --errors myminio

# 详细追踪指定 API
mc admin trace --verbose --call "s3.PutObject" myminio

# 追踪 5xx 错误
mc admin trace --status-code "5[0-9][0-9]" myminio
```

**注意事项**: trace 输出**实时流式**，Ctrl+C 停止；高负载集群中 trace 输出量极大，建议使用过滤参数缩小范围；生产环境谨慎使用 `--all` 参数。

---

### 性能监控（top）
**概念定义**: `mc admin top` 提供 MinIO 集群的实时性能监控视图，按 API 操作类型展示请求速率、延迟、错误率等关键指标。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `ALIAS` | string | 目标集群别名 |
| `lock` | 子命令 | 查看锁信息 |
| `api` | 子命令 | 查看 API 性能统计 |

**配置示例**:

```bash
# 查看 API 性能 Top 统计
mc admin top api myminio

# 查看锁信息
mc admin top lock myminio
```

**注意事项**: top 命令提供**实时快照**而非持续监控，持续监控建议使用 Prometheus + Grafana 方案。

---

## Prometheus指标采集
### Metrics 端点
**概念定义**: MinIO 以 Prometheus 数据模型发布集群和节点指标，支持 v2 和 v3 两个版本的指标端点。v3 版本按功能域分类提供更细粒度的指标，v2 版本按资源类型（cluster/node/bucket/resource）组织。

**核心参数**:

| 端点 | 版本 | 说明 |
|------|------|------|
| `/minio/metrics/v2` | v2 | v2 基础端点 |
| `/minio/v2/metrics/cluster` | v2 | 集群级聚合指标 |
| `/minio/v2/metrics/node` | v2 | 节点级指标 |
| `/minio/v2/metrics/bucket` | v2 | 桶级指标 |
| `/minio/v2/metrics/resource` | v2 | 资源级指标 |
| `/minio/metrics/v3` | v3 | v3 基础端点（返回 cluster/usage/buckets） |
| `/minio/metrics/v3/{category}` | v3 | v3 分类端点 |

#### v3 指标分类
| 分类 | 端点路径 | 说明 |
|------|----------|------|
| API | `/minio/metrics/v3/api/requests` | API 请求指标 |
| API (Bucket) | `/minio/metrics/v3/bucket/api` | 桶级 API 指标 |
| Audit | `/minio/metrics/v3/audit` | 审计日志指标 |
| Cluster | `/minio/metrics/v3/cluster/health` | 集群健康指标 |
| Cluster | `/minio/metrics/v3/cluster/config` | 集群配置指标 |
| Cluster | `/minio/metrics/v3/cluster/erasure-set` | 纠删码集指标 |
| Cluster | `/minio/metrics/v3/cluster/iam` | IAM 指标 |
| Cluster | `/minio/metrics/v3/cluster/usage/buckets` | 桶用量统计 |
| Cluster | `/minio/metrics/v3/cluster/usage/objects` | 对象用量统计 |
| Debug | `/minio/metrics/v3/debug/go` | Go 运行时调试指标 |
| ILM | `/minio/metrics/v3/ilm` | 生命周期管理指标 |
| Logger | `/minio/metrics/v3/logger/webhook` | 日志 Webhook 指标 |
| Notification | `/minio/metrics/v3/notification` | 事件通知指标 |
| Replication | `/minio/metrics/v3/replication` | 复制指标 |
| Scanner | `/minio/metrics/v3/scanner` | 扫描器指标 |
| System | `/minio/metrics/v3/system/cpu` | CPU 指标 |
| System | `/minio/metrics/v3/system/drive` | 磁盘指标 |
| System | `/minio/metrics/v3/system/memory` | 内存指标 |
| System | `/minio/metrics/v3/system/network/internode` | 节点间网络指标 |
| System | `/minio/metrics/v3/system/process` | 进程指标 |

**配置示例**:

```bash
# 获取 v3 基础指标
curl -H "Authorization: Bearer TOKEN" http://minio.example.com:9000/minio/metrics/v3

# 获取特定分类指标
curl -H "Authorization: Bearer TOKEN" http://minio.example.com:9000/minio/metrics/v3/audit

# 获取桶级 API 指标
curl -H "Authorization: Bearer TOKEN" http://minio.example.com:9000/minio/metrics/v3/bucket/api?buckets=mybucket,yourbucket

# 列出可用指标（Markdown 格式）
curl http://minio.example.com:9000/minio/metrics/v3/audit?list

# JSON 格式输出
curl -H "Content-Type: application/json" http://minio.example.com:9000/minio/metrics/v3/cluster/health?list
```

**注意事项**: 默认需要 **Bearer Token 认证**，使用 `mc admin prometheus generate` 生成；v3 端点**按需返回**，仅输出有值的指标；v2 端点在 2025 版本中仍受支持但建议迁移到 v3。

---

### 生成 Scrape 配置
**概念定义**: `mc admin prometheus generate` 自动生成 Prometheus `scrape_configs` 配置片段，包含认证 Token、端点路径和目标地址，可直接粘贴到 Prometheus 配置文件中。

**配置示例**:

```yaml
# mc admin prometheus generate myminio 输出示例
global:
  scrape_interval: 60s

scrape_configs:
  - job_name: minio-job
    bearer_token: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...
    metrics_path: /minio/v2/metrics/cluster
    scheme: https
    static_configs:
      - targets: ['minio.example.net:9000']

  - job_name: minio-job-node
    bearer_token: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...
    metrics_path: /minio/v2/metrics/node
    scheme: https
    static_configs:
      - targets: ['minio-1.example.net:9000', 'minio-2.example.net:9000']

  - job_name: minio-job-bucket
    bearer_token: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...
    metrics_path: /minio/v2/metrics/bucket
    scheme: https
    static_configs:
      - targets: ['minio.example.net:9000']

  - job_name: minio-job-resource
    bearer_token: eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...
    metrics_path: /minio/v2/metrics/resource
    scheme: https
    static_configs:
      - targets: ['minio.example.net:9000']
```

```bash
# 生成并保存到文件
mc admin prometheus generate myminio > /etc/prometheus/minio-scrape.yml
mc admin prometheus generate myminio node >> /etc/prometheus/minio-scrape.yml
mc admin prometheus generate myminio bucket >> /etc/prometheus/minio-scrape.yml
mc admin prometheus generate myminio resource >> /etc/prometheus/minio-scrape.yml
```

**注意事项**: `scrape_interval` 建议设置为 **60s 或更长**避免抓取超时；Bearer Token 默认有效期 24 小时，生产环境建议使用 `MINIO_PROMETHEUS_AUTH_TYPE=public` 并配合网络层访问控制；v3 抓取需修改 `metrics_path` 为 `/minio/metrics/v3/{category}`。

---

### 关键指标
**概念定义**: 以下为 MinIO 运维中最重要的监控指标，按类别分组，覆盖集群状态、请求性能、存储容量和对象统计。

#### 集群状态指标
| 指标名称 | 类型 | 说明 |
|----------|------|------|
| `minio_cluster_info` | gauge | 集群元信息（版本等） |
| `minio_cluster_health_drives_online_count` | gauge | 在线磁盘数 |
| `minio_cluster_health_drives_offline_count` | gauge | 离线磁盘数 |
| `minio_cluster_health_drives_count` | gauge | 总磁盘数 |
| `minio_cluster_health_nodes_online_count` | gauge | 在线节点数 |
| `minio_cluster_health_nodes_offline_count` | gauge | 离线节点数 |
| `minio_cluster_erasure_set_overall_health` | gauge | 纠删码集整体健康（1=健康，0=不健康） |
| `minio_cluster_erasure_set_healing_drives_count` | gauge | 正在修复的磁盘数 |

#### 请求性能指标
| 指标名称 | 类型 | 说明 |
|----------|------|------|
| `minio_api_requests_total` | counter | API 请求总数 |
| `minio_api_requests_errors_total` | counter | 错误请求总数（4xx+5xx） |
| `minio_api_requests_5xx_errors_total` | counter | 5xx 服务端错误总数 |
| `minio_api_requests_4xx_errors_total` | counter | 4xx 客户端错误总数 |
| `minio_api_requests_inflight_total` | gauge | 当前正在处理的请求数 |
| `minio_api_requests_ttfb_seconds_distribution` | histogram | TTFB 延迟分布 |
| `minio_api_requests_traffic_sent_bytes` | counter | 发送字节总数 |
| `minio_api_requests_traffic_received_bytes` | counter | 接收字节总数 |

#### 存储容量指标
| 指标名称 | 类型 | 说明 |
|----------|------|------|
| `minio_cluster_health_capacity_raw_total_bytes` | gauge | 原始总容量（字节） |
| `minio_cluster_health_capacity_raw_free_bytes` | gauge | 原始可用容量（字节） |
| `minio_cluster_health_capacity_usable_total_bytes` | gauge | 可用总容量（字节） |
| `minio_cluster_health_capacity_usable_free_bytes` | gauge | 可用空闲容量（字节） |

#### 桶对象指标
| 指标名称 | 类型 | 说明 |
|----------|------|------|
| `minio_bucket_objects` | gauge | 桶内对象数量 |
| `minio_bucket_api_total` | counter | 桶 API 请求总数 |
| `minio_bucket_api_traffic_sent_bytes` | counter | 桶发送字节数 |
| `minio_bucket_api_traffic_received_bytes` | counter | 桶接收字节数 |

**PromQL 查询示例**:

```promql
# 集群在线节点数
minio_cluster_health_nodes_online_count

# 5xx 错误率（每秒）
rate(minio_api_requests_5xx_errors_total[5m])

# 存储使用率（百分比）
100 - (minio_cluster_health_capacity_usable_free_bytes / minio_cluster_health_capacity_usable_total_bytes * 100)

# 请求延迟 P99
histogram_quantile(0.99, rate(minio_api_requests_ttfb_seconds_distribution_bucket[5m]))

# 桶对象数量
minio_bucket_objects{bucket="mybucket"}
```

**注意事项**: `minio_cluster_health_capacity_usable_*` 指标反映的是**纠删码后的可用容量**（扣除冗余后）；`minio_api_requests_total` 包含所有 S3 API 操作，可按 `name` label 按操作类型过滤。

---

## Grafana仪表盘
### 官方 Dashboard 模板
**概念定义**: MinIO 在 Grafana 官方市场提供预构建的 Dashboard 模板，直接导入即可可视化 MinIO 集群的 Prometheus 指标数据，无需手动创建面板。

**核心参数**:

| Dashboard | ID | 适用版本 | 说明 |
|-----------|-----|----------|------|
| MinIO Dashboard | 13502 | v3 Metrics | 集群综合监控仪表盘 |
| MinIO Bucket Dashboard | 19237 | v3 Metrics | 桶级别监控仪表盘 |

**配置示例**:

```bash
# Grafana 中导入 Dashboard#    Grafana Web UI → Dashboards → Import → 输入 ID: 13502

# 或通过 API 导入curl -X POST http://grafana.example.com:3000/api/dashboards/import \
  -H "Content-Type: application/json" \
  -d '{"dashboard": {"id": 13502}}'
```

**注意事项**: 导入前需确保 **Prometheus 数据源已配置**；Dashboard ID 可能随版本更新变化，建议从 Grafana Labs 官网搜索最新版本；v2 和 v3 指标不兼容，需使用对应版本的 Dashboard。

---

### 数据源配置
**概念定义**: Grafana 需配置 Prometheus 数据源来读取 MinIO 指标，数据源定义了 Prometheus 服务的 URL 和访问凭据。

**核心参数**:

| 参数 | 值 | 说明 |
|------|-----|------|
| Name | `Prometheus-MinIO` | 数据源名称 |
| URL | `http://prometheus:9090` | Prometheus 服务地址 |
| Access | `Server` / `Browser` | 访问模式 |
| Scrape Interval | `60s` | 抓取间隔 |
| HTTP Method | `GET` | 请求方法 |

**配置示例**:

```yaml
# 或通过 Grafana Provisioning 自动配置
# /etc/grafana/provisioning/datasources/minio-prometheus.yml
apiVersion: 1

datasources:
  - name: Prometheus-MinIO
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: false
    jsonData:
      timeInterval: "60s"
    editable: true
```

**注意事项**: 数据源 URL 需确保 **Grafana 容器/进程可访问** Prometheus 服务；生产环境建议使用 Service Discovery 或 DNS 解析。

---

### 关键面板
**概念定义**: MinIO 官方 Dashboard 13502 包含以下核心监控面板，覆盖集群健康、请求速率、存储容量和网络带宽四大维度。

#### 集群健康面板
| 指标 | 面板类型 | 说明 |
|------|----------|------|
| `minio_cluster_health_nodes_online_count` | Stat | 在线节点数 |
| `minio_cluster_health_nodes_offline_count` | Stat | 离线节点数 |
| `minio_cluster_health_drives_online_count` | Stat | 在线磁盘数 |
| `minio_cluster_health_drives_offline_count` | Stat | 离线磁盘数 |
| `minio_cluster_erasure_set_overall_health` | Stat | 纠删码集健康状态 |

#### 请求速率面板
| 指标 | 面板类型 | 说明 |
|------|----------|------|
| `rate(minio_api_requests_total[5m])` | Graph | 每秒请求数（QPS） |
| `rate(minio_api_requests_errors_total[5m])` | Graph | 错误请求速率 |
| `minio_api_requests_inflight_total` | Graph | 并发请求数 |
| `histogram_quantile(0.99, rate(minio_api_requests_ttfb_seconds_distribution_bucket[5m]))` | Graph | P99 延迟 |

#### 存储容量面板
| 指标 | 面板类型 | 说明 |
|------|----------|------|
| `minio_cluster_health_capacity_usable_total_bytes` | Gauge | 总可用容量 |
| `minio_cluster_health_capacity_usable_free_bytes` | Gauge | 空闲容量 |
| 容量使用率计算 | Gauge | 使用百分比 |

#### 带宽面板
| 指标 | 面板类型 | 说明 |
|------|----------|------|
| `rate(minio_api_requests_traffic_sent_bytes[5m])` | Graph | 出站带宽 |
| `rate(minio_api_requests_traffic_received_bytes[5m])` | Graph | 入站带宽 |

**注意事项**: 面板数据依赖 **Prometheus 数据采集的连续性**，采集间隔过长会导致图表出现断点；建议配置 Alert Rules 对关键面板设置告警阈值。

---

## 审计日志
### 审计 Webhook 配置
**概念定义**: MinIO 通过审计 Webhook 将每个 API 操作的详细审计日志以 JSON 格式 `PUT` 到外部 HTTP 端点，满足安全合规和操作审计需求。配置通过 `audit_webhook` 子系统完成。

**核心参数**:

| 参数 | 类型 | 说明 |
|------|------|------|
| `endpoint` | string | 审计日志接收端 HTTP 端点 URL |
| `auth_token` | string | 认证令牌，Webhook 请求的 `Authorization` 头 |
| `client_cert` | string | mTLS 客户端证书路径 |
| `client_key` | string | mTLS 客户端密钥路径 |
| `queue_size` | int | 日志队列大小 |
| `queue_dir` | string | 磁盘队列目录（持久化） |
| `enable` | string | 开关：`on` / `off` |

**配置示例**:

```bash
# 设置审计 Webhook
mc admin config set myminio audit_webhook:primary \
  endpoint="http://log-server:8080/audit" \
  auth_token="Bearer my-secret-token" \
  enable="on"

# 启用 mTLS 的审计 Webhook
mc admin config set myminio audit_webhook:primary \
  endpoint="https://log-server:8443/audit" \
  auth_token="Bearer my-secret-token" \
  client_cert="/etc/minio/certs/client.crt" \
  client_key="/etc/minio/certs/client.key" \
  enable="on"

# 查看当前配置
mc admin config get myminio audit_webhook

# 重启服务应用配置
mc admin service restart myminio
```

**注意事项**: 配置审计 Webhook 后**必须重启 MinIO 服务**才能生效；`endpoint` 在重启 MinIO 时**必须可达**，否则可能导致启动失败；`queue_dir` 用于在目标不可达时本地持久化积压日志。

---

### 日志格式
**概念定义**: MinIO 审计日志以 JSON 文档格式记录每次 API 操作的完整上下文，包括请求者、操作类型、资源、时间戳、HTTP 状态码等字段。

**核心参数**:

| 字段 | 类型 | 说明 |
|------|------|------|
| `time` | string | ISO 8601 时间戳 |
| `api.name` | string | API 操作名称（如 `PutObject`） |
| `api.bucket` | string | 目标桶名 |
| `api.object` | string | 目标对象名 |
| `requestID` | string | 唯一请求标识 |
| `requestHeader.host` | string | 请求主机头 |
| `remotehost` | string | 客户端 IP |
| `userAgent` | string | 客户端 User-Agent |
| `user` | string | 访问用户 |
| `responseHeader.statusCode` | int | HTTP 状态码 |
| `responseHeader.x-amz-request-id` | string | S3 请求 ID |

**日志格式示例**:

```json
{
  "time": "2025-04-22T22:12:26.000Z",
  "deploymentid": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "api": {
    "name": "PutObject",
    "bucket": "mybucket",
    "object": "path/to/file.pdf"
  },
  "remotehost": "192.168.1.50",
  "requestID": "17E0C8A9B6F0E65D",
  "userAgent": "MinIO (linux; amd64) minio-go/v7.0.66",
  "user": "alice",
  "requestHeader": {
    "Host": "minio.example.com:9000",
    "Content-Length": "1048576",
    "X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD"
  },
  "responseHeader": {
    "statusCode": 200,
    "x-amz-request-id": "17E0C8A9B6F0E65D",
    "Content-Length": "0"
  },
  "tags": {
    "objectSize": "1048576"
  }
}
```

**注意事项**: 审计日志**包含请求体大小但不包含实际数据**，不会泄露对象内容；高负载集群中审计日志量极大，建议配置日志聚合系统（如 ELK、Loki）处理。

---

## 健康检查
### 存活检查（Liveness）
**概念定义**: `/minio/health/live` 端点检测 MinIO 服务进程是否存活并可响应请求，用于 Kubernetes Liveness Probe 或负载均衡器健康检查。

**核心参数**:

| 状态码 | 说明 |
|--------|------|
| `200 OK` | 服务在线且功能正常 |
| `429 Too Many Requests` | 服务高负载，建议负载均衡器路由流量到其他节点 |

**配置示例**:

```bash
# HTTP 存活检查
curl -I http://minio.example.com:9000/minio/health/live

# Kubernetes Liveness Probe
# livenessProbe:
#   httpGet:
#     path: /minio/health/live
#     port: 9000
#     scheme: HTTP
#   initialDelaySeconds: 120
#   periodSeconds: 15
#   timeoutSeconds: 10
#   failureThreshold: 3
```

**注意事项**: 存活检查**仅验证进程存活**，不验证集群功能完整性；`429` 状态码表示服务**正在经历高负载**（线程压力或请求队列满），不应视为失败。

---

### 就绪检查（Readiness）
**概念定义**: `/minio/health/ready` 端点检测 MinIO 节点是否已完成初始化并可接受请求，用于 Kubernetes Readiness Probe。

**核心参数**:

| 状态码 | 说明 |
|--------|------|
| `200 OK` | 节点已初始化并可接受请求 |
| `429 Too Many Requests` | 服务高负载 |
| `503 Service Unavailable` | 节点未就绪（如 etcd 不可达） |

**配置示例**:

```bash
# HTTP 就绪检查
curl -I http://minio.example.com:9000/minio/health/ready

# Kubernetes Readiness Probe
# readinessProbe:
#   httpGet:
#     path: /minio/health/ready
#     port: 9000
#     scheme: HTTP
#   initialDelaySeconds: 120
#   periodSeconds: 15
#   timeoutSeconds: 10
#   successThreshold: 1
#   failureThreshold: 3
```

**注意事项**: 就绪检查是**节点级别**的，不同于集群级别的读写检查；Kubernetes 中 readinessProbe 失败会停止向该 Pod 路由流量。

---

### 集群健康检查
**概念定义**: 集群级别的健康检查端点 `/minio/health/cluster` 验证集群是否满足读写仲裁要求，包括集群写就绪和集群读就绪两个端点。

**核心参数**:

| 端点 | 说明 |
|------|------|
| `/minio/health/cluster` | 集群写就绪检查 |
| `/minio/health/cluster/read` | 集群读就绪检查 |
| `?distributed=true` | 分布式检查（所有节点均确认） |
| `?maintenance=true` | 维护模式检查（评估节点下线影响） |

**响应头**:

| 响应头 | 说明 |
|--------|------|
| `X-Minio-Write-Quorum` | 写仲裁所需磁盘数 |
| `X-Minio-Read-Quorum` | 读仲裁所需磁盘数 |
| `X-Minio-Healing-Drives` | 正在修复的磁盘数（>0 时出现） |
| `X-Minio-Server-Status` | 故障原因（503 时出现） |
| `X-Minio-Storage-Class-Defaults` | 是否使用默认存储类 |

**配置示例**:

```bash
# 集群写就绪检查
curl -I http://minio.example.com:9000/minio/health/cluster

# 集群读就绪检查
curl -I http://minio.example.com:9000/minio/health/cluster/read

# 分布式健康检查（所有节点视角）
curl -I "http://minio.example.com:9000/minio/health/cluster?distributed=true"

# 维护模式检查（评估某节点下线影响）
curl -I "http://minio.example.com:9000/minio/health/cluster?maintenance=true"

# 200 OK  -- 集群可维持仲裁
# 412 Precondition Failed -- 下线会导致仲裁丢失
# 503 Service Unavailable -- 集群不可用
```

**注意事项**: `X-Minio-Server-Status` 响应头在 503 时提供具体原因，常见值包括 `offline`、`restarting`、`grid-offline`、`peer-unreachable:{HOST}` 等；分布式检查 (`distributed=true`) 对网络要求更高，可能因网络延迟导致误报。

---

## Server Pool运维
### 扩容（添加 Server Pool）
**概念定义**: MinIO 通过添加新的 Server Pool 实现水平扩容，新 Pool 的节点和磁盘规格可不同于现有 Pool，数据根据各 Pool 的可用空间按比例自动分配。

**核心参数**:

| 参数 | 说明 |
|------|------|
| 新 Pool 节点数 | 至少 2 个节点，建议与现有 Pool 节点数一致 |
| 新 Pool 磁盘数 | 每个节点至少 1 个磁盘，建议与现有 Pool 一致 |
| 纠删码配置 | 自动计算，建议保持与现有 Pool 相同 |

**配置示例**:

```bash
# 原始启动命令（Pool-0）
minio server http://minio{1...4}.example.com:9000/data{1...4}

# 扩容后启动命令（Pool-0 + Pool-1）
minio server \
  http://minio{1...4}.example.com:9000/data{1...4} \
  http://minio{5...8}.example.com:9000/data{1...4}

# 重启所有节点以应用新配置
mc admin service restart myminio
```

**注意事项**: 扩容后**需要重启所有 MinIO 节点**使新 Pool 生效；新 Pool 添加后数据**不会自动再平衡**，需手动触发 `mc admin rebalance`；新 Pool 磁盘需为空或格式化后的干净磁盘。

---

### 下线退役（Decommission）
**概念定义**: `mc admin decommission` 将指定 Server Pool 的数据迁移到其余 Pool，完成后可安全移除该 Pool 的硬件，是 MinIO 推荐的缩容方式。

**核心参数**:

| 参数 | 说明 |
|------|------|
| `start` | 启动退役流程 |
| `status` | 查看退役进度 |
| `cancel` | 取消退役（数据迁移回退） |

**状态字段**:

| 状态值 | 说明 |
|--------|------|
| `Pending` | 等待开始 |
| `InProgress` | 迁移进行中 |
| `Complete` | 退役完成，可安全移除 |
| `Failed` | 退役失败，需排查 |
| `Canceled` | 已取消 |

**配置示例**:

```bash
# 启动退役
mc admin decommission start myminio \
  http://minio{1...4}.example.com:9000/data{1...4}

# 查看退役状态
mc admin decommission status myminio \
  http://minio{1...4}.example.com:9000/data{1...4}

# 输出示例：
# Decommission Status: InProgress
#  Started: 2025-04-20 08:00:00
#  Progress: 45.2% (1.2 TiB / 2.65 TiB)
#  Objects: 500,000 / 1,100,000
#  Estimated Completion: 2025-04-21 02:00:00

# 取消退役
mc admin decommission cancel myminio \
  http://minio{1...4}.example.com:9000/data{1...4}
```

**注意事项**: 退役中的 Pool **仍可写入但不接受新对象路由分配**；退役进度取决于数据量和网络带宽；`Complete` 状态后需手动从启动命令中移除该 Pool 并重启服务；`Failed` 状态需检查日志排查原因。

---

### 再平衡（Rebalance）
**概念定义**: `mc admin rebalance` 在新 Pool 添加后重新分配对象，使各 Pool 的数据分布更均衡，优化存储利用率和访问性能。

**核心参数**:

| 子命令 | 参数 | 说明 |
|--------|------|------|
| `start` | `ALIAS` | 启动再平衡 |
| `status` | `ALIAS` | 查看再平衡进度 |
| `stop` | `ALIAS` | 停止再平衡 |

**配置示例**:

```bash
# 启动再平衡
mc admin rebalance start myminio

# 查看再平衡状态
mc admin rebalance status myminio

# 停止再平衡
mc admin rebalance stop myminio
```

**注意事项**: 再平衡是**资源密集型操作**，建议在低负载时段执行；再平衡不会中断服务，但会增加 I/O 和网络开销；停止再平衡后已迁移的对象不会回退。

---

## 故障恢复与自愈
### Healing 机制
**概念定义**: MinIO 基于纠删码（Erasure Code）实现自动修复（Healing），当检测到数据分片损坏或磁盘故障时，自动从健康的冗余分片重建缺失数据，无需人工干预。

**核心参数**:

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `heal frequency` | 30d | 自动修复周期 |
| `heal bitrot` | on | 数据腐化检测 |
| `heal drives` | all | 修复目标磁盘范围 |

**配置示例**:

```bash
# 查看当前修复配置
mc admin config get myminio heal

# 调整修复并发度
mc admin config set myminio heal max_concurrency=4

# 设置自动修复扫描周期
mc admin config set myminio heal frequency=7d

# 重启服务使配置生效
mc admin service restart myminio
```

**注意事项**: Healing 是**后台自动过程**，无需手动触发（除非特殊场景）；修复优先级**低于读写请求**，不影响服务性能；可通过 `minio_cluster_erasure_set_healing_drives_count` 指标监控修复进度。

---

### 磁盘替换
**概念定义**: 当 MinIO 集群中某个磁盘发生硬件故障，直接替换故障磁盘后 MinIO 自动检测新磁盘并启动重建过程，从其他健康磁盘恢复数据。

**核心参数**:

| 场景 | 操作 | 说明 |
|------|------|------|
| 磁盘故障 | 替换物理磁盘 | 使用相同路径的新磁盘 |
| 自动检测 | MinIO 自动识别 | 新磁盘挂载后自动纳入 |
| 自动重建 | 后台 Healing | 无需手动触发 |

**配置示例**:

```bash
# 故障磁盘检测mc admin info myminio
# 查看输出中的 Offline Drives

# 替换磁盘后验证mc admin info myminio
# 确认新磁盘状态为 Healthy

# 监控重建进度# 通过 Prometheus 指标
minio_cluster_erasure_set_healing_drives_count

# 或通过控制台
mc admin heal --recursive --dry-run myminio
```

**注意事项**: 替换磁盘后**必须保持相同的挂载路径**；一个纠删码集中同时故障的磁盘数**不能超过冗余度**（parity），否则数据不可恢复；替换后 MinIO 自动检测新磁盘，**无需重启服务**。

---

### 手动触发修复
**概念定义**: 在特殊场景下（如扫描器发现可修复问题但未自动处理），可使用 `mc admin heal` 手动触发修复操作，支持指定范围（集群/桶/前缀）和扫描深度。

**核心参数**:

| 参数 | 说明 |
|------|------|
| `--recursive` / `-r` | 递归修复 |
| `--dry-run` / `-n` | 仅检查，不修复 |
| `--scan` | 扫描模式：`normal`（默认）或 `deep`（深度） |
| `--force-start` / `-f` | 强制启动（即使已有修复任务） |
| `--remove` | 移除悬空对象和前缀 |

**配置示例**:

```bash
# 手动修复整个集群
mc admin heal --recursive myminio

# 修复特定桶
mc admin heal --recursive myminio/mybucket

# 深度扫描修复（逐字节校验）
mc admin heal --scan deep --recursive myminio/mybucket

# 仅检查不修复
mc admin heal --recursive --dry-run myminio

# 清理悬空对象
mc admin heal --remove --recursive myminio
```

**注意事项**: `--scan deep` 模式**逐字节校验数据完整性**，适合偶发性数据损坏的排查；手动修复**消耗 I/O 和 CPU 资源**，建议在低负载时段执行；`--remove` 会删除悬空前缀，**不可逆操作**。

---

### 扫描器状态
**概念定义**: `mc admin scanner info` 展示 MinIO 内置扫描器的运行状态和统计信息，扫描器负责检查对象完整性、执行 ILM 策略、评估复制规则和触发 Healing。

**核心参数**:

| 统计类别 | 字段 | 说明 |
|----------|------|------|
| 全局统计 | `Last full scan time` | 最后一次全扫描完成时间 |
| 全局统计 | `Current cycle` | 当前扫描周期编号 |
| 全局统计 | `Active drives` | 活跃驱动器总数 |
| 每分钟统计 | `Objects Scanned` | 每分钟扫描对象数及平均耗时 |
| 每分钟统计 | `Versions Scanned` | 每分钟扫描版本数及平均耗时 |
| 每分钟统计 | `Versions Heal Checked` | 每分钟修复检查版本数 |
| 每分钟统计 | `ILM checks` | 每分钟 ILM 策略检查版本数 |
| 每分钟统计 | `Check Replication` | 每分钟复制检查版本数 |
| 每分钟统计 | `Read Metadata` | 每分钟读取元数据对象数 |
| 每分钟统计 | `Yield` | 扫描器让出 I/O 的总时长 |

**配置示例**:

```bash
# 查看扫描器状态
mc admin scanner info myminio

# 调整扫描器速度
mc admin config set myminio scanner speed=fast
mc admin service restart myminio

# 速度选项：slow / default / fast
# - slow: 最小化对读写请求的影响
# - fast: 加快扫描速度，减少磁盘空闲等待
# - default: 平衡模式（默认 10x 延迟因子）
```

**注意事项**: `Last full scan time` 为 `0d0h0m` 表示**扫描尚未完成一个完整周期**；`Yield` 时间越长表示扫描器**越频繁地为读写请求让出 I/O**；扫描器速度设置需权衡**扫描完整性和业务性能**；从 RELEASE.2025-03-27T23-09-45Z 起，扫描器会**自动清理悬空前缀**。

---

## 交叉引用链接
本文档涉及的全部 8 个关联文档及其官方链接如下：

| 文档编号 | 文档名称 | 说明 |
|----------|----------|------|
| 1 | [MinIO Client (mc) Complete Guide](https://min.io/docs/minio/linux/reference/minio-mc.html) | mc 命令行工具完整参考 |
| 2 | [MinIO Admin Client (mc admin)](https://min.io/docs/minio/linux/reference/minio-mc-admin.html) | mc admin 管理命令完整参考 |
| 3 | [Metrics and Alerts](https://min.io/docs/minio/linux/operations/monitoring/metrics-and-alerts.html) | Prometheus 指标采集完整文档 |
| 4 | [Monitor MinIO with Grafana](https://min.io/docs/minio/linux/operations/monitoring/grafana.html) | Grafana 仪表盘配置指南 |
| 5 | [Publish Server or Audit Logs to External Service](https://min.io/docs/minio/linux/operations/monitoring/minio-logging.html) | 审计日志与日志发布配置 |
| 6 | [Healthcheck API](https://min.io/docs/minio/linux/operations/monitoring/healthcheck-probe.html) | 健康检查端点完整参考 |
| 7 | [Decommission Server Pool](https://min.io/docs/minio/linux/reference/minio-mc-admin/mc-admin-decommission.html) | Server Pool 退役管理文档 |
| 8 | [Object Scanner](https://min.io/docs/minio/linux/operations/concepts/scanner.html) | 扫描器与 Healing 机制文档 |

**Grafana Dashboard 直接链接**:

- [MinIO Dashboard (ID: 13502)](https://grafana.com/grafana/dashboards/13502-minio-dashboard/)
- [MinIO Bucket Dashboard (ID: 19237)](https://grafana.com/grafana/dashboards/19237-minio-bucket-dashboard/)

**Prometheus Alert Rules 参考**:

- [Prometheus Alerting Rules](https://prometheus.io/docs/prometheus/latest/configuration/alerting_rules/)
- [MinIO Metrics and Alerts](https://min.io/docs/minio/linux/operations/monitoring/metrics-and-alerts.html)

---

> **文档结束** -- 版本基线 RELEASE.2025-04-22T22-12-26Z