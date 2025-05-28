<template>
  <div class="douyin">
    <!-- 切换模式的标签页 -->
    <a-tabs default-active-key="single">
      <a-tab-pane key="single" title="单个解析">
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
      </a-tab-pane>

      <a-tab-pane key="batch" title="批量解析">
        <div class="batch-container">
          <div class="input-methods">
            <a-tabs>
              <a-tab-pane key="text" title="文本输入">
                <a-textarea
                  v-model="batchInputText"
                  placeholder="请输入多个抖音视频链接，每行一个"
                  :auto-size="{ minRows: 4, maxRows: 8 }"
                />
              </a-tab-pane>
              <a-tab-pane key="excel" title="Excel导入">
                <div class="excel-upload">
                  <div
                    class="upload-area"
                    @click="triggerFileInput"
                    @drop.prevent="handleFileDrop"
                    @dragover.prevent
                  >
                    <icon-upload />
                    <p>点击或拖拽Excel文件到此处</p>
                    <input
                      ref="fileInput"
                      type="file"
                      accept=".xlsx,.xls"
                      style="display: none"
                      @change="handleFileSelect"
                    />
                  </div>
                  <div v-if="excelColumns.length > 0" class="column-select">
                    <p>请选择包含抖音链接的列：</p>
                    <a-select v-model="selectedColumn" placeholder="选择要解析的列">
                      <a-option
                        v-for="column in excelColumns"
                        :key="column.key"
                        :value="column.key"
                      >
                        {{ column.title }}
                      </a-option>
                    </a-select>
                  </div>
                </div>
              </a-tab-pane>
            </a-tabs>
          </div>

          <div class="batch-actions">
            <a-space>
              <a-button type="primary" :loading="isBatchLoading" @click="startBatchParse">
                开始批量解析
              </a-button>
              <a-button
                type="primary"
                status="success"
                :disabled="!hasSelectedVideos"
                @click="batchDownload"
              >
                批量下载选中视频
              </a-button>
            </a-space>
          </div>

          <div class="batch-table">
            <a-table
              v-model:selected-keys="selectedRows"
              :columns="tableColumns"
              :data="batchVideoList"
              :pagination="{ pageSize: 10 }"
              :loading="isBatchLoading"
              row-key="id"
              :row-selection="rowSelection"
            >
              <template #cover="{ record }">
                <img :src="record.cover" class="video-cover-thumbnail" :alt="record.title" />
              </template>
              <template #status="{ record }">
                <a-tag :color="getStatusColor(record.status)">
                  {{ getStatusText(record.status) }}
                </a-tag>
              </template>
              <template #operations="{ record }">
                <a-space>
                  <a-button
                    type="text"
                    size="small"
                    :disabled="record.status !== 'success'"
                    @click="downloadSingle(record)"
                  >
                    <template #icon><icon-download /></template>
                    下载
                  </a-button>
                  <a-button type="text" size="small" status="danger" @click="removeVideo(record)">
                    <template #icon><icon-delete /></template>
                    删除
                  </a-button>
                </a-space>
              </template>
            </a-table>
          </div>
        </div>
      </a-tab-pane>
    </a-tabs>

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
    <div v-if="isDownloading && !isBatchDownloading" class="progress-overlay">
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

    <!-- 批量下载进度遮罩层 -->
    <div v-if="isBatchDownloading" class="progress-overlay">
      <div class="progress-container batch-progress">
        <div class="progress-header">
          <div class="icon">
            <icon-download />
          </div>
          <div class="progress-text">批量下载进度</div>
          <div class="progress-summary">{{ completedCount }}/{{ totalCount }} 个视频</div>
        </div>

        <div class="download-list">
          <div v-for="item in downloadList" :key="item.id" class="download-item">
            <div class="item-info">
              <img :src="item.cover" class="item-cover" />
              <div class="item-details">
                <div class="item-title">{{ item.title }}</div>
                <div class="item-author">{{ item.author }}</div>
              </div>
              <div class="item-status">
                <template v-if="item.status === 'waiting'">
                  <icon-clock-circle />
                  等待下载
                </template>
                <template v-else-if="item.status === 'downloading'">
                  <icon-loading /> {{ item.progress }}%
                </template>
                <template v-else-if="item.status === 'completed'">
                  <icon-check-circle style="color: var(--color-success-light-4)" /> 下载完成
                </template>
                <template v-else-if="item.status === 'error'">
                  <icon-close-circle style="color: var(--color-danger-light-4)" />
                  {{ item.error || '下载失败' }}
                </template>
              </div>
            </div>
            <div v-if="item.status === 'downloading'" class="item-progress">
              <div class="progress-bar">
                <div class="progress-inner" :style="{ width: item.progress + '%' }"></div>
              </div>
              <div class="progress-info">
                <span>{{ item.downloadedSize }} / {{ item.totalSize }}</span>
                <span>{{ item.speed }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="progress-actions">
          <a-button v-if="hasWaitingDownloads" status="danger" @click="cancelBatchDownload">
            <template #icon><icon-close /></template>
            取消下载
          </a-button>
          <a-button v-else type="primary" @click="closeBatchDownloadDialog">
            <template #icon><icon-check /></template>
            完成
          </a-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useLogStore } from '../../stores/log'
