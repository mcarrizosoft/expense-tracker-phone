import type { TxSource, TxType } from "@/db/schema"

export const TYPE_LABELS: Record<TxType, string> = {
  expense: "Gasto",
  income: "Ingreso",
  transfer_out: "Transferencia enviada",
  transfer_in: "Transferencia recibida",
  internal: "Entre mis cuentas",
}

export const SOURCE_LABELS: Record<TxSource, string> = {
  apple_pay: "Apple Pay",
  mercadopago: "Mercado Pago",
  lemon: "Lemon",
  galicia: "Galicia",
  manual: "Manual",
  other: "Otro",
}

export const OUTGOING_TYPES: TxType[] = ["expense", "transfer_out"]

export function isOutgoing(type: TxType) {
  return OUTGOING_TYPES.includes(type)
}

export const INCOMING_TYPES: TxType[] = ["income", "transfer_in"]

export function isIncoming(type: TxType) {
  return INCOMING_TYPES.includes(type)
}
