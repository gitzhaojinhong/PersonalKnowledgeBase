## 17.1 BFC简介

BFC（Block Formatting Context）即块级格式化上下文，是一个独立的渲染区域。

## 17.2 触发BFC的条件

以下任一条件都可以触发 BFC：

1. 根元素（html）
2. float 不为 none
3. position 为 absolute 或 fixed
4. display 为 inline-block、table-cell、table-caption
5. overflow 不为 visible（常用 overflow: hidden）
6. flex 或 grid 布局的子元素

## 17.3 BFC的特性

1. BFC 内部的子元素在垂直方向上依次排列
2. 垂直方向的距离由 margin 决定，相邻 BFC 之间的 margin 会重叠
3. BFC 内的子元素不会影响外面的元素
4. BFC 的区域会与浮动元素重叠
5. 计算 BFC 高度时，浮动元素也会参与计算

## 17.4 BFC的应用

### 17.4.1 解决外边距重叠

当两个元素的上下 margin 重叠时，可以用 BFC 解决。

```html
<div class="container">
    <div class="box1">box1</div>
    <div class="box2">box2</div>
</div>
```

```css
.container {
    overflow: hidden;  /* 触发 BFC，margin 不重叠 */
}
.box1 {
    margin-bottom: 20px;
}
.box2 {
    margin-top: 30px;
}
```

### 17.4.2 解决父元素高度塌陷

```css
.father {
    overflow: hidden;  /* 触发 BFC，浮动元素也参与高度计算 */
}
```

### 17.4.3 实现两栏布局

```css
.left {
    float: left;
    width: 200px;
}
.right {
    overflow: hidden;  /* 触发 BFC，与浮动元素不重叠 */
}
```

### 17.4.4 清除浮动

```css
.clearfix {
    overflow: hidden;  /* 触发 BFC，清除浮动影响 */
}
```