# Docker安装配置与实战操作

## Docker环境搭建

在开始使用Docker之前，需要根据操作系统选择合适的安装方式。Docker提供了跨平台支持，可以在Windows、macOS和各类Linux发行版上运行。

### Windows系统安装

Windows环境下推荐使用Docker Desktop，它提供了图形化管理界面和完整的容器运行环境。

#### 系统要求

- Windows 10 64位专业版/企业版/教育版
- 开启Hyper-V虚拟化功能
- 或使用WSL 2（Windows子系统Linux版本2）

#### 安装步骤

访问Docker官网下载Docker Desktop for Windows安装包。安装前需要启用Hyper-V：

1. 打开控制面板 → 程序 → 启用或关闭Windows功能
2. 勾选"Hyper-V"和"容器"选项
3. 重启计算机使配置生效
4. 运行Docker Desktop安装程序
5. 启动Docker Desktop，等待引擎初始化完成

验证安装：

```bash
# 查看Docker版本
docker version

# 运行测试容器
docker run hello-world
```

### macOS系统安装

macOS用户同样使用Docker Desktop，安装过程更为简洁。

#### 使用Homebrew安装（推荐）

```bash
# 通过Homebrew Cask安装
brew install --cask docker

# 启动Docker应用程序
open /Applications/Docker.app
```

#### 手动安装

1. 从Docker官网下载Docker Desktop for Mac的dmg文件
2. 双击dmg文件，将Docker拖入Applications文件夹
3. 从应用程序启动Docker
4. 首次启动需要输入系统密码授权

验证安装：

```bash
# 检查Docker状态
docker info

# 查看系统信息
docker system info
```

### Linux系统安装

Linux环境下推荐使用官方脚本进行安装，以CentOS/RHEL为例：

#### 使用官方脚本快速安装

```bash
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker
sudo systemctl enable docker
```

#### Ubuntu/Debian手动安装

```bash
# 更新包索引
sudo apt-get update

# 安装依赖
sudo apt-get install ca-certificates curl gnupg lsb-release

# 添加Docker官方GPG密钥
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 添加Docker仓库
sudo apt-get update

# 安装Docker
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin
```

#### 配置非root用户权限

```bash
# 将当前用户添加到docker组
sudo usermod -aG docker $USER

# 重新登录使权限生效
newgrp docker

# 验证权限
docker ps
```

## 配置镜像加速器

由于Docker Hub服务器位于海外，国内访问速度较慢。配置镜像加速器可以显著提升镜像拉取速度。

### 阿里云镜像加速器配置

1. 登录阿里云容器镜像服务控制台
2. 左侧菜单选择"镜像加速器"
3. 复制专属加速器地址

**Linux系统配置：**

```bash
sudo mkdir -p /etc/docker
sudo tee /etc/docker/daemon.json <<-'EOF'
{
  "registry-mirrors": ["https://your-id.mirror.aliyuncs.com"]
}
EOF
sudo systemctl daemon-reload
sudo systemctl restart docker
```

**Windows/macOS配置：**

在Docker Desktop设置中找到"Docker Engine"，编辑JSON配置添加镜像地址。

![镜像加速器配置流程图](dockerImgs\docker_p2_00.svg)

## 镜像管理实战

Docker镜像是容器运行的基础，掌握镜像的查询、拉取、构建和管理操作至关重要。

### 搜索和拉取镜像

#### 搜索镜像

可以通过Docker Hub网站或命令行搜索所需镜像：

```bash
docker search nginx
```

搜索结果说明：

- **NAME**：镜像名称
- **DESCRIPTION**：镜像描述
- **STARS**：收藏数量
- **OFFICIAL**：是否为官方镜像
- **AUTOMATED**：是否为自动构建

#### 拉取镜像

```bash
docker pull nginx:latest
docker pull nginx:1.21
```

### 查看和管理本地镜像

#### 列出镜像

```bash
docker images
# 或
docker image ls
```

#### 镜像详细信息

```bash
docker inspect nginx:latest
```

#### 镜像标签管理

