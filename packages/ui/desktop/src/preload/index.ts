import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  updateTimer: (data: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => {
    ipcRenderer.send('update-timer', data)
  },
  onToggleTimer: (callback: () => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('toggle-timer', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('toggle-timer', wrappedCallback)
    }
  },
  onResetTimer: (callback: () => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('reset-timer', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('reset-timer', wrappedCallback)
    }
  },
  onSetMode: (callback: (mode: 'focus' | 'break') => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, mode: 'focus' | 'break') => callback(mode)
    ipcRenderer.on('set-mode', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('set-mode', wrappedCallback)
    }
  },
  onRestoreTimer: (callback: (state: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, state: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => callback(state)
    ipcRenderer.on('restore-timer', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('restore-timer', wrappedCallback)
    }
  },
  onUpdateTimer: (callback: (state: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, state: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => callback(state)
    ipcRenderer.on('update-timer', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('update-timer', wrappedCallback)
    }
  },
  toggleTimer: () => {
    ipcRenderer.send('toggle-timer')
  },
  resetTimer: () => {
    ipcRenderer.send('reset-timer')
  },
  setMode: (mode: 'focus' | 'break') => {
    ipcRenderer.send('set-mode', mode)
  },
  onTimerComplete: (callback: (state: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => void) => {
    const wrappedCallback = (_event: Electron.IpcRendererEvent, state: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => callback(state)
    ipcRenderer.on('timer-complete', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('timer-complete', wrappedCallback)
    }
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
