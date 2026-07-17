# MinIO 部署与配置

> 知识归档 -- 面向 Java 后端开发者的 MinIO 部署与配置参考手册

---

## 部署架构概览
### 单机单盘（SNSD）
**概念定义**：Single-Node Single-Drive，在单台服务器上使用单个存储卷运行 MinIO 服务。仅适用于开发测试环境，不提供任何数据冗余或高可用保障。

**核心参数**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `MINIO_ROOT_USER` | 根用户访问密钥 | `minioadmin` |
| `MINIO_ROOT_PASSWORD` | 根用户密钥 | `minioadmin` |
| `--address` | API 监听地址 | `:9000` |
| `--console-address` | Web 控制台监听地址 | 动态随机端口 |

**配置示例**：

```bash
# 二进制部署 - 单机单盘
export MINIO_ROOT_USER=admin
export MINIO_ROOT_PASSWORD=StrongP@ssw0rd
minio server /data --console-address ":9001"
```

```bash
# Docker 部署 - 单机单盘
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v ~/minio/data:/data \
  -e "MINIO_ROOT_USER=ROOTNAME" \
  -e "MINIO_ROOT_PASSWORD=CHANGEME123" \
  quay.io/minio/minio server /data --console-address ":9001"
```

**注意事项**：**生产环境严禁使用默认凭据 `minioadmin/minioadmin`**。SNSD 模式下磁盘故障将导致数据永久丢失，不可用于生产环境。

---

### 单机多盘（SNMD）
**概念定义**：Single-Node Multi-Drive，在单台服务器上使用多个存储卷运行 MinIO 服务。该模式利用纠删码（Erasure Coding）提供数据冗余保护，单节点内可容忍最多半数磁盘故障。

**核心参数**：

| 参数 | 说明 | 要求 |
|------|------|------|
| 最小磁盘数 | 纠删码所需最少磁盘数量 | >= 4 块 |
| 数据盘 | 存储数据的磁盘数量 | 建议 4-16 块 |
| 校验盘 | 纠删码校验盘数量 | 默认占总盘数 50% |
| 故障容忍 | 可容忍的磁盘故障数 | 最多 N/2 块 |

**配置示例**：

```bash
# 二进制部署 - 单机4盘 SNMD
export MINIO_ROOT_USER=admin
export MINIO_ROOT_PASSWORD=StrongP@ssw0rd
minio server /mnt/disk{1...4} --console-address ":9001"
```

```bash
# Docker 部署 - 单机4盘 SNMD
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /mnt/disk1:/data1 \
  -v /mnt/disk2:/data2 \
  -v /mnt/disk3:/data3 \
  -v /mnt/disk4:/data4 \
  -e "MINIO_ROOT_USER=ROOTNAME" \
  -e "MINIO_ROOT_PASSWORD=CHANGEME123" \
  quay.io/minio/minio server /data{1...4} --console-address ":9001"
```

**注意事项**：**各磁盘必须挂载为独立的文件系统，且不能使用同一物理磁盘的多个分区**。建议使用 XFS 文件系统以获得最佳性能。所有磁盘容量应保持一致，MinIO 以最小磁盘容量为准计算可用空间。

---

## Docker 部署
### Docker Run 单盘部署
**概念定义**：通过 `docker run` 命令以容器方式启动单盘 MinIO 服务，是开发测试环境最常用的快速部署方式。

**核心参数**：

| 参数 | 说明 | 示例值 |
|------|------|--------|
| `-p 9000:9000` | API 端口映射 | `9000` |
| `-p 9001:9001` | 控制台端口映射 | `9001` |
| `-v` | 数据卷挂载 | `/data` |
| `-e MINIO_ROOT_USER` | 根用户 | `ROOTNAME` |
| `-e MINIO_ROOT_PASSWORD` | 根密码 | `CHANGEME123` |
| `--console-address` | 控制台监听地址 | `:9001` |

**配置示例**：