import { formatBytes, formatTime } from '../../utils/format'
import * as XLSX from 'xlsx'

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

// 批量处理相关的变量
const batchInputText = ref('')
const isBatchLoading = ref(false)
const batchVideoList = ref([])
const selectedRows = ref([])
const fileInput = ref(null)
const excelColumns = ref([])
const selectedColumn = ref('')
const excelData = ref([])

// 表格列定义
const tableColumns = [
  { title: '封面', slotName: 'cover', width: 100 },
  { title: '标题', dataIndex: 'title' },
  { title: '作者', dataIndex: 'author' },
  { title: '点赞数', dataIndex: 'diggCount' },
  { title: '状态', slotName: 'status', width: 100 },
  { title: '操作', slotName: 'operations', width: 150, fixed: 'right' }
]

const rowSelection = reactive({
  type: 'checkbox',
  showCheckedAll: true,
  onlyCurrent: false
})

// 计算属性：是否有选中的视频
const hasSelectedVideos = computed(() => selectedRows.value.length > 0)

// 从文本中提取抖音链接
const extractDouyinUrl = (text) => {
  // 匹配抖音链接的正则表达式（支持更多格式的分享文本）
  const douyinRegex =
    /https?:\/\/(?:(?:www\.)?douyin\.com\/video\/[0-9]+|v\.douyin\.com\/[a-zA-Z0-9_-]+)/
  const match = text.match(douyinRegex)
  return match ? match[0] : null
}

// 处理粘贴事件
const handlePaste = (e) => {
  e.preventDefault() // 阻止默认粘贴行为
  const pastedText = e.clipboardData.getData('text')
  // 直接使用完整的粘贴文本
  inputText.value = pastedText
  logStore.addLog(`已粘贴分享文本`, 'info')
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
    Message.error('未在文本中找到有效的抖音视频链接')
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
  console.log('data', data)
  logStore.addLog('成功获取抖音视频信息', 'info')

  if (data.success) {
    completeProgress()
    videoInfo.value = data.data
  } else {
    progressStatus.value = '解析失败'
    progressWidth.value = 0
    logStore.addLog(`解析失败|视频不存在: ${data.error || '未知错误'}`, 'error')
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

  // 生成文件名：标题_作者_时间戳.mp4
  const fileName = `${videoInfo.value.aweme_detail.item_title || '抖音视频'}_${
    videoInfo.value.aweme_detail.author.nickname
  }_${new Date().getTime()}.mp4`

  logStore.addLog('准备下载视频...', 'info')
  window.electron.ipcRenderer.send('prepare-download', {
    url: playUrl,
    filename: fileName
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

// 触发文件选择
const triggerFileInput = () => {
  fileInput.value.click()
}

// 处理文件拖放
const handleFileDrop = (e) => {
  const file = e.dataTransfer.files[0]
  if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
    handleExcelFile(file)
  } else {
    Message.error('请上传Excel文件(.xlsx或.xls)')
  }
}

// 处理文件选择
const handleFileSelect = (e) => {
  const file = e.target.files[0]
  if (file) {
    handleExcelFile(file)
  }
}

// 处理Excel文件
const handleExcelFile = (file) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result)
      const workbook = XLSX.read(data, { type: 'array' })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

      // 使用 sheet_to_json 时设置 header: 1 来获取原始数据（包括表头）
      const rawData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })

      if (rawData.length < 2) {
        Message.error('Excel 文件必须包含表头和数据')
        return
      }

      // 第一行作为表头
      const headers = rawData[0]

      // 检查是否有空的表头
      if (headers.some((header) => !header)) {
        Message.error('Excel 文件包含空的表头，请检查')
        return
      }

      // 构建列信息
      const columns = headers.map((header, index) => ({
        key: String(index),
        title: header,
        originalHeader: header
      }))

      excelColumns.value = columns
      // 保存原始数据供后续使用
      excelData.value = rawData.slice(1) // 除去表头的数据

      Message.success('Excel 文件解析成功，请选择包含抖音链接的列')
    } catch (error) {
      Message.error('Excel 文件解析失败：' + error.message)
      console.error('Excel 解析错误:', error)
    }
  }
  reader.readAsArrayBuffer(file)
}

