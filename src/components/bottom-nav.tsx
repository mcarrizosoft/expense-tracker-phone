"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HomeIcon, ListIcon, PiggyBankIcon, PlusIcon, SettingsIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const items = [
  { href: "/", label: "Inicio", icon: HomeIcon },
  { href: "/transactions", label: "Movimientos", icon: ListIcon },
  { href: "/new", label: "Agregar", icon: PlusIcon },
  { href: "/savings", label: "Ahorros", icon: PiggyBankIcon },
  { href: "/settings", label: "Ajustes", icon: SettingsIcon },
]

export function BottomNav({ pending }: { pending: number }) {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:static md:border-t-0 md:bg-transparent md:pb-0 md:backdrop-blur-none">
      <ul className="mx-auto grid max-w-2xl grid-cols-5 md:flex md:gap-1">
        {items.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <li key={href}>
              <Link
                href={href}
                className={cn(
                  "relative flex flex-col items-center gap-1 py-2 text-[11px] text-muted-foreground transition-colors md:flex-row md:gap-1.5 md:rounded-lg md:px-3 md:py-1.5 md:text-sm",
                  active && "text-foreground md:bg-muted"
                )}
              >
                <Icon className="size-5 md:size-4" />
                {label}
                {href === "/transactions" && pending > 0 && (
                  <span className="absolute top-1 right-[calc(50%-20px)] flex size-4 items-center justify-center rounded-full bg-orange-500 text-[10px] font-semibold text-white md:static">
                    {pending}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