镜像标签（Tag）用于区分同一镜像的不同版本：

```bash
# 给镜像打标签
docker tag nginx:latest myregistry/nginx:v1.0

# 删除标签
docker rmi myregistry/nginx:v1.0
```

#### 删除镜像

```bash
# 删除单个镜像
docker rmi nginx:latest

# 强制删除
docker rmi -f nginx:latest

# 删除所有未使用的镜像
docker image prune -a
```

删除技巧：

```bash
# 删除悬空镜像（无标签的镜像）
docker image prune

# 删除所有未使用的镜像
# 注意：这会删除所有未被容器引用的镜像
docker image prune -a
```

### 保存和加载镜像

当需要在没有网络的环境部署或备份镜像时，可以将镜像导出为文件：

#### 导出镜像

```bash
# 导出单个镜像
docker save -o nginx.tar nginx:latest

# 导出多个镜像
docker save -o images.tar nginx:latest redis:latest
```

#### 加载镜像

```bash
docker load -i nginx.tar
```

![镜像管理操作流程图](dockerImgs\docker_p2_01.svg)

## 容器运行与管理

容器是Docker的核心，理解容器的生命周期管理是掌握Docker的关键。

### 创建和启动容器

#### 基础运行命令

```bash
# 前台运行
docker run nginx

# 后台运行（守护模式）
docker run -d nginx

# 指定容器名称
docker run -d --name my-nginx nginx

# 端口映射
docker run -d -p 8080:80 nginx

# 端口映射（指定IP）
docker run -d -p 127.0.0.1:8080:80 nginx
```

#### 环境变量配置

```bash
docker run -d \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=mydb \
  mysql:8.0

# 从文件加载环境变量
docker run -d --env-file env.list mysql:8.0
```

env.list文件示例：

```
MYSQL_ROOT_PASSWORD=secret
MYSQL_DATABASE=mydb
MYSQL_USER=appuser
MYSQL_PASSWORD=apppass
```

### 容器生命周期管理

#### 查看容器状态

```bash
# 查看运行中的容器
docker ps

# 查看所有容器（包括已停止的）
docker ps -a

# 查看容器资源使用
docker stats
```

#### 容器控制命令

```bash
# 启动已停止的容器
docker start <container>

# 停止容器
docker stop <container>

# 强制停止容器
docker kill <container>

# 重启容器
docker restart <container>

# 暂停容器
docker pause <container>

# 恢复容器
docker unpause <container>
```

#### 删除容器

```bash
# 删除已停止的容器
docker rm <container>

# 强制删除运行中的容器
docker rm -f <container>

# 删除所有已停止的容器
docker container prune
```

### 容器交互操作

#### 查看容器日志

```bash
# 查看日志
docker logs <container>

# 实时跟踪日志
docker logs -f <container>

# 查看最近100行日志
docker logs --tail 100 <container>

# 查看带时间戳的日志
docker logs -t <container>
```

#### 进入容器内部

```bash
# 使用bash进入容器
docker exec -it <container> /bin/bash

# 使用sh进入（Alpine镜像）
docker exec -it <container> /bin/sh

# 在容器内执行单次命令
docker exec <container> ls -la
```

容器内常用操作：

```bash
# 安装工具（Debian/Ubuntu）
apt-get update && apt-get install -y vim curl

# 安装工具（Alpine）
apk add --no-cache vim curl
```

#### 文件拷贝

```bash
# 从容器复制到宿主机
docker cp <container>:/path/in/container /host/path

# 从宿主机复制到容器
docker cp /host/path <container>:/path/in/container
```

实际应用示例：

```bash
# 从Nginx容器复制配置文件
docker cp my-nginx:/etc/nginx/nginx.conf ./nginx.conf

# 修改后复制回去
docker cp ./nginx.conf my-nginx:/etc/nginx/nginx.conf

# 重启容器使配置生效
docker restart my-nginx
```

### 容器资源限制

合理限制容器资源使用，防止单个容器占用过多资源：

#### CPU限制

