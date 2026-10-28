<!-- FeatureGroups.vue：纯CSS复刻VitePress 2.x VPFeatures + VPFeature，完整对齐官方源码 -->
<script setup>
import { useData } from 'vitepress'
import { computed } from 'vue'
import {withBase} from "vitepress";

const { frontmatter } = useData()
const groups = computed(() => frontmatter.value.featureGroups || [])

// 和原生一致：根据当前分组内item数量自动计算网格class
const getGridClass = (len) => {
  if (!len) return
  if (len === 2) return 'grid-2'
  if (len === 3) return 'grid-3'
  if (len % 3 === 0) return 'grid-6'
  if (len > 3) return 'grid-4'
}
</script>

<template>
  <div v-for="group in groups" :key="group.title" class="vp-feature-group">
    <h3 v-if="group.title" class="vp-feature-group-title">{{ group.title }}</h3>

    <div class="VPFeatures">
      <div class="container">
        <ul class="items">
          <li
              v-for="item in group.items"
              :key="item.title"
              class="item"
              :class="[getGridClass(group.items.length)]"
          >
            <a
                v-if="item.link"
                class="VPFeature link"
                :href="withBase(item.link)"
                @click="handleNavigate($event, item.link)"
                :target="item.target || '_self'"
                :rel="item.rel"
            >
              <article class="box">
                <div v-if="item.icon" class="icon">
                  <template v-if="typeof item.icon === 'object'">
                    <component :is="item.icon" />
                  </template>
                  <template v-else>{{ item.icon }}</template>
                </div>
                <h2 class="title">{{ item.title }}</h2>
                <p v-if="item.details" class="details">{{ item.details }}</p>
                <div v-if="item.linkText" class="link-text">
                  <p class="link-text-value">
                    {{ item.linkText }} <span class="vpi-arrow-right link-text-icon" />
                  </p>
                </div>
              </article>
            </a>
            <div v-else class="VPFeature">
              <article class="box">
                <div v-if="item.icon" class="icon">
                  <template v-if="typeof item.icon === 'object'">
                    <component :is="item.icon" />
                  </template>
                  <template v-else>{{ item.icon }}</template>
                </div>
                <h2 class="title">{{ item.title }}</h2>
                <p v-if="item.details" class="details">{{ item.details }}</p>
              </article>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 分组外层（仅分组标题、分组间距，不属于官方VPFeature体系） */
.vp-feature-group {
  margin-top: 48px; /* 分组和上方内容的间距 */
}
.vp-feature-group-title {
  max-width: 72rem; /* 和feature容器保持一致最大宽度 */
  margin: 0 auto 24px; /* 上下：0，左右自动居中，底部距离卡片24px */
  padding: 0 1.5rem; /* 左右内边距，适配小屏幕 */
  font-size: 1.25rem; /* 标题字号 */
  font-weight: 600; /* 字体加粗 */
  color: var(--vp-c-text-1); /* 使用VitePress主文本颜色变量，适配明暗主题 */
}

/* ========== VPFeatures 官方布局样式（完整复刻，无缺漏） ========== */
.VPFeatures {
  position: relative; /* 相对定位，给内部元素定位基准 */
}

.container {
  margin: 0 auto; /* 容器水平居中 */
  max-width: 72rem; /* 容器最大宽度，限制内容不会无限拉宽 */
}
.items {
  display: flex; /* 开启弹性布局，横向排列卡片 */
  flex-wrap: wrap; /* 空间不足自动换行 */
  margin: -0.5rem; /* 负边距抵消li.item的padding，实现间隙 */
  list-style: none; /* ✅ 清除ul默认黑点，官方源码必备 */
  padding-inline-start: 0; /* ✅ 清除ul默认内边距，官方源码必备 */
}
.item {
  padding: 0.5rem; /* 卡片单元格内边距，作为卡片之间的间距 */
  width: 100%; /* 默认移动端单列，占满一行 */
}
@media (min-width: 40rem) { /* ≥40rem：2列布局 */
  .item.grid-2,
  .item.grid-4,
  .item.grid-6 {
    width: calc(100% / 2); /* 一行均分2份 */
  }
}
@media (min-width: 48rem) { /* ≥48rem：grid-2/4保持2列，grid-3/6切换为3列 */
  .item.grid-2,
  .item.grid-4 {
    width: calc(100% / 2); /* 一行均分2份 */
  }
  .item.grid-3,
  .item.grid-6 {
    width: calc(100% / 3); /* 一行均分3份 */
  }
}
@media (min-width: 60rem) { /* ≥60rem：grid-4切换为4列 */
  .item.grid-4 {
    width: calc(100% / 4); /* 一行均分4份 */
  }
}

