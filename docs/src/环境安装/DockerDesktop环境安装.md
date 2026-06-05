# DockerDesktop环境安装

## 一、前提条件

部署过程中，项目官方文档站点、镜像源及资源检索链接大多依赖外网访问，需配置合规网络环境。

所以必须使用“魔法”，并全程开启“魔法”

Docker Desktop 运行**必须开启 CPU 硬件虚拟化**：虚拟化开关在主板 BIOS 内配置，不同品牌主板的 BIOS 进入方式存在差异，可根据主板型号自行查阅对应教程。

> 重要提示：开启硬件虚拟化后，Docker Desktop 默认占用本机半数内存与部分 CPU 算力；若额外开启 GPU 加速，还会耗用部分显卡资源，请结合自身硬件配置酌情决定是否长期启用虚拟化。

## 二、安装WSL

（一般电脑上会有wsl，需要做的只是更新即可，**直接看安装Linux章节**）

安装 WSL的 命令

右键单击并选择“以 **管理员** 身份运行”，在管理员模式下打开 PowerShell，输入 wsl --install（国内有时用不了） 命令，然后重新启动计算机。

```powershell
wsl --install
```

该命令执行后重启电脑会自动下载Ubuntu Linux

如果使用了`wsl --install`又不想使用Ubuntu，可以使用`wsl --unregister Ubuntu`删除Ubuntu系统

## 三、安装Linux

我自己首选RockyLinux，进入官网，点击下载，下拉到最后选择wsl版本下载

