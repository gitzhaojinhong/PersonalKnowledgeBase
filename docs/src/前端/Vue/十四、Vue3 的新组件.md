<ClientOnly>

## 14.1 Teleport

`<Teleport>` 可以将组件渲染到 DOM 树任意位置，常用于模态框、弹窗等场景。

```vue
<template>
    <button @click="isShow = true">显示弹窗</button>
    <Teleport to="body">
        <div class="modal" v-show="isShow">
            <h2>我是弹窗的标题</h2>
            <p>我是弹窗的内容</p>
            <button @click="isShow = false">关闭弹窗</button>
        </div>
    </Teleport>
</template>
<script lang='ts' setup name="Modal">
    import { ref } from 'vue';

    let isShow = ref(false);
</script>
<style scoped>
.modal {
    width: 200px;
    height: 150px;
    background-color: skyblue;
    border-radius: 10px;
    text-align: center;
    position: fixed;
    left: 50%;
    top: 20px;
    margin-left: -100px;
}
</style>
```

## 14.2 Suspense

`<Suspense>` 用于处理异步组件的加载状态。

> **坑点注意：** 截至目前，`Suspense` 仍是一个**实验性功能**，生产环境中使用需谨慎，建议结合项目实际情况评估。

**子组件（异步加载）：**

```vue
<template>
    <div class="child">
        <h2>Child组件</h2>
        <img :src="imgUrl" alt="">
    </div>
</template>
<script lang='ts' setup name="Child">
    import axios from 'axios';

    let response = await axios.get('https://api.btstu.cn/sjbz/api.php?format=json');
    let imgUrl = response.data.imgurl;
</script>
```

**父组件使用 Suspense：**

```vue
<template>
    <div class="app">
        <h2>App组件</h2>
        <Suspense>
            <template v-slot:default>
                <Child/>
            </template>
            <template v-slot:fallback>
                <h4>图片正在加载，请稍后...</h4>
            </template>
        </Suspense>
    </div>
</template>
<script lang='ts' setup name="App">
    import Child from './components/Child.vue';
</script>
```

**注意：** 顶层 await 需要配合 Suspense 使用，否则组件可能无法渲染。如果不想用 Suspense，改用 onMounted 生命周期钩子发起请求。
</ClientOnly>