```bash
# 完整 Docker Run 命令
docker run -d \
  --name minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -v ~/minio/data:/data \
  -e "MINIO_ROOT_USER=ROOTNAME" \
  -e "MINIO_ROOT_PASSWORD=CHANGEME123" \
  quay.io/minio/minio server /data --console-address ":9001"
```

**注意事项**：**`--console-address` 参数必须显式指定，否则控制台端口为动态分配，不便访问**。API 端口 9000 用于 S3 兼容的 SDK 调用，控制台端口 9001 用于 Web UI 管理。

---

### Docker Run 多盘部署
**概念定义**：通过 `docker run` 命令挂载多个数据卷，在单容器内实现多盘部署。使用 `http://localhost:9000/mnt/drive-{1...4}` 语法声明多个数据盘。

**核心参数**：

| 参数 | 说明 | 示例值 |
|------|------|--------|
| 多盘挂载路径 | 容器内挂载路径 | `/mnt/drive-{1...4}` |
| 卷挂载数量 | 挂载的数据卷数量 | >= 4 |

**配置示例**：

```bash
# Docker Run 多盘（4盘）部署
docker run -d \
  --name minio-multi \
  -p 9000:9000 \
  -p 9001:9001 \
  -v /mnt/disk1:/mnt/drive-1 \
  -v /mnt/disk2:/mnt/drive-2 \
  -v /mnt/disk3:/mnt/drive-3 \
  -v /mnt/disk4:/mnt/drive-4 \
  -e "MINIO_ROOT_USER=ROOTNAME" \
  -e "MINIO_ROOT_PASSWORD=CHANGEME123" \
  quay.io/minio/minio server /mnt/drive-{1...4} --console-address ":9001"
```

**注意事项**：**多盘部署的最小磁盘数为 4 块**，少于 4 块时无法启用纠删码。挂载路径必须指向不同的物理磁盘或独立存储卷，不能是同一磁盘的不同目录。

---

### Docker Compose 部署
**概念定义**：使用 `docker-compose.yml` 编排 MinIO 服务，适合需要持久化配置管理和多容器协作的场景。

**核心参数**：

| 参数 | 说明 | 位置 |
|------|------|------|
| `image` | 镜像地址 | `quay.io/minio/minio` |
| `command` | 启动命令 | `server /data --console-address ":9001"` |
| `environment` | 环境变量 | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` |
| `volumes` | 数据卷 | 宿主机路径:容器路径 |
| `healthcheck` | 健康检查 | `/minio/health/live` |

**配置示例**：

```yaml
# docker-compose.yml - 单机单盘
version: "3.8"
services:
  minio:
    image: quay.io/minio/minio
    container_name: minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ROOTNAME
      MINIO_ROOT_PASSWORD: CHANGEME123
    command: server /data --console-address ":9001"
    volumes:
      - ./minio/data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped
```

```yaml
# docker-compose.yml - 单机多盘（4盘）
version: "3.8"
services:
  minio:
    image: quay.io/minio/minio
    container_name: minio
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: ROOTNAME
      MINIO_ROOT_PASSWORD: CHANGEME123
    command: server /data{1...4} --console-address ":9001"
    volumes:
      - ./minio/data1:/data1
      - ./minio/data2:/data2
      - ./minio/data3:/data3
      - ./minio/data4:/data4
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
    restart: unless-stopped
```

**注意事项**：**生产环境中应使用命名卷（named volumes）而非绑定挂载（bind mount）以提高可移植性**。`healthcheck` 配置用于 Docker 自动检测服务健康状态，配合 `restart` 策略实现自动恢复。

---

## 分布式部署
### 多节点多盘架构
**概念定义**：Multi-Node Multi-Drive（MNMD），在多个物理节点上部署 MinIO 服务，每个节点挂载多个磁盘，通过纠删码实现跨节点的高可用与数据冗余。这是 MinIO 推荐的生产环境部署模式。

**核心参数**：

| 参数 | 说明 | 要求 |
|------|------|------|
| 最小节点数 | 分布式集群所需最少节点数 | >= 4 个节点 |
| 每节点最小磁盘数 | 每个节点所需最少磁盘数 | >= 4 块 |
| 总磁盘数 | 集群总磁盘数 | >= 16 块 |
| 故障域容忍 | 可容忍的节点故障数 | 最多 N/2 个节点 |
| 节点间通信协议 | 节点间数据同步协议 | HTTP/HTTPS |

**配置示例**：

```bash
# 4节点4盘分布式集群 - 每节点执行相同命令
export MINIO_ROOT_USER=admin
export MINIO_ROOT_PASSWORD=StrongP@ssw0rd

