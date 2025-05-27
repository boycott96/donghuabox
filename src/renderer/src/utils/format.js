/**
 * 格式化字节大小
 * @param {number} bytes 字节数
 * @returns {string} 格式化后的大小
 */
export const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * 格式化时间（秒）
 * @param {number} seconds 秒数
 * @returns {string} 格式化后的时间
 */
export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '计算中...'
  if (seconds < 60) return Math.round(seconds) + ' 秒'

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)

  if (minutes < 60) {
    return `${minutes} 分 ${remainingSeconds} 秒`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours} 时 ${remainingMinutes} 分 ${remainingSeconds} 秒`
}
