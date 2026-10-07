# Configurar los Atajos de iOS

Necesitás la **URL del endpoint** y el **token**: los ves en la web, en **Ajustes → Conexión con el iPhone**. La misma guía está dentro de la app.

> Los atajos y automatizaciones se sincronizan por iCloud, así que al pasar al iPhone 17 Pro se migran solos (revisá que las automatizaciones sigan en "Ejecutar inmediatamente").

## A. Atajo base "Registrar gasto"

Se usa desde las automatizaciones de Mercado Pago, Lemon y Galicia (y podés ponerlo en el Botón de Acción del 17 Pro o en la pantalla de inicio para gastos en efectivo).

1. **Atajos → Atajos → +**. Nombre: `Registrar gasto`. En ⓘ activá **Aceptar entrada** de tipo **Texto**.
2. **Elegir del menú** — texto *¿Qué hiciste?*:
   - *Pagué / compré* → acción **Texto** `expense`
   - *Transferí* → **Texto** `transfer_out`
   - *Recibí plata* → **Texto** `income`
   - *Solo consulté el saldo* → **Detener este atajo**
3. **Establecer variable** `tipo` = *Resultado del menú*.
4. **Pedir entrada** (Número) *¿Cuánto?* → **Establecer variable** `monto`.
5. **Pedir entrada** (Texto) *¿A quién / en qué?* → **Establecer variable** `detalle`.
6. **Obtener contenido de URL**
   - URL: `https://TU-APP.vercel.app/api/ingest`
   - Método: `POST`
   - Encabezados: `Authorization` = `Bearer TU_TOKEN`
   - Cuerpo de la solicitud: **JSON**
     - `amount` → variable `monto`
     - `type` → variable `tipo`
     - `source` → *Entrada del atajo*
     - `merchant` → variable `detalle`
7. **Mostrar notificación**: `Gasto registrado ✅`.

## B. Automatización al cerrar Mercado Pago / Lemon / Galicia

1. **Atajos → Automatización → + → App**.
2. Elegí la app, marcá **Se cierra** (desmarcá *Se abre*) y **Ejecutar inmediatamente**.
3. Acción **Ejecutar atajo** → `Registrar gasto`, con entrada un **Texto**:
   - Mercado Pago → `mercadopago`
   - Lemon → `lemon`
   - Galicia → `galicia`
4. Repetí para cada app.

## C. Automatización de Apple Pay (Wallet)

1. **Atajos → Automatización → + → Transacción**.
2. Elegí tus tarjetas, dejá todas las categorías y marcá **Ejecutar inmediatamente** → **Nuevo atajo en blanco**.
3. **Obtener contenido de URL** (igual que A6) con cuerpo JSON:
   - `amount` → *Entrada del atajo* → **Importe**
   - `merchant` → *Entrada del atajo* → **Comercio**
   - `source` → `apple_pay`
   - `type` → `expense`

El disparador "Transacción" solo se ejecuta con pagos **Apple Pay** de tarjetas cargadas en Wallet. Los pagos con QR desde Mercado Pago los cubre la automatización B.

## Probar el endpoint desde la compu

```bash
curl -X POST https://TU-APP.vercel.app/api/ingest -H "Authorization: Bearer TU_TOKEN" -H "Content-Type: application/json" -d '{"amount":"1.234,56","source":"manual","merchant":"Prueba"}'
```

Debería responder `201` y aparecer en la web como "Por revisar".
