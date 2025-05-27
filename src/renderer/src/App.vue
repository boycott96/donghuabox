<template>
  <router-view />
</template>
<script setup>
import { useLogStore } from './stores/log'

const logStore = useLogStore()
logStore.addLog('系统启动')
</script>