/* ========== VPFeature 卡片官方样式（完整复刻，无缺漏） ========== */
.VPFeature {
  display: block; /* 块级元素，填满li父容器 */
  border: 1px solid var(--vp-c-bg-soft); /* 边框颜色，使用软背景色变量 */
  border-radius: 0.75rem; /* 卡片圆角大小 */
  height: 100%; /* 卡片高度100%，保证同排卡片等高 */
  background-color: var(--vp-c-bg); /* 卡片底色，适配明暗主题 */
  transition: border-color 0.25s, background-color 0.25s, transform 0.25s; /* 过渡动画：边框色、背景色、上浮位移 */
  text-decoration: none; /* 清除a标签默认下划线 */
}
.VPFeature.link:hover {
  border-color: var(--vp-c-brand-1); /* 可点击卡片hover时边框变为主题色 */
}
/* 保留你想要的上浮效果，原生官方没有这条 */
.VPFeature:hover {
  transform: translateY(-5px); /* hover向上偏移5px，上浮动画 */
}
.box {
  display: flex; /* 卡片内部弹性布局，纵向排列 */
  flex-direction: column; /* 主轴垂直方向 */
  padding: 1.5rem; /* 卡片内部内容边距 */
  height: 100%; /* 填满卡片容器高度 */
  //background-color: rgba(0,0,0,0);
}
.box > :deep(.VPImage) {
  margin-bottom: 1.25rem; /* VPImage图片图标底部外边距，深度选择器穿透scoped */
}
.icon {
  display: flex; /* 图标盒子弹性布局，居中图标 */
  justify-content: center; /* 水平居中 */
  align-items: center; /* 垂直居中 */
  margin-bottom: 1.25rem; /* 图标距离下方标题的间距 */
  border-radius: 0.375rem; /* 图标盒子圆角 */
  background-color: var(--vp-c-default-soft); /* 图标盒子背景色 */
  width: 3rem; /* 图标盒子宽度 */
  height: 3rem; /* 图标盒子高度 */
  font-size: 1.5rem; /* 图标文字大小 */
  transition: background-color 0.25s; /* 背景色过渡动画 */
}
.title {
  border-top: none !important; /* 强制清除继承/原生带来的上边框横线 */
  padding-top: 0 !important; /* 强制清除继承/原生带来的上边距 */
  line-height: 1.5; /* 标题行高 */
  font-size: 1rem; /* 标题字号 */
  font-weight: 600; /* 标题字重 */
  color: var(--vp-c-text-1); /* 标题文本颜色，主文本变量 */
  margin: 0; /* 清除h2默认外边距 */
}
.details {
  flex-grow: 1; /* 自动占满剩余空间，把linkText挤到底部 */
  padding-top: 0.5rem; /* 和标题之间的上边距 */
  line-height: 1.7142857; /* 描述文本行高，和官方保持一致 */
  font-size: 0.875rem; /* 描述字号 */
  font-weight: 500; /* 描述字重 */
  color: var(--vp-c-text-2); /* 次要文本颜色变量 */
  margin: 0; /* 清除p/ul默认外边距 */
}
.link-text {
  padding-top: 0.5rem; /* 和上方描述文本的间距 */
}
.link-text-value {
  display: flex; /* 文字和箭头横向排列 */
  align-items: center; /* 文字箭头垂直居中对齐 */
  font-size: 0.875rem; /* 查看更多文字字号 */
  font-weight: 500; /* 字重 */
  color: var(--vp-c-brand-1); /* 使用主题色 */
  margin: 0; /* 清除p默认外边距 */
}
.link-text-icon {
  margin-inline-start: 0.375rem; /* 箭头图标左边距（兼容rtl双向文字） */
}
</style>

