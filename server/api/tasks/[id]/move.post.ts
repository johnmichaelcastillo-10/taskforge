import { moveTask } from '../../../services/tasks'

/** Drag and drop on the board, or "Move to…": `{ status, position }`. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const id = routeId(event)
  const input = await readValidBody(event, taskMoveSchema)
  return { task: await moveTask(await useDb(), account.id, id, input) }
})
