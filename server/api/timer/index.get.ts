import { getRunningTimer } from '../../services/timer'

/** The running timer, or `{ running: null }`. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return { running: await getRunningTimer(await useDb(), account.id) }
})
