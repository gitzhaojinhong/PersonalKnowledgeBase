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
                    {text: 'CSS', link: '/前端/CSS/首页'},
                    {text: 'HTML', link: '/前端/HTML/首页'},
                    {text: 'Vue临时', link: '/前端/Vue/首页'},
                ]
            },
            {
                text: '后端',
                items: [
                    {text: 'JUC', link: '/后端/JUC/首页'},
                    {text: 'JakartaEE-Servlet', link: '/后端/JakartaEE-Servlet/首页'},
                    {text: 'Spring', link: '/后端/Spring/首页'},
                    {text: 'SpringBoot', link: '/后端/SpringBoot/首页'},
                    {text: 'SpringCloud', link: '/后端/SpringCloud/首页'},
                    {text: 'MyBatisPlus', link: '/后端/MyBatisPlus/首页'},
                    {text: 'Redis', link: '/后端/Redis/首页'},
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
            '/前端/CSS/': [
                {
                    text: '目录',
                    items: getCategoryItems('前端/CSS')
                }
            ],
            '/前端/HTML/': [
                {
                    text: '目录',
                    items: getCategoryItems('前端/HTML')
                }
            ],
            '/前端/Vue/': [
                {
                    text: '目录',
                    items: getCategoryItems('前端/Vue')
                }
            ],
            //===========================后 端 导 航================================
            '/后端/JUC/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/JUC')
                }
            ],

            '/后端/JakartaEE-Servlet/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/JakartaEE-Servlet')
                }
            ],

            '/后端/Spring/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/Spring')
                }
            ],

            '/后端/SpringBoot/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/SpringBoot')
                }
            ],
            '/后端/SpringCloud/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/SpringCloud')
                }
            ],
            '/后端/MyBatisPlus/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/MyBatisPlus')
                }
            ],
            '/后端/Redis/': [
                {
                    text: '目录',
                    items: getCategoryItems('后端/Redis')
                }
            ],
            //===========================项 目 导 航================================
            '/项目/天机学堂/': [
                {
                    text: '目录',
                    items: getCategoryItems('项目/天机学堂')
                }
            ],
            //===========================环 境 安 装 导 航================================


            '/环境安装/': [
                {
                    text: '目录',
                    items: getCategoryItems('环境安装')
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
