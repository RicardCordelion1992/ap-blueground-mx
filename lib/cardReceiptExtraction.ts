import Anthropic from '@anthropic-ai/sdk';

// Extracción de comprobantes/facturas de gastos pagados con tarjeta corporativa (Brex o
// Jeeves), subidos por cada tarjetahabiente en /gastos-tarjeta. Mismo patrón que
// lib/paymentProofExtraction.ts: la IA solo ayuda a prellenar monto/fecha/concepto — la persona
// siempre elige el edificio a mano, y puede corregir cualquier campo antes o después de guardar.
export type ExtractedReceiptFields = {
  amount?: number;
  date?: string; // ISO yyyy-mm-dd — fecha del gasto
  description?: string; // comercio o concepto, tal como aparece en el comprobante
};

const SYSTEM_PROMPT = `Extraes datos estructurados de comprobantes/facturas de gastos pagados con tarjeta corporativa (Brex o Jeeves) para un sistema de cuentas por pagar.
Devuelve SOLO un objeto JSON válido, sin texto adicional, con estas llaves (usa null si no encuentras el dato):
amount (número, el monto total del gasto), date (formato YYYY-MM-DD, fecha del gasto),
description (el comercio o concepto del gasto, tal como aparece en el comprobante, en pocas palabras).`;

// Mismo modelo vigente que usa el resto de las extracciones (ver lib/invoiceExtraction.ts y
// lib/paymentProofExtraction.ts).
const MODEL = 'claude-sonnet-5';

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY no está configurada.');
  return new Anthropic({ apiKey });
}

function parseJsonLoose(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('La respuesta del modelo no contenía JSON.');
  return JSON.parse(match[0]);
}

export async function extractReceiptFromText(receiptText: string): Promise<ExtractedReceiptFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Texto del comprobante:\n\n${receiptText.slice(0, 12000)}` }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}

export async function extractReceiptFromImage(base64Png: string): Promise<ExtractedReceiptFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Png } },
          { type: 'text', text: 'Extrae los datos de este comprobante de gasto.' },
        ],
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}

// Fallback nativo de PDF: igual que extractFromPdf en lib/invoiceExtraction.ts — Claude lee el
// PDF directamente (texto + diseño visual) cuando no hay capa de texto utilizable.
export async function extractReceiptFromPdf(base64Pdf: string): Promise<ExtractedReceiptFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
          { type: 'text', text: 'Extrae los datos de este comprobante de gasto.' },
        ] as any,
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}
