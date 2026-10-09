import { prisma } from '@/lib/prisma';

// Compara un comprobante de pago extraído contra las facturas APROBADAS (pendientes de pago)
// para decidir a cuál(es) corresponde. Nunca marca nada "a ciegas": si hay más de una
// combinación igual de probable, o ninguna cuadra, se devuelve 'none' y el comprobante queda
// para asignación manual (ver app/invoices/comprobantes).
export type MatchResult =
  | { kind: 'single'; invoiceIds: string[] }
  | { kind: 'none' };

const AMOUNT_TOLERANCE = 1; // $1 MXN de margen por redondeo

// Pagos de CFE hechos por Mercado Pago cobran una comisión fija por cada recibo pagado, así que
// el monto del comprobante puede venir $12 MXN más alto que el total de la factura (o, si el
// comprobante cubre varios recibos en un solo pago, $12 más por cada uno de ellos). El matching
// siempre prueba el monto tal cual Y el monto menos esta comisión, para no perder esos casos.
const MERCADOPAGO_RECEIPT_FEE = 12;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameLooksRelated(beneficiary: string | undefined, vendorName: string): boolean {
  if (!beneficiary) return true; // sin nombre de beneficiario no filtramos por nombre, solo por monto
  const a = normalize(beneficiary);
  const b = normalize(vendorName);
  if (!a || !b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  // comparación simple por palabras compartidas (ej. "CFE SUMINISTRADOR" vs "Comisión Federal de Electricidad")
  const aWords = new Set(a.split(' ').filter((w) => w.length > 2));
  const bWords = new Set(b.split(' ').filter((w) => w.length > 2));
  let shared = 0;
  for (const w of aWords) if (bWords.has(w)) shared++;
  return shared > 0;
}

// ¿El monto del comprobante corresponde a esta factura? Prueba el monto exacto y, por si se
// pagó por Mercado Pago, el monto menos la comisión por recibo.
function amountMatchesSingle(extractedAmount: number, invoiceTotal: number): boolean {
  if (Math.abs(invoiceTotal - extractedAmount) <= AMOUNT_TOLERANCE) return true;
  if (Math.abs(invoiceTotal - (extractedAmount - MERCADOPAGO_RECEIPT_FEE)) <= AMOUNT_TOLERANCE) return true;
  return false;
}

// Busca un subconjunto (2 a 6 facturas) de `candidates` cuya suma de total coincida con `target`
// dentro de la tolerancia — probando también la suma + comisión de Mercado Pago (12 por cada
// recibo incluido en el subconjunto). Si encuentra más de una combinación posible, es
// ambiguo -> null.
function findSubsetSum(candidates: { id: string; total: number }[], target: number): string[] | null {
  const n = candidates.length;
  if (n > 14) return null; // evita explosión combinatoria — en la práctica nunca hay tantas candidatas del mismo proveedor sin pagar
  const found: string[][] = [];
  for (let mask = 1; mask < 1 << n; mask++) {
    // Limitar a combinaciones de hasta 6 facturas (un pago que cubra más de 6 es muy raro).
    const count = popcount(mask);
    if (count > 6) continue;
    let sum = 0;
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += candidates[i].total;
        ids.push(candidates[i].id);
      }
    }
    const matchesPlain = Math.abs(sum - target) <= AMOUNT_TOLERANCE;
    const matchesWithFee = Math.abs(sum + MERCADOPAGO_RECEIPT_FEE * count - target) <= AMOUNT_TOLERANCE;
    if (matchesPlain || matchesWithFee) {
      found.push(ids);
      if (found.length > 1) return null; // más de una combinación posible -> ambiguo
    }
  }
  return found.length === 1 ? found[0] : null;
}

function popcount(mask: number): number {
  let c = 0;
  while (mask) {
    c += mask & 1;
    mask >>= 1;
  }
  return c;
}

export async function matchPaymentProof(extracted: {
  amount?: number | null;
  beneficiaryName?: string | null;
}): Promise<MatchResult> {
  if (!extracted.amount || extracted.amount <= 0) return { kind: 'none' };

  const approved = await prisma.invoice.findMany({
    where: { status: 'APPROVED', payable: true },
    include: { vendor: true },
  });

  const relevant = approved.filter((inv) => nameLooksRelated(extracted.beneficiaryName || undefined, inv.vendor.name));
  const pool = relevant.length > 0 ? relevant : approved;

  // Caso simple: una sola factura con el mismo monto (o monto - comisión de Mercado Pago).
  const exact = pool.filter((inv) => amountMatchesSingle(extracted.amount!, Number(inv.total)));
  if (exact.length === 1) {
    return { kind: 'single', invoiceIds: [exact[0].id] };
  }
  if (exact.length > 1) {
    // Varias facturas con exactamente el mismo monto — no hay forma segura de saber cuál es, se deja para revisión manual.
    return { kind: 'none' };
  }

  // Caso compuesto: el comprobante cubre varias facturas del mismo proveedor en un solo pago.
  const candidates = pool.map((inv) => ({ id: inv.id, total: Number(inv.total) }));
  const subset = candidates.length >= 2 ? findSubsetSum(candidates, extracted.amount!) : null;
  if (subset && subset.length >= 2) {
    return { kind: 'single', invoiceIds: subset };
  }

  return { kind: 'none' };
}
