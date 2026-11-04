import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionForm, type TransactionDefaults } from "@/components/transaction-form"
import { txSourceEnum, txTypeEnum, type TxSource, type TxType } from "@/db/schema"
import { getCategories, getFixedBillOptions } from "@/lib/data"
import { SOURCE_LABELS } from "@/lib/labels"

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; merchant?: string; amount?: string; type?: string; source?: string }>
}) {
  const [sp, categories, fixedBills] = await Promise.all([searchParams, getCategories(), getFixedBillOptions()])

  const categoryId = Number(sp.category)
  const amount = Number(sp.amount)
  // `source` viene de MacroDroid en Android al cerrar Lemon/Galicia: /new?source=lemon
  const source = txSourceEnum.enumValues.includes(sp.source as TxSource) ? (sp.source as TxSource) : undefined
  const type = txTypeEnum.enumValues.includes(sp.type as TxType) ? (sp.type as TxType) : undefined
  const defaults: TransactionDefaults | undefined =
    sp.category || sp.merchant || sp.amount || source || type
      ? {
          categoryId: categories.some((c) => c.id === categoryId) ? categoryId : undefined,
          merchant: sp.merchant?.slice(0, 200),
          amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
          type,
          source,
        }
      : undefined
  const title = defaults?.merchant
    ? `Pagar ${defaults.merchant}`
    : source
      ? `¿Qué hiciste en ${SOURCE_LABELS[source]}?`
      : "Nuevo movimiento"

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm categories={categories} defaults={defaults} fixedBills={fixedBills} />
      </CardContent>
    </Card>
  )
}