// 开始批量解析
const startBatchParse = async () => {
  let urls = []

  if (selectedColumn.value) {
    // 从 Excel 数据中获取链接
    const columnIndex = excelColumns.value.findIndex((col) => col.key === selectedColumn.value)
    if (columnIndex !== -1) {
      urls = excelData.value
        .map((row) => row[columnIndex])
        .filter((url) => url) // 过滤掉空值
        .map((url) => extractDouyinUrl(String(url)))
        .filter((url) => url) // 过滤掉无效链接
    }
  } else {
    // 从文本输入中获取链接
    urls = batchInputText.value
      .split('\n')
      .map((line) => extractDouyinUrl(line))
      .filter((url) => url)
  }

  if (urls.length === 0) {
    Message.error('没有找到有效的抖音链接')
    return
  }

  Message.info(`找到 ${urls.length} 个有效链接，开始解析...`)
  await processBatchUrls(urls)
}

// 处理批量URL
const processBatchUrls = async (urls) => {
  if (urls.length === 0) {
    Message.error('没有找到有效的抖音链接')
    return
  }

  isBatchLoading.value = true

  for (const url of urls) {
    const videoId = Math.random().toString(36).substr(2, 9)
    batchVideoList.value.push({
      id: videoId,
      url: url,
      title: '解析中...',
      author: '',
      cover: '',
      diggCount: 0,
      status: 'loading'
    })

    try {
      // 发送解析请求到主进程
      window.electron.ipcRenderer.send('parse-douyin', url)

      // 等待结果
      const result = await new Promise((resolve) => {
        window.electron.ipcRenderer.once('parse-douyin-result', (event, data) => {
          resolve(data)
        })
      })

      const index = batchVideoList.value.findIndex((item) => item.id === videoId)
      if (index !== -1) {
        if (result.success) {
          const videoData = result.data.aweme_detail
          batchVideoList.value[index] = {
            id: videoId,
            url: url,
            title: videoData.item_title || '无标题',
            author: videoData.author.nickname,
            cover: videoData.video.cover.url_list[0],
            diggCount: videoData.statistics.digg_count,
            playUrl: videoData.video.play_addr.url_list[0],
            status: 'success'
          }
        } else {
          batchVideoList.value[index].status = 'error'
          logStore.addLog(`解析失败|视频不存在: ${result.error || '未知错误'}`, 'error')
        }
      }
    } catch (err) {
      const index = batchVideoList.value.findIndex((item) => item.id === videoId)
      if (index !== -1) {
        batchVideoList.value[index].status = 'error'
        logStore.addLog(`解析出错: ${err.message}`, 'error')
      }
    }
  }

  isBatchLoading.value = false
  Message.success(`批量解析完成，共处理 ${urls.length} 个链接`)
}

// 获取状态颜色
const getStatusColor = (status) => {
  const colors = {
    loading: 'arcoblue',
    success: 'green',
    error: 'red'
  }
  return colors[status] || 'arcoblue'
}

// 获取状态文本
const getStatusText = (status) => {
  const texts = {
    loading: '解析中',
    success: '解析成功',
    error: '解析失败'
  }
  return texts[status] || '未知状态'
}

// 下载单个视频
const downloadSingle = (video) => {
  if (!video.playUrl) {
    Message.error('没有可用的视频下载地址')
    return
  }

  window.electron.ipcRenderer.send('prepare-download', {
    url: video.playUrl,
    filename: `${video.title || '抖音视频'}_${new Date().getTime()}.mp4`
  })
}

