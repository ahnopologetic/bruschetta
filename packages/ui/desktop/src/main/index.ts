import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray, Notification } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let icons: { [key: string]: Electron.NativeImage } | null = null
let timerState: { time: string; mode: 'focus' | 'break'; isRunning: boolean } | null = null
let timerInterval: NodeJS.Timeout | null = null
let currentTimeLeft: number = 0
// const defaultFocusTime = 25 * 60
// const defaultBreakTime = 5 * 60
const defaultFocusTime = process.env.NODE_ENV === 'development' ? 1 * 60 : 25 * 60
const defaultBreakTime = process.env.NODE_ENV === 'development' ? 0.1 * 60 : 5 * 60

function createWindow(): void {
  // If window already exists, just show it
  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
    return
  }

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    show: false,
    autoHideMenuBar: true,
    transparent: true,
    titleBarStyle: 'hiddenInset',
    vibrancy: 'under-window',
    visualEffectState: 'active',
    resizable: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    // Restore timer state if it exists
    if (timerState) {
      mainWindow?.webContents.send('restore-timer', timerState)
    }
  })

  mainWindow.on('close', (event) => {
    // Prevent window from being destroyed
    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Create application menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Bruschetta',
      submenu: [
        {
          label: 'Start/Pause',
          accelerator: 'CommandOrControl+Enter',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('toggle-timer')
            }
          }
        },
        {
          label: 'Reset',
          accelerator: 'CommandOrControl+R',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('reset-timer')
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Focus Mode',
          accelerator: 'CommandOrControl+1',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('toggle-timer')
              mainWindow.webContents.send('set-mode', 'focus')
            }
          }
        },
        {
          label: 'Break Mode',
          accelerator: 'CommandOrControl+2',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('toggle-timer')
              mainWindow.webContents.send('set-mode', 'break')
            }
          }
        },
        {
          label: 'Show devtools',
          accelerator: 'CommandOrControl+I',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.openDevTools()
            }
          }
        },
        {
          label: 'Minimize to tray',
          accelerator: 'CommandOrControl+M',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.hide()
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)
}

function createTray(): void {
  // Load different icons for different states
  const iconPath = join(__dirname, '../../resources')
  icons = {
    default: nativeImage.createFromPath(join(iconPath, 'icon.png')),
    // focus: nativeImage.createFromPath(join(iconPath, 'icon-focus.png')),
    // break: nativeImage.createFromPath(join(iconPath, 'icon-break.png'))
  }

  tray = new Tray(icons.default.resize({ width: 32, height: 32 }))

  // Use monospaced font for timer
  if (process.platform === 'darwin') {
    tray.setTitle('00:00', {
      fontType: 'monospaced'
    })
  }
}

// Add sound handling
function playSound(type: 'start' | 'end'): void {
  if (!mainWindow) return

  const soundPath = join(__dirname, '../../resources/sounds', `${type}.mp3`)
  mainWindow.webContents.executeJavaScript(`
    new Audio('file://${soundPath}').play().catch(err => console.error('Failed to play sound:', err));
  `)
}

function updateTimer(): void {
  if (!timerState?.isRunning) return

  currentTimeLeft--
  const mins = Math.floor(currentTimeLeft / 60)
  const secs = currentTimeLeft % 60
  const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

  timerState.time = timeString
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-timer', timerState)
  }

  if (currentTimeLeft <= 0) {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    timerState.isRunning = false
    if (timerState.mode === 'focus') {
      timerState.mode = 'break'
      currentTimeLeft = 5 * 60 // Default break time
    } else {
      timerState.mode = 'focus'
      currentTimeLeft = defaultFocusTime
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-complete', timerState)
    }
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.bruschetta.app')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Create window and tray
  createWindow()
  createTray()

  // Handle sound requests
  ipcMain.on('play-sound', (_event, type: 'start' | 'end') => {
    playSound(type)
  })

  // Handle timer updates from renderer
  ipcMain.on('update-timer', (_event, { time, mode, isRunning }) => {
    // Store timer state
    timerState = { time, mode, isRunning }
    // Update currentTimeLeft based on the time string
    const [mins, secs] = time.split(':').map(Number)
    currentTimeLeft = mins * 60 + secs

    if (tray && icons) {
      if (process.platform === 'darwin') {
        tray.setTitle(time, {
          fontType: 'monospaced'
        })
      } else {
        tray.setTitle(time)
      }

      const currentIcon = icons[mode] || icons.default
      tray.setImage(currentIcon.resize({ width: 16, height: 16 }))

      const contextMenu = Menu.buildFromTemplate([
        { label: `${mode === 'focus' ? 'Focus' : 'Break'} - ${isRunning ? 'Running' : 'Paused'}` },
        { type: 'separator' },
        {
          label: 'Show App',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.show()
            }
          }
        },
        { type: 'separator' },
        {
          label: isRunning ? 'Pause' : 'Start',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('toggle-timer')
            }
          }
        },
        {
          label: 'Reset',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('reset-timer')
            }
          }
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
      tray.setContextMenu(contextMenu)
    }
  })

  // Handle timer control from renderer
  ipcMain.on('toggle-timer', () => {
    if (!timerState) return
    timerState.isRunning = !timerState.isRunning

    // Update currentTimeLeft if not already set
    if (currentTimeLeft <= 0) {
      currentTimeLeft = timerState.mode === 'focus' ? defaultFocusTime : defaultBreakTime
    }

    if (timerState.isRunning) {
      if (!timerInterval) {
        timerInterval = setInterval(updateTimer, 1000)
      }
    } else {
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = null
      }
    }
  })

  ipcMain.on('reset-timer', () => {
    if (timerInterval) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (timerState) {
      timerState.isRunning = false
      timerState.mode = 'focus'
      currentTimeLeft = defaultFocusTime
      const mins = Math.floor(currentTimeLeft / 60)
      const secs = currentTimeLeft % 60
      timerState.time = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-timer', timerState)
      }
    }
  })

  ipcMain.on('set-mode', (_event, mode: 'focus' | 'break') => {
    if (!timerState) return
    timerState.mode = mode
    currentTimeLeft = mode === 'focus' ? defaultFocusTime : defaultBreakTime
    const mins = Math.floor(currentTimeLeft / 60)
    const secs = currentTimeLeft % 60
    timerState.time = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-timer', timerState)
    }
  })

  ipcMain.on('show-notification', (_event, title: string, message: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const notification = new Notification({
        title,
        body: message,
        icon: join(__dirname, '../../resources/icon.png'),
        actions: [{
          type: 'button',
          text: 'OK',
        },
        {
          type: 'button',
          text: 'Restart',
        },
        ],
      })
      notification.show()
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore()
      }
      mainWindow.focus()
    } else {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle quit properly
app.on('before-quit', () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  if (mainWindow) {
    mainWindow.destroy()
    mainWindow = null
  }
})

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