minio server \
  http://minio-node-{1...4}/data{1...4} \
  --console-address ":9001"
```

**注意事项**：**分布式部署要求所有节点时间同步（NTP），时间偏差过大将导致请求失败**。所有节点必须使用相同的 `MINIO_ROOT_USER` 和 `MINIO_ROOT_PASSWORD`。分布式集群扩容时，新增节点数量必须与现有集群节点数保持一致（即扩容需对称扩展）。

---

### 分布式启动命令格式
**概念定义**：分布式部署的 `minio server` 命令通过 `http://host/data` 格式声明各节点的存储位置，MinIO 使用 `{a...b}` 花括号展开语法批量声明节点和磁盘。

**核心参数**：

| 参数 | 说明 | 格式 |
|------|------|------|
| 节点展开 | 批量声明节点主机名 | `http://host-{1...N}` |
| 磁盘展开 | 批量声明磁盘路径 | `/data{1...N}` |
| 必须为 HTTP/HTTPS | 即使本地磁盘也需 URL 格式 | `http://` 或 `https://` |

**配置示例**：

```bash
# 4节点4盘 - 花括号展开
minio server http://minio-{1...4}/data{1...4}

# 等价于显式声明
minio server \
  http://minio-1/data1 http://minio-1/data2 http://minio-1/data3 http://minio-1/data4 \
  http://minio-2/data1 http://minio-2/data2 http://minio-2/data3 http://minio-2/data4 \
  http://minio-3/data1 http://minio-3/data2 http://minio-3/data3 http://minio-3/data4 \
  http://minio-4/data1 http://minio-4/data2 http://minio-4/data3 http://minio-4/data4
```

```bash
# 使用 IP 地址
minio server http://192.168.1.{10...13}/data{1...4}
```

**注意事项**：**花括号展开中的数字范围必须连续且在所有节点上保持一致**。分布式模式下，每个节点上的 `data` 路径必须指向独立的物理磁盘或挂载点，不能是同一磁盘的子目录。

---

## Kubernetes 部署
### MinIO Operator 安装
**概念定义**：MinIO Operator 是 Kubernetes 原生的控制器，通过 CRD（Custom Resource Definition）扩展 Kubernetes API，实现 MinIO 集群的声明式部署、扩缩容和运维管理。

**核心参数**：

| 参数 | 说明 | 默认值 |
|------|------|--------|
| 命名空间 | Operator 部署命名空间 | `minio-operator` |
| 副本数 | Operator Pod 副本数 | 2 |
| STS 服务端口 | STS 服务端口 | 4223 |
| Operator 服务端口 | Operator 服务端口 | 4221 |

**配置示例**：

```bash
# Helm 方式安装 Operator
helm repo add minio-operator https://operator.minio.org.cn
helm repo update

helm install \
  --namespace minio-operator \
  --create-namespace \
  operator minio-operator/operator

# 验证安装
kubectl get all -n minio-operator
```

```bash
# 本地 Helm Chart 安装
curl -O https://raw.githubusercontent.com/minio/operator/master/helm-releases/operator-7.1.1.tgz
helm install \
  --namespace minio-operator \
  --create-namespace \
  minio-operator ./operator-7.1.1.tgz
```

**注意事项**：**如果使用 Helm 安装 Operator，则必须使用 Helm 管理该安装的完整生命周期，不可混用 `kubectl` 或 Kustomize 进行管理**。Operator 部署后将在集群中创建 `minio-operator` 命名空间，并启动两个服务：`operator`（端口 4221）和 `sts`（端口 4223）。

---

