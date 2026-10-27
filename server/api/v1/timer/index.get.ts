import { getRunningTimer } from '../../../services/timer'

export default defineEventHandler(async (event) => {
  const account = await requireApiAccount(event)
  return { running: await getRunningTimer(await useDb(), account.id) }
})
