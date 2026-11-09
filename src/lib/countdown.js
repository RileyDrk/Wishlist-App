export function getCountdown({ month, day }, now = new Date()) {
  const year = now.getFullYear()
  let target = new Date(year, month - 1, day)
  const isHoliday = now.getMonth() === month - 1 && now.getDate() === day
  if (!isHoliday && now >= target) target = new Date(year + 1, month - 1, day)
  const total = isHoliday ? 0 : Math.max(0, Math.floor((target - now) / 1000))
  return { isHoliday, remaining: {
    days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60, seconds: total % 60,
  } }
}
