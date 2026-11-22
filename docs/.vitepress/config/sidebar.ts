import {sidebar_old} from "./sidebar_old";
import {sidebar_yvque} from "./sidebar_yvque";
import {getCategoryItems} from "../utils/SidebarUtil";

export const sidebar={
    // ...sidebar_old,
    ...sidebar_yvque,
    //===========================VitePress 搭 建================================
    '/VitePress搭建/': [
        {
            text: '目录',
            items: getCategoryItems('VitePress搭建')
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
}