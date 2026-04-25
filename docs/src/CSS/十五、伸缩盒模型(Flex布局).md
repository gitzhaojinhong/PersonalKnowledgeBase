## 15.1 Flex布局简介

Flex 布局（Flexible Box）是一种一维布局模型，用于在一条线上排列元素。

**概念：**
- 主轴：Flex 容器默认水平排列，水平方向为主轴
- 侧轴：与主轴垂直的方向为侧轴
- Flex 项目：Flex 容器的子元素

## 15.2 父元素属性

### 15.2.1 display: flex

开启 Flex 布局。

```css
.container {
    display: flex;
}
```

### 15.2.2 flex-direction

设置主轴方向。

```css
flex-direction: row;               /* 默认，水平从左到右 */
flex-direction: row-reverse;         /* 水平从右到左 */
flex-direction: column;             /* 垂直从上到下 */
flex-direction: column-reverse;      /* 垂直从下到上 */
```

### 15.2.3 flex-wrap

设置是否换行。

```css
flex-wrap: nowrap;      /* 默认，不换行 */
flex-wrap: wrap;        /* 换行 */
flex-wrap: wrap-reverse; /* 反向换行 */
```

### 15.2.4 justify-content

设置主轴上的对齐方式。

```css
justify-content: flex-start;     /* 默认，从起点排列 */
justify-content: flex-end;         /* 从终点排列 */
justify-content: center;           /* 居中对齐 */
justify-content: space-between;    /* 两端对齐，间距平分 */
justify-content: space-around;     /* 两侧间距是中间间距的一半 */
justify-content: space-evenly;     /* 所有间距相等 */
```

### 15.2.5 align-items

设置侧轴上的对齐方式（单行）。

```css
align-items: flex-start;     /* 从起点排列 */
align-items: flex-end;         /* 从终点排列 */
align-items: center;           /* 居中对齐 */
align-items: baseline;         /* 基线对齐 */
align-items: stretch;          /* 默认，拉伸占满容器（不设置高度时） */
```

### 15.2.6 align-content

设置侧轴上的对齐方式（多行）。

```css
align-content: flex-start;     /* 从起点排列 */
align-content: flex-end;         /* 从终点排列 */
align-content: center;           /* 居中对齐 */
align-content: space-between;    /* 两端对齐 */
align-content: space-around;    /* 两侧间距是中间间距的一半 */
align-content: space-evenly;   /* 所有间距相等 */
align-content: stretch;         /* 默认，拉伸占满容器 */
```

### 15.2.7 flex-flow 复合属性

```css
/* 语法 */
flex-flow: flex-direction flex-wrap;

/* 示例 */
flex-flow: row wrap;
```

## 15.3 子元素属性

### 15.3.1 flex-grow

设置项目的放大比例。

```css
flex-grow: 0;     /* 默认，不放大 */
flex-grow: 1;     /* 放大占满剩余空间 */
```

**注意：** 所有项目 flex-grow 之和大于 1 时，按比例分配剩余空间。

### 15.3.2 flex-shrink

设置项目的缩小比例。

```css
flex-shrink: 1;     /* 默认，等比例缩小 */
flex-shrink: 0;      /* 不缩小 */
```

### 15.3.3 flex-basis

设置项目在主轴上的初始大小。

```css
flex-basis: 100px;  /* 初始宽度 100px */
flex-basis: auto;    /* 默认，由内容决定 */
```

### 15.3.4 flex 复合属性

```css
/* 语法 */
flex: flex-grow flex-shrink flex-basis;

/* 示例 */
flex: 1;              /* flex: 1 1 0% */
flex: 1 0 100px;      /* 明确指定三个值 */

/* 常用写法 */
flex: 1;              /* 只有一个数值，表示 flex-grow */
flex: 100px;          /* 只有一个长度值，表示 flex-basis */
```

### 15.3.5 align-self

单独设置某个项目在侧轴上的对齐方式。

```css
align-self: flex-start;     /* 从起点排列 */
align-self: flex-end;        /* 从终点排列 */
align-self: center;          /* 居中对齐 */
align-self: baseline;       /* 基线对齐 */
align-self: stretch;        /* 拉伸占满容器 */
```

### 15.3.6 order

设置项目的排列顺序。

```css
order: 0;     /* 默认，order 越小越靠前 */
order: 1;     /* 排在 order 为 0 的项目后面 */
order: -1;    /* 排在 order 为 0 的项目前面 */
```

## 15.4 Flex布局应用

### 15.4.1 水平居中

```css
.container {
    display: flex;
    justify-content: center;
}
```

### 15.4.2 垂直居中

```css
.container {
    display: flex;
    align-items: center;
}
```

### 15.4.3 水平垂直居中

```css
.container {
    display: flex;
    justify-content: center;
    align-items: center;
}
```

### 15.4.4 Sticky Footer 布局

让页面内容不满一屏时，footer 固定在底部。

```css
body {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}
.main {
    flex: 1;
}
```

---