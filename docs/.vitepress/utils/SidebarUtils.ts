import * as fs from 'node:fs'
import * as path from 'path'

/**
 * 根据分类目录自动生成侧边栏的 items 数组
 * 功能：扫描目录下的 md 文件 → 读取 aorder.json 排序 → 返回标准 sidebar 结构
 * @param category 分类文件夹名称（如 Spring、SpringBoot）
 */
export function getCategoryItems(category: string) {
    // 1. 拼接当前分类的完整绝对路径
    // __dirname = 当前 config.mts 所在目录
    // ../src/${category} = 指向 src/分类名 这个文件夹
    const dir = path.resolve(__dirname, `../../src/${category}`)

    // 2. 读取目录下所有文件，只保留 .md 文件，并去掉文件后缀名
    // 最终得到：['Spring', 'api-examples中文', 'markdown-examples']
    const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.md'))       // 只筛选 .md 结尾的文件
        .map(f => f.replace('.md', ''))       // 去掉 .md 后缀，只保留文件名

    // 3. 读取当前分类下的 order.json 排序配置
    let order: string[] = []
    try {
        // 读取 order.json 文件内容
        const orderFileContent = fs.readFileSync(path.join(dir, 'aorder.json'), 'utf8')
        // 把 JSON 字符串转成数组
        order = JSON.parse(orderFileContent)
    } catch (e) {
        // 如果没有 order.json 或读取失败，就用空数组，不报错
    }

    // 4. 第一步排序：严格按照 order.json 里的顺序，只保留真实存在的文件
    const sorted = order.filter(name => files.includes(name))

    // 5. 找出没有在 order.json 里的文件，追加到列表末尾
    const unordered = files.filter(name => !order.includes(name))

    // 6. 合并最终的文件名顺序：排序好的 + 未排序的
    const finalNames = [...sorted, ...unordered]

    // 7. 转换成 VitePress sidebar 需要的格式：{ text: 显示名称, link: 链接 }
    return finalNames.map(name => ({
        text: name,                // 侧边栏显示的文字
        link: `/${category}/${name}`  // 页面跳转链接
    }))
}
