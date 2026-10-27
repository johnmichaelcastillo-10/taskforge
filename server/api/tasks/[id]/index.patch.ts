import { updateTask } from '../../../services/tasks'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const id = routeId(event)
  const input = await readValidBody(event, taskUpdateSchema)
  return { task: await updateTask(await useDb(), account.id, id, input) }
})
