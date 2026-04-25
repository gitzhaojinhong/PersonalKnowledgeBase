import {defineConfig} from 'vitepress'
import {getCategoryItems} from "./utils/SidebarUtils";

export default defineConfig({

    // 部署
    base: '/PersonalKnowledgeBase/',
    // 源码目录
    srcDir: './src',
    //网站标题
    title: "个人知识库",
    //网站描述
    description: "一个使用VitePress搭建的个人知识库",

    themeConfig: {
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
        // 导航栏
        nav: [
            {text: '主页', link: '/'},
            {
                text: '前端',
                items: [
                ]
            },
            {
                text: '后端',
                items: [
                    {text: 'JakartaEE-Servlet', link: '/JakartaEE-Servlet/一、Web基础概念'},
                    {text: 'Spring', link: '/Spring/第一章 Spring 概述'},
                    {text: 'SpringBoot', link: '/SpringBoot/SpringBoot'},
                    {text: 'SpringCloud', link: '/SpringCloud/一、分布式基础'},
                ]
            },
        ],
        // sidebar: getSidebar(),
        sidebar: {
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
                    items: [
                        { text: 'SpringBoot 主页', link: '/SpringBoot/SpringBoot' }
                    ]
                }
            ],
            '/SpringCloud/': [
                {
                    text: '目录',
                    items: getCategoryItems('SpringCloud')
                }
            ],


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
})
