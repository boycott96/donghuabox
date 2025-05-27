import { createMemoryHistory, createRouter } from 'vue-router'
import menu from '@renderer/model/menu.json'

// 预定义所有可能的组件导入
const component = {
  '/tools/douyin': () => import('../views/tools/douyin.vue')
}

const routes = [
  {
    path: '/',
    component: () => import('../components/layout.vue'),
    redirect: '/tools/douyin',
    children: menu.map((item) => {
      if (item.children) {
        return {
          path: item.path,
          // 父级路由不需要具体组件，它会作为一个容器
          children: item.children.map((child) => ({
            path: child.path.replace(item.path + '/', ''), // 修改这里，确保正确处理路径
            component: component[child.path]
          }))
        }
      }
      return {
        path: item.path,
        component: component[item.path]
      }
    })
  }
]

const router = createRouter({
  history: createMemoryHistory(),
  routes
})

export default router
