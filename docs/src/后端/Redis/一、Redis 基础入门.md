
## 1.1 Redis 概述

Redis 诞生于2009年，全称是 **R**emote **D**ictionary **S**erver（远程词典服务器），是一个基于内存的键值型 NoSQL 数据库。

**特征**：
- 键值（key-value）型，value 支持多种不同数据结构，功能丰富
- 单线程，每个命令具备原子性
- 低延迟、速度快（基于内存、IO多路复用、良好的编码）
- 支持数据持久化
- 支持主从集群、分片集群
- 支持多语言客户端

**作者**：Antirez  
**官网**：https://redis.io/

### 1.1.1 NoSQL 认知

**NoSQL** 可以翻译为 Not Only SQL（不仅仅是SQL），或者是 No SQL（非SQL的）数据库，是相对于传统关系型数据库而言的，有很大差异的一种特殊的数据库，因此也称之为**非关系型数据库**。

| **对比维度** | **关系型数据库** | **非关系型数据库** |
|---|---|---|
| 数据结构 | 结构化（行列规范） | 非结构化（键值、文档、图等） |
| 数据关联 | 通过外键关联 | 无关联，靠代码或数据耦合 |
| 查询方式 | 基于SQL，语法有统一标准 | 查询语法差异极大 |
| 事务特性 | 满足 ACID 原则 | 不保证 ACID，只保证基本一致性 |
| 存储方式 | 主要基于磁盘，有大量磁盘IO | 主要基于内存，性能更高 |
| 扩展性 | 集群模式一般为主从（垂直扩展） | 数据分片存储（水平扩展），支持海量数据 |

**存储方式说明**：
- 关系型数据库基于磁盘存储，会有大量磁盘IO，对性能有一定影响
- 非关系型数据库操作更多依赖内存，内存读写速度非常快

**扩展性说明**：
- 关系型数据库：集群模式一般是主从，主从数据一致，起到数据备份作用，称为**垂直扩展**
- 非关系型数据库：可以将数据拆分，存储在不同机器上，解决内存大小限制问题，称为**水平扩展**
- 关系型数据库因表之间存在关联，做水平扩展会给数据查询带来很多麻烦

---

## 1.2 Redis 安装与配置

> 大多数企业基于 Linux 服务器部署项目，Redis 官方也不提供 Windows 版本安装包，以下以 CentOS 7 为例。

### 1.2.1 安装依赖库

Redis 是基于 C 语言编写的，因此首先需要安装 Redis 所需要的 gcc 依赖：

```bash
yum install -y gcc tcl
```

### 1.2.2 上传、解压与编译

将 Redis 安装包（如 redis-6.2.6.tar.gz）上传到虚拟机，例如放到 `/usr/local/src` 目录：

```bash
# 解压缩
tar -xzf redis-6.2.6.tar.gz

# 进入 redis 目录
cd redis-6.2.6

# 编译并安装
make && make install
```

> **说明**：`make install` 将编译好的可执行程序复制到系统默认的 `/usr/local/bin` 目录，该目录已配置到环境变量，因此在任意目录下都可以运行 redis 相关命令。
>
> 默认安装路径下的主要可执行文件：
> - `redis-cli`：Redis 命令行客户端
> - `redis-server`：Redis 服务端启动脚本
> - `redis-sentinel`：Redis 哨兵启动脚本

### 1.2.3 Redis 启动方式

Redis 有以下三种启动方式：

**方式一：默认启动（前台启动，不推荐）**

```bash
redis-server
```

> 该方式属于前台启动，会阻塞整个会话窗口，窗口关闭或按 `CTRL + C` 则 Redis 停止，**不推荐使用**。

**方式二：指定配置文件后台启动（推荐）**

Redis 的配置文件在安装包根目录下，文件名为 `redis.conf`。建议先备份原配置文件：

```bash
# 备份配置文件
cp redis.conf redis.conf.bck
```

修改 `redis.conf` 中的关键配置：

