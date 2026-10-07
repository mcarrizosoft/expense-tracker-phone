import { count, eq } from "drizzle-orm"
import { WalletIcon } from "lucide-react"
import { db } from "@/db"
import { transactions } from "@/db/schema"
import { BottomNav } from "@/components/bottom-nav"

export const dynamic = "force-dynamic"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ pending }] = await db
    .select({ pending: count() })
    .from(transactions)
    .where(eq(transactions.needsReview, true))

  return (
    <div className="min-h-dvh pt-[env(safe-area-inset-top)]">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <WalletIcon className="size-4" />
          </div>
          Mis Gastos
        </div>
        <div className="hidden md:block">
          <BottomNav pending={pending} />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-28 md:pb-10">{children}</main>
      <div className="md:hidden">
        <BottomNav pending={pending} />
      </div>
    </div>
  )
}
