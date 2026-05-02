# 一、Vue3 概述

## 1.1 基本信息

1. Vue 3 是当前最新的主要版本，是一个用于构建用户界面的**渐进式 JavaScript 框架**（你可以从简单的页面交互开始，按需逐步引入更复杂的特性和工具，最终构建完整的现代化应用），由**尤雨溪（Evan You）**和团队开发。
2. 2020 年 9 月 18 日 Vue.js 正式发布 3.0 版本，代号 **One Piece 海贼王**。
3. 经历了 4800+ 次提交、40+ 个 RFC、600+ 次 PR、300+ 贡献者。
4. 截止 2025 年 7 月，最新稳定版本为 **3.5.17**。

```bash
# 查看当前最新稳定版
npm show vue version
```

5. 资源地址：
   - [Vue3 官网](https://vuejs.org/) / [Vue3 中文官网](https://cn.vuejs.org/)
   - [Vue3 核心仓库（源码）](https://github.com/vuejs/core)
   - 编译产物发布在 [npm](https://www.npmjs.com/) 上供生产环境使用

## 1.2 核心优势

**性能提升：**
- 比 Vue 2 更快的渲染速度（虚拟 DOM 重写，优化 Diff 算法）。**初次渲染快 55%，更新渲染快 133%。**
- 更小的体积（Tree-shaking 支持，核心库压缩后约 10KB）。**打包体积减少 41%。**
- **内存减少 54%。**

**Composition API（组合式 API）：**
- 引入基于函数的 `setup()` 语法，逻辑复用更灵活（替代 Options API 的混入模式）。
- 更好的 TypeScript 支持。
- **本课程主要讲解组合式 API，选项式 API 属于 Vue2 中的语法机制，不是官方推荐的。**

## 1.3 新特性

1. **Teleport**：将组件渲染到 DOM 树任意位置（如 `body` 下的模态框），解决 `z-index` 和布局层级问题。
2. **Fragments**：支持模板多根节点，无需额外包裹 `<div>`（减少冗余 DOM 层级）。
3. **Suspense**：统一处理异步组件/异步依赖的加载状态（提供 `fallback` 占位内容）。
4. **自定义渲染器**：通过 `@vue/runtime-core` 实现非 DOM 渲染（如小程序、Canvas、终端应用）。

## 1.4 底层核心优化

1. **Proxy 响应式系统**：替代 `Object.defineProperty`，支持动态属性/数组索引/集合类型（`Map`/`Set`）的自动追踪。
2. **虚拟 DOM 重写**：
   - 编译时：静态节点提升（Hoist Static）、动态标记（Patch Flags）。
   - 运行时：优化 Diff 算法，跳过静态子树比对。
3. **Tree-Shaking 支持**：基于 ES Module 的模块化架构，未使用的功能（如 `v-model` 修饰符）不会打入生产包。

## 1.5 生态与工具

- **Vite**：原生 ES Module 的构建工具，极速热更新，默认推荐开发环境。
- **Pinia**：官方推荐的状态管理库（替代 Vuex），更简洁的 API。
- **TypeScript 集成**：源码使用 TS 重写，提供完整的类型推断。

## 1.6 兼容性

- 支持现代浏览器（IE11 需 polyfill）。
- 提供迁移构建（`@vue/compat`）帮助从 Vue 2 平滑升级。
