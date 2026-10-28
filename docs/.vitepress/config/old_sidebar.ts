import {getCategoryItems} from "../utils/SidebarUtil";

export const old_sidebar={
    //===========================VitePress 搭 建================================
    '/VitePress搭建/':[
        {
            text: '目录1', //分组标题
            collapsed: true, //true: 目录折叠起来
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

    //===========================后 端 导 航================================
    '/后端/设计模式/': [
        {
            text: '目录',
            items: getCategoryItems('后端/设计模式')
        }
    ],

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
    //===========================数 据 库 导 航================================
    '/数据库/ElasticSearch/': [
        {
            text: '目录',
            items: getCategoryItems('数据库/ElasticSearch')
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
    ],



    //===========================DevOps 导 航================================
    '/DevOps/Docker/': [
        {
            text: '目录',
            items: getCategoryItems('DevOps/Docker')
        }
    ],
    '/DevOps/Git/': [
        {
            text: '目录',
            items: getCategoryItems('DevOps/Git')
        }
    ],
    '/DevOps/Maven/': [
        {
            text: '目录',
            items: getCategoryItems('DevOps/Maven')
        }
    ],
    /**
     * =========================================================================================================
     */

}