### Operator 环境变量配置
**概念定义**：通过 `kubectl set env` 命令动态修改 MinIO Operator Deployment 的环境变量，用于控制 Operator 行为和 TLS 证书管理等功能。

**核心参数**：

| 环境变量 | 说明 | 值 |
|------|------|------|
| `OPERATOR_STS_AUTO_TLS_ENABLED` | 启用 STS 自动 TLS | `on` / `off` |

**配置示例**：

```bash
# 启用 Operator STS 自动 TLS
kubectl set env -n minio-operator deployment/minio-operator \
  OPERATOR_STS_AUTO_TLS_ENABLED=on
```

**注意事项**：**修改环境变量后，Operator Deployment 将自动滚动更新 Pod**。`OPERATOR_STS_AUTO_TLS_ENABLED` 启用后，Operator 会自动为 STS 服务生成和管理 TLS 证书。

---

### Tenant 创建与管理
**概念定义**：Tenant（租户）是 MinIO Operator 中的核心 CRD 资源，代表一个独立的 MinIO 集群实例。每个 Tenant 拥有独立的存储、配置和访问控制。

**核心参数**：

| 参数 | 说明 | 示例值 |
|------|------|------|
| `name` | Tenant 名称 | `my-minio-tenant` |
| `namespace` | Tenant 命名空间 | `minio-tenant` |
| `pools[].servers` | 每个池的节点数 | 4 |
| `pools[].volumesPerServer` | 每节点磁盘数 | 4 |
| `pools[].volumeClaimTemplate` | PVC 模板定义 | 存储类 + 容量 |

**配置示例**：

```yaml
# tenant.yaml - MinIO Tenant 声明
apiVersion: minio.min.io/v2
kind: Tenant
metadata:
  name: my-minio-tenant
  namespace: minio-tenant
spec:
  image: quay.io/minio/minio:latest
  pools:
    - servers: 4
      volumesPerServer: 4
      volumeClaimTemplate:
        metadata:
          name: data
        spec:
          accessModes:
            - ReadWriteOnce
          resources:
            requests:
              storage: 100Gi
  users:
    - name: console-user
  features:
    enableSFTP: false
```

```bash
# 创建 Tenant
kubectl apply -f tenant.yaml

# 检查 Tenant 状态
kubectl get tenants -n minio-tenant
kubectl describe tenant my-minio-tenant -n minio-tenant
```

**注意事项**：**Tenant 创建后，节点数（servers）不可缩减，只能增加**。PVC 模板中定义的存储大小不可修改，扩容需通过添加新 Pool 实现。Operator 会自动为 Tenant 创建 Service、StatefulSet 和 TLS 证书等资源。

---

## TLS 证书配置
### 自动 TLS（Operator STS Auto TLS）
**概念定义**：MinIO Operator 内置的自动 TLS 证书管理功能，通过 Kubernetes `certificates.k8s.io` API 自动生成 CSR（Certificate Signing Request）并签发 TLS 证书，用于 MinIO 集群内部和 STS 服务的加密通信。

**核心参数**：

| 参数 | 说明 | 默认值 |
|------|------|------|
| `OPERATOR_STS_AUTO_TLS_ENABLED` | 启用 STS 自动 TLS | `off` |
| CSR 签名方 | 证书签名请求的签发方 | Kubernetes CA |

**配置示例**：

```bash
# 启用 Operator STS 自动 TLS
kubectl set env -n minio-operator deployment/minio-operator \
  OPERATOR_STS_AUTO_TLS_ENABLED=on
```

**注意事项**：**启用自动 TLS 后，Operator 会自动为每个 Tenant 生成 TLS 证书**。证书由 Kubernetes 集群 CA 签发，仅在集群内受信任。如需外部访问，需配合 cert-manager 或手动证书。

---

### cert-manager 集成
**概念定义**：将 MinIO Operator 与 cert-manager 集成，利用 cert-manager 自动管理 TLS 证书的签发与续期，支持 Let's Encrypt 等外部 CA。

**核心参数**：

