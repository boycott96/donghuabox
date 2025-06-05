import { app, BrowserWindow, ipcMain, dialog, net, Tray, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { autoUpdater } from 'electron-updater'
import log from 'electron-log'

// 支持的图片格式

// 用于存储当前的下载请求和解析窗口
let currentDownloadRequest = null
let currentParseWindow = null
let mainWindow = null
let tray = null

// 配置日志
log.transports.file.level = 'info'
log.info('应用启动')
autoUpdater.logger = log

// 配置更新服务器
const updateServerUrl = 'https://donghuabox.cn-nb1.rains3.com/updates' // 使用配置文件中的地址
autoUpdater.setFeedURL({
  provider: 'generic',
  url: updateServerUrl,
  channel: 'latest'
})

// 禁用自动下载
autoUpdater.autoDownload = false

// 确保只运行一个实例
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    // 当运行第二个实例时，聚焦到主窗口
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

function createTray() {
  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    {
      label: '退出',
      click: () => {
        app.quit()
      }
    }
  ])

  tray.setToolTip('动画箱')
  tray.setContextMenu(contextMenu)

  // 点击托盘图标时显示主窗口
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 850,
    minWidth: 1000,
    minHeight: 850,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  // 添加窗口最小化到托盘的功能
  mainWindow.on('minimize', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })

  // 添加关闭按钮的处理
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow.hide()
      return false
    }
    return true
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  // mainWindow.webContents.openDevTools()

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// 下载函数
function downloadFile(url, savePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(savePath)
    const httpClient = url.startsWith('https') ? https : http
    let startTime = Date.now()
    let lastBytes = 0
    let lastTime = startTime
    let progressTimeout = null

    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
        Accept: '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: 'https://www.douyin.com/',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-platform': '"Windows"'
      }
    }

    const clearProgressTimeout = () => {
      if (progressTimeout) {
        clearTimeout(progressTimeout)
        progressTimeout = null
      }
    }

    // 发送进度消息的函数
    const sendProgress = (progress, bytesReceived, totalBytes, speed) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-progress', {
          progress,
          bytesReceived,
          totalBytes,
          speed
        })
      }
    }

    const request = httpClient.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        clearProgressTimeout()
        return reject({ success: false, message: `HTTP错误: ${response.statusCode}` })
      }

      const totalBytes = parseInt(response.headers['content-length'], 10)
      let downloadedBytes = 0

      // 设置超时检测
      const checkProgress = () => {
        clearProgressTimeout()
        progressTimeout = setTimeout(() => {
          // 如果 5 秒内没有新的数据，发送当前进度
          const currentTime = Date.now()
          const speed = ((downloadedBytes - lastBytes) * 1000) / (currentTime - lastTime)
          lastBytes = downloadedBytes
          lastTime = currentTime

          sendProgress(downloadedBytes / totalBytes, downloadedBytes, totalBytes, speed)
          checkProgress()
        }, 5000)
      }

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        const currentTime = Date.now()

        if (currentTime - lastTime >= 1000) {
          const speed = ((downloadedBytes - lastBytes) * 1000) / (currentTime - lastTime)
          lastBytes = downloadedBytes
          lastTime = currentTime

          sendProgress(downloadedBytes / totalBytes, downloadedBytes, totalBytes, speed)
          // 重置进度检测
          checkProgress()
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        clearProgressTimeout()
        file.close()
        currentDownloadRequest = null
        // 确保发送 100% 进度
        sendProgress(1, totalBytes, totalBytes, 0)
        resolve({ success: true, message: '视频下载完成', path: savePath })
      })

      file.on('error', (err) => {
        clearProgressTimeout()
        file.close()
        fs.unlink(savePath, () => {})
        currentDownloadRequest = null
        reject({ success: false, message: `文件写入错误: ${err.message}` })
      })

      // 开始进度检测
      checkProgress()
    })

    // 保存当前下载请求的引用
    currentDownloadRequest = {
      request,
      file,
      savePath,
      cleanup: () => {
        clearProgressTimeout()
        if (currentDownloadRequest) {
          currentDownloadRequest = null
        }
      }
    }

    request.on('error', (err) => {
      clearProgressTimeout()
      file.close()
      fs.unlink(savePath, () => {})
      currentDownloadRequest = null
      reject({ success: false, message: `网络错误: ${err.message}` })
    })
  })
}

// 取消下载
ipcMain.on('cancel-download', () => {
  if (currentDownloadRequest) {
    const { request, file, savePath, cleanup } = currentDownloadRequest
    cleanup()
    request.abort() // 中断请求
    file.close() // 关闭文件流
    fs.unlink(savePath, () => {}) // 删除未完成的文件
    currentDownloadRequest = null
  }
})

// 取消解析
ipcMain.on('cancel-parse', () => {
  if (currentParseWindow) {
    currentParseWindow.destroy() // 销毁解析窗口
    currentParseWindow = null
  }
})

// 准备下载，显示保存对话框
ipcMain.on('prepare-download', async (event, { url, filename }) => {
  try {
    // 让用户选择保存位置
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '选择保存位置',
      defaultPath: filename,
      buttonLabel: '保存视频'
    })

    // 发送保存对话框结果
    mainWindow.webContents.send('save-dialog-complete', {
      canceled: result.canceled,
      filePath: result.filePath,
      url: url
    })
  } catch (error) {
    mainWindow.webContents.send('download-error', error.message)
  }
})

