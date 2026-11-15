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
}