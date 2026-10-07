// Argentina no usa horario de verano: UTC-3 fijo.
const AR_OFFSET = "-03:00"
export const AR_TZ = "America/Argentina/Buenos_Aires"

export function currentMonth(): string {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  return now.toISOString().slice(0, 7)
}

export function isValidMonth(m: string | undefined): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m)
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export function monthRange(month: string): { start: Date; end: Date } {
  return {
    start: new Date(`${month}-01T00:00:00${AR_OFFSET}`),
    end: new Date(`${shiftMonth(month, 1)}-01T00:00:00${AR_OFFSET}`),
  }
}

export function monthLabel(month: string): string {
  const label = new Date(`${month}-15T12:00:00${AR_OFFSET}`).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: AR_TZ,
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const SHORT_MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

/** "06 oct, 21:22" en hora argentina. Formateo manual para que servidor y navegador
 *  generen exactamente el mismo texto (Intl difiere en espacios/“p. m.” entre motores). */
export function formatDateTime(date: Date): string {
  const ar = new Date(date.getTime() - 3 * 60 * 60 * 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(ar.getUTCDate())} ${SHORT_MONTHS[ar.getUTCMonth()]}, ${pad(ar.getUTCHours())}:${pad(ar.getUTCMinutes())}`
}

/** Valor para un <input type="datetime-local"> en hora argentina. */
export function toLocalInputValue(date: Date): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

export function fromLocalInputValue(value: string): Date {
  return new Date(`${value}:00${AR_OFFSET}`)
}