网址： [Rocky Linux官网](https://rockylinux.org)

RockyLinux 也可以点击该链接立刻下载：[Rocky Linux wsl版镜像](https://dl.rockylinux.org/pub/rocky/10/images/x86_64/Rocky-10-WSL-Base.latest.x86_64.wsl)

**将RockLinux导入WSL**

**先决条件：**

打开一个管理员权限的终端（PowerShell 或命令提示符），然后运行 `wsl --update`更新并使用最新版的wsl。

```powershell
wsl --update
```

**完整导入命令（可替换相应目录后复制使用）**

1. 先创建 D 盘存储目录（已存在可跳过，可以不使用命令行创建，**目录自己指定**）

以管理员身份打开 Windows 终端（PowerShell/CMD），执行命令：

```cmd
mkdir D:\DevelopmentEnvironment\RockyLinux
```

2. 核心导入命令（路径都替换为自己电脑上对应的路径）

```cmd
wsl --import RockyLinux10 "D:\DevelopmentEnvironment\RockyLinux" "D:\BrowserDownload\Rocky-10-WSL-Base.latest.x86_64.wsl" --version 2
```

- 命令说明：
  1. `RockyLinux10`：你的自定义机器名称（可修改）；
  2. 第二个参数：Linux 虚拟磁盘文件的存储目录（D 盘，你指定的路径）；
  3. 第三个参数：你的 `.wsl` 镜像完整路径（下载的RockyLinux镜像）；
  4. `--version 2`：强制使用 WSL2 版本，保证性能和兼容性。

安装后镜像可以删除。

选择自定义目录的原因：日常使用该系统不可避免的文件会变大（RockyLinux的所有文件都在安装目录的   **ext4.vhdx**   文件中）

**如果你想在Windows中直接使用Rocky Linux的话，可以在命令行启动**

------



| 主流Linux版本               |                                                              |                                                              |                                                          |
| :-------------------------- | :----------------------------------------------------------- | :----------------------------------------------------------- | :------------------------------------------------------- |
| **发行版**                  | **核心特点**                                                 | **优势场景**                                                 | **注意事项**                                             |
| **Ubuntu Server LTS**       | 社区活跃，文档丰富；软件包更新快；对容器化（Docker/K8s）和云平台（AWS/Azure/GCP）支持极佳。 | 互联网公司、SaaS、新项目、云原生架构、追求快速开发和DevOps流程的团队。 | 系统默认配置相对开放，生产环境需要根据安全基线进行加固。 |
| **Rocky Linux / AlmaLinux** | 作为RHEL的免费、开源替代品，提供企业级的稳定性和长达10年的支持周期；安全策略（如SELinux）严格。 | 传统企业、金融电信、需要高合规性、从旧版CentOS迁移、团队熟悉RHEL生态的场景。 | 软件包版本相对保守，以稳定和安全为首要目标。             |



## 四、安装Docker Desktop

下载地址如下：[DockerDesktop下载地址](https://www.docker.com/products/docker-desktop/)

Docker Desktop默认不能更改安装地址，若使用命令行安装则可以**指定安装地址**

cmd命令行安装（该命令不支持PowerShell）

```cmd
start /w "" "安装包完整路径地址Docker Desktop Installer.exe" install -accept-license --installation-dir="目标安装目录的完整地址"
例：start /w "" "D:\BrowserDownload\Docker Desktop Installer.exe" install -accept-license --installation-dir="D:\DevelopmentEnvironment\DockerDesktop"
```

自行决定是否汉化：[汉化地址](https://github.com/asxez/DockerDesktop-CN)



进入DockerDesktop后先**修改设置**

- 点击**常规** 确保  **使用基于 WSL 2 的引擎 (Windows Home can only run the WSL 2 backend)**  选项被勾选
- 点击**资源**确保  **Enable integration with additional distros:**  识别到已经安装的RockyLinux系统 **并且打开RockyLinux开关**
- 更改镜像安装地址，点击**资源**将磁盘镜像位置改为目标位置

这个修改目的是：在 Docker Desktop 中配置与刚才安装的 RockyLinux10 WSL 发行版的集成，让 Docker 可以利用 WSL 2 的环境运行容器，这个配置能大幅提升 Docker 在 Windows 上的性能和兼容性。



此时执行cmd命令`wsl -l -v`显示如下（星号表示默认的Linux）

```cmd
wsl -l -v
  NAME              STATE           VERSION
* RockyLinux10      Running         2
  docker-desktop    Running         2
```



**添加容器操作**

- 前提：需要登陆DockerDesktop，不然无法pull（国内登录不了）

- 使用DockerDesktop拉取镜像：点击最上方搜索框搜索你想要的镜像（下面以mysql为例）选择**星标**和DockerDesktop最高的镜像（大概率为官方镜像），点击PULL下载镜像

- 下载完镜像后将其部署为容器，**一定不要使用DockerDesktop进行容器部署**，原因如下：若使用可视化界面进行容器部署，容器的端口映射默认只能在容器内可见，无法映射到主机端口

- 准备好需要挂载的目录（防止容器删除后数据丢失）

- 打开cmd（此时cmd可直接使用docker命令）运行以下命令

  ```cmd
  # 启动 MySQL 容器的完整命令（适配 WSL + Docker Desktop 环境）
  docker run 
      --name MySQL                  # 给容器命名为 "MySQL"，方便后续通过名称管理（如停止/删除）
      -p 3306:3306                  # 端口映射：将主机的 3306 端口映射到容器内的 3306 端口
                                    # 格式：主机端口:容器端口，外部可通过 localhost:3306 访问容器内的 MySQL
      -v /d/DockerDataVolumes/DataVolumeMounting/Mysql/MysqlData:/var/lib/mysql  
                                    # 数据卷挂载（持久化数据）：
                                    # 将 Windows 路径 D:\StudyProgramFiles\DataVolumeMounting\MysqlData
                                    # 映射到容器内 MySQL 数据存储目录 /var/lib/mysql
                                    # 注意：WSL 中访问 Windows D 盘需用 /d/ 开头，而非 D:\
      -e MYSQL_ROOT_PASSWORD=123456 # 设置环境变量：指定 MySQL root 用户的密码为 123456
      -d                            # 后台运行容器（守护进程模式），执行后终端不会被占用
      mysql:latest                  # 指定使用的镜像名称和版本：mysql 最新版
  # MySQL数据卷和环境变量有很多，具体可参考docker官网做取舍
  ```

- 此时打开DockerDesktop就可以看到容器的运行情况了，也可以使用其他工具连接mysql。
- 后续容器的启动和关闭可直接在DockerDesktop可视化界面操作

## 五、docker常用命令

- 容器管理（最常用）

```bash
# 1. 启动容器（新建+启动）
docker run [选项] 镜像名:版本  # 例：docker run -d --name nginx -p 80:80 nginx:latest
# 2. 查看运行中的容器
docker ps  # 只看运行中
docker ps -a  # 查看所有（包括已停止）
# 3. 启动/停止/重启容器
docker start 容器名/ID    # 启动已停止的容器
docker stop 容器名/ID     # 停止运行中的容器
docker restart 容器名/ID  # 重启容器
# 4. 进入容器内部（交互模式）
docker exec -it 容器名/ID /bin/bash  # 例：docker exec -it MySQL /bin/bash
# 5. 删除容器（需先停止）
docker rm 容器名/ID       # 删除单个
docker rm -f 容器名/ID    # 强制删除（即使容器在运行）
docker rm $(docker ps -aq)  # 删除所有容器
```

- 镜像管理（可通过DockerDesktop可视化页面管理）

```bash
# 1. 拉取镜像
docker pull 镜像名:版本  # 例：docker pull mysql:latest
# 2. 查看本地镜像
docker images  # 列出所有本地镜像
# 3. 删除镜像（需先删除依赖该镜像的容器）
docker rmi 镜像名/ID       # 删除单个
docker rmi $(docker images -aq)  # 删除所有镜像
# 4. 构建镜像（从 Dockerfile）
docker build -t 自定义镜像名:版本 构建目录  # 例：docker build -t myapp:v1 .
```

- 数据卷 / 挂载管理（windows可手动创建，运行容器时指定）

```bash
# 1. 创建数据卷
docker volume create 卷名  # 例：docker volume create mysql-data
# 2. 查看数据卷
docker volume ls
# 3. 查看数据卷详情（路径等）
docker volume inspect 卷名
# 4. 删除数据卷
docker volume rm 卷名
docker volume prune  # 删除未使用的数据卷
```

- 日志 / 信息查看

```bash
# 1. 查看容器日志
docker logs 容器名/ID        # 查看全部日志
docker logs -f 容器名/ID     # 实时跟踪日志（类似 tail -f）
docker logs --tail 100 容器名/ID  # 查看最后100行
# 2. 查看容器/镜像详情
docker inspect 容器名/ID  # 查看容器详细信息（配置、挂载等）
docker inspect 镜像名/ID  # 查看镜像详细信息
```

- 其他实用命令

```bash
# 1. 查看 Docker 版本
docker version
# 2. 查看 Docker 系统信息（镜像、容器数量等）
docker info
# 3. 清理无用资源（容器、镜像、卷等）
docker system prune  # 清理未使用的资源（谨慎执行）
docker system prune -a  # 清理所有未使用的资源（包括未被引用的镜像）
```



## 六、资料总结所使用的参考文档

参考文档如下（**参考文档均为官方文档，可放心使用**）：

WSL文档：[Windows Subsystem for Linux 文档 | Microsoft Learn](https://learn.microsoft.com/zh-cn/windows/wsl/)

将 Rocky Linux 导入WSL2 文档：[将 Rocky Linux 导入 WSL 或 WSL2 - 文档 - Rocky Linux 文档](https://docs.rocky-linux.cn/10/guides/interoperability/import_rocky_to_wsl/#steps)

在 Windows 上安装 Docker Desktop文档：[Windows | Docker 文档](https://docs.docker.top/desktop/setup/install/windows-install/)

Docker Hub资源查询：[docker hub](https://hub.docker.com/repositories)

wsl科普[哔哩哔哩链接](https://www.bilibili.com/video/BV1tW42197za/?share_source=copy_web&vd_source=dd864dd38ffe3f6398e6cd790ad9136d)