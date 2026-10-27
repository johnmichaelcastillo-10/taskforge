import { startTimer } from '../../services/timer'

/**
 * Starts timing a task: `{ taskId, switch? }`. With a timer already running on another task,
 * 409 unless `switch` is true, which stops that one first. Returns the new session and, after a
 * switch, the one that stopped.
 */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const input = await readValidBody(event, timerStartSchema)
  return await startTimer(await useDb(), account.id, input.taskId, { switch: input.switch })
})
