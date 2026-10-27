/**
 * The running timer, shared across the app (navbar, task panel, cards).
 *
 * Elapsed time counts from the server's own measurement (`durationSeconds` when it was fetched),
 * not from comparing the browser's clock with the server's start time, so a computer whose clock
 * is off still shows the right figure.
 */
export function useTimer() {
  const running = useState<WorkSession | null>('timer-running', () => null)
  // When, by this browser's clock, the running session started.
  const since = useState<number | null>('timer-since', () => null)

  function setRunning(session: WorkSession | null) {
    running.value = session
    since.value = session ? Date.now() - session.durationSeconds * 1000 : null
  }

  async function refresh() {
    const { running: session } = await $fetch<{ running: WorkSession | null }>('/api/timer')
    setRunning(session)
  }

  /** Starts timing a task; `switch` stops a timer running on another task first. */
  async function start(taskId: number, options: { switch?: boolean } = {}) {
    const result = await $fetch<{ session: WorkSession, stopped: WorkSession | null }>('/api/timer/start', {
      method: 'POST',
      body: { taskId, switch: options.switch ?? false },
    })
    setRunning(result.session)
    return result
  }

  async function stop() {
    const { session } = await $fetch<{ session: WorkSession }>('/api/timer/stop', { method: 'POST' })
    setRunning(null)
    return session
  }

  return { running, since, setRunning, refresh, start, stop }
}

/**
 * Seconds since `since`, updated every second once the component is mounted. Null until then:
 * the server and the browser read the clock at different moments, so a figure rendered on the
 * server would never match the one the browser hydrates.
 */
export function useElapsed(since: Ref<number | null>) {
  const now = ref<number | null>(null)
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    now.value = Date.now()
    timer = setInterval(() => (now.value = Date.now()), 1000)
  })
  onBeforeUnmount(() => clearInterval(timer))
  return computed(() => (since.value === null || now.value === null ? null : Math.max(0, (now.value - since.value) / 1000)))
}