```properties
# 允许访问的地址，默认是 127.0.0.1，会导致只能在本地访问
# 修改为 0.0.0.0 则可以在任意 IP 访问，生产环境不要设置为 0.0.0.0
bind 0.0.0.0

# 守护进程，修改为 yes 后即可后台运行
daemonize yes

# 密码，设置后访问 Redis 必须输入密码
requirepass 123321

# 监听的端口（默认 6379）
port 6379

# 工作目录，默认是当前目录，日志、持久化等文件会保存在这个目录
dir .

# 数据库数量，设置为 1 代表只使用 1 个库，默认有 16 个库，编号 0~15
databases 1

# 设置 redis 能够使用的最大内存
maxmemory 512mb

# 日志文件，默认为空，不记录日志，可以指定日志文件名
logfile "redis.log"
```

启动 Redis：

```bash
# 进入 redis 安装目录
cd /usr/local/src/redis-6.2.6

# 使用指定配置文件启动
redis-server redis.conf
```

停止 Redis 服务：

```bash
# 通过 redis-cli 执行 shutdown 命令
redis-cli -u 123321 shutdown
```

**方式三：配置开机自启（生产推荐）**

新建系统服务文件：

```bash
vi /etc/systemd/system/redis.service
```

文件内容如下：

```ini
[Unit]
Description=redis-server
After=network.target

[Service]
Type=forking
ExecStart=/usr/local/bin/redis-server /usr/local/src/redis-6.2.6/redis.conf
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

重载 systemd 配置，并操作 redis 服务：

```bash
# 重载系统服务
systemctl daemon-reload

# 启动
systemctl start redis

# 停止
systemctl stop redis

# 重启
systemctl restart redis

# 查看状态
systemctl status redis

# 设置开机自启
systemctl enable redis
```

---

## 1.3 Redis 客户端

Redis 安装完成后，可以通过以下几种客户端操作 Redis：

### 1.3.1 redis-cli（命令行客户端）

redis-cli 的基本用法：

```bash
redis-cli [options] [commands]
```

常用 options：
- `-h 127.0.0.1`：指定要连接的 redis 节点的 IP 地址，默认是 127.0.0.1
- `-p 6379`：指定要连接的 redis 节点的端口，默认是 6379
- `-a 123321`：指定 redis 的访问密码
- 不指定 command 时，进入 redis-cli 的交互控制台

```bash
# 选择 0 号数据库
select 0

# 心跳测试，服务端正常会返回 pong
ping
```

### 1.3.2 Redis 桌面客户端（图形化）

推荐使用 Redis Desktop Manager（RDM）或 Another Redis DeskTop：
- GitHub 开源地址：https://github.com/uglide/RedisDesktopManager（源码，无安装包）
- Windows 安装包地址：https://github.com/lework/RedisDesktopManager-Windows/releases

安装后建立连接的步骤：
1. 点击左上角「连接到 Redis 服务器」
2. 填写 Redis 服务 IP、端口、密码
3. 点击确定，在左侧菜单会出现该连接
4. 点击连接即可查看数据

> **提示**：Redis 默认有 16 个仓库，编号从 0~15，通过配置文件可以设置仓库数量（不超过16）。在 redis-cli 中通过 `select <编号>` 来切换数据库。

### 1.3.3 Redis 的 key 结构规范

Redis 没有类似 MySQL 中 Table 的概念，如果不同业务的 key 重名会产生冲突。

**推荐用法**：Redis 的 key 允许有多个单词形成层级结构，多个单词之间用 `:` 隔开，格式如下：

```
项目名:业务名:类型:id
```

例如项目名叫 `heima`，有 user 和 product 两种数据：
- user 相关 key：**`heima:user:1`**
- product 相关 key：**`heima:product:1`**

如果 value 是 Java 对象，可以将对象序列化为 JSON 字符串后存储：

| KEY | VALUE |
|---|---|
| `heima:user:1` | `{"id":1, "name":"Jack", "age":21}` |
| `heima:product:1` | `{"id":1, "name":"小米11", "price":4999}` |

> **优势**：在 Redis 桌面客户端中，会以相同前缀作为层级结构显示，让数据看起来层次分明，关系清晰，便于管理。

---

