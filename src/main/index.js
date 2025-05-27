import { app, BrowserWindow, ipcMain, dialog } from 'electron'
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

function createWindow() {
  const mainWindow = new BrowserWindow({
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

  mainWindow.webContents.openDevTools()

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

    const options = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        Referer: 'https://www.douyin.com/',
        'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120"',
        'sec-ch-ua-platform': '"Windows"'
      }
    }

    const request = httpClient.get(url, options, (response) => {
      if (response.statusCode !== 200) {
        return reject({ success: false, message: `HTTP错误: ${response.statusCode}` })
      }

      const totalBytes = parseInt(response.headers['content-length'], 10)
      let downloadedBytes = 0

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length
        const currentTime = Date.now()
        
        if (currentTime - lastTime >= 1000) {
          const speed = ((downloadedBytes - lastBytes) * 1000) / (currentTime - lastTime)
          lastBytes = downloadedBytes
          lastTime = currentTime

          BrowserWindow.getFocusedWindow()?.webContents.send('download-progress', {
            progress: downloadedBytes / totalBytes,
            bytesReceived: downloadedBytes,
            totalBytes: totalBytes,
            speed: speed
          })
        }
      })

      response.pipe(file)

      file.on('finish', () => {
        file.close()
        currentDownloadRequest = null
        resolve({ success: true, message: '视频下载完成', path: savePath })
      })

      file.on('error', (err) => {
        file.close()
        fs.unlink(savePath, () => {})
        currentDownloadRequest = null
        reject({ success: false, message: `文件写入错误: ${err.message}` })
      })
    })

    // 保存当前下载请求的引用
    currentDownloadRequest = { request, file, savePath }

    request.on('error', (err) => {
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
    const { request, file, savePath } = currentDownloadRequest
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
    const win = BrowserWindow.getFocusedWindow()

    // 让用户选择保存位置
    const result = await dialog.showSaveDialog(win, {
      title: '选择保存位置',
      defaultPath: filename,
      buttonLabel: '保存视频'
    })

    // 发送保存对话框结果
    win.webContents.send('save-dialog-complete', {
      canceled: result.canceled,
      filePath: result.filePath,
      url: url
    })
  } catch (error) {
    BrowserWindow.getFocusedWindow()?.webContents.send('download-error', error.message)
  }
})

// 开始实际下载
ipcMain.on('start-download', async (event, { url, filePath }) => {
  try {
    const result = await downloadFile(url, filePath)

    if (result.success) {
      BrowserWindow.getFocusedWindow()?.webContents.send('download-complete', {
        success: true,
        filePath: filePath
      })
    } else {
      throw new Error(result.message)
    }
  } catch (error) {
    BrowserWindow.getFocusedWindow()?.webContents.send('download-error', error.message)
  }
})

// 处理抖音链接解析
ipcMain.on('parse-douyin', async (event, url) => {
  try {
    // 如果有正在进行的解析，先关闭它
    if (currentParseWindow) {
      currentParseWindow.destroy()
    }

    const douyinWindow = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false
      }
    })

    // 保存当前解析窗口的引用
    currentParseWindow = douyinWindow

    const filter = {
      urls: [
        'https://www.douyin.com/aweme/v1/web/aweme/detail/*',
        'https://*.douyin.com/aweme/v1/web/aweme/detail/*'
      ]
    }

    let isProcessed = false

    douyinWindow.webContents.session.webRequest.onCompleted(filter, async (details) => {
      if (details.statusCode === 200 && !isProcessed) {
        try {
          isProcessed = true
          const response = await douyinWindow.webContents.executeJavaScript(`
            new Promise(async (resolve) => {
              try {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', '${details.url}', true);
                xhr.onload = function() {
                  try {
                    const jsonData = JSON.parse(xhr.responseText);
                    resolve({ success: true, data: jsonData });
                  } catch (e) {
                    resolve({ 
                      success: false, 
                      error: 'Parse Error', 
                      status: xhr.status,
                      responseText: xhr.responseText.substring(0, 500)  // 只获取前500个字符
                    });
                  }
                };
                xhr.onerror = function() {
                  resolve({ 
                    success: false, 
                    error: 'Network Error',
                    status: xhr.status
                  });
                };
                xhr.send();
              } catch (error) {
                resolve({ success: false, error: error.message });
              }
            })
          `)
          if (response.success && response.data) {
            event.reply('parse-douyin-result', {
              success: true,
              data: response.data
            })
          } else {
            event.reply('parse-douyin-result', {
              success: false,
              error: response.error,
              responseText: response.responseText
            })
          }
          currentParseWindow = null
          douyinWindow.destroy()
        } catch (error) {
          event.reply('parse-douyin-result', {
            success: false,
            error: error.message,
            responseText: error.responseText
          })
          currentParseWindow = null
          douyinWindow.destroy()
        }
      }
    })

    try {
      await douyinWindow.loadURL(url)
    } catch (error) {
      event.reply('parse-douyin-result', {
        success: false,
        error: error.message,
        responseText: error.responseText
      })
      currentParseWindow = null
      douyinWindow.destroy()
    }
  } catch (error) {
    event.reply('parse-douyin-result', {
      success: false,
      error: error.message,
      responseText: error.responseText
    })
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
