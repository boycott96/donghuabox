import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import ArcoVue from '@arco-design/web-vue'
import '@arco-design/web-vue/dist/arco.css'
import 'virtual:svg-icons-register'
import { createPinia } from 'pinia'

import SvgIcon from '@renderer/components/svg-icon.vue'

// 图标
import ArcoVueIcon from '@arco-design/web-vue/es/icon'

import router from './router'

createApp(App)
  .use(router)
  .use(ArcoVue)
  .use(ArcoVueIcon)
  .use(createPinia())
  .component('svg-icon', SvgIcon)
  .mount('#app')