// 批量下载相关状态
const isBatchDownloading = ref(false)
const downloadList = ref([])
const completedCount = computed(
  () =>
    downloadList.value.filter((item) => item.status === 'completed' || item.status === 'error')
      .length
)
const totalCount = computed(() => downloadList.value.length)
const hasWaitingDownloads = computed(() =>
  downloadList.value.some((item) => item.status === 'waiting' || item.status === 'downloading')
)

// 关闭批量下载对话框
const closeBatchDownloadDialog = () => {
  isBatchDownloading.value = false
  downloadList.value = []
}

// 取消批量下载
const cancelBatchDownload = () => {
  window.electron.ipcRenderer.send('cancel-download')
  downloadList.value = downloadList.value.map((item) => {
    if (item.status === 'waiting' || item.status === 'downloading') {
      return { ...item, status: 'error', error: '用户取消下载' }
    }
    return item
  })
  logStore.addLog('用户取消了批量下载', 'warning')
}

// 下载单个视频（批量下载中的单个任务）
const downloadSingleInBatch = async (video, savePath) => {
  const downloadItem = downloadList.value.find((item) => item.id === video.id)
  if (!downloadItem) return

  try {
    // 直接开始下载，不再弹出保存对话框
    window.electron.ipcRenderer.send('start-download', {
      url: video.playUrl,
      filePath: savePath
    })

    // 等待下载完成
    const result = await new Promise((resolve) => {
      // 创建事件处理器
      const completeHandler = (event, data) => {
        window.electron.ipcRenderer.removeListener('download-progress', progressHandler)
        window.electron.ipcRenderer.removeListener('download-complete', completeHandler)
        window.electron.ipcRenderer.removeListener('download-error', errorHandler)
        resolve({ success: true, data })
      }

      const errorHandler = (event, error) => {
        window.electron.ipcRenderer.removeListener('download-progress', progressHandler)
        window.electron.ipcRenderer.removeListener('download-complete', completeHandler)
        window.electron.ipcRenderer.removeListener('download-error', errorHandler)
        resolve({ success: false, error })
      }

      // 创建进度监听器
      const progressHandler = (event, data) => {
        if (downloadItem.status === 'downloading') {
          downloadItem.progress = Math.round(data.progress * 100)
          downloadItem.downloadedSize = formatBytes(data.bytesReceived)
          downloadItem.totalSize = formatBytes(data.totalBytes)
          downloadItem.speed = formatBytes(data.speed) + '/s'

          // 如果进度达到 100%，自动设置为完成状态
          if (data.progress >= 1) {
            downloadItem.status = 'completed'
            downloadItem.progress = 100
            downloadItem.speed = '0 KB/s'
            // 移除所有监听器
            window.electron.ipcRenderer.removeListener('download-progress', progressHandler)
            window.electron.ipcRenderer.removeListener('download-complete', completeHandler)
            window.electron.ipcRenderer.removeListener('download-error', errorHandler)
            // 立即解析 Promise，不等待 complete 事件
            resolve({ success: true, data: { filePath: savePath } })
          }
        }
      }

      // 添加进度监听器
      window.electron.ipcRenderer.on('download-progress', progressHandler)
      window.electron.ipcRenderer.once('download-complete', completeHandler)
      window.electron.ipcRenderer.once('download-error', errorHandler)
    })

    if (result.success) {
      downloadItem.status = 'completed'
      downloadItem.progress = 100 // 确保进度显示为100%
      logStore.addLog(`视频 "${video.title}" 下载完成`, 'success')
    } else {
      downloadItem.status = 'error'
      downloadItem.error = result.error
      logStore.addLog(`视频 "${video.title}" 下载失败: ${result.error}`, 'error')
    }
  } catch (err) {
    downloadItem.status = 'error'
    downloadItem.error = err.message
    logStore.addLog(`视频 "${video.title}" 下载出错: ${err.message}`, 'error')
  }
}

