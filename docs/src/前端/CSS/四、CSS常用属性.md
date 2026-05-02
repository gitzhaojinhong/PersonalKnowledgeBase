## 4.1 颜色表示

### 4.1.1 颜色名

使用英文单词表示颜色。

```css
color: red;
color: blue;
```

### 4.1.2 rgb 或 rgba

使用红、绿、蓝三原色表示颜色。

```css
/* 语法 */
color: rgb(red, green, blue);
color: rgba(red, green, blue, alpha);

/* 示例 */
color: rgb(255, 0, 0);           /* 红色 */
color: rgb(0, 255, 0);           /* 绿色 */
color: rgb(0, 0, 255);           /* 蓝色 */
color: rgba(0, 0, 0, 0.5);       /* 黑色半透明 */
```

**参数说明：**
- red、green、blue：0-255 之间的整数
- alpha：0-1 之间的小数，表示透明度

### 4.1.3 HEX 或 HEXA（十六进制）

使用十六进制表示颜色。

```css
/* 语法 */
color: #RRGGBB;
color: #RRGGBBAA;

/* 示例 */
color: #ff0000;           /* 红色 */
color: #0000ff;           /* 蓝色 */
color: #00000080;         /* 半透明黑色 */
```

**简写规则：** 每两位相同可以简写为一位，如 `#ff0000` 简写为 `#f00`。

### 4.1.4 HSL 或 HSLA

使用色相、饱和度、亮度表示颜色。

```css
/* 语法 */
color: hsl(hue, saturation, lightness);
color: hsla(hue, saturation, lightness, alpha);

/* 示例 */
color: hsl(0, 100%, 50%);           /* 红色 */
color: hsla(0, 100%, 50%, 0.5);     /* 半透明红色 */
```

**参数说明：**
- hue：0-360 之间的色轮角度
- saturation：0%-100% 之间的饱和度
- lightness：0%-100% 之间的亮度
- alpha：0-1 之间的透明度

## 4.2 字体属性

### 4.2.1 字体大小

```css
font-size: 16px;
```

**常用单位：** px（像素）

### 4.2.2 字体族

```css
font-family: "Microsoft YaHei", "Times New Roman", serif;
```

**说明：**
- 建议使用双词组成的中文字体放在最前面
- 可以设置多个字体，用逗号分隔，从左到右依次查找，找不到则使用下一个
- serif 和 sans-serif 称为字体族，表示"有衬线"和"无衬线"

### 4.2.3 字体风格

```css
font-style: normal;     /* 正常 */
font-style: italic;      /* 斜体 */
font-style: oblique;     /* 倾斜（不常用） */
```

### 4.2.4 字体粗细

```css
font-weight: normal;    /* 正常（400） */
font-weight: bold;      /* 加粗（700） */
font-weight: lighter;   /* 更细 */
font-weight: 100-900;   /* 数值 */
```

**注意：** 数值必须是 100 的整数倍。

### 4.2.5 字体复合写法

将多个字体属性合并成一个简写属性。

```css
/* 语法 */
font: font-style font-weight font-size/line-height font-family;

/* 示例 */
font: italic bold 20px "Microsoft YaHei", sans-serif;
```

**注意：** 字体复合写法中 font-size 和 font-family 是必须的两个属性，其他省略时会有默认值。

## 4.3 文本属性

### 4.3.1 文本颜色

```css
color: red;
color: #f00;
color: rgb(255, 0, 0);
```

### 4.3.2 文本间距

- **letter-spacing：** 字间距
- **word-spacing：** 词间距（针对英文）

```css
letter-spacing: 10px;
word-spacing: 10px;
```

### 4.3.3 文本修饰

```css
text-decoration: none;           /* 无装饰线 */
text-decoration: underline;      /* 下划线 */
text-decoration: overline;       /* 上划线 */
text-decoration: line-through;    /* 删除线 */
```

### 4.3.4 文本缩进

```css
text-indent: 32px;                /* 缩进两个字符 */
text-indent: 2em;                /* 缩进两个字符 */
```

### 4.3.5 文本对齐（水平）

```css
text-align: left;     /* 左对齐 */
text-align: center;   /* 居中对齐 */
text-align: right;    /* 右对齐 */
```

### 4.3.6 行高

