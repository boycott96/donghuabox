<template>
  <div class="douyin">
    <div class="search-container">
      <div class="input-wrapper">
        <input
          v-model="inputText"
          class="search-input"
          placeholder="请输入抖音视频链接"
          @paste="handlePaste"
          @keyup.enter="parseVideo"
        />
        <icon-close v-if="inputText" class="clear-icon" @click="inputText = ''" />
      </div>
      <button
        class="search-btn"
        :disabled="isLoading"
        @click="isLoading ? cancelParse() : parseVideo()"
      >
        <template v-if="!isLoading">
          <icon-search />
          解析视频
        </template>
        <template v-else>
          <icon-loading />
          点击取消解析
        </template>
      </button>
    </div>

    <!-- 进度条遮罩层 -->
    <div v-if="isLoading" class="progress-overlay">
      <div class="progress-container">
        <div class="progress-icon">
          <icon-loading />
        </div>
        <div class="progress-text">正在解析视频...</div>
        <div class="progress-bar">
          <div class="progress-inner" :style="{ width: progressWidth + '%' }"></div>
        </div>
        <div class="progress-status">{{ progressStatus }}</div>
        <div class="progress-actions">
          <a-button status="danger" @click="cancelParse">
            <template #icon><icon-close /></template>
            取消解析
          </a-button>
        </div>
      </div>
    </div>

    <!-- 下载进度遮罩层 -->
    <div v-if="isDownloading" class="progress-overlay">
      <div class="progress-container">
        <div class="icon">
          <template v-if="downloadStatus === 'downloading'">
            <icon-download />
          </template>
          <template v-else-if="downloadStatus === 'completed'">
            <icon-check-circle style="color: var(--color-success-light-4)" />
          </template>
          <template v-else-if="downloadStatus === 'error'">
            <icon-close-circle style="color: var(--color-danger-light-4)" />
          </template>
        </div>
        <div class="progress-text">
          <template v-if="downloadStatus === 'downloading'"> 正在下载视频... </template>
          <template v-else-if="downloadStatus === 'completed'"> 下载完成！ </template>
          <template v-else-if="downloadStatus === 'error'"> 下载失败 </template>
        </div>
        <div v-if="downloadStatus === 'downloading'" class="progress-bar">
          <div class="progress-inner" :style="{ width: downloadProgress + '%' }"></div>
        </div>
        <div v-if="downloadStatus === 'downloading'" class="download-info">
          <div class="speed">下载速度：{{ downloadSpeed }}</div>
          <div class="remaining">剩余时间：{{ remainingTime }}</div>
          <div class="size">{{ downloadedSize }} / {{ totalSize }}</div>
        </div>
        <div v-else-if="downloadStatus === 'completed'" class="complete-info">
          <p class="save-path">文件已保存到：{{ savedFilePath }}</p>
        </div>
        <div v-else-if="downloadStatus === 'error'" class="error-info">
          <p class="error-message">{{ errorMessage }}</p>
        </div>
        <div class="progress-actions">
          <template v-if="downloadStatus === 'downloading'">
            <a-button status="danger" @click="cancelDownload">
              <template #icon><icon-close /></template>
              取消下载
            </a-button>
          </template>
          <template v-else>
            <a-button type="primary" @click="closeDownloadDialog">
              <template #icon><icon-check /></template>
              确定
            </a-button>
          </template>
        </div>
      </div>
    </div>

    <a-spin :loading="isLoading" class="loading-container">
      <div v-if="videoInfo" class="video-info">
        <!-- 作者信息区域 -->
        <div class="author-info">
          <img
            :src="videoInfo.aweme_detail?.author?.avatar_thumb?.url_list[0]"
            class="author-avatar"
            alt="作者头像"
          />
          <div class="author-details">
            <h3 class="author-name">{{ videoInfo.aweme_detail?.author?.nickname }}</h3>
            <p class="author-signature">{{ videoInfo.aweme_detail?.author?.signature }}</p>
          </div>
        </div>

        <!-- 视频信息区域 -->
        <div class="video-details">
          <div class="video-header">
            <h2 class="video-title">{{ videoInfo.aweme_detail?.item_title || '抖音视频' }}</h2>
            <div class="flex space-between">
              <div class="video-stats">
                <span>
                  <icon-heart />
                  {{ videoInfo.aweme_detail?.statistics?.digg_count || 0 }}
                </span>
                <span>
                  <icon-message />
                  {{ videoInfo.aweme_detail?.statistics?.comment_count || 0 }}
                </span>
                <span>
                  <icon-star />
                  {{ videoInfo.aweme_detail?.statistics?.collect_count || 0 }}
                </span>
                <span>
                  <icon-share-alt />
                  {{ videoInfo.aweme_detail?.statistics?.share_count || 0 }}
                </span>
              </div>
              <a-button type="primary" @click="downloadVideo">
                <template #icon><icon-download /></template>
                下载视频
              </a-button>
            </div>
          </div>

          <div class="video-cover">
            <img :src="videoInfo.aweme_detail?.video?.cover?.url_list[0]" alt="视频封面" />
          </div>

          <p class="video-desc">{{ videoInfo.aweme_detail?.desc }}</p>

          <div v-if="videoInfo.aweme_detail?.text_extra?.length" class="video-tags">
            <a-tag
              v-for="tag in videoInfo.aweme_detail?.text_extra"
              :key="tag.hashtag_name"
              color="arcoblue"
            >
              #{{ tag.hashtag_name }}
            </a-tag>
          </div>

          <div class="video-actions"></div>
        </div>
      </div>
    </a-spin>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useLogStore } from '../../stores/log'
