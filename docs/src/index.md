---
# VitePress 首页配置文件
# 参考文档: https://vitepress.dev/reference/default-theme-home-page
# 样式美化：https://vitepress.yiov.top/style
layout: home

# Hero 区域配置 - 页面顶部的主要展示区域
hero:
  name: "知识集"  # 网站名称(大标题)
  text: "沉淀山海学识\n收纳世间智慧\n以文字载道\n以知识前行"  # 副标题/描述文本
  tagline: "深耕所学，不负求知"  # 标语/口号(可选)
  image:
    src: /logo.svg  # 图片路径
    alt: 知识集-知识分享与沉淀
  actions:  # 操作按钮配置(最多两个)
    - theme: brand  # 主题样式: brand(品牌色) 或 alt(次要样式)
      text: 开始探索
      link: /
    - theme: alt  # 第二个按钮使用次要样式
      text: 知识归档
      link: /
      
# 特性列表配置 - 展示项目的核心功能特点
features:
  - title: VitePress个人网站搭建
    details: 从零搭建知识库，掌握配置与部署
    link: /VitePress搭建/首页
  - title: 环境搭建
    details: 开发环境规范指南，文件管理与变量配置
    link: /环境安装/首页
  - title: Hutool官方文档跳转
    details: Java全能工具库，简洁优雅的API
    link: https://www.hutool.cn/docs/#/

  - title: Git
    details: 分布式版本控制系统，掌握分支管理与团队协作
    link: /DevOps/Git/Git版本控制系统全面解析
  - title: Maven
    details: Java项目管理工具，依赖管理与自动化构建
    link: /DevOps/Maven/Maven项目管理工具详解
  - title: Docker
    details: 容器化技术，实现环境一致性与快速部署
    link: /DevOps/Docker/Docker容器技术核心概念




featureGroups:
  - title: Java生态
    items:
      - title: Spring核心
        details: Spring的基础容器与AOP机制
        link: /Java生态/Spring核心
      - title: SpringWebMVC
        details: 基于MVC的Web请求处理框架
        link: /Java生态/SpringWebMVC
      - title: WebSocket
        details: 全双工通信协议及Spring支持
        link: /Java生态/WebSocket
      - title: REST客户端
        details: 调用REST服务的客户端抽象
        link: /Java生态/REST客户端
      - title: SpringKafka
        details: Spring对Kafka的集成
        link: /Java生态/SpringKafka
      - title: Elasticsearch
        details: 分布式搜索与分析引擎
        link: /Java生态/Elasticsearch/
      - title: MinIo
        details: 兼容S3的对象存储
        link: /Java生态/MinIO
      - title: Neo4J
        details: 图数据库与图数据模型
        link: /Java生态/Neo4J
  - title: Python生态
    items:
      - title: 组件嵌入
        details: MD内直接写Vue组件
        link: /Python生态/组件嵌入
---


<FeatureGroups/>