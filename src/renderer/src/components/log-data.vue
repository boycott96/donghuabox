<template>
  <div class="log-container">
    <div class="log-header">
      <svg-icon class="log-icon" name="log" />
      <h3 v-if="!collapsed">系统日志</h3>
      <div v-if="!collapsed" class="log-controls">
        <div class="scroll-control">
          <a-switch v-model="autoScroll" size="small" :default-checked="true" />
          <span class="scroll-label">{{ autoScroll ? '自动滚动' : '手动滚动' }}</span>
        </div>
        <a-tooltip content="清空日志">
          <a-button size="mini" @click="clearLogs">
            <template #icon>
              <svg-icon name="delete" />
            </template>
          </a-button>
        </a-tooltip>
      </div>
    </div>
    <div ref="logContentRef" class="log-content">
      <div
        v-for="(log, index) in logStore.logs"
        :key="index"
        class="log-item"
        :class="[log.type, { expanded: expandedLogs[index] }]"
        @dblclick="toggleExpand(index)"
      >
        <template v-if="collapsed">
          <span class="log-index">#{{ index + 1 }}</span>
        </template>
        <template v-else>
          <span class="log-time">{{ formatTime(log.timestamp) }}</span>
          <span class="log-message">{{ log.message }}</span>
          <a-button
            v-if="isMessageOverflow(index)"
            class="expand-button"
            size="mini"
            type="text"
            @click.stop="toggleExpand(index)"
          >
            <template #icon>
              <svg-icon :name="expandedLogs[index] ? 'up' : 'down'" />
            </template>
            {{ expandedLogs[index] ? '收起' : '展开' }}
          </a-button>
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
const autoScroll = ref(true)
const expandedLogs = ref({})

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

const clearLogs = () => {
  logStore.clearLogs()
}

const scrollToBottom = async () => {
  await nextTick()
  if (logContentRef.value && autoScroll.value) {
    logContentRef.value.scrollTop = logContentRef.value.scrollHeight
  }
}

const isMessageOverflow = (index) => {
  const message = logStore.logs[index]?.message
  if (!message) return false

  const tempDiv = document.createElement('div')
  tempDiv.style.visibility = 'hidden'
  tempDiv.style.position = 'absolute'
  tempDiv.style.whiteSpace = 'nowrap'
  tempDiv.innerText = message
  document.body.appendChild(tempDiv)

  const isOverflow = tempDiv.offsetWidth > 300 // 根据实际宽度调整
  document.body.removeChild(tempDiv)

  return isOverflow
}

const toggleExpand = (index) => {
  expandedLogs.value[index] = !expandedLogs.value[index]
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
    flex: 1;
  }
  .log-controls {
    display: flex;
    gap: 8px;
    margin-left: auto;
    align-items: center;
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
  padding: 2px 8px;
  margin: 2px 0;
  border-radius: 4px;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  position: relative;
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background-color: var(--color-fill-2);
    .expand-button {
      opacity: 1;
    }
  }

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
    flex-shrink: 0;
  }

  .log-message {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }

  &.expanded {
    .log-message {
      white-space: normal;
      word-break: break-all;
    }
    background-color: var(--color-fill-2);
    padding: 8px;
  }

  .expand-button {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    padding: 2px 8px;
    font-size: 12px;
    opacity: 0;
    transition: all 0.2s ease;
    color: var(--color-text-2);
    display: flex;
    align-items: center;
    gap: 4px;

    &:hover {
      color: var(--color-text-1);
      background-color: var(--color-fill-3);
    }

    :deep(.svg-icon) {
      width: 12px;
      height: 12px;
    }
  }

  .log-index {
    font-size: 12px;
    font-weight: 500;
    padding: 0 4px;
    border-radius: 4px;
    background-color: var(--color-fill-2);
  }
}

.log-controls {
  display: flex;
  gap: 8px;
  margin-left: auto;
  align-items: center;

  .scroll-control {
    display: flex;
    align-items: center;
    gap: 4px;

    .scroll-label {
      font-size: 12px;
      color: var(--color-text-2);
    }
  }
}
</style>
