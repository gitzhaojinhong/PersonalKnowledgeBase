# 三、第一个 vue 程序

## 3.1 分析入口文件

将自动生成的 Vue3 工程中 `src` 目录下的内容全部删除，从零开始手动编写。

项目根目录下的 `index.html` 是入口文件：

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + Vue + TS</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

关键点：

1. `id='app'` 的 div 容器：Vue 最终渲染的结果会放到该 div 中
2. `<script>` 引入了 `/src/main.ts`：程序入口从该文件开始

## 3.2 编写 main.ts

在 `src` 目录下新建 `main.ts` 文件：

```typescript
// 引入 createApp 函数
import { createApp } from 'vue';

// 引入根组件 App
import App from './App.vue';

// 将 App 根组件交给 createApp 创建应用，并挂载到 id='app' 的元素上
createApp(App).mount('#app');
```

## 3.3 编写 App.vue

在 `src` 目录下新建 `App.vue` 文件：

```vue
<template>
  <!-- html：组件结构 -->
  <div class="hello">
    <h1>hello vue3!</h1>
  </div>
</template>

<!-- scoped 表示该样式为局部样式，只对当前组件有效 -->
<style scoped>
  .hello {
    background-color: #b5f0ee;
    box-shadow: 0 0 15px;
    border-radius: 15px;
    padding: 15px;
  }
</style>

<script>
  // 对外暴露组件（默认导出）
  export default {
    name: 'MyApp'  // 用于在 DevTools 显示组件名称，方便调试
  }
</script>
```

## 3.4 启动测试

```bash
npm run dev
```

打开浏览器访问 `http://localhost:5173/`，即可看到渲染结果。