| 参数 | 说明 | 要求 |
|------|------|------|
| cert-manager 版本 | 所需 cert-manager 最低版本 | >= 1.7.x |
| Kubernetes 版本 | 所需 Kubernetes 最低版本 | >= 1.21 |
| Operator 版本 | 推荐 Operator 最低版本 | >= 5.0.10 |

**配置示例**：

```yaml
# cert-manager 使用示例 - 在 Tenant 中引用 cert-manager 证书
apiVersion: minio.min.io/v2
kind: Tenant
metadata:
  name: minio-tenant-tls
spec:
  requestAutoCert: false
  certConfig:
    commonName: minio.example.com
    organizationName: ["MyOrg"]
    dnsNames:
      - minio.example.com
      - "*.minio.example.com"
  externalCertSecret:
    - name: minio-tls-cert
      type: cert-manager.io/v1
```

```bash
# 创建 cert-manager Certificate 资源
cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: minio-tls-cert
  namespace: minio-tenant
spec:
  secretName: minio-tls-cert
  dnsNames:
    - minio.example.com
    - "*.minio.example.com"
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
EOF
```

**注意事项**：**cert-manager 集成要求 Operator 版本 >= 5.0.10 以获得最佳 `tls` 和 `cert-manager` Secret 类型支持**。Secret 类型支持 `opaque`（使用 `private.key`/`public.crt`）、`tls`（使用 `tls.key`/`tls.crt`）和 `cert-manager.io/v1`。

---

### 手动证书配置
**概念定义**：手动生成 TLS 证书并配置到 MinIO 服务器，适用于非 Kubernetes 环境或需要自定义证书的场景。

**核心参数**：

| 参数 | 说明 | 路径 |
|------|------|------|
| 默认证书目录 | 默认证书搜索路径 | `${HOME}/.minio/certs` |
| 自定义证书目录 | 通过 `--certs-dir` 指定 | 自定义路径 |
| 私钥文件 | TLS 私钥 | `private.key` |
| 公钥文件 | TLS 公钥证书 | `public.crt` |
| CA 目录 | 第三方 CA 证书存放 | `{certs}/CAs/` |

**配置示例**：

```bash
# 创建证书目录
mkdir -p ${HOME}/.minio/certs

# 使用 certgen 工具生成自签名证书
certgen -host "localhost,minio.example.com,192.168.1.100"

# 放置证书文件
cp public.crt ${HOME}/.minio/certs/
cp private.key ${HOME}/.minio/certs/

# 启动 MinIO 并指定证书目录
minio server --certs-dir ${HOME}/.minio/certs /data --console-address ":9001"
```

```bash
# 多域证书配置 - 每个域一个子目录
${HOME}/.minio/certs/
  private.key          # 默认域证书
  public.crt
  s3.example.com/
    private.key
    public.crt
  console.example.com/
    private.key
    public.crt
```

**注意事项**：**证书文件必须对运行 MinIO 进程的用户可读**。启用 TLS 后，需将 `MINIO_VOLUMES` 中的 `http` 更新为 `https`。MinIO 使用 SNI（Server Name Indication）自动匹配客户端请求的主机名与对应证书。**推荐使用 ECDSA 或 EdDSA 算法生成密钥，计算开销低于 RSA**。

---

## Nginx 反向代理
### Nginx 反向代理配置
**概念定义**：通过 Nginx 作为 MinIO 集群的前置反向代理，统一对外暴露 API 和控制台端口，同时提供 TLS 终止、负载均衡和请求路由功能。

**核心参数**：

| 参数 | 说明 | 典型值 |
|------|------|--------|
| `proxy_pass` | 代理目标地址 | `http://minio_cluster` |
| `proxy_set_header Host` | 传递原始 Host 头 | `$http_host` |
| `proxy_buffering` | 代理缓冲 | `off` |
| `client_max_body_size` | 客户端请求体最大大小 | 根据需求设置 |
| `proxy_connect_timeout` | 代理连接超时 | `300s` |

**配置示例**：