```bash
# 限制使用1个CPU核心
docker run -d --cpus="1.0" nginx

# 限制使用50%的CPU
docker run -d --cpus="0.5" nginx

# 指定CPU核心
docker run -d --cpuset-cpus="0,1" nginx
```

#### 内存限制

```bash
# 限制内存使用
docker run -d --memory="512m" nginx

# 限制内存和交换空间
docker run -d --memory="512m" --memory-swap="1g" nginx
```

#### 磁盘IO限制

```bash
# 限制读写速度
docker run -d --device-read-bps /dev/sda:10mb nginx
docker run -d --device-write-bps /dev/sda:10mb nginx
```

#### 综合资源限制示例

```bash
docker run -d \
  --name resource-limited-app \
  --cpus="1.5" \
  --memory="1g" \
  --memory-swap="2g" \
  --pids-limit=100 \
  myapp:latest
```

### 容器网络管理

#### 查看网络

```bash
# 列出所有网络
docker network ls

# 查看网络详情
docker network inspect bridge
```

#### 创建自定义网络

```bash
# 创建桥接网络
docker network create my-network

# 创建带子网的网络
docker network create \
  --subnet=172.20.0.0/16 \
  --gateway=172.20.0.1 \
  my-network
```

#### 容器间通信

```bash
# 在自定义网络中运行容器
docker run -d --name db --network my-network mysql:8.0
docker run -d --name app --network my-network myapp

# 容器间可以通过容器名互相访问
# app容器中可以通过 db:3306 访问数据库
```

![Docker容器网络通信架构](dockerImgs\docker_p2_02.svg)

## 数据持久化方案

容器的设计理念是无状态和临时性的，但实际应用中常需要持久化存储数据。Docker提供了数据卷和挂载目录两种方案。

### 数据卷（Volume）

数据卷是Docker管理的持久化存储区域，推荐用于生产环境：

#### 创建和管理数据卷

```bash
# 创建数据卷
docker volume create my-data

# 列出数据卷
docker volume ls

# 查看数据卷详情
docker volume inspect my-data

# 删除数据卷
docker volume rm my-data

# 删除未使用的数据卷
docker volume prune
```

#### 使用数据卷

```bash
# 运行容器时挂载数据卷
docker run -d \
  -v my-data:/var/lib/mysql \
  mysql:8.0

# 使用命名卷
docker run -d \
  --mount source=my-data,target=/var/lib/mysql \
  mysql:8.0
```

### 绑定挂载（Bind Mount）

将宿主机目录直接挂载到容器，适合开发环境：

```bash
# 绑定挂载
docker run -d \
  -v /host/path:/container/path \
  nginx

# 只读挂载
docker run -d \
  -v /host/config:/etc/nginx:ro \
  nginx
```

### 数据备份与恢复

#### 备份数据卷

```bash
# 创建备份容器，将数据卷内容打包
docker run --rm \
  -v my-data:/data \
  -v $(pwd):/backup \
  alpine \
  tar czf /backup/backup.tar.gz -C /data .
```

#### 恢复数据卷

```bash
# 从备份文件恢复数据卷
docker run --rm \
  -v my-data:/data \
  -v $(pwd):/backup \
  alpine \
  tar xzf /backup/backup.tar.gz -C /data
```

## 实战案例：搭建完整的Web应用

部署一个包含前端、后端和数据库的完整应用：

```bash
# 创建网络
docker network create webapp-network

# 启动数据库
docker run -d \
  --name db \
  --network webapp-network \
  -v db-data:/var/lib/mysql \
  -e MYSQL_ROOT_PASSWORD=secret \
  -e MYSQL_DATABASE=webapp \
  mysql:8.0

# 启动后端服务
docker run -d \
  --name backend \
  --network webapp-network \
  -p 8080:8080 \
  -e DB_HOST=db \
  -e DB_PASSWORD=secret \
  my-backend:latest

# 启动前端服务
docker run -d \
  --name frontend \
  --network webapp-network \
  -p 80:80 \
  my-frontend:latest
```

Docker为应用的容器化运行提供了完整的工具链，从环境搭建到容器管理，再到数据持久化，构建了现代化的应用部署体系。