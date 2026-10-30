import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionForm, type TransactionDefaults } from "@/components/transaction-form"
import { getCategories, getFixedBillOptions } from "@/lib/data"

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; merchant?: string; amount?: string }>
}) {
  const [sp, categories, fixedBills] = await Promise.all([searchParams, getCategories(), getFixedBillOptions()])

  const categoryId = Number(sp.category)
  const amount = Number(sp.amount)
  const defaults: TransactionDefaults | undefined =
    sp.category || sp.merchant || sp.amount
      ? {
          categoryId: categories.some((c) => c.id === categoryId) ? categoryId : undefined,
          merchant: sp.merchant?.slice(0, 200),
          amount: Number.isFinite(amount) && amount > 0 ? amount : undefined,
        }
      : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle>{defaults?.merchant ? `Pagar ${defaults.merchant}` : "Nuevo movimiento"}</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm categories={categories} defaults={defaults} fixedBills={fixedBills} />
      </CardContent>
    </Card>
  )
}
