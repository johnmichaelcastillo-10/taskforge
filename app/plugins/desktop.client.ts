// Inside the desktop app (desktop/), the page can reach the native shell through Tauri's global
// API. In a browser `window.__TAURI__` doesn't exist and this does nothing.
//
// - The tray shows the running timer, and its "Stop timer" item stops it here.
// - Native notifications when a timer starts or stops, and every two hours it keeps running.

interface TauriGlobal {
  core: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> }
  event: { listen: (event: string, handler: () => void) => Promise<() => void> }
}

const REMINDER_SECONDS = 2 * 60 * 60

export default defineNuxtPlugin(() => {
  const tauri = (window as { __TAURI__?: TauriGlobal }).__TAURI__
  if (!tauri) return

  const invoke = (command: string, args: Record<string, unknown>) =>
    tauri.core.invoke(command, args).catch(error => console.warn(`Desktop: ${command} failed`, error))
  const { running, since, stop } = useTimer()

  // Keep the tray in step, and announce starts and stops made anywhere in the app (not the
  // timer already running when the window opens).
  let opening = true
  watch(running, (session, previous) => {
    invoke('set_timer', { timer: { taskTitle: session?.taskTitle ?? null } })
    if (opening) {
      opening = false
    }
    else if (session && session.id !== previous?.id) {
      invoke('notify', { title: 'Timer started', body: `${session.taskTitle} · ${session.projectName}` })
    }
    else if (!session && previous) {
      invoke('notify', { title: 'Timer stopped', body: previous.taskTitle })
    }
  }, { immediate: true })

  tauri.event.listen('tray-stop-timer', async () => {
    if (!running.value) return
    try {
      await stop()
      await refreshNuxtData()
    }
    catch (error) {
      invoke('notify', { title: 'Couldn’t stop the timer', body: errorMessage(error) })
    }
  })

  // A reminder each time a timer passes another two hours, in case it was left running.
  let reminded = 0
  setInterval(() => {
    if (!running.value || since.value === null) {
      reminded = 0
      return
    }
    const periods = Math.floor((Date.now() - since.value) / 1000 / REMINDER_SECONDS)
    if (periods > reminded) {
      reminded = periods
      invoke('notify', { title: 'Timer still running', body: `${running.value.taskTitle}: ${formatDuration(periods * REMINDER_SECONDS)} so far` })
    }
  }, 60_000)
})
