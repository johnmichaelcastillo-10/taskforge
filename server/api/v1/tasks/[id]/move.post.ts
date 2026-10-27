import { moveTask } from '../../../../services/tasks'

/** Moves the task to `{ status, position }` (0 = top of the column). */
export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  const id = routeId(event)
  const input = await readValidBody(event, taskMoveSchema)
  return { task: await moveTask(await useDb(), account.id, id, input) }
})
