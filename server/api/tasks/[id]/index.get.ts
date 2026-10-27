import { getTask } from '../../../services/tasks'

export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const { task } = await getTask(await useDb(), account.id, routeId(event))
  return { task }
})
