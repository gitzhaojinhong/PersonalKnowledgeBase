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

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      'layout-top': () =>[
          // h(MouseClick),
          // h(MouseFollower),
          h(Mouse),
      ]
    })
  },
  enhanceApp({ app, router, siteData }) {
    // ...
    app
        // .component("MouseClick", MouseClick)
        // .component("MouseFollower", MouseFollower)
        .component("Mouse", Mouse)
  },
  // 图片缩放功能
  setup() {
    const route = useRoute();
    const initZoom = () => {
      // mediumZoom('[data-zoomable]', { background: 'var(--vp-c-bg)' }); // 默认
      mediumZoom('.main img', { background: 'var(--vp-c-bg)' }); // 不显式添加{data-zoomable}的情况下为所有图像启用此功能
    };
    onMounted(() => {
      initZoom();
    });
    watch(
        () => route.path,
        () => nextTick(() => initZoom())
    );
  },
} satisfies Theme
