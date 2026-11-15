import {DefaultTheme} from "vitepress";

export const nav_old: DefaultTheme.NavItem[] = [
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
]