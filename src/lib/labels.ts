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

/** Dólares que se pueden usar como referencia (claves de DolarAPI / ArgentinaDatos). */
export const USD_KINDS = ["bolsa", "blue", "cripto", "oficial"] as const
export type UsdKind = (typeof USD_KINDS)[number]

export const USD_KIND_LABELS: Record<UsdKind, string> = {
  bolsa: "MEP",
  blue: "Blue",
  cripto: "Cripto",
  oficial: "Oficial",
}

export const DEFAULT_USD_KIND: UsdKind = "bolsa"

export function isUsdKind(v: unknown): v is UsdKind {
  return USD_KINDS.includes(v as UsdKind)
}