// 选择保存目录
ipcMain.on('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择保存目录',
      properties: ['openDirectory', 'createDirectory'],
      buttonLabel: '选择目录'
    })

    mainWindow.webContents.send('directory-selected', {
      canceled: result.canceled,
      filePath: result.filePaths[0]
    })
  } catch (error) {
    mainWindow.webContents.send('directory-selected', {
      canceled: true,
      error: error.message
    })
  }
})

// 开始实际下载
ipcMain.on('start-download', async (event, { url, filePath }) => {
  try {
    const result = await downloadFile(url, filePath)

    if (result.success) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('download-complete', {
          success: true,
          filePath: filePath
        })
      }
    } else {
      throw new Error(result.message)
    }
  } catch (error) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('download-error', error.message)
    }
  }
})

// 处理抖音链接解析
ipcMain.on('parse-douyin', async (event, url) => {
  try {
    if (currentParseWindow) {
      currentParseWindow.destroy()
    }

    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        partition: 'persist:douyin',
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    })
    currentParseWindow = win

    let isProcessed = false

    // 监听目标请求
    win.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.douyin.com/*'] },
      (details, callback) => {
        if (!isProcessed && details.url.includes('/aweme/v1/web/aweme/detail/')) {
          isProcessed = true

          // 复刻请求
          const allowedHeaders = [
            'user-agent',
            'referer',
            'cookie',
            'accept',
            'accept-language',
            'x-bogus',
            'msToken'
          ]
          const request = net.request({ method: details.method, url: details.url })
          Object.entries(details.requestHeaders).forEach(([k, v]) => {
            if (allowedHeaders.includes(k.toLowerCase())) {
              try {
                request.setHeader(k, v)
              } catch (e) {
                console.warn('设置header失败:', k, v, e.message)
              }
            }
          })
          let raw = ''
          request.on('response', (res) => {
            res.on('data', (chunk) => (raw += chunk))
            res.on('end', () => {
              try {
                const data = JSON.parse(raw)
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('parse-douyin-result', {
                    success: true,
                    data: data
                  })
                }
              } catch (err) {
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('parse-douyin-result', {
                    success: false,
                    error: 'JSON解析失败: ' + err.message,
                    raw: raw
                  })
                }
              }
              // 关闭窗口
              if (currentParseWindow) {
                currentParseWindow.destroy()
                currentParseWindow = null
              }
            })
          })
          request.on('error', (err) => {
            console.error('复刻请求失败:', err)
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('parse-douyin-result', {
                success: false,
                error: '复刻请求失败: ' + err.message
              })
            }
            if (currentParseWindow) {
              currentParseWindow.destroy()
              currentParseWindow = null
            }
          })
          request.end()
        }
        callback({ requestHeaders: details.requestHeaders })
      }
    )

    // 加载页面
    await win.loadURL(url)
  } catch (error) {
    console.error('初始化失败:', error)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('parse-douyin-result', {
        success: false,
        error: `初始化失败: ${error.message}`
      })
    }
    if (currentParseWindow) {
      currentParseWindow.destroy()
      currentParseWindow = null
    }
  }
})

// 检查更新
async function checkForUpdates() {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('add-log', {
        message: '开始检查更新...',
        type: 'info'
      })
    }
    const result = await autoUpdater.checkForUpdates()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('add-log', {
        message: `检查更新结果: ${JSON.stringify(result.updateInfo)}`,
        type: 'info'
      })
    }
    return result
  } catch (error) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('add-log', {
        message: `检查更新失败: ${error.message}`,
        type: 'error'
      })
    }
    return null
  }
}

// 发送状态到窗口
function sendStatusToWindow(text, type = 'info') {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-message', text)
    mainWindow.webContents.send('add-log', {
      message: text,
      type: type
    })
  }
}

// 监听自动更新事件
autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('正在检查更新...', 'info')
})

autoUpdater.on('update-available', (info) => {
  sendStatusToWindow(`发现新版本: ${info.version}，是否更新？`, 'info')
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-available', info)
  }
})

autoUpdater.on('update-not-available', () => {
  sendStatusToWindow(`当前版本 ${app.getVersion()} 已是最新版本`, 'info')
})

autoUpdater.on('error', (err) => {
  sendStatusToWindow(`更新出错: ${err.message}`, 'error')
})

autoUpdater.on('download-progress', (progressObj) => {
  let message = `下载速度: ${progressObj.bytesPerSecond} - 已下载 ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`
  sendStatusToWindow(message, 'info')
})

autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('更新已下载，将在退出时安装', 'info')
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-downloaded', info)
  }
})

// 添加新的 IPC 处理程序
ipcMain.handle('start-download', () => {
  sendStatusToWindow('开始下载更新...', 'info')
  return autoUpdater.downloadUpdate()
})

ipcMain.handle('quit-and-install', () => {
  sendStatusToWindow('准备安装更新...', 'info')
  autoUpdater.quitAndInstall(false, true)
})

// 修改原有的检查更新 IPC 处理程序
ipcMain.handle('check-for-updates', async () => {
  sendStatusToWindow('手动触发检查更新', 'info')
  return await checkForUpdates()
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()
  createTray()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // 等待主窗口完全加载后再检查更新
  mainWindow.webContents.on('did-finish-load', () => {
    // 延迟 3 秒检查更新，确保渲染进程已经准备好接收消息
    setTimeout(async () => {
      sendStatusToWindow('应用启动，自动检查更新...', 'info')
      await checkForUpdates()
    }, 3000)
  })

  // 每4小时检查一次更新
  setInterval(
    async () => {
      sendStatusToWindow('定时检查更新...', 'info')
      await checkForUpdates()
    },
    4 * 60 * 60 * 1000
  )
})

// 修改退出处理
app.on('before-quit', () => {
  app.isQuitting = true
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
