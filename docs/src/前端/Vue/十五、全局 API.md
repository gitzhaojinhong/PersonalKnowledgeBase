<ClientOnly>

## 15.1 app.component()

注册全局组件，使用时不需要手动引入。

```typescript
import { createApp } from "vue";
import App from "./App.vue";
import LoginInfo from "./LoginInfo.vue";

const app = createApp(App);
app.component('LoginInfo', LoginInfo);
app.mount('#app');
```

在任意组件中直接使用：

```vue
<template>
    <div class="app">
        <LoginInfo/>  <!-- 无需 import -->
    </div>
</template>
```

## 15.2 app.config.errorHandler

全局错误处理，捕获应用中的未处理异常。

```typescript
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);

app.config.errorHandler = (err, vm, info) => {
    console.error('全局捕获的错误:', err);
    console.log('发生错误的组件:', vm);
    console.log('错误来源:', info);
    alert('发生错误，请稍后重试！');
};

app.mount('#app');
```

## 15.3 app.config.globalProperties

定义全局属性，在所有组件中都可以访问。

```typescript
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);
app.config.globalProperties.globalName = '极课未来';

declare module 'vue' {
    interface ComponentCustomProperties {
        globalName: string
    }
}

app.mount('#app');
```

## 15.4 app.directive()

注册全局自定义指令。

```typescript
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);

app.directive('filter', (element, {value}) => {
    element.style.filter = `saturate(${value}%)`;
});

app.mount('#app');
```

使用自定义指令：

```vue
<template>
    <img v-filter="80" src="xxx.jpg" alt="">
</template>
```

## 15.5 app.mount() 与 app.unmount()

```typescript
import { createApp } from "vue";
import App from "./App.vue";

const app = createApp(App);
app.mount('#app');

// 3秒后卸载
setTimeout(() => {
    app.unmount();
}, 3000);
```

## 15.6 app.use()

安装插件，如 Pinia、Vue Router 等。

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```
</ClientOnly>