```nginx
# nginx.conf - MinIO S3 API 反向代理
upstream minio_api {
    least_conn;
    server minio-1:9000;
    server minio-2:9000;
    server minio-3:9000;
    server minio-4:9000;
}

upstream minio_console {
    least_conn;
    server minio-1:9001;
    server minio-2:9001;
    server minio-3:9001;
    server minio-4:9001;
}

server {
    listen 443 ssl http2;
    server_name minio-api.example.com;

    ssl_certificate     /etc/nginx/certs/public.crt;
    ssl_certificate_key /etc/nginx/certs/private.key;

    # 允许大文件上传
    client_max_body_size 0;
    proxy_buffering off;

    location / {
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_pass http://minio_api;
    }
}

server {
    listen 443 ssl http2;
    server_name minio-console.example.com;

    ssl_certificate     /etc/nginx/certs/public.crt;
    ssl_certificate_key /etc/nginx/certs/private.key;

    client_max_body_size 0;
    proxy_buffering off;

    location / {
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-NginX-Proxy true;
        proxy_pass http://minio_console;

        # WebSocket 支持（控制台需要）
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**注意事项**：**MinIO 控制台需要 WebSocket 支持，Nginx 配置中必须包含 `proxy_http_version 1.1` 和 `Upgrade`/`Connection` 头**。`proxy_buffering off` 是必需的，否则可能导致大文件上传失败。签名验证相关的请求头（`Host`、`X-Forwarded-*`）必须正确传递，否则会导致 S3 签名验证错误（HTTP 400/403）。

---

### 负载均衡策略
**概念定义**：Nginx 的 upstream 模块提供多种负载均衡算法，用于在多个 MinIO 节点间分发 API 请求。

**核心参数**：

| 策略 | 说明 | 适用场景 |
|------|------|----------|
| `least_conn` | 最小连接数 | 推荐，适合长连接场景 |
| `round_robin` | 轮询（默认） | 常规场景 |
| `ip_hash` | IP 哈希 | 需要会话保持 |
| `weight` | 权重分配 | 节点性能不均 |

**配置示例**：

```nginx
# 最小连接数策略（推荐）
upstream minio_api {
    least_conn;
    server minio-1:9000;
    server minio-2:9000;
    server minio-3:9000;
    server minio-4:9000;
}

# 带权重的负载均衡
upstream minio_api {
    server minio-1:9000 weight=3;
    server minio-2:9000 weight=2;
    server minio-3:9000 weight=1;
}
```

**注意事项**：**MinIO 推荐使用 `least_conn` 策略，因为对象存储操作涉及大量数据传输，连接持续时间差异较大**。不建议使用 `ip_hash` 策略，因为 S3 API 是无状态的。

---

## 环境变量参考
### 根凭据
**概念定义**：控制 MinIO 超级用户（root）访问权限的核心环境变量，必须在 MinIO 服务启动前设置。

**核心参数**：

| 环境变量 | 说明 | 默认值 | 是否必须 |
|------|------|------|------|
| `MINIO_ROOT_USER` | 根用户访问密钥 | `minioadmin` | 生产必须修改 |
| `MINIO_ROOT_PASSWORD` | 根用户密钥 | `minioadmin` | 生产必须修改 |
| `MINIO_API_ROOT_ACCESS` | 启用/禁用根用户 API 访问 | `on` | 可选 |

**配置示例**：

```bash
# 设置根凭据
export MINIO_ROOT_USER=myAdminUser
export MINIO_ROOT_PASSWORD=Strong_Random_P@ssw0rd!

# 禁用根用户 API 访问（确保已有其他管理员用户）
export MINIO_API_ROOT_ACCESS=off
```

**注意事项**：**生产环境必须修改默认凭据，MinIO 强烈建议使用独特、较长且随机的值**。`MINIO_ROOT_USER` 和 `MINIO_ROOT_PASSWORD` 仅支持环境变量设置，无对应的配置项。禁用根用户 API 访问前，必须先创建至少一个具有 `consoleAdmin` 策略的替代管理员用户。

---

### 服务器 URL 与控制台
**概念定义**：控制 MinIO 对外暴露的服务器地址和控制台重定向 URL 的环境变量，在 Nginx 反向代理或负载均衡场景下尤为重要。

**核心参数**：

| 环境变量 | 说明 | 示例 |
|------|------|------|
| `MINIO_SERVER_URL` | S3 API 服务器的外部可访问 URL | `https://minio-api.example.com` |
| `MINIO_BROWSER_REDIRECT_URL` | Web 控制台的外部重定向 URL | `https://minio-console.example.com` |
| `MINIO_DOMAIN` | 用于 DNS 风格 Bucket 访问的域名 | `minio.example.com` |
| `MINIO_REGION` | 服务器区域标识 | `us-east-1` |