import { formatBytes, formatTime } from '../../utils/format' // 需要创建这个工具函数文件

const inputText = ref('')
const videoInfo = ref(null)
const logStore = useLogStore()
const isLoading = ref(false)
const progressWidth = ref(0)
const progressStatus = ref('准备解析...')
const isDownloading = ref(false)
const downloadProgress = ref(0)
const downloadSpeed = ref('0 KB/s')
const remainingTime = ref('计算中...')
const downloadedSize = ref('0 MB')
const totalSize = ref('0 MB')
const downloadStatus = ref('downloading') // 'downloading', 'completed', 'error'
const savedFilePath = ref('')
const errorMessage = ref('')

// 从文本中提取抖音链接
const extractDouyinUrl = (text) => {
  // 匹配抖音链接的正则表达式（支持标准链接和短链接）
  const douyinRegex =
    /https?:\/\/(?:(?:www\.)?douyin\.com\/video\/[0-9]+|v\.douyin\.com\/[a-zA-Z0-9]+)/
  const match = text.match(douyinRegex)
  return match ? match[0] : null
}

// 处理粘贴事件
const handlePaste = (e) => {
  const pastedText = e.clipboardData.getData('text')
  const url = extractDouyinUrl(pastedText)
  if (url) {
    inputText.value = pastedText
    logStore.addLog(`检测到抖音链接: ${url}`, 'info')
  }
}

// 模拟进度更新
let progressInterval
const startProgressSimulation = () => {
  progressWidth.value = 0
  const stages = [
    '准备解析...',
    '获取视频信息...',
    '解析视频数据...',
    '获取下载地址...',
    '即将完成...'
  ]
  let currentStage = 0

  progressInterval = setInterval(() => {
    if (progressWidth.value < 90) {
      progressWidth.value += Math.random() * 15
      if (progressWidth.value > currentStage * 25 && currentStage < stages.length) {
        progressStatus.value = stages[currentStage]
        currentStage++
      }
    }
  }, 500)
}

// 完成进度
const completeProgress = () => {
  clearInterval(progressInterval)
  progressWidth.value = 100
  progressStatus.value = '解析完成！'
  setTimeout(() => {
    progressWidth.value = 0
  }, 500)
}

// 取消解析
const cancelParse = () => {
  window.electron.ipcRenderer.send('cancel-parse')
  isLoading.value = false
  videoInfo.value = null
  logStore.addLog('用户取消了视频解析', 'warning')
}

