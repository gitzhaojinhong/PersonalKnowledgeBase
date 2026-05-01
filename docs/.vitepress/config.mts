import {defineConfig} from 'vitepress'
import {getCategoryItems} from "./utils/SidebarUtils";

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
                    {text: 'CSS', link: '/CSS/一、CSS基础'},
                    {text: 'HTML', link: '/HTML/一、Web开发基础'},
                ]
            },
            {
                text: '后端',
                items: [
                    {text: 'JakartaEE-Servlet', link: '/JakartaEE-Servlet/一、Web基础概念'},
                    {text: 'Spring', link: '/Spring/一、Spring 概述'},
                    {text: 'SpringBoot', link: '/SpringBoot/首页'},
                    {text: 'SpringCloud', link: '/SpringCloud/一、分布式基础'},
                ]
            },
            {
                text: '项目',
                items: [
                    {text: '天机学堂', link: '/天机学堂/首页'},
                ]
            },
        ],
        // sidebar: getSidebar(),
        sidebar: {
            //===========================VitePress 搭 建================================
            '/VitePress搭建/':[
                {
                    text: '目录',
                    items: getCategoryItems('VitePress搭建')
                }
            ],
            //===========================开 发 速 查================================
            '/后端开发速查/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端开发速查')
                }
            ],
            //===========================前 端 导 航================================
            '/CSS/': [
                {
                    text: '目录',
                    items: getCategoryItems('CSS')
                }
            ],
            '/HTML/': [
                {
                    text: '目录',
                    items: getCategoryItems('HTML')
                }
            ],
            //===========================后 端 导 航================================
            '/JakartaEE-Servlet/': [
                {
                    text: '目录',
                    items: getCategoryItems('JakartaEE-Servlet')
                }
            ],

            '/Spring/': [
                {
                    text: '目录',
                    items: getCategoryItems('Spring')
                }
            ],

            '/SpringBoot/': [
                {
                    text: '目录',
                    items: getCategoryItems('SpringBoot')
                }
            ],
            '/SpringCloud/': [
                {
                    text: '目录',
                    items: getCategoryItems('SpringCloud')
                }
            ],
            //===========================项 目 导 航================================
            '/天机学堂/': [
                {
                    text: '目录',
                    items: getCategoryItems('天机学堂')
                }
            ]
            /**
             * =========================================================================================================
             */

        },
        // 右侧大纲 - deep - 显示所有标题(不支持一级标题)
        outline: {
            level: "deep",
            label: '大纲'
        },

        socialLinks: [
            {icon: 'github', link: 'https://github.com/vuejs/vitepress'}
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
        // 禁用 HTML 标签渲染，纯 Markdown 更安全
        html: false,
    },

})
