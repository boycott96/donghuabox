import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLogStore = defineStore('log', () => {
  const logs = ref([])

  const addLog = (message, type = 'info') => {
    logs.value.push({
      timestamp: Date.now(),
      type,
      message
    })
  }

  const clearLogs = () => {
    logs.value = []
  }

  return {
    logs,
    addLog,
    clearLogs
  }
})
