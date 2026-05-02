<ClientOnly>

## 10.1 路由概述

- **路由（route）**：一个 key-value 对儿，key 是请求路径，value 是对应的 Vue 组件。
- **路由器（router）**：管理路由。

路由是为了解决：在 **SPA（单网页）应用**中实现页面跳转效果的。在 SPA 应用中，所有的请求均为 AJAX 请求，只能页面局部刷新。使用路由技术，可以让浏览器地址栏发生变化，模拟页面跳转效果，同时用户也可以轻松使用浏览器的前进和后退按钮。

**路由的工作原理描述：**

1. 当用户点击**用户列表**按钮时，发送请求 `/user/list`，浏览器地址栏地址变为 `/user/list`。路由器接收到请求路径，找到对应 `UserList.vue` 组件，将组件更新到页面对应位置。
2. 当用户点击**商品列表**按钮时，路由器将 `UserList.vue` 组件卸载，将 `ProductList.vue` 组件更新到页面对应位置。

## 10.2 实现一个简单的路由

### 10.2.1 项目结构

```plain
src/
├── router/
│   └── index.ts
├── views/
│   ├── HomeView.vue
│   └── AboutView.vue
├── App.vue
└── main.ts
```

**重点注意事项：** 现代的企业级项目中，一般组件要放到 `components` 目录下，路由组件要放到 `views/pages` 目录下。另外路由组件的文件名建议以 `View` 结尾，大家尽量遵循这个规范。

### 10.2.2 安装必要的依赖

```bash
npm install vue-router
```

### 10.2.3 创建路由组件

`src/views/HomeView.vue`：

```vue
<template>
  <div class="home">
    <h1>Home Page</h1>
    <p>Welcome to the home page!</p>
  </div>
</template>
<script lang="ts" setup name="HomeView"></script>
<style scoped>
  .home {
    text-align: center;
    padding: 20px;
  }
</style>
```

`src/views/AboutView.vue`：

```vue
<template>
  <div class="about">
    <h1>About Us</h1>
    <p>This is the about page.</p>
  </div>
</template>
<script lang="ts" setup name="AboutView"></script>
<style scoped>
.about {
  text-align: center;
  padding: 20px;
}
</style>
```

### 10.2.4 配置路由规则

`src/router/index.ts`：

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'

// 创建路由器
const router = createRouter({
  // 路由的工作模式采用 history
  history: createWebHistory(),
  // 路由数组用来配置多个路由
  routes: [
    {
      path: '/home',
      component: HomeView,
    },
    {
      path: '/about',
      component: AboutView,
    }
  ]
})

export default router
```

**懒加载写法（推荐）：**

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/about',
      component: () => import('../views/AboutView.vue'),
    }
  ]
})

export default router
```

### 10.2.5 App.vue 组件

**第一种写法：使用 RouterView 和 RouterLink 组件（推荐）：**

```vue
<template>
  <div id="app">
    <nav>
      <RouterLink to="/home" active-class="active">Home</RouterLink>
      <RouterLink to="/about" active-class="active">About</RouterLink>
    </nav>
    <RouterView />
  </div>
</template>
<script lang="ts" setup name="App"></script>
<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
nav {
  padding: 30px;
}
nav a {
  font-weight: bold;
  color: #2c3e50;
  padding: 0 10px;
}
.active {
  color: #42b983;
}
</style>
```

**第二种写法：使用 router-view 和 router-link 标签：**

```vue
<template>
  <div id="app">
    <nav>
      <router-link to="/home" active-class="active">Home</router-link>
      <router-link to="/about" active-class="active">About</router-link>
    </nav>
    <router-view />
  </div>
</template>
<script lang="ts" setup name="App"></script>
<style>
/* 样式同上 */
</style>
```

### 10.2.6 main.ts 入口文件

```typescript
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(router)
app.mount('#app')
```

## 10.3 路由器工作模式

### 10.3.1 history 模式

