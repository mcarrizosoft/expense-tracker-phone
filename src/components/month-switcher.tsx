import Link from "next/link"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { currentMonth, monthLabel, shiftMonth } from "@/lib/dates"

export function MonthSwitcher({
  month,
  basePath,
  params = {},
}: {
  month: string
  basePath: string
  params?: Record<string, string | undefined>
}) {
  const href = (m: string) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
    qs.set("month", m)
    return `${basePath}?${qs}`
  }
  const isCurrent = month === currentMonth()

  return (
    <div className="flex items-center justify-between gap-2">
      <Button asChild variant="ghost" size="icon" aria-label="Mes anterior">
        <Link href={href(shiftMonth(month, -1))}>
          <ChevronLeftIcon />
        </Link>
      </Button>
      <div className="text-center">
        <div className="font-medium">{monthLabel(month)}</div>
        {!isCurrent && (
          <Link
            href={href(currentMonth())}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Ir al mes actual
          </Link>
        )}
      </div>
      {isCurrent ? (
        <Button variant="ghost" size="icon" aria-label="Mes siguiente" disabled>
          <ChevronRightIcon />
        </Button>
      ) : (
        <Button asChild variant="ghost" size="icon" aria-label="Mes siguiente">
          <Link href={href(shiftMonth(month, 1))}>
            <ChevronRightIcon />
          </Link>
        </Button>
      )}
    </div>
  )
}
