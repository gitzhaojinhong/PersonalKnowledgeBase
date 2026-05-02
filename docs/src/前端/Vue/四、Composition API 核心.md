# 四、Composition API 核心

## 4.1 选项式 API vs 组合式 API

### 4.1.1 类比说明

**选项式 API — 传统厨房（东西都分类放，但做一道菜要跑多个地方）**

```plain
冰箱（data区）：鸡蛋、番茄（番茄炒蛋需要）+ 肉、蔬菜（其他菜需要）
厨具柜（methods区）：炒锅、菜刀（番茄炒蛋需要）+ 蒸锅、烤箱（其他菜需要）
调料架（computed区）：盐、糖（番茄炒蛋需要）+ 酱油（其他菜需要）

问题：做番茄炒蛋要来回跑三个地方！
```

**组合式 API — 现代厨房（按用途打包）**

```plain
【番茄炒蛋套餐包】：鸡蛋 + 番茄 + 炒锅 + 菜刀 + 盐、糖（所有需要的全在一包里）
【红烧肉套餐包】：肉 + 炒锅 + 酱油、糖

优点：做番茄炒蛋时，打开"番茄炒蛋套餐包"，里面什么都有！
```

### 4.1.2 代码对比

**选项式 API 代码风格（所有业务的数据/方法/计算属性混在一起）：**

```vue
<!-- 选项式 API：data、methods、computed 各自放一处 -->
组件 = {
  data() {
    return {
      // 业务1：用户登录数据
      用户名: '', 密码: '', 是否登录: false, 用户信息: null,
      // 业务2：购物车数据
      购物车商品: [], 购物车总价: 0,
      // 业务3：商品列表数据
      商品列表: [], 加载中: false, 当前页码: 1,
    }
  },
  methods: {
    登录() { /* 用 this.用户名 */ },
    添加到购物车(商品) { /* 操作 this.购物车商品 */ },
    获取商品列表() { /* 设置 this.加载中 */ },
  },
  computed: {
    是否已登录() { return !!this.用户信息 },
    购物车商品数量() { return this.购物车商品.length },
  }
}
```

**组合式 API 代码风格（按业务聚合）：**

```typescript
// 业务1：用户登录 — 相关的东西放一起
const 用户名 = ref('')
const 密码 = ref('')
const 用户信息 = ref(null)
function 登录() { /* 用 用户名.value 访问，不用 this */ }
const 是否已登录 = computed(() => !!用户信息.value)

// 业务2：购物车 — 相关的东西放一起
const 购物车商品 = ref([])
function 添加到购物车(商品) { 购物车商品.value.push(商品) }
const 购物车商品数量 = computed(() => 购物车商品.value.length)

// 业务3：商品列表 — 相关的东西放一起
const 商品列表 = ref([])
const 加载中 = ref(false)
async function 获取商品列表() {
  加载中.value = true
  商品列表.value = await fetch('/api/products').then(r => r.json())
  加载中.value = false
}
```

**总结：**
- **选项式 API：** 东西按种类放（所有数据放一起，所有方法放一起）
- **组合式 API：** 东西按用途放（做一件事需要的所有东西放一起）

## 4.2 setup 函数

`setup` 是 Vue3 **组合式 API** 的**核心入口函数（几乎所有组合式的 API 都写在 setup 函数中）**，它在组件初始化时最先执行，集中管理所有组件逻辑（状态、方法、生命周期等），并返回**模板**（`<template>` 标签）可访问的内容。

### 4.2.1 基本用法

