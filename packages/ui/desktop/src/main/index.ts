import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null
let icons: { [key: string]: Electron.NativeImage } | null = null

function createWindow(): void {
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
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
          click: () => mainWindow?.webContents.send('toggle-timer')
        },
        {
          label: 'Reset',
          accelerator: 'CommandOrControl+R',
          click: () => mainWindow?.webContents.send('reset-timer')
        },
        { type: 'separator' },
        {
          label: 'Focus Mode',
          accelerator: 'CommandOrControl+1',
          click: () => mainWindow?.webContents.send('set-mode', 'focus')
        },
        {
          label: 'Break Mode',
          accelerator: 'CommandOrControl+2',
          click: () => mainWindow?.webContents.send('set-mode', 'break')
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
    focus: nativeImage.createFromPath(join(iconPath, 'icon-focus.png')),
    break: nativeImage.createFromPath(join(iconPath, 'icon-break.png'))
  }

  tray = new Tray(icons.default.resize({ width: 16, height: 16 }))

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
    if (tray && icons) {
      // Add null check for icons
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
        { label: 'Show App', click: () => mainWindow?.show() },
        { type: 'separator' },
        {
          label: isRunning ? 'Pause' : 'Start',
          click: () => mainWindow?.webContents.send('toggle-timer')
        },
        { label: 'Reset', click: () => mainWindow?.webContents.send('reset-timer') },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
      ])
      tray.setContextMenu(contextMenu)
    }
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
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

// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
