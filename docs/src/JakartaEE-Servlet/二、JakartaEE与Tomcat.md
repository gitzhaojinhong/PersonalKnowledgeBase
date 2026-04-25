## 二、JakartaEE与Tomcat

### 2.1 JakartaEE概述

JakartaEE（原JavaEE）是一套企业级Java应用开发规范，由Eclipse基金会维护。

**核心规范包括：**
- **Servlet**：Web请求处理规范
- **JSP/JSTL**：动态页面技术
- **JDBC**：数据库访问规范
- **JPA**：对象关系映射规范
- **EJB**：企业级组件规范
- **JMS**：消息服务规范
- **WebSocket**：全双工通信规范

**版本演进：**
- JavaEE 8（2017年）→ JakartaEE 8（迁移到Eclipse）
- JakartaEE 9（2020年）：包名从`javax.*`改为`jakarta.*`
- JakartaEE 10（2022年）：Servlet 6.0、支持Java 17+

### 2.2 Tomcat服务器

Tomcat是Apache开源的Servlet容器，实现了JakartaEE的Servlet、JSP等规范。

**核心作用：**
- 监听HTTP请求端口（默认8080）
- 管理Servlet生命周期
- 处理请求分发和响应
- 提供连接池、线程池等基础设施

#### Tomcat目录结构

```
apache-tomcat-10.x.x/
├── bin/                    # 启动/关闭脚本
│   ├── startup.bat         # Windows启动
│   ├── startup.sh          # Linux启动
│   ├── shutdown.bat        # Windows关闭
│   └── shutdown.sh         # Linux关闭
├── conf/                   # 配置文件
│   ├── server.xml          # 服务器核心配置
│   ├── web.xml             # 全局Web应用配置
│   ├── context.xml         # 上下文配置
│   └── tomcat-users.xml    # 用户权限配置
├── lib/                    # Tomcat运行依赖的Jar包
├── logs/                   # 日志文件
├── temp/                   # 临时文件
├── webapps/                # 部署Web应用的目录
│   ├── ROOT/               # 默认根应用
│   ├── docs/               # 文档
│   └── examples/           # 示例应用
└── work/                   # JSP编译后的工作目录
```

#### server.xml核心配置

```xml
<!-- 服务配置 -->
<Server port="8005" shutdown="SHUTDOWN">
    
    <!-- 连接器配置 -->
    <Connector port="8080" 
               protocol="HTTP/1.1"
               connectionTimeout="20000"
               redirectPort="8443"
               maxThreads="200"
               minSpareThreads="10"
               acceptCount="100"/>
    
    <!-- 引擎配置 -->
    <Engine name="Catalina" defaultHost="localhost">
        
        <!-- 虚拟主机配置 -->
        <Host name="localhost" appBase="webapps" unpackWARs="true">
            
            <!-- 上下文配置（可配置多个Web应用） -->
            <Context path="/myapp" docBase="D:/projects/myapp" reloadable="true"/>
            
        </Host>
    </Engine>
</Server>
```

**关键配置项说明：**

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `port` | 监听端口 | 8080 |
| `maxThreads` | 最大线程数（并发处理能力） | 200 |
| `minSpareThreads` | 最小空闲线程数 | 10 |
| `acceptCount` | 等待队列长度 | 100 |
| `connectionTimeout` | 连接超时时间（毫秒） | 20000 |

#### IDEA集成Tomcat配置

**步骤：**
1. Edit Configurations → Add New Configuration → Tomcat Server → Local
2. 配置Application Server路径（Tomcat安装目录）
3. 配置Deployment（部署的Web应用）
4. 配置URL（访问路径）
5. 配置VM options（可选，如内存参数）

**VM options常用配置：**
```
-Xms512m -Xmx1024m -XX:MetaspaceSize=256m -XX:MaxMetaspaceSize=512m
```

---
