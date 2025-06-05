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

/**
 * 格式化数字为带单位的简短格式
 * @param {number} num - 要格式化的数字
 * @returns {string} - 格式化后的字符串
 */
export const formatNumber = (num) => {
  if (num === null || num === undefined) return '0'
  
  const units = ['', 'w', 'w', '亿']
  const digit = 2
  let i = 0
  
  // 处理万以下的数字
  if (num < 10000) {
    return num.toString()
  }
  
  // 处理万以上的数字
  while (num >= 10000 && i < units.length - 1) {
    num = num / 10000
    i++
  }
  
  // 保留指定位数的小数
  return num.toFixed(digit).replace(/\.?0+$/, '') + units[i]
}
