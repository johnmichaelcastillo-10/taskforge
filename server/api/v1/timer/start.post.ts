import { startTimer } from '../../../services/timer'

/** Starts timing `{ taskId }`; `switch: true` stops a timer running on another task first. */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  const input = await readValidBody(event, timerStartSchema)
  return await startTimer(await useDb(), account.id, input.taskId, { switch: input.switch })
})
