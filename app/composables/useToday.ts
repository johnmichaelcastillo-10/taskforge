/**
 * Today's date in the signed-in user's time zone. The server renders with the same zone, so
 * "overdue" and "due tomorrow" agree on both sides of hydration.
 */
export function useToday() {
  const { user } = useUserSession()
  return computed(() => dateIn(user.value?.timezone ?? 'UTC'))
}