// 批量下载选中的视频
const batchDownload = async () => {
  const selectedVideos = batchVideoList.value.filter(
    (video) => selectedRows.value.includes(video.id) && video.status === 'success'
  )

  if (selectedVideos.length === 0) {
    Message.warning('请选择要下载的视频')
    return
  }

  try {
    // 先选择保存目录
    const saveResult = await new Promise((resolve) => {
      window.electron.ipcRenderer.send('select-directory')
      window.electron.ipcRenderer.once('directory-selected', (event, data) => {
        resolve(data)
      })
    })

    if (saveResult.canceled) {
      return
    }

    // 初始化下载列表
    downloadList.value = selectedVideos.map((video) => ({
      ...video,
      status: 'waiting',
      progress: 0,
      downloadedSize: '0 MB',
      totalSize: '计算中...',
      speed: '0 KB/s',
      error: null,
      // 修改文件名格式：标题_作者_时间戳.mp4
      savePath: `${saveResult.filePath}/${video.title || '抖音视频'}_${video.author}_${new Date().getTime()}.mp4`
    }))

    isBatchDownloading.value = true

    // 串行下载，避免并发问题
    for (const video of selectedVideos) {
      const downloadItem = downloadList.value.find((item) => item.id === video.id)
      if (downloadItem) {
        downloadItem.status = 'downloading'
        try {
          await downloadSingleInBatch(video, downloadItem.savePath)
          // 添加一个小延迟，确保状态更新和事件清理完成
          await new Promise((resolve) => setTimeout(resolve, 500))
        } catch (err) {
          console.error('下载出错:', err)
          // 继续下一个视频的下载
          continue
        }
      }
    }
  } catch (err) {
    Message.error('批量下载初始化失败：' + err.message)
    logStore.addLog('批量下载初始化失败：' + err.message, 'error')
  }
}

// 移除视频
const removeVideo = (video) => {
  const index = batchVideoList.value.findIndex((item) => item.id === video.id)
  if (index !== -1) {
    batchVideoList.value.splice(index, 1)
  }
}
</script>

