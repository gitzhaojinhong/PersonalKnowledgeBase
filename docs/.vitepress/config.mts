import {defineConfig} from 'vitepress'
import {getCategoryItems} from "./utils/SidebarUtils";



// https://vitepress.dev/reference/site-config
export default defineConfig({

    base: '/PersonalKnowledgeBase/',

    srcDir: './src',
    //网站标题
    title: "个人知识库",
    //网站描述
    description: "一个使用VitePress搭建的个人知识库",

    themeConfig: {
        // https://vitepress.dev/reference/default-theme-config
        // 导航栏
        nav: [
            {text: '主页', link: '/'},
            {
                text: '后端',
                items: [
                    {text: 'Spring', link: '/Spring/Spring'},
                    {text: 'SpringBoot', link: '/SpringBoot/SpringBoot'}
                ]
            }
        ],
        // sidebar: getSidebar(),
        sidebar: {
            // Spring 下的页面，只显示 Spring 侧边栏
            '/Spring/': [
                {
                    text: 'Spring 文档',
                    items: getCategoryItems('Spring')
                }
            ],

            // SpringBoot 下的页面，只显示 SpringBoot 侧边栏
            '/SpringBoot/': [
                {
                    text: 'SpringBoot 文档',
                    items: [
                        { text: 'SpringBoot 主页', link: '/SpringBoot/SpringBoot' }
                    ]
                }
            ]
        },
        // 右侧大纲 - 显示二级和三级标题
        outline: {
            level: [2, 3],
            label: '页面导航'
        },

        socialLinks: [
            {icon: 'github', link: 'https://github.com/vuejs/vitepress'}
        ]
    },
})
