# MinIO基本概念

## 概述

### MinIO对象存储

MinlO 是基于 Apache License v2.0 开源协议 的的对象存储服务，可以做为云存储的解决方案，保存海量的图片，视频文档。

并且兼容 Amazon S3 API

MinIO 的官方提供的中文文档：[MinIO官方文档](http://docs.minio.org.cn/docs/)

### MinIO架构分层

MinIO 采用 Server Pools → Erasure Sets → Drives 的三级分层架构：

```plain
Server Pools（服务器池）
    └── Erasure Sets（纠删码集）
            └── Drives（驱动器）
```

* Server Pools（服务器池）：负责水平扩展，每个池是一组独立节点，拥有自己的计算、网络和存储资源。
* Erasure Sets（纠删码集）：数据冗余的基本单位，一组驱动器中最多可容忍一半驱动器故障而不丢数据。
* Drives（驱动器）：物理存储介质。

这种架构使 MinIO 能够在不牺牲一致性的前提下实现横向扩展。

### MinIO支持的拓扑类型

1. 单节点单驱动器，一个 MinIO 服务器，带有一个驱动器或文件夹用于存储数据
2. 单节点多驱动器，一个 MinIO 服务器，带有多个挂载的驱动器或文件夹用于存储数据
3. 多节点多驱动器，多个 MinIO 服务器，带有多个挂载的驱动器或卷用于存储数据

### docker安装

最后一个有web控制台的免费版本：minio/minio RELEASE.2025-04-22T22-12-26Z

创建一个环境变量文件minio：示例`/etc/default/minio`

```properties
# MINIO_ROOT_USER and MINIO_ROOT_PASSWORD sets the root account for the MinIO server.
# This user has unrestricted permissions to perform S3 and administrative API operations on any resource in the deployment.
# Omit to use the default values 'minioadmin:minioadmin'.
# MinIO recommends setting non-default values as a best practice, regardless of environment

MINIO_ROOT_USER=myminioadmin
MINIO_ROOT_PASSWORD=minio-secret-key-change-me

# MINIO_VOLUMES sets the storage volume or path to use for the MinIO server.

MINIO_VOLUMES="/mnt/data"

# MINIO_OPTS sets any additional commandline options to pass to the MinIO server.
# For example, `--console-address :9001` sets the MinIO Console listen port
MINIO_OPTS="--console-address :9001"
```

docker命令：

```powershell
docker run -dt                                  \
  -p 9000:9000                                  \
  -p 9001:9001                                  \
  -v PATH:/mnt/data                             \
  -v /etc/default/minio:/etc/config.env         \
  -e "MINIO_CONFIG_ENV_FILE=/etc/config.env"    \
  --name "minio_local"                          \
  minio/minio:RELEASE.2025-04-22T22-12-26Z      \
  server --console-address ":9001"
```

web控制台：`http://localhost:9001/`

## 基本概念

### Bucket(桶)

用于逻辑分组和隔离对象的容器。不同存储桶之间的数据是相互隔离的。

### Path / Prefix(路径)

通过在对象名称中使用类似 folder/subfolder/ 的字符串来模拟目录结构，方便组织和管理对象。

但它在本质上并不是真正的目录层级。

### Object(对象)

MinIO 中数据存储的基本单元，即你存入的文件本身。
