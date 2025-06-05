<template>
  <a-layout class="app-layout">
    <a-layout-header class="app-header">
      <div class="logo">
        <svg-icon name="logo" />
        <span class="logo-text">DongHuaBox</span>
      </div>
      <a-menu
        mode="horizontal"
        :default-selected-keys="selectedKeys"
        @menu-item-click="onMenuItemClick"
      >
        <template v-for="item in menu">
          <a-menu-item v-if="item.type === 'menu'" :key="item.path">
            {{ item.name }}
          </a-menu-item>
          <a-sub-menu v-else :key="`sub-${item.path}`">
            <template #title>
              {{ item.name }}
            </template>
            <a-menu-item v-for="subItem in item.children" :key="subItem.path">
              {{ subItem.name }}
            </a-menu-item>
          </a-sub-menu>
        </template>
      </a-menu>
      <div class="header-actions">
        <update-checker />
      </div>
    </a-layout-header>
    <a-layout>
      <a-layout-sider
        class="layout-sider"
        :collapsed="collapsed"
        breakpoint="lg"
        :hide-trigger="true"
        collapsible
        :width="320"
        @collapse="onCollapse"
      >
        <log-data :collapsed="collapsed" />
        <a-button class="collapse-btn" shape="circle" @click="collapsed = !collapsed">
          <template #icon>
            <icon-menu-unfold v-if="collapsed" />
            <icon-menu-fold v-else />
          </template>
        </a-button>
      </a-layout-sider>
      <a-layout-content class="app-content">
        <router-view class="container" />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup>
import menu from '@renderer/model/menu.json'
import LogData from './log-data.vue'
import UpdateChecker from './update-checker.vue'
import { useRouter, useRoute } from 'vue-router'
import { ref } from 'vue'
const router = useRouter()
const route = useRoute()
const collapsed = ref(true)

const onCollapse = (val) => {
  collapsed.value = val
}

// 获取当前的路由 key，然后做
const selectedKeys = ref([route.path])

const onMenuItemClick = (key) => {
  router.push(key)
}
</script>
<style lang="scss" scoped>
.app-layout {
  box-sizing: border-box;
  width: 100%;
  height: 100vh;
  background-color: var(--color-neutral-2);
  overflow: hidden;

  :deep(.arco-layout) {
    height: calc(100vh - 48px);
  }

  .app-header {
    background-color: var(--color-bg-1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    border-bottom: 1px solid var(--color-neutral-3);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    transition: all 0.3s ease;

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 320px;
      cursor: pointer;
      padding: 8px 0;
      transition: all 0.3s ease;

      &:hover {
        opacity: 0.85;
      }

      :deep(svg) {
        width: 28px;
        height: 28px;
        color: var(--color-primary-6);
      }

      .logo-text {
        font-size: 20px;
        font-weight: 600;
        background: linear-gradient(
          120deg,
          var(--color-primary-light-4),
          var(--color-primary-light-1)
        );
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        letter-spacing: 0.5px;
      }
    }

    :deep(.arco-menu) {
      background: transparent;
      border: none;

      .arco-menu-item {
        font-size: 14px;
        transition: all 0.3s ease;

        &:hover {
          color: var(--color-primary-6);
        }

        &.arco-menu-selected {
          color: var(--color-primary-6);
          font-weight: 500;

          &::after {
            background-color: var(--color-primary-6);
          }
        }
      }
    }
  }

  .layout-sider {
    position: relative;

    .collapse-btn {
      position: absolute;
      right: -16px;
      top: 50%;
      transform: translateY(-50%);
      z-index: 1;
      background-color: var(--color-bg-1);
      border: 1px solid var(--color-neutral-3);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      &:hover {
        background-color: var(--color-fill-1);
      }
    }
  }

  .header-actions {
    margin-left: auto;
    padding: 0 16px;
    display: flex;
    align-items: center;
  }
}
</style>
