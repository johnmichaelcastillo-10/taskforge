import { stopTimer } from '../../../services/timer'

export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  return { session: await stopTimer(await useDb(), account.id) }
})