- **优点：** URL 更美观，路径中不带有 `#`，更接近传统网站的 URL。
- **缺点：** 后期项目上线，需要服务器端配合处理路径问题，否则刷新会有 404 错误。

```typescript
const router = createRouter({
  history: createWebHistory(),
});
```

### 10.3.2 hash 模式

- **优点：** 兼容性好，不需要服务器端处理路径。
- **缺点：** URL 中带有 `#` 不美观，SEO 优化方面相对较差。

```typescript
const router = createRouter({
  history: createWebHashHistory(),
});
```

## 10.4 为路由起名字

```typescript
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      name: 'home',
      path: '/home',
      component: HomeView,
    },
    {
      name: 'about',
      path: '/about',
      component: AboutView,
    }
  ]
})
```

## 10.5 to 的三种写法

**第一种：字符串路径**

```vue
<router-link to="/home" active-class="active">Home</router-link>
```

**第二种：对象形式（带 path）**

```vue
<router-link :to="{path: '/about'}" active-class="active">About</router-link>
```

**第三种：对象形式（带 name）**

```vue
<router-link :to="{name: 'home'}" active-class="active">Home</router-link>
```

## 10.6 嵌套路由

### 10.6.1 定义子路由组件

在 `views/about` 目录下创建 `TeamView.vue` 和 `HistoryView.vue`：

```vue
<template>
  <div class="team">
    <h2>Our Team</h2>
    <p>Meet our amazing team members...</p>
  </div>
</template>
<script lang="ts" setup></script>
<style scoped>
.team {
  text-align: center;
  padding: 20px;
}
</style>
```

```vue
<template>
  <div class="history">
    <h2>Company History</h2>
    <p>Learn about our company's journey...</p>
  </div>
</template>
<script lang="ts" setup></script>
<style scoped>
.history {
  text-align: center;
  padding: 20px;
}
</style>
```

### 10.6.2 注册子路由

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import AboutView from '../views/AboutView.vue'
import TeamView from '../views/about/TeamView.vue'
import HistoryView from '../views/about/HistoryView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      name: 'home',
      path: '/home',
      component: HomeView,
    },
    {
      name: 'about',
      path: '/about',
      component: AboutView,
      children: [
        {
          name: 'team',
          path: 'team',
          component: TeamView
        },
        {
          name: 'history',
          path: 'history',
          component: HistoryView
        },
      ]
    }
  ]
})

export default router
```

**注意：** 子路由组件的 `path` 不要以 `/` 开始，如果 `path` 是 `team`，则完整的路径是 `/about/team`。

### 10.6.3 子路由导航

```vue
<template>
  <div class="about">
    <h1>About Us</h1>
    <p>This is the about page.</p>
    <nav>
      <router-link to="/about/team" active-class="active">Team</router-link>
      <router-link to="/about/history" active-class="active">History</router-link>
    </nav>
    <router-view />
  </div>
</template>
<script lang="ts" setup name="AboutView"></script>
<style scoped>
.about {
  text-align: center;
  padding: 20px;
}
nav {
  padding: 20px 0;
}
nav a {
  font-weight: bold;
  color: #2c3e50;
  padding: 0 10px;
}
nav a.active {
  color: #42b983;
}
</style>
```

## 10.7 父子路由组件参数传递

### 10.7.1 query 参数

父组件传递数据：

```vue
<template>
  <div class="about">
    <h1>About Us</h1>
    <nav>
      <router-link :to="{path: '/about/team', query: {company, members}}" active-class="active">Team</router-link>
      <router-link :to="{path: '/about/history', query: {company, establishYear}}" active-class="active">History</router-link>
    </nav>
    <router-view />
  </div>
</template>
<script lang="ts" setup name="AboutView">
  import { ref } from 'vue';

  let company = ref('One Master');
  let members = ref(1);
  let establishYear = ref('2025');
</script>
```

子组件接收数据：

```vue
<template>
  <div class="team">
    <h2>Our Team</h2>
    <p>{{ company }} has {{ members }} member in total.</p>
  </div>