**配置示例**：

```bash
# Docker Compose 环境变量
environment:
  MINIO_SERVER_URL: "https://minio-api.example.com"
  MINIO_BROWSER_REDIRECT_URL: "https://minio-console.example.com"
  MINIO_DOMAIN: "minio.example.com"
  MINIO_REGION: "cn-north-1"
```

```yaml
# Kubernetes Deployment 环境变量
env:
  - name: MINIO_SERVER_URL
    value: "https://minio-api.example.com"
  - name: MINIO_BROWSER_REDIRECT_URL
    value: "https://minio-console.example.com"
  - name: MINIO_DOMAIN
    value: "minio.example.com"
  - name: MINIO_REGION
    value: "cn-north-1"
```

**注意事项**：**在 Nginx 反向代理场景下，`MINIO_SERVER_URL` 必须设置为 Nginx 对外的 HTTPS 地址，否则预签名 URL 中的主机名可能不正确**。`MINIO_DOMAIN` 用于支持 DNS 风格的 Bucket 访问（如 `bucket.minio.example.com`），需配合泛域名 DNS 解析。

---

### 其他常用环境变量
**概念定义**：除根凭据和 URL 配置外，MinIO 还提供一系列用于控制日志、存储、网络等行为的可选环境变量。

**核心参数**：

| 环境变量 | 说明 | 示例值 |
|------|------|------|
| `MINIO_VOLUMES` | 存储卷路径（替代命令行参数） | `http://minio-{1...4}/data{1...4}` |
| `MINIO_LOG_QUERY_URL` | 允许将日志查询发送到指定 URL | `http://logservice:8080` |
| `MINIO_IDENTITY_OPENID_CONFIG_URL` | OpenID Connect 配置 URL | `https://idp.example.com/.well-known/openid-configuration` |
| `MINIO_KMS_KES_KEY_NAME` | KES 加密密钥名称 | `minio-encryption-key` |
| `MINIO_PROMETHEUS_AUTH_TYPE` | Prometheus 认证类型 | `public` / `jwt` |
| `MINIO_API_REQUESTS_MAX` | 最大并发 API 请求数 | `1600` |

**配置示例**：

```bash
# 综合配置示例
export MINIO_VOLUMES="http://minio-{1...4}/data{1...4}"
export MINIO_LOG_QUERY_URL="http://log-collector:8080"
export MINIO_IDENTITY_OPENID_CONFIG_URL="https://keycloak.example.com/realms/minio/.well-known/openid-configuration"
export MINIO_PROMETHEUS_AUTH_TYPE="public"
export MINIO_API_REQUESTS_MAX=1600
```

**注意事项**：**环境变量的优先级高于配置文件中的同名配置项**。如果同时定义了环境变量和配置项，MinIO 使用环境变量的值。部分设置仅支持环境变量方式（如 `MINIO_ROOT_USER`），不支持配置项方式。

---

## 交叉引用
- [MinIO核心概念](./MinIO核心概念.md)
- [MinIO-Bucket操作](./MinIO-Bucket操作.md)
- [MinIO-Object操作](./MinIO-Object操作.md)
- [MinIO权限与安全](./MinIO权限与安全.md)
- [MinIO数据管理](./MinIO数据管理.md)
- [MinIO-Java-SDK](./MinIO-Java-SDK.md)
- [MinIO运维监控](./MinIO运维监控.md)
- [MinIO-Spring-Boot集成](./MinIO-Spring-Boot集成.md)

---

> 参考来源：MinIO 官方文档 (https://minio.org.cn/docs/)