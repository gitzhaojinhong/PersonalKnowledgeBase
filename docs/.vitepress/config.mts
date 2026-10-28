import {defineConfig} from 'vitepress'
import {getCategoryItems} from "./utils/SidebarUtil";
import {sidebar} from "./config/sidebar";

export default defineConfig({

    // 部署
    base: '/PersonalKnowledgeBase/',
    // 源码目录
    srcDir: './src',
    // 语言
    lang: 'zh-CN',
    //网站标题
    title: "个人知识库",
    //网站描述
    description: "一个使用VitePress搭建的个人知识库",
    // 头部
    head: [
        ['link',{ rel: 'icon', href: '/logo.svg'}],
    ],

    themeConfig: {
        logo: '/logo.svg',
        // 搜索功能
        search: {
            provider: 'local',
            options: {
                translations: {
                    button: {
                        buttonText: '搜索文档',
                        buttonAriaLabel: '搜索文档'
                    },
                    modal: {
                        noResultsText: '无法找到相关结果',
                        resetButtonTitle: '清除查询条件',
                        footer: {
                            selectText: '选择',
                            navigateText: '切换',
                            closeText: '关闭'
                        }
                    }
                }
            }
        },
        /**
         * ================================= 添 加 文 档 后 修 改 处 ======================================================
          */
        // 导航栏
        nav: [
            {text: '主页', link: '/'},
            {
                text: 'VitePress搭建',link: '/VitePress搭建/首页'
            },
            {
                text: '后端速查',link: '/后端开发速查/首页'
            },
            {
                text: '前端',
                items: [
                    {text: 'CSS', link: '/前端/CSS/首页'},
                    {text: 'HTML', link: '/前端/HTML/首页'},
                ]
            },
            {
                text: '后端',
                items: [
                    {text: '设计模式', link: '/后端/设计模式/首页'},
                    {text: 'JUC', link: '/后端/JUC/首页'},
                    {text: 'JakartaEE-Servlet', link: '/后端/JakartaEE-Servlet/首页'},
                    {text: 'Spring', link: '/后端/Spring/首页'},
                    {text: 'SpringBoot', link: '/后端/SpringBoot/首页'},
                    {text: 'SpringCloud', link: '/后端/SpringCloud/首页'},
                    {text: 'MyBatisPlus', link: '/后端/MyBatisPlus/首页'},
                    {text: 'Redis', link: '/后端/Redis/首页'},
                    {text: 'MinIO', link: '/后端/MinIO/首页'},
                ]
            },
            {
              text: '数据库',
                items: [
                    {text: 'ElasticSearch', link: '/数据库/ElasticSearch/首页'},
                ]
            },
            {
                text: '项目',
                items: [
                    {text: '天机学堂', link: '/项目/天机学堂/首页'},
                ]
            },
        ],
        // sidebar: getSidebar(),
        sidebar,
        // 右侧大纲 - deep - 显示所有标题(不支持一级标题)
        outline: {
            level: "deep",
            label: '大纲'
        },

        socialLinks: [
            {icon: 'github', link: 'https://github.com/gitzhaojinhong'}
        ]
    },
    // 忽略死链接比如localhost:8080/xxx
    ignoreDeadLinks: true,
    // 禁用 Markdown 属性语法
    markdown: {
        // 禁用 Markdown 属性语法解析（如 {.class #id}）
        attrs: {
            disable: true
        },
        // 禁用 HTML 标签渲染false ，默认true
        html: true,
    },


})
