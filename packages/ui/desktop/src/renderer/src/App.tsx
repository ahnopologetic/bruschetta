import { useState, useEffect } from 'react'
import { Button } from './components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './components/ui/select'

declare global {
  interface Window {
    api: {
      updateTimer: (data: { time: string; mode: 'focus' | 'break'; isRunning: boolean }) => void
      onToggleTimer: (callback: () => void) => () => void
      onResetTimer: (callback: () => void) => () => void
      onSetMode: (callback: (mode: 'focus' | 'break') => void) => () => void
      playSound: (type: 'start' | 'end') => void
    }
  }
}

const FOCUS_DURATIONS = [25, 30, 45, 50, 55]
const BREAK_DURATIONS = [5, 10, 15]

export default function App() {
  const [isRunning, setIsRunning] = useState(false)
  const [mode, setMode] = useState<'focus' | 'break'>('focus')
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATIONS[0] * 60)
  const [selectedFocusDuration, setSelectedFocusDuration] = useState(FOCUS_DURATIONS[0])
  const [selectedBreakDuration, setSelectedBreakDuration] = useState(BREAK_DURATIONS[0])

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null

    if (isRunning && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1)
      }, 1000)
    } else if (timeLeft === 0) {
      window.api.playSound('end')
      if (mode === 'focus') {
        setMode('break')
        setTimeLeft(selectedBreakDuration * 60)
      } else {
        setMode('focus')
        setTimeLeft(selectedFocusDuration * 60)
      }
      setIsRunning(false)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRunning, timeLeft, mode, selectedFocusDuration, selectedBreakDuration])

  useEffect(() => {
    window.api.updateTimer({
      time: formatTime(timeLeft),
      mode,
      isRunning
    })
  }, [timeLeft, mode, isRunning])

  useEffect(() => {
    const unsubToggle = window.api.onToggleTimer(() => {
      setIsRunning((prev) => !prev)
    })

    const unsubReset = window.api.onResetTimer(handleReset)

    return () => {
      unsubToggle()
      unsubReset()
    }
  }, [])

  useEffect(() => {
    const unsubMode = window.api.onSetMode((newMode) => {
      setMode(newMode)
      setTimeLeft(newMode === 'focus' ? selectedFocusDuration * 60 : selectedBreakDuration * 60)
    })

    return () => unsubMode()
  }, [selectedFocusDuration, selectedBreakDuration])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleReset = () => {
    setIsRunning(false)
    setMode('focus')
    setTimeLeft(selectedFocusDuration * 60)
  }

  const handleToggleTimer = () => {
    if (!isRunning) {
      window.api.playSound('start')
    }
    setIsRunning(!isRunning)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Bruschetta</h1>
          <div className="text-6xl font-mono">{formatTime(timeLeft)}</div>

          <div className="flex gap-4 justify-center">
            <Select
              value={selectedFocusDuration.toString()}
              onValueChange={(value) => {
                const duration = parseInt(value)
                setSelectedFocusDuration(duration)
                if (mode === 'focus' && !isRunning) {
                  setTimeLeft(duration * 60)
                }
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Focus duration" />
              </SelectTrigger>
              <SelectContent>
                {FOCUS_DURATIONS.map((duration) => (
                  <SelectItem key={duration} value={duration.toString()}>
                    {duration} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedBreakDuration.toString()}
              onValueChange={(value) => {
                const duration = parseInt(value)
                setSelectedBreakDuration(duration)
                if (mode === 'break' && !isRunning) {
                  setTimeLeft(duration * 60)
                }
              }}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Break duration" />
              </SelectTrigger>
              <SelectContent>
                {BREAK_DURATIONS.map((duration) => (
                  <SelectItem key={duration} value={duration.toString()}>
                    {duration} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={handleToggleTimer}>
              {isRunning ? '⏸️ Pause' : '👍 Start'}
            </Button>
            <Button size="lg" variant="outline" onClick={handleReset}>
              ↪️ Reset
            </Button>
          </div>

          {/* <div className="text-sm text-muted-foreground">
            {mode === 'focus' ? 'Focus Session' : 'Break Time'}
          </div> */}
        </div>
      </div>
    </div>
  )
}
