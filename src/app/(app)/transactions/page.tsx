import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MonthSwitcher } from "@/components/month-switcher"
import { TransactionFilters } from "@/components/transaction-filters"
import { TransactionList } from "@/components/transaction-list"
import { txSourceEnum, type TxSource } from "@/db/schema"
import { getCategories, getFixedBillOptions, getTransactions } from "@/lib/data"
import { currentMonth, isValidMonth } from "@/lib/dates"
import { isOutgoing } from "@/lib/labels"
import { formatARS } from "@/lib/money"

type SearchParams = { month?: string; source?: string; category?: string; pending?: string }

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const month = isValidMonth(sp.month) ? sp.month : currentMonth()
  const pendingOnly = sp.pending === "1"
  const source = txSourceEnum.enumValues.includes(sp.source as TxSource)
    ? (sp.source as TxSource)
    : undefined
  const categoryId =
    sp.category === "none" ? ("none" as const) : sp.category ? Number(sp.category) || undefined : undefined

  const [items, categories, fixedBills] = await Promise.all([
    getTransactions({ month, source, categoryId, pendingOnly }),
    getCategories(),
    getFixedBillOptions(),
  ])
  const total = items.reduce((acc, t) => acc + (isOutgoing(t.type) ? Number(t.amount) : 0), 0)

  return (
    <div className="grid gap-4">
      <Tabs value={pendingOnly ? "pending" : "month"}>
        <TabsList className="h-10 w-full">
          <TabsTrigger value="month" asChild>
            <Link href={`/transactions?month=${month}`}>Del mes</Link>
          </TabsTrigger>
          <TabsTrigger value="pending" asChild>
            <Link href="/transactions?pending=1">Por revisar</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {!pendingOnly && (
        <>
          <MonthSwitcher
            month={month}
            basePath="/transactions"
            params={{ source: sp.source, category: sp.category }}
          />
          <TransactionFilters categories={categories} />
        </>
      )}

      <Card>
        <CardContent>
          {!pendingOnly && items.length > 0 && (
            <div className="flex justify-between border-b pb-3 text-sm">
              <span className="text-muted-foreground">
                {items.length} {items.length === 1 ? "movimiento" : "movimientos"}
              </span>
              <span>
                Gastos: <b className="tabular-nums">{formatARS(total)}</b>
              </span>
            </div>
          )}
          <TransactionList
            items={items}
            categories={categories}
            fixedBills={fixedBills}
            emptyText={pendingOnly ? "Nada por revisar 🎉" : "No hay movimientos con estos filtros."}
          />
        </CardContent>
      </Card>
    </div>
  )
}
