import { app, BrowserWindow, ipcMain, dialog, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs'
import https from 'https'
import http from 'http'

// 支持的图片格式

// 用于存储当前的下载请求和解析窗口
let currentDownloadRequest = null
let currentParseWindow = null
let mainWindow = null

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
      webSecurity: true, // 启用 web 安全
      allowRunningInsecureContent: false // 禁止加载不安全内容
    }
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
