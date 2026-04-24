---
# VitePress 首页配置文件
# 参考文档: https://vitepress.dev/reference/default-theme-home-page
layout: home

# Hero 区域配置 - 页面顶部的主要展示区域
hero:
  name: "个人知识库"  # 网站名称(大标题)
  text: "一个使用VitePress搭建的个人知识库"  # 副标题/描述文本
  tagline: My great project tagline  # 标语/口号(可选)
  actions:  # 操作按钮配置(最多两个)
    - theme: brand  # 主题样式: brand(品牌色) 或 alt(次要样式)
      text:  暂不能点击 # 按钮文字
      link: /  # 点击跳转的链接路径
    - theme: alt  # 第二个按钮使用次要样式
      text: 暂不能点击
      link: /

# 特性列表配置 - 展示项目的核心功能特点(最多3个)
features:
  - title: Feature A  # 特性标题
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit  # 特性详细描述
  - title: Feature B
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
  - title: Feature C
    details: Lorem ipsum dolor sit amet, consectetur adipiscing elit
---

