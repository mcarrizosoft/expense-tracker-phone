# Mis Gastos

Web app personal (Next.js + shadcn/ui + Neon Postgres) para llevar los gastos del mes **sin cargar nada a mano**: el iPhone manda cada movimiento automáticamente mediante **Atajos de iOS**.

- **Apple Pay (Wallet):** cada pago se registra solo (monto + comercio).
- **Mercado Pago / Lemon / Galicia:** al cerrar la app, el iPhone pregunta *¿Qué hiciste?* (pago, transferencia, ingreso o "solo consulté el saldo") y el monto.
- Dashboard mensual con total gastado, ingresos, balance, gráfico por categoría y por medio de pago.
- Reglas por comercio para categorizar automáticamente; lo que llega sin categoría queda "Por revisar".
- Instalable como app en el iPhone (Safari → Compartir → *Agregar a inicio*).

## Puesta en marcha

1. **Base de datos:** creá un proyecto gratis en [Neon](https://console.neon.tech) y copiá el connection string (*pooled*).
2. **Variables:** copiá `.env.example` a `.env.local` y completá los valores.
3. Instalar y preparar la base:

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

4. Levantar en local:

```bash
npm run dev
```

## Deploy en Vercel

1. Subí el repo a GitHub e importalo en [vercel.com/new](https://vercel.com/new).
2. En *Environment Variables* cargá `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET` e `INGEST_TOKEN`.
3. Deploy. Entrá a `https://tu-app.vercel.app`, iniciá sesión y andá a **Ajustes**: ahí tenés la URL del endpoint, el token y la guía paso a paso para crear los Atajos (también en [docs/atajos-ios.md](docs/atajos-ios.md)).

## API para Atajos

```
POST /api/ingest
Authorization: Bearer <INGEST_TOKEN>
Content-Type: application/json

{ "amount": "12.500,00", "type": "expense", "source": "apple_pay", "merchant": "Coto" }
```

| Campo | Valores | Default |
|---|---|---|
| `amount` (obligatorio) | número o texto (`"$ 1.234,56"`, `"12500"`, `"1,234.56"`) | — |
| `type` | `expense`, `transfer_out`, `income`, `transfer_in` | `expense` |
| `source` | `apple_pay`, `mercadopago`, `lemon`, `galicia`, `manual`, `other` | `other` |
| `merchant`, `description` | texto libre | — |
| `category` | nombre exacto de una categoría | regla por comercio |
| `occurredAt` | fecha ISO 8601 | ahora |

Respuestas: `201` creado · `400` datos inválidos · `401` token incorrecto.

## Scripts

- `npm run db:generate` — generar migración tras cambiar `src/db/schema.ts`
- `npm run db:migrate` — aplicar migraciones
- `npm run db:seed` — cargar categorías por defecto
- `npm run db:studio` — explorar la base
