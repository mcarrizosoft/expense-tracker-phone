import { headers } from "next/headers"
import { LogOutIcon } from "lucide-react"
import { logout } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CategoryManager, CopyField, FixedBillManager, RuleList } from "@/components/settings-client"
import { ShortcutsGuide } from "@/components/shortcuts-guide"
import { getCategories, getFixedBillsStatus, getMerchantRules } from "@/lib/data"
import { currentMonth } from "@/lib/dates"

export default async function SettingsPage() {
  const [categories, rules, bills, h] = await Promise.all([
    getCategories(),
    getMerchantRules(),
    getFixedBillsStatus(currentMonth()),
    headers(),
  ])
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https")
  const endpoint = `${proto}://${host}/api/ingest`
  const token = process.env.INGEST_TOKEN

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Conexión con el iPhone</CardTitle>
          <CardDescription>Datos para configurar los Atajos de iOS.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">URL del endpoint</span>
            <CopyField value={endpoint} />
          </div>
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Token (header Authorization: Bearer …)</span>
            {token ? (
              <CopyField value={token} secret />
            ) : (
              <p className="text-sm text-destructive">Falta configurar INGEST_TOKEN en el entorno.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo crear los Atajos</CardTitle>
          <CardDescription>
            Una vez configurados, el iPhone te pregunta qué hiciste cada vez que salís de Mercado Pago,
            Lemon o Galicia, y registra solo los pagos con Apple Pay.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ShortcutsGuide endpoint={endpoint} />
        </CardContent>
      </Card>

      <Card id="cuentas-fijas" className="scroll-mt-4">
        <CardHeader>
          <CardTitle>Cuentas fijas</CardTitle>
          <CardDescription>Lo que pagás todos los meses. En el inicio ves cuáles ya pagaste.</CardDescription>
        </CardHeader>
        <CardContent>
          <FixedBillManager bills={bills} categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryManager categories={categories} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reglas por comercio</CardTitle>
          <CardDescription>Categorizan automáticamente los pagos que llegan desde los Atajos.</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleList rules={rules} />
        </CardContent>
      </Card>

      <form action={logout}>
        <Button variant="outline" className="w-full" type="submit">
          <LogOutIcon /> Cerrar sesión
        </Button>
      </form>
    </div>
  )
}
