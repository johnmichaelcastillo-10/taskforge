/** The browser's IANA time zone, such as 'Asia/Manila'. */
export function browserTimeZone(): string | undefined {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
