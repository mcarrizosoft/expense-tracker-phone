import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TransactionForm } from "@/components/transaction-form"
import { getCategories } from "@/lib/data"

export default async function NewTransactionPage() {
  const categories = await getCategories()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nuevo movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <TransactionForm categories={categories} />
      </CardContent>
    </Card>
  )
}
