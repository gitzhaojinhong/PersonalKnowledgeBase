import * as fs from 'node:fs'
import * as path from 'path'

interface ProgressItem {
    rawPathTitleList: string[]
    pathTitleList: string[]
}

/**
 * 读取 progress.json 并按顺序返回侧边栏 items 数组
 * @param category 分类文件夹相对路径（如 Java生态/Elasticsearch）
 */
export function getCategoryItemsFromProgress(category: string) {
    const dir = path.resolve(__dirname, `../../src/${category}`)

    let progressList: ProgressItem[] = []
    try {
        const content = fs.readFileSync(path.join(dir, 'progress.json'), 'utf8')
        progressList = JSON.parse(content)
    } catch (e) {
        return []
    }

    return progressList.map(item => ({
        text: item.rawPathTitleList[0] ?? '',
        link: `/${category}/${item.pathTitleList[0] ?? ''}`
    }))
}

/**
 * 批量生成侧边栏配置
 * @param categories 路径数组，如 ['Java生态/Elasticsearch', 'Java生态/MinIO']
 */
export function generateSidebarConfig(categories: string[]) {
    const config: Record<string, any[]> = {}
    for (const category of categories) {
        config[`/${category}/`] = [
            {
                text: '目录',
                collapsed: true,
                items: getCategoryItemsFromProgress(category)
            }
        ]
    }
    return config
}