// 解析视频
const parseVideo = async () => {
  const url = extractDouyinUrl(inputText.value)
  if (!url) {
    Message.error('请输入有效的抖音视频链接')
    logStore.addLog('无效的视频链接', 'error')
    return
  }

  logStore.addLog(`开始解析链接: ${url}`, 'info')
  isLoading.value = true
  startProgressSimulation()
  // 发送解析请求到主进程
  window.electron.ipcRenderer.send('parse-douyin', url)
}

// 监听API响应数据
window.electron.ipcRenderer.on('parse-douyin-result', (event, data) => {
  clearInterval(progressInterval)
  logStore.addLog('成功获取抖音视频信息', 'info')

  if (data.success) {
    completeProgress()
    videoInfo.value = data.data
  } else {
    progressStatus.value = '解析失败'
    progressWidth.value = 0
    logStore.addLog(`解析失败: ${data.error || '未知错误'}`, 'error')
  }
  isLoading.value = false
})

// 关闭下载对话框
const closeDownloadDialog = () => {
  isDownloading.value = false
  downloadStatus.value = 'downloading'
  downloadProgress.value = 0
  savedFilePath.value = ''
  errorMessage.value = ''
}

// 取消下载
const cancelDownload = () => {
  window.electron.ipcRenderer.send('cancel-download')
  isDownloading.value = false
  downloadStatus.value = 'downloading'
  downloadProgress.value = 0
  downloadSpeed.value = '0 KB/s'
  remainingTime.value = '计算中...'
  downloadedSize.value = '0 MB'
  totalSize.value = '0 MB'
  savedFilePath.value = ''
  errorMessage.value = ''
  logStore.addLog('用户取消了视频下载', 'warning')
}

// 下载视频
const downloadVideo = async () => {
  const playUrl = videoInfo.value?.aweme_detail?.video?.play_addr?.url_list[0]
  if (!playUrl) {
    Message.error('没有可下载的视频')
    logStore.addLog('下载失败: 没有可用的视频链接', 'error')
    return
  }

  logStore.addLog('准备下载视频...', 'info')
  window.electron.ipcRenderer.send('prepare-download', {
    url: playUrl,
    filename: `${videoInfo.value.aweme_detail.item_title || '抖音视频'}_${new Date().getTime()}.mp4`
  })
}

// 监听保存对话框结果
window.electron.ipcRenderer.on('save-dialog-complete', (event, data) => {
  if (data.canceled) {
    return
  }

  // 开始显示下载进度并开始下载
  isDownloading.value = true
  downloadStatus.value = 'downloading'
  downloadProgress.value = 0
  downloadSpeed.value = '计算中...'
  remainingTime.value = '计算中...'
  downloadedSize.value = '0 MB'
  totalSize.value = '计算中...'
  savedFilePath.value = ''
  errorMessage.value = ''

  logStore.addLog('开始下载视频...', 'info')
  window.electron.ipcRenderer.send('start-download', data)
})

// 监听下载进度
window.electron.ipcRenderer.on('download-progress', (event, data) => {
  const { progress, bytesReceived, totalBytes, speed } = data

  downloadProgress.value = Math.round(progress * 100)
  downloadedSize.value = formatBytes(bytesReceived)
  totalSize.value = formatBytes(totalBytes)

  if (speed) {
    downloadSpeed.value = formatBytes(speed) + '/s'
    // 计算剩余时间
    const remainingBytes = totalBytes - bytesReceived
    const remainingSeconds = remainingBytes / speed
    remainingTime.value = formatTime(remainingSeconds)
  } else {
    downloadSpeed.value = '计算中...'
    remainingTime.value = '计算中...'
  }

  logStore.addLog(`下载进度: ${downloadProgress.value}%`, 'info')
})

// 监听下载完成
window.electron.ipcRenderer.on('download-complete', (event, data) => {
  downloadStatus.value = 'completed'
  savedFilePath.value = data.filePath
  logStore.addLog('视频下载完成', 'success')
})

// 监听下载错误
window.electron.ipcRenderer.on('download-error', (event, error) => {
  downloadStatus.value = 'error'
  errorMessage.value = error
  logStore.addLog(`下载失败: ${error}`, 'error')
})
</script>

