# Dockerfile镜像构建与容器编排

## Dockerfile镜像构建

Dockerfile是一个文本文件，包含了构建Docker镜像的所有指令。通过Dockerfile可以实现镜像构建的自动化和标准化，确保在不同环境下构建出一致的镜像。

## Dockerfile核心指令

Dockerfile由一系列指令组成，每条指令会在镜像中创建一个新的层。

### FROM - 指定基础镜像

FROM指令必须是Dockerfile的第一条指令（注释除外），用于指定构建的基础镜像：

```dockerfile
# 使用官方Node.js镜像
FROM node:18-alpine

# 使用特定版本的JDK
FROM openjdk:17-jdk-slim

# 多阶段构建指定阶段名称
FROM maven:3.8-openjdk-17 AS builder
```

### LABEL - 添加元数据

为镜像添加标签信息，便于镜像管理：

```dockerfile
LABEL maintainer="developer@company.com"
LABEL version="1.0.0"
LABEL description="电商系统订单服务"
LABEL org.opencontainers.image.source="https://github.com/company/order-service"
```

### ENV - 设置环境变量

定义容器运行时的环境变量：

```dockerfile
# 设置应用环境
ENV NODE_ENV=production
ENV APP_PORT=3000

# 设置JVM参数
ENV JAVA_OPTS="-Xmx2g -Xms1g -XX:+UseG1GC"

# 多个变量同时设置
ENV TZ=Asia/Shanghai \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8
```

### WORKDIR - 设置工作目录

指定容器内的工作目录，后续指令的相对路径都基于此目录：

```dockerfile
# 设置工作目录
WORKDIR /app

# WORKDIR会自动创建目录
WORKDIR /usr/local/myapp/data

# 可以使用环境变量
WORKDIR ${APP_HOME}
```

### COPY和ADD - 复制文件

将构建上下文中的文件复制到镜像中：

```dockerfile
# 复制单个文件
COPY package.json .

# 复制多个文件
COPY package.json package-lock.json ./

# 复制整个目录
COPY ./src ./src

# 支持通配符
COPY *.jar /app/

# 设置文件权限和所有者
COPY --chown=node:node app.js .
```

ADD指令功能更强，但通常推荐使用COPY：

```dockerfile
# ADD支持自动解压和URL下载
ADD https://example.com/file.tar.gz /app/
ADD archive.tar.gz /app/
```

### RUN - 执行命令

在镜像构建过程中执行命令：

```dockerfile
# 更新包索引并安装软件
RUN apt-get update && apt-get install -y \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*

# 创建目录
RUN mkdir -p /app/logs /app/data

# 组合命令
RUN npm install && npm run build
```

### EXPOSE - 声明端口

声明容器运行时监听的端口：

```dockerfile
# 声明单个端口
EXPOSE 8080

# 声明多个端口
EXPOSE 8080 8443

# 声明UDP端口
EXPOSE 53/udp
```

注意：EXPOSE只是声明，实际运行时仍需通过`-p`参数映射端口。

### CMD和ENTRYPOINT - 容器启动命令

CMD指定容器启动时的默认命令：

```dockerfile
# 推荐格式（exec格式）
CMD ["node", "app.js"]

# shell格式
CMD node app.js

# 可被docker run命令覆盖
```

ENTRYPOINT指定容器启动时始终执行的命令：

```dockerfile
ENTRYPOINT ["java", "-jar", "/app.jar"]

# CMD作为默认参数
CMD ["--server.port=8080"]
```

ENTRYPOINT和CMD的组合：

```dockerfile
ENTRYPOINT ["java", "-jar"]
CMD ["/app.jar"]

# 运行时可以覆盖CMD
docker run myapp /another-app.jar
```

### USER - 指定运行用户

指定后续指令和容器运行时的用户：

```dockerfile
# 创建用户
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# 切换到非root用户
USER appuser

# 后续指令以appuser执行
WORKDIR /home/appuser
```

### VOLUME - 声明数据卷

声明需要持久化或共享的目录：

```dockerfile
# 声明数据卷
VOLUME ["/app/data", "/app/logs"]

# 或
VOLUME /app/data
```

### ARG - 构建参数

定义构建时可传递的变量：

```dockerfile
# 定义构建参数
ARG NODE_VERSION=18

# 使用构建参数
FROM node:${NODE_VERSION}-alpine

# 构建时传递参数
docker build --build-arg NODE_VERSION=20 -t myapp .
```

![Dockerfile指令执行流程](dockerImgs\docker_p3_00.svg)

### HEALTHCHECK - 健康检查

