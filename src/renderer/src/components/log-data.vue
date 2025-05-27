<template>
  <div class="log-container">
    <div class="log-header">
      <svg-icon class="log-icon" name="log" />
      <h3 v-if="!collapsed">系统日志</h3>
    </div>
    <div ref="logContentRef" class="log-content">
      <div v-for="(log, index) in logStore.logs" :key="index" class="log-item" :class="log.type">
        <template v-if="collapsed">
          <span class="log-index">#{{ index + 1 }}</span>
        </template>
        <template v-else>
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted } from 'vue'
import { useLogStore } from '../stores/log'

defineProps({
  collapsed: {
    type: Boolean,
    default: false
  }
})

const logStore = useLogStore()
const logContentRef = ref(null)

const formatTime = (timestamp) => {
  const date = new Date(timestamp)
  const now = new Date()

  // 获取时间部分
  const time = date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  // 如果是今天的日志，只显示时间
  if (date.toDateString() === now.toDateString()) {
    return time
  }

  // 如果不是今天的日志，显示月日和时间
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day} ${time}`
}

const scrollToBottom = async () => {
  await nextTick()
  if (logContentRef.value) {
    logContentRef.value.scrollTop = logContentRef.value.scrollHeight
  }
}

// 组件挂载时也执行滚动
onMounted(() => {
  scrollToBottom()
})

watch(() => logStore.logs.length, scrollToBottom)
</script>

<style lang="scss" scoped>
.log-container {
  display: flex;
  flex-direction: column;
  height: calc(100% - 10px);
  font-family: monospace;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  padding: 4px 10px;
  font-size: 14px;
  border-bottom: 1px solid var(--color-neutral-3);

  .log-icon {
    width: 20px;
    height: 20px;
  }
  h3 {
    margin-left: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-1);
  }
}

.log-content {
  flex: 1;
  overflow-y: auto;
  padding: 1px 10px;
  font-size: 12px;
  max-height: calc(100% - 40px);
}

.log-item {
  padding: 2px;
  margin: 2px 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  &.info {
    color: #888;
  }

  &.warning {
    color: #ffd700;
  }

  &.error {
    color: #ff4444;
  }

  .log-time {
    flex-shrink: 0; // 防止时间部分被压缩
  }

  .log-message {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0; // 确保 flex 子项可以正确收缩
  }

  .log-index {
    font-size: 12px;
    font-weight: 500;
    padding: 0 4px;
    border-radius: 4px;
    background-color: var(--color-fill-2);
  }
}
</style>
