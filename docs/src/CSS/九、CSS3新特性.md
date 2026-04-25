## 9.1 CSS3简介

CSS3 是 CSS 的最新版本，增加了许多新特性。

### 9.1.1 私有前缀

为了兼容不同浏览器，部分新属性需要添加私有前缀。

| 内核 | 前缀 |
|------|------|
| Webkit | -webkit- |
| Mozilla | -moz- |
| Microsoft | -ms- |
| Opera | -o- |

**示例：**

```css
/* 圆角（需要私有前缀） */
border-radius: 10px;
-webkit-border-radius: 10px;
-moz-border-radius: 10px;
```

### 9.1.2 CSS3基本语法

CSS3 的基本语法与 CSS2 相同，只是增加了新的属性。

## 9.2 新增长度单位

| 单位 | 说明 |
|------|------|
| rem | 相对于根元素字体大小 |
| vw | 视口宽度的 1% |
| vh | 视口高度的 1% |
| vmin | 视口宽高中较小的 1% |
| vmax | 视口宽高中较大的 1% |

## 9.3 盒模型相关属性

### 9.3.1 box-sizing 怪异盒模型

让元素的内边距和边框包含在 width 和 height 之内。

```css
/* 标准盒模型（默认） */
box-sizing: content-box;

/* 怪异盒模型 */
box-sizing: border-box;

width: 200px;
padding: 10px;
border: 1px solid red;
```

### 9.3.2 resize 调整盒子大小

允许用户调整元素的大小。

```css
resize: none;       /* 不允许调整 */
resize: both;       /* 水平和垂直都可以 */
resize: horizontal; /* 只能调整宽度 */
resize: vertical;   /* 只能调整高度 */
```

**注意：** 需要配合 overflow: auto 使用。

### 9.3.3 box-shadow 盒子阴影

```css
/* 语法 */
box-shadow: h-shadow v-shadow blur spread color inset;

/* 示例 */
box-shadow: 10px 10px 10px 0px rgba(0, 0, 0, 0.3);
```

**参数说明：**
- h-shadow：水平阴影位置（必填）
- v-shadow：垂直阴影位置（必填）
- blur：模糊距离
- spread：阴影尺寸
- color：阴影颜色
- inset：是否内阴影

### 9.3.4 opacity 不透明度

```css
opacity: 0.5;  /* 0-1 之间的值 */
```

## 9.4 新增背景属性

### 9.4.1 background-origin（背景图原点）

```css
background-origin: padding-box;    /* 从内边距开始（默认） */
background-origin: border-box;      /* 从边框开始 */
background-origin: content-box;     /* 从内容区开始 */
```

### 9.4.2 background-clip（背景裁剪）

```css
background-clip: border-box;    /* 裁剪到边框（默认） */
background-clip: padding-box;    /* 裁剪到内边距 */
background-clip: content-box;    /* 裁剪到内容区 */
background-clip: text;           /* 裁剪到文字（需要 color: transparent） */
```

### 9.4.3 background-size（背景图尺寸）

```css
background-size: auto auto;      /* 保持原尺寸 */
background-size: 100px 200px;   /* 固定尺寸 */
background-size: 50% 50%;        /* 百分比 */
background-size: cover;          /* 覆盖，可能裁剪 */
background-size: contain;        /* 完整显示，可能留白 */
```

### 9.4.4 多背景图

```css
background: url('./bg1.png') left top no-repeat,
            url('./bg2.png') right bottom no-repeat;
```

## 9.5 新增边框属性

### 9.5.1 边框圆角

```css
/* 语法 */
border-radius: length|%;

/* 示例 */
border-radius: 10px;               /* 四个角 */
border-radius: 10px 20px;          /* 左上右下 10px，右上左下 20px */
border-radius: 50%;                /* 圆形 */
```

**单独设置各角：**

```css
border-top-left-radius: 10px;
border-top-right-radius: 10px;
border-bottom-right-radius: 10px;
border-bottom-left-radius: 10px;
```

### 9.5.2 边框外轮廓（了解）

```css
outline: width style color;
outline-offset: 10px;
```

## 9.6 新增文本属性

### 9.6.1 文本阴影

```css
/* 语法 */
text-shadow: h-shadow v-shadow blur color;

/* 示例 */
text-shadow: 2px 2px 4px red;
```

### 9.6.2 文本换行

```css
white-space: normal;      /* 正常换行 */
white-space: nowrap;      /* 不换行 */
white-space: pre;         /* 保留空白和换行 */
white-space: pre-wrap;    /* 保留空白，正常换行 */
white-space: pre-line;    /* 合并空白，保留换行 */
```

### 9.6.3 文本溢出

```css
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```

**多行文本溢出：**

```css
overflow: hidden;
text-overflow: ellipsis;
display: -webkit-box;
-webkit-line-clamp: 3;
-webkit-box-orient: vertical;
```

### 9.6.4 文本修饰（升级）

```css
text-decoration-line: underline;
text-decoration-color: red;
text-decoration-style: wavy;
text-decoration-thickness: 2px;
```

**复合写法：**

```css
text-decoration: underline wavy red 2px;
```

### 9.6.5 文本描边（仅 webkit 内核）

```css
-webkit-text-stroke: width color;
```

## 9.7 渐变

### 9.7.1 线性渐变

```css
/* 语法 */
background: linear-gradient(direction, color-stop1, color-stop2, ...);

/* 示例 */
background: linear-gradient(to right, red, blue);
background: linear-gradient(45deg, red, blue);
background: linear-gradient(to bottom, red 0%, blue 100%);
```

### 9.7.2 径向渐变

```css
/* 语法 */
background: radial-gradient(shape size at position, color-stop1, color-stop2, ...);

/* 示例 */
background: radial-gradient(circle, red, blue);
background: radial-gradient(ellipse at center, red 0%, blue 100%);
```

### 9.7.3 重复渐变

```css
background: repeating-linear-gradient(45deg, red 0px, red 10px, blue 10px, blue 20px);
```

## 9.8 Web字体

### 9.8.1 基本用法

```css
/* 定义字体 */
@font-face {
    font-family: "MyFont";
    src: url('./fonts/MyFont.woff2') format('woff2'),
         url('./fonts/MyFont.woff') format('woff');
    font-display: swap;
}

/* 使用字体 */
body {
    font-family: "MyFont", sans-serif;
}
```

### 9.8.2 字体图标

字体图标是使用字体文件显示的图标，具有矢量图形的优点。

**常用字体图标库：**
- Font Awesome
- IconFont（阿里巴巴）
- Ionicons

**使用步骤：**
1. 引入字体图标 CSS 文件
2. 使用对应的类名或 Unicode 字符

---