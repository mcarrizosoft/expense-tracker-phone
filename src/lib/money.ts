const formatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatARS(value: number | string): string {
  return formatter.format(typeof value === "string" ? Number(value) : value)
}

/**
 * Convierte montos como "$ 1.234,56", "ARS 12.500", "1,234.56" o 1234.5 a número.
 * Si hay ambos separadores, el último es el decimal. Si hay uno solo, se toma
 * como decimal únicamente cuando lo siguen 1 o 2 dígitos (formato AR por defecto).
 */
export function parseAmount(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? round2(Math.abs(input)) : null

  const cleaned = input.replace(/[^\d.,]/g, "")
  if (!/\d/.test(cleaned)) return null

  const lastDot = cleaned.lastIndexOf(".")
  const lastComma = cleaned.lastIndexOf(",")
  let normalized: string

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSep = lastDot > lastComma ? "." : ","
    const thousandSep = decimalSep === "." ? "," : "."
    normalized = cleaned.split(thousandSep).join("").replace(decimalSep, ".")
  } else {
    const sep = lastDot !== -1 ? "." : lastComma !== -1 ? "," : null
    if (!sep) {
      normalized = cleaned
    } else {
      const parts = cleaned.split(sep)
      const isDecimal = parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2
      normalized = isDecimal ? parts.join(".") : parts.join("")
    }
  }

  const value = Number(normalized)
  return Number.isFinite(value) && value > 0 ? round2(value) : null
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}
