import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { i18nKey, createI18n } from './winui/components/i18n'
import './winui/styles/theme.css'
import './winui/styles/animations.css'
import './assets/app.css'

const i18n = createI18n(navigator.language || 'zh-CN')

const app = createApp(App)
app.use(router)
app.provide(i18nKey, i18n)
app.config.globalProperties.$t = i18n.t
app.mount('#app')

document.addEventListener('contextmenu', (event) => {
  const insideInput = (event.target as HTMLElement)?.closest?.('input, textarea, [contenteditable]')
  if (!insideInput) event.preventDefault()
})
