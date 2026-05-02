# 十一、状态管理（Pinia）

> **什么时候使用 Pinia？当数据需要在多个不相关的组件间共享时。**
>
> **Hooks 是代码的组织方式（怎么做逻辑），Pinia 是状态的存储方案（在哪存数据）。**

## 11.1 Pinia 概述

Pinia 是 Vue 3 的状态（数据）管理库，是 Vue 官方推荐的状态管理解决方案。

**官网地址：** [https://pinia.vuejs.org/](https://pinia.vuejs.org/)

**为什么需要 Pinia？**

假设你开发一个购物网站，有以下功能：
- 购物车（需要记录商品）
- 用户登录（需要保存用户名）
- 商品库存（需要实时更新）

如果不用 Pinia，你的数据可能分散在各个组件里，导致：
- 数据共享困难（需要 props/emit 层层传递）
- 数据不一致（多个组件同时修改可能互相覆盖）

**Pinia 就像一个公共仓库，所有组件都能直接从这里读/写数据！**

**集中式管理的优势：**
- 数据共享简单：所有组件直接访问同一个仓库
- 数据一致性：数据更新后，所有用到它的组件会自动同步
- 维护方便：所有逻辑集中在仓库里

## 11.2 计数器演示 Pinia 基础用法

### 11.2.1 项目结构

```plain
src/
├── store/
│   └── Count.ts
├── components/
│   └── Count.vue
├── App.vue
└── main.ts
```

### 11.2.2 安装 Pinia

```bash
npm i pinia
```

### 11.2.3 在 main.ts 中使用 Pinia

```typescript
import { createApp } from "vue";
import App from "./App.vue";
import { createPinia } from "pinia";

const app = createApp(App);
const pinia = createPinia();
app.use(pinia);
app.mount('#app');
```

### 11.2.4 创建 Store

`src/store/Count.ts`：

```typescript
import { defineStore } from "pinia";

export const useCountStore = defineStore('count', {
    state(){
        return {
            count: 1,
            n: 1
        };
    },
    actions: {
        add(){
            this.count += this.n;
        },
        minus(){
            this.count -= this.n;
        }
    }
});
```

### 11.2.5 在组件中使用 Store

`src/components/Count.vue`：

```vue
<template>
    <div class="count">
        <h1>Counter: {{ countStore.count }}</h1>
        <select v-model.number="countStore.n">
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
        </select>
        <button @click="add">+</button>
        <button @click="minus">-</button>
    </div>
</template>
<script lang='ts' setup name="Count">
    import { useCountStore } from '../store/Count';

    let countStore = useCountStore();

    function add(){
        countStore.add();
    }
    function minus(){
        countStore.minus();
    }
</script>
<style scoped>
.count {
    background-color: skyblue;
    padding: 10px;
    border-radius: 10px;
}
</style>
```

## 11.3 修改数据的几种方式

### 11.3.1 直接修改

```typescript
countStore.count += countStore.n;
```

### 11.3.2 $patch 批量修改

```typescript
countStore.$patch({
    count: countStore.count + countStore.n,
});
```

### 11.3.3 通过 actions 修改（推荐）

在 store 中定义 actions：

```typescript
actions: {
    add(){
        this.count += this.n;
    },
    minus(){
        this.count -= this.n;
    }
}
```

## 11.4 storeToRefs

使用 `storeToRefs` 可以将 store 中的数据转换为 ref 对象，方便在模板中使用：

```vue
<script lang='ts' setup name="Count">
    import { storeToRefs } from 'pinia';
    import { useCountStore } from '../store/Count';

    let countStore = useCountStore();
    let {count, n} = storeToRefs(countStore);

    function add(){
        countStore.add();
    }
    function minus(){
        countStore.minus();
    }
</script>
```

**注意：** `pinia` 提供的 `storeToRefs` 只会将数据做转换，而 `Vue` 的 `toRefs` 会转换 store 中所有的数据和方法。

## 11.5 getters

当 state 中的数据需要经过加工之后再显示，可以使用 getters：

```typescript
import { defineStore } from "pinia";

export const useCountStore = defineStore('count', {
    state(){
        return {
            count: 1,
            n: 1
        };
    },
    actions: {
        add(){
            this.count += this.n;
        },
        minus(){
            this.count -= this.n;
        }
    },
    getters: {
        // 普通函数写法
        bigCount(): number{
            return this.count * 10;
        },
        // 箭头函数写法
        // bigCount: state => state.count * 10
    }
});
```

在组件中使用 getters：

```vue
<script lang='ts' setup name="Count">
    import { storeToRefs } from 'pinia';
    import { useCountStore } from '../store/Count';

    let countStore = useCountStore();
    let {count, n, bigCount} = storeToRefs(countStore);
</script>
<h1>10x Counter: {{ bigCount }}</h1>
```

## 11.6 $subscribe 订阅状态变化

`$subscribe` 方法用于订阅 store 状态变化：

```typescript
countStore.$subscribe((mutate, state) => {
    console.log("包含变更信息的对象", mutate);
    console.log("变更后的新状态", state);
    // 可以将数据保存到 localStorage
    localStorage.setItem('count', JSON.stringify(state));
});
```

## 11.7 毒鸡汤案例演示 Pinia

本节通过一个"毒鸡汤"案例演示 Pinia 的实际应用，包含完整的 Store 创建、数据读取、异步请求处理和 localStorage 持久化。

**前置知识：**

- 安装 `nanoid` 用于生成唯一 id：`npm install nanoid`
- 接口地址：`https://api.shadiao.pro/du`
- **连续解构赋值+重命名语法**：

```typescript
// 冒号的作用是赋值，不是重命名
let { username: uname } = person;
// 等价于
let uname = person.username;

// 连续解构 + 重命名
let { data: { data: { text: content } } } = response;
// 等价于
let content = response.data.data.text;
```

**项目结构：**

```plain
src/
├── store/
│   └── Du.ts
├── components/
│   └── Du.vue
├── App.vue
└── main.ts
```

**第一步：创建 Store（`src/store/Du.ts`）**

```typescript
import { defineStore } from "pinia";
import { reactive } from "vue";
import axios from "axios";
import { nanoid } from "nanoid";

export const useDuStore = defineStore("du", () => {
    // 初始数据
    let duList = reactive([
        { id: 'id001', content: '过年哪个亲戚问我成绩，我就问他年终奖金。' },
        { id: 'id002', content: '间歇性洗心革面，持续性混吃等死。' },
        { id: 'id003', content: '路遥知马力不足，日久见人心叵测。' }
    ]);

    // 异步获取毒鸡汤
    async function getDu() {
        let response = await axios.get("https://api.shadiao.pro/du");
        // 连续解构赋值 + 重命名
        let { data: { data: { text: content } } } = response;
        duList.unshift({ id: nanoid(), content });
    }

    return { duList, getDu };
});
```

**第二步：组件中使用（`src/components/Du.vue`）**

```vue
<template>
    <div class="du">
        <button @click="getDu">获取毒鸡汤</button>
        <ul>
            <li v-for="(du, index) in duStore.duList" :key="du.id">
                {{ index + 1 }} - {{ du.content }}
            </li>
        </ul>
    </div>
</template>

<script lang='ts' setup>
    import { useDuStore } from '../store/Du';
    const duStore = useDuStore();
    function getDu() {
        duStore.getDu();
    }
</script>

<style scoped>
.du {
    background-color: rgb(171, 214, 129);
    border-radius: 10px;
    padding: 10px;
}
</style>
```

**第三步：使用 $subscribe 实现 localStorage 持久化**

页面加载时从 localStorage 读取毒鸡汤列表，列表变化时自动保存：

```typescript
import { defineStore } from "pinia";
import { reactive } from "vue";
import axios from "axios";
import { nanoid } from "nanoid";

export const useDuStore = defineStore("du", () => {
    // 初始化时从 localStorage 读取，|| [] 为默认值
    let duList = reactive(
        JSON.parse(localStorage.getItem("duList") as string) || []
    );

    async function getDu() {
        let response = await axios.get("https://api.shadiao.pro/du");
        let { data: { data: { text: content } } } = response;
        duList.unshift({ id: nanoid(), content });
    }

    return { duList, getDu };
});
```

```typescript
// 在组件 script setup 中：
const duStore = useDuStore();
function getDu() {
    duStore.getDu();
}

// 订阅仓库数据变化，数据更新时自动同步到 localStorage
duStore.$subscribe((mutate, state) => {
    localStorage.setItem("duList", JSON.stringify(duStore.duList));
});
```

## 11.8 Store 的组合式写法（推荐）

```typescript
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export const useCountStore = defineStore("count", () => {
    // state 对应响应式数据
    let count = ref(1);
    let n = ref(1);

    // actions 对应方法
    function add(){
        count.value += n.value;
    }
    function minus(){
        count.value -= n.value;
    }

    // getters 对应计算属性
    let bigCount = computed(() => {
        return count.value * 10;
    });

    return {count, n, add, minus, bigCount};
});
```

## 11.9 购物车案例

### 11.9.1 项目结构

```plain
src/
├── stores/
│   └── cart.ts
├── components/
│   ├── ProductList.vue
│   └── ShoppingCart.vue
├── App.vue
└── main.ts
```

### 11.9.2 创建 Pinia Store

`src/stores/cart.ts`：

```typescript
import { defineStore } from 'pinia'

interface Product {
    id: number
    name: string
    price: number
}

interface CartItem extends Product {
    quantity: number
}

export const useCartStore = defineStore('cart', {
    state: () => ({
        items: [] as CartItem[],
        products: [
            { id: 1, name: '笔记本电脑', price: 7999 },
            { id: 2, name: '智能手机', price: 3999 },
            { id: 3, name: '无线耳机', price: 599 },
        ] as Product[],
    }),
    getters: {
        totalPrice: (state) => {
            return state.items.reduce((total, item) => total + item.price * item.quantity, 0)
        },
        totalItems: (state) => {
            return state.items.reduce((total, item) => total + item.quantity, 0)
        },
    },
    actions: {
        addToCart(productId: number) {
            const product = this.products.find(p => p.id === productId)
            if (!product) return

            const existingItem = this.items.find(item => item.id === productId)
            if (existingItem) {
                existingItem.quantity++
            } else {
                this.items.push({ ...product, quantity: 1 })
            }
        },
        removeFromCart(productId: number) {
            const itemIndex = this.items.findIndex(item => item.id === productId)
            if (itemIndex > -1) {
                const item = this.items[itemIndex]
                if (item.quantity > 1) {
                    item.quantity--
                } else {
                    this.items.splice(itemIndex, 1)
                }
            }
        },
        clearCart() {
            this.items = []
        },
    },
})
```

### 11.9.3 商品列表组件

`src/components/ProductList.vue`：

```vue
<template>
    <div class="product-list">
        <h2>商品列表</h2>
        <ul>
            <li v-for="product in products" :key="product.id">
                {{ product.name }} - ¥{{ product.price }}
                <button @click="addToCart(product.id)">加入购物车</button>
            </li>
        </ul>
    </div>
</template>
<script setup lang="ts">
import { useCartStore } from '../stores/cart.ts'
import { storeToRefs } from 'pinia'

const cartStore = useCartStore()
const { products } = storeToRefs(cartStore)

const addToCart = (productId: number) => {
    cartStore.addToCart(productId)
}
</script>
```

### 11.9.4 购物车组件

`src/components/ShoppingCart.vue`：

```vue
<template>
    <div class="shopping-cart">
        <h2>购物车 ({{ totalItems }}件)</h2>
        <p v-if="items.length === 0">购物车为空</p>
        <ul v-else>
            <li v-for="item in items" :key="item.id">
                {{ item.name }} × {{ item.quantity }} - ¥{{ item.price * item.quantity }}
                <button @click="removeFromCart(item.id)">移除</button>
            </li>
        </ul>
        <p v-if="items.length > 0">总价: ¥{{ totalPrice }}</p>
        <button v-if="items.length > 0" @click="clearCart">清空购物车</button>
    </div>
</template>
<script setup lang="ts">
import { useCartStore } from '../stores/cart.ts'
import { storeToRefs } from 'pinia'

const cartStore = useCartStore()
const { items, totalPrice, totalItems } = storeToRefs(cartStore)

const removeFromCart = (productId: number) => {
    cartStore.removeFromCart(productId)
}

const clearCart = () => {
    cartStore.clearCart()
}
</script>
```

### 11.9.5 主应用组件

`src/App.vue`：

```vue
<template>
    <div class="app">
        <h1>Pinia 购物车示例</h1>
        <div class="container">
            <ProductList />
            <ShoppingCart />
        </div>
    </div>
</template>
<script setup lang="ts">
import ProductList from './components/ProductList.vue'
import ShoppingCart from './components/ShoppingCart.vue'
</script>
<style>
.app {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}
.container {
    display: flex;
    gap: 20px;
}
.container > * {
    flex: 1;
}
</style>
```

### 11.9.6 Pinia 优势总结

1. **集中式状态管理**：购物车状态和逻辑集中在一个 store 中
2. **类型安全**：使用 TypeScript 定义了接口，所有方法都有明确的类型
3. **响应式**：组件会自动响应 store 中状态的变化
4. **模块化**：购物车逻辑与组件分离，易于维护和测试
5. **Devtools 支持**：Pinia 与 Vue Devtools 集成，方便调试
