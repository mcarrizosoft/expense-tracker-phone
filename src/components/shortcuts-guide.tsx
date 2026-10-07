import { ChevronDownIcon, TriangleAlertIcon } from "lucide-react"

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {n}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">{children}</div>
    </li>
  )
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{children}</code>
}

function Section({
  title,
  subtitle,
  children,
  open = false,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  open?: boolean
}) {
  return (
    <details open={open} className="group rounded-xl border">
      <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 flex-1">
          <div className="font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{subtitle}</div>
        </div>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-4 py-4">{children}</div>
    </details>
  )
}

function Pitfall({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg bg-orange-500/10 p-3 text-xs">
      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0 text-orange-500" />
      <div>{children}</div>
    </div>
  )
}

export function ShortcutsGuide({ endpoint }: { endpoint: string }) {
  return (
    <div className="grid gap-3 text-sm leading-relaxed">
      <Section title="1. Atajo base «Registrar gasto»" subtitle="Se crea una sola vez" open>
        <ol className="grid gap-4">
          <Step n={1}>
            <b>Atajos</b> → <b>Biblioteca</b> → <b>+</b>. Nombre: <b>Registrar gasto</b>.
          </Step>
          <Step n={2}>
            Arriba aparece <i>Recibir … de …</i>: tocá el tipo y dejá marcado solo <b>Texto</b>. En{" "}
            <i>Si no hay entrada</i>: <b>Continuar</b>.
          </Step>
          <Step n={3}>
            <b>Seleccionar del menú</b> con <i>¿Qué hiciste?</i> y las opciones{" "}
            <i>Pagué / Compré</i>, <i>Transferí</i>, <i>Recibí plata</i> y <i>Solo consulté</i>.
            Debajo de cada opción, una acción <b>Texto</b> con <Code>expense</Code>,{" "}
            <Code>transfer_out</Code>, <Code>income</Code>. En <i>Solo consulté</i>:{" "}
            <b>Detener este atajo</b>.
          </Step>
          <Step n={4}>
            <b>Solicitar entrada</b> → <b>Número</b> con <i>¿Cuánto?</i> → <b>Establecer variable</b>{" "}
            <Code>monto</Code>.
          </Step>
          <Step n={5}>
            <b>Solicitar entrada</b> → <b>Texto</b> con <i>¿A quién / en qué?</i> →{" "}
            <b>Establecer variable</b> <Code>detalle</Code>.
          </Step>
          <Step n={6}>
            <b>Establecer variable</b> <Code>medio</Code> = <b>Entrada del atajo</b> (tipo{" "}
            <b>Texto</b>).
          </Step>
          <Step n={7}>
            <b>Obtener contenido de URL</b>:
            <ul className="mt-2 grid gap-1.5 pl-1">
              <li>
                URL: <Code>{endpoint}</Code>
              </li>
              <li>
                Método: <b>POST</b>
              </li>
              <li>
                Encabezado: <Code>Authorization</Code> = <Code>Bearer TU_TOKEN</Code>
              </li>
              <li>
                Cuerpo <b>JSON</b>: <Code>amount</Code>→monto, <Code>type</Code>→Resultado del menú,{" "}
                <Code>source</Code>→medio, <Code>merchant</Code>→detalle
              </li>
            </ul>
          </Step>
          <Step n={8}>
            <b>Mostrar notificación</b> con la variable <b>Contenido de URL</b> (así ves si se guardó).
          </Step>
        </ol>
        <div className="mt-4 grid gap-2">
          <Pitfall>
            No dejes filas vacías en <b>Encabezados</b>: iOS no envía nada y no avisa.
          </Pitfall>
          <Pitfall>
            En cada campo del JSON tiene que haber una <b>burbuja de variable</b>, no texto escrito.
            La burbuja <i>Texto</i> toma el último bloque Texto, no la variable que querés.
          </Pitfall>
        </div>
      </Section>

      <Section title="2. Automatización por app" subtitle="Lemon, Galicia, Mercado Pago…">
        <ol className="grid gap-4">
          <Step n={1}>
            <b>Automatización</b> → <b>+</b> → <b>App</b> → elegí la app → marcá <b>Se cierra</b> →{" "}
            <b>Ejecutar de inmediato</b>.
          </Step>
          <Step n={2}>
            <b>Siguiente</b> → <b>Nuevo atajo en blanco</b> (no elijas «Registrar gasto» directo,
            porque no recibe el medio).
          </Step>
          <Step n={3}>
            Acción <b>Texto</b> con <Code>lemon</Code>, <Code>galicia</Code> o{" "}
            <Code>mercadopago</Code>, y debajo <b>Ejecutar atajo</b> → <b>Registrar gasto</b> con{" "}
            <b>Texto</b> como entrada.
          </Step>
        </ol>
        <div className="mt-4">
          <Pitfall>
            «Se cierra» también salta si cambiás de app un segundo. Elegí <i>Solo consulté</i> y no se
            guarda nada.
          </Pitfall>
        </div>
      </Section>

      <Section title="3. Apple Pay (Wallet)" subtitle="Pagos con el iPhone, sin preguntas">
        <ol className="grid gap-4">
          <Step n={1}>
            <b>Automatización</b> → <b>+</b> → <b>Transacción</b> → elegí tus tarjetas →{" "}
            <b>Ejecutar de inmediato</b> → <b>Nuevo atajo en blanco</b>.
          </Step>
          <Step n={2}>
            <b>Obtener contenido de URL</b> igual que en el paso 1.7, con cuerpo JSON:{" "}
            <Code>amount</Code>→Entrada del atajo › <b>Importe</b>, <Code>merchant</Code>→Entrada del
            atajo › <b>Comercio</b>, <Code>source</Code>=<Code>apple_pay</Code>,{" "}
            <Code>type</Code>=<Code>expense</Code>.
          </Step>
        </ol>
      </Section>

      <p className="px-1 text-xs text-muted-foreground">
        Tip: en el iPhone 17 Pro podés asignar «Registrar gasto» al Botón de Acción para cargar gastos
        en efectivo.
      </p>
    </div>
  )
}