```vue
<template>
    <div class="person">
        <!-- 插值语法：{{}} -->
        <h2>姓名：{{ name }}</h2>
        <!-- 绑定事件 -->
        <button @click="showTel">查看联系方式</button>
    </div>
</template>
<!-- 编写 TypeScript 代码，需要在 script 标签中添加 lang='ts' -->
<script lang="ts">
    export default {
        name: 'Person',
        setup() {
            // 数据
            let name = '张三';
            let tel = '13000000000';

            // 方法
            function showTel(): void {
                alert(`手机号：${tel}`);
            }

            // setup 函数的返回值非常重要，返回值会自动交给模板处理
            // name 和 value 同名，可以使用对象简写形式
            return { name, showTel };
        }
    }
</script>
<style scoped>
    .person {
        background-color: skyblue;
        box-shadow: 0 0 15px;
        border-radius: 15px;
        padding: 15px;
    }
</style>
```

**知识点总结：**

1. 插值语法：`{{ }}`
2. 绑定事件：`@click`（等同于 `v-on:click`）
3. **setup 函数中提供的数据和方法必须通过 `return` 的方式交出去，模板才能解析。**
4. 对象简写形式：`{name: name, showTel: showTel}` 可以简写为 `{name, showTel}`

### 4.2.2 setup 的返回值

setup 函数的返回值可以是：

1. **返回一个对象**：对象会暴露给模板（`<template>`）使用，模板可以直接访问对象的属性和方法。
2. **返回一个渲染函数**：如果 `setup` 直接返回一个渲染函数，则组件的 `<template>` 会被**完全忽略**，渲染函数的输出直接替代模板内容。

```vue
<!-- 返回渲染函数（普通函数写法） -->
return function() {
    return '渲染内容';
}

<!-- 返回渲染函数（箭头函数简写） -->
return () => '箭头函数渲染内容';
```

### 4.2.3 setup 语法糖

使用 `<script lang="ts" setup>` 语法糖，不需要手动 `return`，数据和方法会**自动暴露给模板**。

```vue
<template>
    <div class="person">
        <h2>姓名：{{ name }}</h2>
        <button @click="showTel">查看联系方式</button>
    </div>
</template>
<!-- 这个 script 只负责导出当前组件（设置 devtools 中显示的组件节点名字） -->
<script lang="ts">
    export default {
        name: 'Person'
    }
</script>
<!-- 这个 script 专门编写 setup 函数中的代码，数据和方法自动暴露给模板 -->
<script lang="ts" setup>
    let name = '张三';
    let tel = '13000000000';
    function showTel() {
        alert(`手机号：${tel}`);
    }
</script>
<style scoped>
    .person {
        background-color: skyblue;
        box-shadow: 0 0 15px;
        border-radius: 15px;
        padding: 15px;
    }
</style>
```

> 第一个 `script` 标签中的默认导出实际上可以省略，当省略后会自动生成默认导出，默认导出的名字和文件名自动保持一致。

### 4.2.4 合并两个 script（推荐）

安装 `vite-plugin-vue-setup-extend` 插件，让两个 `script` 合并成一个：

```bash
npm install vite-plugin-vue-setup-extend -D
```

修改 `vite.config.ts`：

```javascript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import SetupExtend from 'vite-plugin-vue-setup-extend'

export default defineConfig({
  plugins: [vue(), SetupExtend()],
})
```

合并后代码：

```vue
<template>
    <div class="person">
        <h2>姓名：{{ name }}</h2>
        <button @click="showTel">查看联系方式</button>
    </div>
</template>
<script lang="ts" setup name="PersonInfo">
    let name = '张三';
    let tel = '13000000000';
    function showTel() {
        alert(`手机号：${tel}`);
    }
</script>
<style scoped>
    .person {
        background-color: skyblue;
        box-shadow: 0 0 15px;
        border-radius: 15px;
        padding: 15px;
    }
</style>
```

### 4.2.5 组件自动注册

在 Vue3 中如果使用了 setup 语法糖，`import` 的组件会**自动注册**，不需要再编写注册代码：

```vue
<!-- 旧写法：手动注册 -->
<script>
    import Person from './components/Person.vue';
    export default {
        name: "MyApp",
        components: { Person }
    }
</script>

<!-- 新写法（语法糖）：自动注册，无需手动注册 -->
<script lang="ts" setup name="MyApp">
    import Person from './components/Person.vue';
</script>
```