```css
line-height: 1.5;      /* 相对于字体大小 */
line-height: 30px;    /* 固定值 */
```

**应用：** 让单行文本垂直居中，可以将 line-height 设置为与 height 相同的值。

### 4.3.7 文本对齐（垂直）

- 顶部：无需处理，随着字体越大默认越靠上
- 垂直居中：让 line-height = height
- 底部：无需处理

### 4.3.8 vertical-align

设置元素在垂直方向上的对齐方式。

```css
vertical-align: baseline;    /* 默认，基线对齐 */
vertical-align: top;          /* 顶部对齐 */
vertical-align: middle;       /* 中部对齐 */
vertical-align: bottom;       /* 底部对齐 */
```

**应用场景：** 解决图片与文字底部对齐问题。

## 4.4 列表属性

### 4.4.1 list-style-type

设置列表前的标记样式。

```css
list-style-type: disc;        /* 实心圆点 */
list-style-type: circle;       /* 空心圆点 */
list-style-type: square;       /* 实心方块 */
list-style-type: decimal;       /* 数字 */
list-style-type: none;          /* 无标记 */
```

### 4.4.2 list-style-image

使用图片作为列表前标记。

```css
list-style-image: url('./li.png');
```

### 4.4.3 list-style-position

设置标记位置。

```css
list-style-position: outside;    /* 默认，标记在内容区外 */
list-style-position: inside;      /* 标记在内容区内 */
```

### 4.4.4 list-style 复合写法

```css
list-style: square inside url('./li.png');
```

## 4.5 表格属性

### 4.5.1 边框相关属性

```css
table {
    border-collapse: collapse;   /* 合并相邻边框 */
    border-spacing: 10px;        /* 边框间距 */
}
```

### 4.5.2 表格特有属性

```css
table {
    width: 300px;
    height: 300px;
    table-layout: auto;          /* 自动布局 */
    table-layout: fixed;         /* 固定布局 */
    border-collapse: collapse;
}
```

**auto 和 fixed 的区别：**
- auto：列宽由内容决定，内容越长列越宽
- fixed：列宽由首行决定，不考虑内容

### 4.5.3 单元格对齐

```css
td {
    text-align: center;          /* 水平居中 */
    vertical-align: middle;      /* 垂直居中 */
}
```

## 4.6 背景属性

### 4.6.1 背景颜色

```css
background-color: red;
```

### 4.6.2 背景图片

```css
background-image: url('./bg.png');
```

**注意：** 如果图片尺寸小于元素，会重复平铺。

### 4.6.3 背景平铺

```css
background-repeat: repeat;       /* 默认，水平和垂直都平铺 */
background-repeat: repeat-x;     /* 只在水平方向平铺 */
background-repeat: repeat-y;     /* 只在垂直方向平铺 */
background-repeat: no-repeat;    /* 不平铺 */
```

### 4.6.4 背景位置

```css
background-position: x y;

/* 具体值 */
background-position: 100px 200px;

/* 关键字 */
background-position: left top;
background-position: center center;
background-position: right bottom;
```

### 4.6.5 背景固定（背景附着）

```css
background-attachment: scroll;   /* 默认，随内容滚动 */
background-attachment: fixed;    /* 固定，不随内容滚动 */
```

### 4.6.6 背景复合写法

```css
background: color url() repeat attachment position;
```

### 4.6.7 背景尺寸

```css
background-size: auto auto;      /* 默认，保持原尺寸 */
background-size: 100px 200px;    /* 固定尺寸 */
background-size: 50% 50%;        /* 百分比 */
background-size: cover;           /* 覆盖整个容器，可能裁剪 */
background-size: contain;         /* 完整显示图片，可能留白 */
```

### 4.6.8 多背景图

```css
background: url('./bg1.png') left top no-repeat,
            url('./bg2.png') right bottom no-repeat;
```

## 4.7 鼠标属性

### 4.7.1 cursor

设置鼠标悬停在元素上时的鼠标样式。

```css
cursor: pointer;       /* 小手 */
cursor: move;          /* 移动 */
cursor: text;          /* 文本 */
cursor: not-allowed;   /* 禁止 */
cursor: default;       /* 默认 */
cursor: wait;          /* 等待 */
cursor: help;          /* 帮助 */
```

---