定义容器健康检查方式：

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1
```

## 多阶段构建优化

多阶段构建可以显著减小最终镜像的体积，提高安全性：

### Java应用多阶段构建

```dockerfile
# 构建阶段
FROM maven:3.8-openjdk-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# 运行阶段
FROM openjdk:17-jdk-slim
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Node.js应用多阶段构建

```dockerfile
# 构建阶段
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 运行阶段
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## 镜像构建最佳实践

### 减少镜像层数

合并多个RUN指令，减少镜像层：

```dockerfile
# 不推荐
RUN apt-get update
RUN apt-get install -y curl
RUN apt-get install -y vim
RUN rm -rf /var/lib/apt/lists/*

# 推荐
RUN apt-get update && apt-get install -y \
    curl \
    vim \
    && rm -rf /var/lib/apt/lists/*
```

### 利用构建缓存

合理安排指令顺序，充分利用Docker的层缓存：

```dockerfile
# 先复制不常变化的文件（利用缓存）
COPY package*.json ./
RUN npm ci

# 再复制经常变化的代码
COPY . .
RUN npm run build
```

### 使用.dockerignore文件

排除不必要的文件，加快构建速度：

```
node_modules
*.log
.git
.env
Dockerfile
docker-compose.yml
README.md
```

### 选择合适的基础镜像

优先选择官方的Alpine版本镜像：

```dockerfile
# 推荐：体积小，安全性高
FROM node:18-alpine
FROM openjdk:17-jdk-alpine

# 不推荐：体积大
FROM node:18
FROM openjdk:17
```

### 构建示例命令

```bash
# 基本构建
docker build -t myapp:1.0 .

# 指定Dockerfile路径
docker build -f Dockerfile.prod -t myapp:prod .

# 传递构建参数
docker build --build-arg NODE_ENV=production -t myapp .

# 不使用缓存构建
docker build --no-cache -t myapp .
```

## Docker Compose容器编排

对于包含多个容器的应用，手动管理每个容器既繁琐又容易出错。Docker Compose提供了声明式的容器编排方案，通过YAML文件定义整个应用栈。

### Docker Compose文件结构

一个典型的docker-compose.yml文件包含以下主要部分：

```yaml
version: '3.8'

services:
  # 服务定义

networks:
  # 网络配置

volumes:
  # 数据卷配置
```

![Docker Compose编排流程图](dockerImgs\docker_p3_01.svg)

### 服务配置详解

#### 基础配置

```yaml
services:
  web:
    image: nginx:latest
    container_name: my-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    environment:
      - NGINX_HOST=example.com
    env_file:
      - .env
```

#### 依赖关系

```yaml
services:
  app:
    build: ./app
    depends_on:
      - db
      - redis

  db:
    image: mysql:8.0

  redis:
    image: redis:alpine
```

#### 数据卷挂载

```yaml
services:
  db:
    image: mysql:8.0
    volumes:
      # 命名卷
      - db-data:/var/lib/mysql
      # 绑定挂载
      - ./config/mysql.cnf:/etc/mysql/conf.d/custom.cnf:ro
      # 临时卷
      - /tmp

volumes:
  db-data:
```

#### 网络配置

```yaml
services:
  frontend:
    networks:
      - frontend-network

  backend:
    networks:
      - frontend-network
      - backend-network

  db:
    networks:
      - backend-network

networks:
  frontend-network:
    driver: bridge
  backend-network:
    driver: bridge
    internal: true  # 内部网络，不暴露到外部
```

#### 资源限制

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
        reservations:
          cpus: '0.5'
          memory: 256M
```

#### 健康检查

```yaml
services:
  app:
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

### 完整应用案例

#### 电商系统微服务架构

```yaml
version: '3.8'

services:
  # 前端服务
  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - gateway
    networks:
      - web

  # API网关
  gateway:
    build: ./gateway
    ports:
      - "8080:8080"
    environment:
      - USER_SERVICE_URL=http://user-service:8081
      - ORDER_SERVICE_URL=http://order-service:8082
    depends_on:
      - user-service
      - order-service
    networks:
      - web
      - service

  # 用户服务
  user-service:
    build: ./user-service
    environment:
      - DB_HOST=user-db
      - REDIS_HOST=redis
    depends_on:
      - user-db
      - redis
    networks:
      - service
      - data

  # 订单服务
  order-service:
    build: ./order-service
    environment:
      - DB_HOST=order-db
      - REDIS_HOST=redis
    depends_on:
      - order-db
      - redis
    networks:
      - service
      - data

  # 用户数据库
  user-db:
    image: mysql:8.0
    volumes:
      - user-db-data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=secret
      - MYSQL_DATABASE=userdb
    networks:
      - data

  # 订单数据库
  order-db:
    image: mysql:8.0
    volumes:
      - order-db-data:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=secret
      - MYSQL_DATABASE=orderdb
    networks:
      - data

  # Redis缓存
  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
    networks:
      - data

volumes:
  user-db-data:
  order-db-data:
  redis-data:

networks:
  web:
  service:
  data:
```

### Docker Compose常用命令

#### 启动服务

```bash
# 前台启动
docker-compose up

# 后台启动
docker-compose up -d

# 构建并启动
docker-compose up --build

# 启动指定服务
docker-compose up -d db redis
```

#### 停止服务

```bash
# 停止服务（保留容器）
docker-compose stop

# 停止并删除容器
docker-compose down

# 停止并删除容器和数据卷
docker-compose down -v
```

#### 查看服务状态

```bash
# 查看运行中的容器
docker-compose ps

# 查看日志
docker-compose logs

# 实时查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs app
```

#### 服务管理

```bash
# 重启服务
docker-compose restart

# 重启指定服务
docker-compose restart app

# 扩展服务实例数
docker-compose up -d --scale app=3

# 执行命令
docker-compose exec app bash
```

#### 构建和推送

```bash
# 构建所有服务
docker-compose build

# 构建指定服务
docker-compose build app

# 推送镜像到仓库
docker-compose push
```

## 容器编排进阶：Kubernetes

当应用规模增长到需要管理成百上千个容器时，Docker Compose就显得力不从心了。Kubernetes（K8s）作为容器编排的事实标准，提供了企业级的容器管理能力。

### 为什么需要Kubernetes

Docker和Docker Compose虽然解决了容器化和基本编排问题，但在大规模生产环境中存在以下局限：

#### Docker的局限性

- 单机管理，无法跨主机编排
- 没有自动故障恢复机制
- 手动扩缩容，效率低下
- 缺少负载均衡能力
- 服务发现能力有限

#### Kubernetes的核心能力

- **自动调度**：智能分配容器到最优节点
- **自愈能力**：容器故障自动重启和替换
- **弹性伸缩**：根据负载自动扩缩容
- **服务发现**：内置DNS和负载均衡
- **滚动更新**：零停机版本更新
- **配置管理**：ConfigMap和Secret管理

![Kubernetes核心能力图](dockerImgs\docker_p3_02.svg)

### K8s核心概念

#### Pod - 最小部署单元

Pod是K8s中的基本调度单位，可以包含一个或多个紧密协作的容器：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  containers:
    - name: app
      image: myapp:1.0
      ports:
        - containerPort: 8080
    - name: sidecar
      image: nginx:alpine
```

#### Deployment - 应用部署

Deployment管理Pod的副本数量和更新策略：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: app
          image: myapp:1.0
          ports:
            - containerPort: 8080
          resources:
            limits:
              memory: "512Mi"
              cpu: "500m"
```

#### Service - 服务发现

Service为Pod提供稳定的网络访问入口：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: my-app
  ports:
    - port: 80
      targetPort: 8080
  type: LoadBalancer
```

### Docker vs Kubernetes对比

| 特性     | Docker/Docker Compose | Kubernetes           |
| -------- | --------------------- | -------------------- |
| 适用规模 | 单机或小规模集群      | 大规模分布式集群     |
| 自动调度 | 不支持                | 智能调度到最优节点   |
| 故障恢复 | 手动重启              | 自动检测并重启       |
| 弹性伸缩 | 手动扩容              | 自动横向扩展         |
| 负载均衡 | 需要额外配置          | 内置负载均衡         |
| 滚动更新 | 需要脚本实现          | 原生支持零停机更新   |
| 学习曲线 | 较平缓                | 较陡峭               |
| 适用场景 | 开发测试、小型应用    | 生产环境、微服务架构 |

### 何时选择K8s

**适合使用Kubernetes的场景：**

- 微服务架构，服务数量众多
- 需要跨多个数据中心部署
- 对高可用性有严格要求
- 需要自动化的故障恢复
- 流量波动大，需要弹性伸缩
- 团队有DevOps文化和实践

**继续使用Docker Compose的场景：**

- 单体应用或服务数量少
- 开发和测试环境
- 单机或小规模部署
- 团队规模小，运维资源有限
- 快速原型验证

![容器编排方案选择决策图](dockerImgs\docker_p3_03.svg)

## 总结

通过Dockerfile可以实现镜像构建的自动化，多阶段构建技术能够显著优化镜像体积。Docker Compose为多容器应用提供了声明式的编排方案，适合中小规模的应用部署。当应用规模增长到一定程度，Kubernetes提供了企业级的容器编排能力，支持大规模分布式部署和自动化运维。

选择合适的工具取决于具体的应用场景和团队能力。对于大多数开发团队，掌握Docker和Docker Compose已经能够满足日常的容器化需求。