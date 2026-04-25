// https://vitepress.dev/guide/custom-theme
import MouseClick from "./components/MouseClick.vue";
import MouseFollower from "./components/MouseFollower.vue";
import { h } from 'vue'
import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import './style/style.css'

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      'layout-top': () =>[
          h(MouseClick),
          h(MouseFollower),
      ]
    })
  },
  enhanceApp({ app, router, siteData }) {
    // ...
    app.component("MouseClick", MouseClick)
        .component("MouseFollower", MouseFollower)
  }
} satisfies Theme
