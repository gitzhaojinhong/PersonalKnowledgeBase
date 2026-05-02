## 5.1 长度单位

| 单位 | 说明 |
|------|------|
| px | 像素，最常用的单位 |
| em | 相对于当前元素的字体大小 |
| rem | 相对于根元素的字体大小 |
| vw | 相对于视口宽度的 1% |
| vh | 相对于视口高度的 1% |

## 5.2 显示模式

### 5.2.1 块级元素（block）

- 独占一行（宽度默认 100%）
- 可以设置宽高和所有盒子模型属性
- 默认display属性：block

**常见块级元素：** div、p、h1-h6、ul、li、table、form 等

### 5.2.2 行内元素（inline）

- 不独占一行，一行放不下时才会换行
- 不可以设置宽高
- 默认display属性：inline

**常见行内元素：** span、a、em、i、strong、b 等

### 5.2.3 行内块元素（inline-block）

- 不独占一行，但可以设置宽高
- 默认display属性：inline-block

**常见行内块元素：** img、input、button、textarea、select 等

### 5.2.4 元素显示模式转换

```css
display: block;        /* 转换为块级元素 */
display: inline;       /* 转换为行内元素 */
display: inline-block; /* 转换为行内块元素 */
```

## 5.3 盒子组成部分

所有 HTML 元素都可以看作是一个盒子，由以下几部分组成：

- **content（内容区）：** 元素中的子元素和文本内容
- **padding（内边距）：** 内容区到边框之间的距离
- **border（边框）：** 元素边框
- **margin（外边距）：** 元素边框外空白区域

**盒子实际尺寸 = content + padding + border**

## 5.4 盒子模型相关属性

### 5.4.1 内边距（padding）

设置内容区到边框之间的距离。

```css
/* 单独设置各方向 */
padding-top: 10px;
padding-right: 10px;
padding-bottom: 10px;
padding-left: 10px;

/* 复合写法 */
padding: 10px;              /* 四个方向都是 10px */
padding: 10px 20px;         /* 上下 10px，左右 20px */
padding: 10px 20px 30px;    /* 上 10px，左右 20px，下 30px */
padding: 10px 20px 30px 40px; /* 上右下左，顺时针 */
```

### 5.4.2 边框（border）

```css
/* 语法 */
border: border-width border-style border-color;

/* 示例 */
border: 1px solid red;

/* 单独设置各方向 */
border-top: 1px solid red;
border-right: 1px solid red;
border-bottom: 1px solid red;
border-left: 1px solid red;
```

**边框样式（border-style）：**
- solid：实线
- dashed：虚线
- dotted：点线
- double：双线
- groove：沟槽
- ridge：山脊

**边框相关属性：**

```css
/* 边框宽度 */
border-width: 1px;

/* 边框颜色 */
border-color: red;

/* 边框方向（top/right/bottom/left） */
border-top-width: 1px;
border-top-color: red;
border-top-style: solid;
```

### 5.4.3 外边距（margin）

设置元素边框外的空白区域。

```css
/* 单独设置各方向 */
margin-top: 10px;
margin-right: 10px;
margin-bottom: 10px;
margin-left: 10px;

/* 复合写法 */
margin: 10px;              /* 四个方向都是 10px */
margin: 10px 20px;         /* 上下 10px，左右 20px */
margin: 10px 20px 30px;    /* 上 10px，左右 20px，下 30px */
margin: 10px 20px 30px 40px; /* 上右下左，顺时针 */
```

**外边距折叠：**
- **垂直方向：** 两个元素的外边距会合并，取最大值
- **水平方向：** 外边距不会合并
- **嵌套塌陷：** 子元素的外边距会传递给父元素（可以使用 BFC 或 padding 解决）

### 5.4.4 清除浏览器默认样式

```css
* {
    margin: 0;
    padding: 0;
}
```

## 5.5 溢出处理

### 5.5.1 overflow 属性

控制内容超出元素范围时的显示方式。

```css
overflow: visible;    /* 默认，显示超出内容 */
overflow: hidden;     /* 隐藏超出内容 */
overflow: scroll;     /* 显示滚动条（始终显示） */
overflow: auto;       /* 自动显示滚动条（必要时显示） */
```

**overflow-x 和 overflow-y：**
```css
overflow-x: auto;
overflow-y: hidden;
```

### 5.5.2 文本溢出

**单行文本溢出：**

```css
white-space: nowrap;          /* 强制不换行 */
overflow: hidden;            /* 隐藏超出内容 */
text-overflow: ellipsis;     /* 显示省略号 */
```

**多行文本溢出（仅支持 WebKit 内核）：**

```css
overflow: hidden;
text-overflow: ellipsis;
display: -webkit-box;
-webkit-line-clamp: 3;       /* 显示行数 */
-webkit-box-orient: vertical;
```

## 5.6 隐藏元素

### 5.6.1 display: none

完全隐藏元素，不占位置。

```css
display: none;
```

### 5.6.2 visibility: hidden

隐藏元素，但仍然占位置。

```css
visibility: hidden;
```

### 5.6.3 opacity: 0

设置透明度为 0，隐藏元素，但仍然占位置。

```css
opacity: 0;
```

## 5.7 元素可见性

```css
visibility: visible;   /* 默认，可见 */
visibility: hidden;    /* 隐藏，占位置 */
visibility: collapse;  /* 隐藏（用于表格） */
```

---