// https://vitepress.dev/guide/custom-theme
import MouseClick from "./components/MouseClick.vue";
import MouseFollower from "./components/MouseFollower.vue";
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style/style.css'
import Mouse from "./components/Mouse.vue";
import mediumZoom from 'medium-zoom';
import { onMounted, watch, nextTick } from 'vue';
import { useRoute } from 'vitepress';
import FeatureGroups from "./components/FeatureGroups.vue";

// 导出主题配置对象，extends表示继承VitePress官方默认主题，不是从零自己写一套主题
export default {
  extends: DefaultTheme,

  // 重写Layout渲染函数：在默认布局基础上，往内置插槽注入自定义内容
  Layout: () => {
    // h 是Vue的createVNode，用来创建虚拟DOM（编程式渲染组件）
    return h(DefaultTheme.Layout, null, {
      // VitePress默认主题提供的布局插槽文档：https://vitepress.dev/guide/extending-default-theme#layout-slots
      // 'layout-top'：全局插槽，作用于【所有页面】，位置：页面最顶部、导航栏上方
      'layout-top': () => [
        // h(MouseClick),       // 旧的鼠标点击组件，暂时注释停用
        // h(MouseFollower),    // 旧的鼠标跟随组件，暂时注释停用
        h(Mouse),               // 注入Mouse组件，实现鼠标点击水波涟漪效果
      ]
    })
  },

  // enhanceApp：VitePress主题钩子，Vue应用实例创建后执行，常用于全局注册组件、挂载全局变量
  enhanceApp({ app, router, siteData }) {
    // app.component(组件名称, 组件对象)：全局注册组件
    // 注册之后，任意md页面里不需要import，直接写标签 <Mouse />、<FeatureGroups />
    app
        // .component("MouseClick", MouseClick)    // 注释，不再全局注册该组件
        // .component("MouseFollower", MouseFollower)
        .component("Mouse", Mouse)                 // 注册鼠标涟漪组件
        .component("FeatureGroups", FeatureGroups) // 注册分组卡片组件
    // 备注：FeatureGroups组件会读取index.md的frontmatter里的featureGroups配置字段
  },

  // setup：主题级别的setup函数，写主题全局的响应式逻辑，这里用来实现图片点击放大
  setup() {
    // useRoute：获取当前路由对象
    const route = useRoute();

    // 封装图片放大初始化函数
    const initZoom = () => {
      // 官方默认写法：只给带有 data-zoomable 属性的图片开启放大
      // mediumZoom('[data-zoomable]', { background: 'var(--vp-c-bg)' });
      // 当前写法：匹配 .main 容器内所有img，文档里全部图片自动支持点击放大，不用手动加属性
      mediumZoom('.main img', { background: 'var(--vp-c-bg)' });
    };

    // onMounted：主题挂载完成时执行一次，页面首次加载绑定图片放大
    onMounted(() => {
      initZoom();
    });

    // 监听路由路径变化（VitePress是SPA单页应用，切换页面不会刷新浏览器）
    watch(
        () => route.path,
        // nextTick：等待DOM更新完成之后再执行，防止跳转后新页面图片DOM还没渲染，绑定失效
        () => nextTick(() => initZoom())
    );
  },
} satisfies Theme
// satisfies Theme：TypeScript语法，校验当前配置对象是否符合VitePress Theme主题类型，提供代码提示、类型报错，不影响运行

