## 10.1 语义化布局标签

HTML5新增了一系列语义化标签，用于替代div进行页面布局，使文档结构更加清晰和有意义。

| 标签名 | 语义 | 说明 |
|--------|------|------|
| header | 页面或区域的头部 | 通常包含导航、logo、搜索框等 |
| footer | 页面或区域的底部 | 通常包含版权信息、联系方式、链接等 |
| nav | 导航区域 | 包含主要的导航链接 |
| article | 独立的内容块 | 文章、帖子、评论等——内容独立完整，脱离上下文也有意义 |
| section | 内容的分段或分区 | 通常包含一个标题，将相关内容分组 |
| aside | 侧边栏或附加信息 | 与主内容相关的辅助信息 |
| main | 文档主体内容 | 每个页面只能有一个，不包含header/footer/nav等 |
| hgroup | 标题组 | 包裹连续的标题元素（主标题+副标题），W3C已从标准中移除，不建议使用 |

**article与section的区别**：
- article强调"独立性"——一块内容如果可以脱离上下文独立存在，就用article（如博客文章、商品卡片、用户评论）
- section强调"分段性"——将一个大主题分成几个小部分，每部分用section包裹
- article内部可以包含多个section，但不是必须的

使用示例：

```html
<header>
    <h1>我的博客</h1>
    <nav>
        <a href="/">首页</a>
        <a href="/about">关于</a>
        <a href="/archive">归档</a>
    </nav>
</header>

<main>
    <article>
        <h2>学习HTML5的心得</h2>
        <p>发布日期：2024年1月1日</p>
        <section>
            <h3>语义化标签的优势</h3>
            <p>语义化标签让代码结构更加清晰...</p>
        </section>
        <section>
            <h3>多媒体能力</h3>
            <p>video和audio标签使媒体嵌入变得简单...</p>
        </section>
    </article>
</main>

<aside>
    <h3>推荐阅读</h3>
    <ul>
        <li><a href="#">CSS入门指南</a></li>
        <li><a href="#">JavaScript基础</a></li>
    </ul>
</aside>

<footer>
    <p>版权所有 © 2024 我的博客</p>
</footer>
```

## 10.2 状态标签

### 10.2.1 meter标签

语义：表示已知范围内的标量测量值（gauge），如电量、磁盘使用率、考试成绩等。

```html
<meter value="0.7" min="0" max="1">70%</meter>
```

属性说明：

value — 当前值（必填）

min — 范围最小值（默认为0）

max — 范围最大值（默认为1）

low — 低值阈值，低于此值浏览器可能以不同颜色显示

high — 高值阈值，高于此值浏览器可能以不同颜色显示

optimum — 最优值

```html
<p>电池电量：<meter value="30" min="0" max="100" low="20" high="80" optimum="100">30%</meter></p>
```

> 注意：meter不是进度条！它表示的是一个已知范围内的静态值，不会自动变化。需要动态变化的进度指示应使用progress标签。

### 10.2.2 progress标签

语义：显示任务完成的进度，如文件上传进度、任务完成百分比等。

```html
<progress value="60" max="100">已完成60%</progress>
```

属性说明：

value — 当前进度值

max — 总量值（默认为1）

不加value属性时，progress显示为不确定进度（通常表现为条纹动画），表示进度未知但正在进行中：

```html
<progress max="100">加载中...</progress>
```

## 10.3 交互标签

### 10.3.1 details与summary标签

details标签创建一个可折叠/展开的内容区域，summary标签指定折叠区域的标题（始终可见）。

```html
<details>
    <summary>什么是HTML？</summary>
    <p>HTML是超文本标记语言，是构建网页内容的基础技术之一。</p>
</details>

<details open>
    <summary>常见问题</summary>
    <p>这里是展开后可见的详细内容。</p>
</details>
```

open属性 — 布尔属性，设置后默认展开（不设置则默认折叠）。

> 实际应用：FAQ（常见问题）、可折叠的说明文档、高级设置面板等场景。可以通过JavaScript监听toggle事件来处理展开/折叠逻辑。

## 10.4 新增文本标签

### 10.4.1 文本注音（ruby + rt）

ruby标签用于为文字添加注音标注（如拼音、日文假名），rt标签写注音内容。

```html
<ruby>
    魑魅魍魉<rt>chi mei wang liang</rt>
</ruby>
```

rp标签用于不支持ruby的浏览器中显示括号：

```html
<ruby>
    魑魅魍魉<rp>(</rp><rt>chi mei wang liang</rt><rp>)</rp>
</ruby>
```

### 10.4.2 文本高亮（mark）

语义：标记/高亮文本，通常用于标记搜索结果中的关键词。

```html
<p>在搜索结果中，匹配的关键词会以 <mark>高亮</mark> 形式显示。</p>
```

mark不是用于装饰性高亮（装饰性效果应通过CSS实现），而是用于语义上的"标记"——表示这段文字因为某种上下文原因需要引起注意。

## 10.5 figure与figcaption标签

figure标签用于包裹独立的引用内容（图片、图表、代码片段等），figcaption标签是figure的标题/说明。

```html
<figure>
    <img src="./chart.png" alt="销售数据图表">
    <figcaption>图1：2024年各季度销售数据</figcaption>
</figure>

<figure>
    <figcaption>代码示例：快速排序</figcaption>
    <pre><code>function quickSort(arr) {
    if (arr.length <= 1) return arr;
    // 排序逻辑...
}</code></pre>
</figure>
```

> figure不仅仅用于图片，任何独立的、可以被引用的内容（图表、代码块、引用段落）都可以使用figure包裹。

---