<style lang="scss" scoped>
// Mixins
@mixin text-ellipsis {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.douyin {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  box-sizing: border-box;
  background: var(--color-bg-1);

  :deep(.arco-tabs) {
    height: 100%;

    .arco-tabs-content {
      height: calc(100% - 46px);
      padding: 16px 0;
    }

    .arco-tab-pane {
      height: 100%;
    }
  }

  .search-container {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    padding: 16px;
    background: var(--color-bg-2);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);

    .input-wrapper {
      flex: 1;
      position: relative;

      .search-input {
        width: 100%;
        height: 42px;
        border-radius: 8px;
        padding: 0 40px 0 16px;
        border: 1px solid var(--color-neutral-3);
        transition: all 0.3s ease;

        &:focus {
          border-color: rgb(var(--arcoblue-6));
          box-shadow: 0 0 0 2px rgba(var(--arcoblue-6), 0.1);
        }
      }

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
      min-width: 120px;
      height: 42px;
      border-radius: 8px;
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
      }

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }
  }

  .video-info {
    background: var(--color-bg-2);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    overflow: hidden;

    .author-info {
      display: flex;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid var(--color-neutral-3);

      .author-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        object-fit: cover;
      }

      .author-details {
        margin-left: 16px;
        flex: 1;

        .author-name {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
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
      padding: 20px;

      .video-header {
        margin-bottom: 20px;

        .video-title {
          margin: 0 0 16px;
          font-size: 18px;
          color: var(--color-text-1);
        }

        .flex {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .video-stats {
          display: flex;
          gap: 20px;
          color: var(--color-text-3);

          span {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 14px;
          }
        }
      }

      .video-cover {
        margin: 0 -20px;
        position: relative;
        padding-top: 56.25%; // 16:9 比例

        img {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
      }

      .video-desc {
        margin: 20px 0;
        font-size: 14px;
        line-height: 1.6;
        color: var(--color-text-2);
      }

      .video-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
    }
  }

  .batch-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;

    .input-methods {
      background: var(--color-bg-2);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      overflow: hidden;

      :deep(.arco-tabs-content) {
        padding: 20px;
      }

      .arco-textarea {
        width: 100%;
        border-radius: 4px;
        resize: none;
      }

      .excel-upload {
        .upload-area {
          border: 2px dashed var(--color-neutral-3);
          border-radius: 8px;
          padding: 32px;
          text-align: center;
          cursor: pointer;
          transition: all 0.3s ease;

          &:hover {
            border-color: rgb(var(--arcoblue-6));
            background: var(--color-fill-1);
          }

          .arco-icon {
            font-size: 40px;
            color: var(--color-text-3);
            margin-bottom: 12px;
          }

          p {
            color: var(--color-text-3);
            margin: 0;
          }
        }

        .column-select {
          margin-top: 20px;
          text-align: center;

          p {
            margin-bottom: 12px;
            color: var(--color-text-2);
          }

          .arco-select {
            width: 240px;
          }
        }
      }
    }

    .batch-actions {
      padding: 16px;
      background: var(--color-bg-2);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      display: flex;
      justify-content: flex-end;
      gap: 12px;
    }

    .batch-table {
      flex: 1;
      background: var(--color-bg-2);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      overflow: hidden;

      :deep(.arco-table) {
        .arco-table-th {
          background: var(--color-fill-1);
        }

        .video-cover-thumbnail {
          width: 120px;
          height: 68px;
          object-fit: cover;
          border-radius: 4px;
        }

        .arco-table-td {
          vertical-align: middle;
        }
      }
    }
  }

  .progress-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;

    .progress-container {
      background: var(--color-bg-2);
      padding: 32px;
      border-radius: 12px;
      width: 420px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);

      .progress-icon,
      .icon {
        font-size: 48px;
        color: rgb(var(--arcoblue-6));
        margin-bottom: 20px;
      }

      .progress-icon {
        animation: spin 1s linear infinite;
      }

      .progress-text {
        font-size: 18px;
        margin-bottom: 24px;
        color: var(--color-text-1);
      }

      .progress-bar {
        height: 8px;
        background: var(--color-fill-2);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 16px;

        .progress-inner {
          height: 100%;
          background: rgb(var(--arcoblue-6));
          transition: width 0.3s ease;
        }
      }

      .progress-status {
        font-size: 14px;
        color: var(--color-text-3);
        margin-bottom: 24px;
      }

      .progress-actions {
        display: flex;
        justify-content: center;
        gap: 12px;

        .arco-btn {
          min-width: 120px;
          height: 36px;
        }
      }

      .download-info {
        margin: 20px 0;
        font-size: 14px;
        color: var(--color-text-2);

        .speed,
        .remaining,
        .size {
          margin: 8px 0;
        }
      }

      .complete-info,
      .error-info {
        margin: 20px 0;
        padding: 0 24px;

        p {
          font-size: 14px;
          word-break: break-all;
          margin: 0;
        }
      }

      .complete-info p {
        color: var(--color-text-2);
      }

      .error-info p {
        color: rgb(var(--red-6));
      }
    }
  }

  .batch-progress {
    width: 600px !important;
    max-height: 80vh;
    display: flex;
    flex-direction: column;

    .progress-header {
      text-align: center;
      margin-bottom: 24px;

      .icon {
        font-size: 48px;
        color: rgb(var(--arcoblue-6));
        margin-bottom: 16px;
      }

      .progress-text {
        font-size: 20px;
        color: var(--color-text-1);
      }

      .progress-summary {
        font-size: 14px;
        color: var(--color-text-3);
      }
    }

    .download-list {
      flex: 1;
      overflow-y: auto;
      margin: 0 -32px;
      padding: 0 32px;

      .download-item {
        background: var(--color-fill-1);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;

        .item-info {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;

          .item-cover {
            width: 80px;
            height: 45px;
            border-radius: 4px;
            object-fit: cover;
          }

          .item-details {
            flex: 1;
            min-width: 0;

            .item-title {
              font-size: 14px;
              color: var(--color-text-1);
              margin-bottom: 4px;
              @include text-ellipsis;
            }

            .item-author {
              font-size: 13px;
              color: var(--color-text-3);
            }
          }

          .item-status {
            font-size: 13px;
            color: var(--color-text-2);
            display: flex;
            align-items: center;
            gap: 4px;
          }
        }

        .item-progress {
          .progress-bar {
            height: 4px;
            background: var(--color-fill-3);
            border-radius: 2px;
            overflow: hidden;
            margin-bottom: 8px;

            .progress-inner {
              height: 100%;
              background: rgb(var(--arcoblue-6));
              transition: width 0.3s ease;
            }
          }

          .progress-info {
            display: flex;
            justify-content: space-between;
            font-size: 12px;
            color: var(--color-text-3);
          }
        }
      }
    }

    .progress-actions {
      margin-top: 24px;
      display: flex;
      justify-content: center;
      gap: 12px;
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
