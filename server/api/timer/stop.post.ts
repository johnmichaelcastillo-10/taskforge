import { stopTimer } from '../../services/timer'

/** Stops the running timer and returns the finished session, its length measured here. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  return { session: await stopTimer(await useDb(), account.id) }
})
