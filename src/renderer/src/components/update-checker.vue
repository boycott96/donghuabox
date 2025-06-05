<template>
  <div class="update-checker">
    <a-button type="primary" :loading="checking" @click="checkForUpdates"> 检查更新 </a-button>
    <a-modal
      v-model:visible="showUpdateModal"
      :title="`发现新版本: ${updateInfo?.version || ''}`"
      @cancel="closeUpdateModal"
      @ok="downloadUpdate"
      ok-text="下载更新"
      cancel-text="稍后再说"
    >
      <p>是否现在下载更新？</p>
      <p v-if="updateInfo">版本号: {{ updateInfo.version }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useLogStore } from '../stores/log'
import { Message } from '@arco-design/web-vue'

const logStore = useLogStore()
const checking = ref(false)
const showUpdateModal = ref(false)
const updateInfo = ref(null)

// 检查更新
const checkForUpdates = async () => {
  checking.value = true
  try {
    await window.electron.ipcRenderer.invoke('check-for-updates')
  } catch (error) {
    logStore.addLog(`检查更新失败: ${error}`, 'error')
  } finally {
    checking.value = false
  }
}

// 关闭更新模态框
const closeUpdateModal = () => {
  showUpdateModal.value = false
}

// 下载更新
const downloadUpdate = async () => {
  try {
    await window.electron.ipcRenderer.invoke('start-download')
    showUpdateModal.value = false
  } catch (error) {
    logStore.addLog(`下载更新失败: ${error}`, 'error')
  }
}

// 监听更新消息
window.electron.ipcRenderer.on('add-log', (event, data) => {
  logStore.addLog(data.message, data.type)
})

// 监听更新可用
window.electron.ipcRenderer.on('update-available', (event, info) => {
  updateInfo.value = info
  showUpdateModal.value = true
})

// 监听更新下载完成
window.electron.ipcRenderer.on('update-downloaded', () => {
  Message.success({
    content: '更新已下载完成，将在退出时安装',
    closable: true
  })
})
</script>

<style scoped>
.update-checker {
  display: inline-block;
}
</style>