</template>
<script lang="ts" setup>
  import { useRoute } from 'vue-router';

  let route = useRoute();
  let {company, members} = route.query;
</script>
```

### 10.7.2 params 参数

**第一步：** 在路由规则中指定动态参数：

```typescript
{
  name: 'about',
  path: '/about',
  component: AboutView,
  children: [
    {
      name: 'team',
      path: 'team/:company/:members?',  // ? 表示可传可不传
      component: TeamView
    },
    {
      name: 'history',
      path: 'history/:company/:establishYear',
      component: HistoryView
    },
  ]
}
```

**第二步：** 父组件传递数据：

```vue
<router-link :to="{name: 'team', params: {company, members}}" active-class="active">Team</router-link>
```

**注意：**
1. 使用 params 参数时，`:to` 后面的对象属性中不能使用 path，必须使用 name。
2. 使用 params 参数时，不能传递数组或对象。

**第三步：** 子组件接收数据：

```vue
<script lang="ts" setup>
  import { useRoute } from 'vue-router';
  let route = useRoute();
</script>
<p>{{ route.params.company }} has {{ route.params.members }} member in total.</p>
```

### 10.7.3 props 配置

#### props 配合 params 参数

在路由规则中添加 `props: true`：

```typescript
{
  name: 'team',
  path: 'team/:company/:members?',
  component: TeamView,
  props: true  // 开启 props
}
```

子组件中使用 `defineProps()` 获取参数：

```vue
<script lang="ts" setup>
  defineProps<{company?: string; members?: string}>();
</script>
<p>{{ company }} has {{ members }} member in total.</p>
```

#### props 配合 query 参数（函数写法）

```typescript
{
  name: 'team',
  path: 'team',
  component: TeamView,
  props: (route) => ({ ...route.query })
}
```

## 10.8 router-link 的 replace 属性

### 10.8.1 push 模式（默认）

路由的导航链接默认是 `push` 模式。路由将用户点击导航链接的记录采用 `push` 方式压入栈顶，从而实现前进和后退效果。

### 10.8.2 replace 模式

设置为 replace 模式的路由导航链接会将当前栈顶部最近的一次请求替换掉，导致无法后退和前进到这一次请求。

```vue
<router-link replace to="/about" active-class="active">About</router-link>
```

## 10.9 编程式路由导航

### 10.9.1 组件挂载后自动跳转

在 `HomeView` 组件挂载完成后，过 5 秒跳转到 `AboutView`：

```vue
<script lang="ts" setup name="HomeView">
  import { onMounted } from 'vue';
  import { useRouter } from 'vue-router';

  const router = useRouter();

  onMounted(() => {
    setTimeout(() => {
      router.push('/about');  // push 模式
      // router.replace('/about');  // replace 模式
    }, 5000);
  });
</script>
```

### 10.9.2 点击按钮跳转

```vue
<template>
  <div class="about">
    <h1>About Us</h1>
    <nav>
      <button @click="goTeam(company, members)">Team</button>
      <button @click="goHistory(company, establishYear)">History</button>
    </nav>
    <router-view />
  </div>
</template>
<script lang="ts" setup name="AboutView">
  import { ref } from 'vue';
  import { useRouter } from 'vue-router';

  let company = ref('One Master');
  let members = ref(1);
  let establishYear = ref('2025');

  const router = useRouter();

  function goTeam(company: string, members: number) {
    router.push({name: 'team', query: {company, members}});
  }

  function goHistory(company: string, establishYear: string) {
    router.push({name: 'history', query: {company, establishYear}});
  }
</script>
```

## 10.10 路由重定向

当访问某个路径时，自动重定向到另一个路由组件：

```typescript
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home'  // 访问根路径时重定向到 /home
    },
    {
      path: '/home',
      component: HomeView,
    },
    {
      path: '/about',
      component: AboutView,
    }
  ]
})
```
</ClientOnly>