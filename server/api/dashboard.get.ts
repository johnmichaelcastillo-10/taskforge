import { getDashboard } from '../services/dashboard'

/** The dashboard's figures for the last `?days=` 7, 30 or 90 days, in the user's time zone. */
export default defineEventHandler(async (event) => {
  const account = await requireAccount(event)
  const { days } = readValidQuery(event, dashboardQuerySchema)
  return await getDashboard(await useDb(), account.id, account.timezone, days)
})
