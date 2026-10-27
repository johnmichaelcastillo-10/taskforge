import { listSessions } from '../../services/timer'

/** Recent work sessions, newest first; `?taskId=` for one task's. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const filters = readValidQuery(event, sessionFiltersSchema)
  return { sessions: await listSessions(await useDb(), account.id, filters) }
})
