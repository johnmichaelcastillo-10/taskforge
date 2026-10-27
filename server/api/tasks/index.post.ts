import { createTask } from '../../services/tasks'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const input = await readValidBody(event, taskCreateSchema)
  setResponseStatus(event, 201)
  return { task: await createTask(await useDb(), account.id, input) }
})