<style lang="scss" scoped>
.douyin {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;

  .search-container {
    display: flex;
    gap: 20px;
    position: fixed;
    z-index: 90;
    padding: 20px;
    transition: all 0.3s ease;

    .search-input {
      height: 42px;
      width: 400px;
      border-radius: 20px;
      padding: 0 40px 0 20px;
      outline: none;
      border: 1px solid var(--color-neutral-6);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.3s ease;

      &:focus {
        border-color: rgb(var(--arcoblue-6));
        box-shadow: 0 0 0 2px rgba(var(--arcoblue-6), 0.2);
      }
    }

    .input-wrapper {
      position: relative;
      width: 400px;

      .clear-icon {
        position: absolute;
        right: 12px;
        top: 50%;
        transform: translateY(-50%);
        cursor: pointer;
        color: var(--color-text-3);
        transition: color 0.3s ease;

        &:hover {
          color: var(--color-text-1);
        }
      }
    }

    .search-btn {
      height: 42px;
      width: 120px;
      border-radius: 20px;
      background-color: rgb(var(--arcoblue-6));
      border: none;
      color: var(--color-white);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      justify-content: center;
      transition: all 0.3s ease;

      &:hover {
        background-color: rgb(var(--arcoblue-7));
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  .progress-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;

    .progress-container {
      background: var(--color-bg-2);
      padding: 30px;
      border-radius: 8px;
      width: 400px;
      text-align: center;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);

      .progress-icon {
        font-size: 40px;
        color: rgb(var(--arcoblue-6));
        margin-bottom: 16px;
        animation: spin 1s linear infinite;
      }

      .icon {
        font-size: 40px;
        color: rgb(var(--arcoblue-6));
        margin-bottom: 16px;
      }

      .progress-text {
        font-size: 18px;
        margin-bottom: 20px;
        color: var(--color-text-1);
      }

      .progress-bar {
        height: 6px;
        background: var(--color-fill-2);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 12px;

        .progress-inner {
          height: 100%;
          background: rgb(var(--arcoblue-6));
          transition: width 0.3s ease;
        }
      }

      .progress-status {
        font-size: 14px;
        color: var(--color-text-3);
        margin-bottom: 20px;
      }

      .progress-actions {
        display: flex;
        justify-content: center;

        .arco-btn {
          min-width: 120px;
        }
      }
    }
  }

  .video-info {
    width: 100%;
    margin: 20px auto;
    margin-top: 100px;
    max-width: 650px;
    padding: 20px;
    background: var(--color-bg-2);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    .author-info {
      display: flex;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--color-neutral-3);

      .author-avatar {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        object-fit: cover;
      }

      .author-details {
        margin-left: 16px;

        .author-name {
          margin: 0;
          font-size: 18px;
          color: var(--color-text-1);
        }

        .author-signature {
          margin: 4px 0 0;
          font-size: 14px;
          color: var(--color-text-3);
        }
      }
    }

    .video-details {
      .video-header {
        margin-bottom: 16px;

        .video-title {
          margin: 0 0 12px;
          font-size: 20px;
          color: var(--color-text-1);
        }

        .video-stats {
          display: flex;
          gap: 16px;
          color: var(--color-text-3);
          font-size: 14px;

          span {
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }
      }

      .video-cover {
        margin-bottom: 16px;
        border-radius: 8px;
        overflow: hidden;

        img {
          width: 100%;
          height: auto;
          object-fit: cover;
        }
      }

      .video-desc {
        margin: 0 0 16px;
        font-size: 14px;
        color: var(--color-text-2);
        line-height: 1.6;
      }

      .video-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }

      .video-actions {
        display: flex;
        justify-content: flex-end;
      }
    }
  }

  .loading-container {
    width: 100%;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .download-info {
    margin: 16px 0;
    font-size: 14px;
    color: var(--color-text-2);
    text-align: center;

    .speed,
    .remaining,
    .size {
      margin: 4px 0;
    }
  }

  .complete-info {
    margin: 16px 0;

    .save-path {
      font-size: 14px;
      color: var(--color-text-2);
      word-break: break-all;
      padding: 0 20px;
    }
  }

  .error-info {
    margin: 16px 0;

    .error-message {
      font-size: 14px;
      color: var(--color-danger-light-4);
      word-break: break-all;
      padding: 0 20px;
    }
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
