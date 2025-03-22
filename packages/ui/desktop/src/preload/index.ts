import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  updateTimer: (data: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => {
    ipcRenderer.send('update-timer', data)
  },
  onToggleTimer: (callback: () => void) => {
    ipcRenderer.on('toggle-timer', callback)
    return () => ipcRenderer.removeListener('toggle-timer', callback)
  },
  onResetTimer: (callback: () => void) => {
    ipcRenderer.on('reset-timer', callback)
    return () => ipcRenderer.removeListener('reset-timer', callback)
  },
  onSetMode: (callback: (mode: 'focus' | 'break') => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, mode: 'focus' | 'break') =>
      callback(mode)
    ipcRenderer.on('set-mode', wrappedCallback)
    return () => ipcRenderer.removeListener('set-mode', wrappedCallback)
  },
  playSound: (type: 'start' | 'end') => {
    ipcRenderer.send('play-sound', type)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
