import { createRouter, createWebHashHistory } from 'vue-router'
import HomeView from './explorer/views/HomeView.vue'
import ExplorerView from './explorer/views/ExplorerView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/explorer/:path(.*)', name: 'explorer', component: ExplorerView }
  ]
})

export function encodePath(path: string): string {
  return path.split('/').filter(Boolean).map((segment) => encodeURIComponent(segment)).join('/')
}

export function pathToRoute(path: string): string {
  return `/explorer/${encodePath(path)}`
}

export function routeToPath(segments: string | string[]): string {
  const joined = Array.isArray(segments) ? segments.join('/') : segments
  try {
    return `/${decodeURIComponent(joined)}`
  } catch {
    return `/${joined}`
  }
}

export default router
