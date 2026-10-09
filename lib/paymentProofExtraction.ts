import Anthropic from '@anthropic-ai/sdk';

export type ExtractedProofFields = {
  amount?: number;
  date?: string; // ISO yyyy-mm-dd — fecha en que se hizo el pago/transferencia
  reference?: string; // folio o referencia del banco
  beneficiaryName?: string; // a quién se le pagó, tal como aparece en el comprobante
  bank?: string;
};

const SYSTEM_PROMPT = `Extraes datos estructurados de comprobantes de pago mexicanos (transferencias bancarias, recibos de pago, confirmaciones SPEI, etc.) para un sistema de cuentas por pagar.
Devuelve SOLO un objeto JSON válido, sin texto adicional, con estas llaves (usa null si no encuentras el dato):
amount (número, el monto total transferido/pagado), date (formato YYYY-MM-DD, fecha en que se hizo el pago),
reference (folio, clave de rastreo o referencia del banco), beneficiaryName (nombre de la persona o empresa a quien se le pagó, tal como aparece en el comprobante),
bank (nombre del banco emisor del comprobante, si aparece).`;

// Mismo modelo vigente que usa la extracción de facturas (ver lib/invoiceExtraction.ts).
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

export async function extractProofFromText(proofText: string): Promise<ExtractedProofFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Texto del comprobante:\n\n${proofText.slice(0, 12000)}` }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}

export async function extractProofFromImage(base64Png: string): Promise<ExtractedProofFields> {
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
          { type: 'text', text: 'Extrae los datos de este comprobante de pago.' },
        ],
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}

// Fallback nativo de PDF: igual que extractFromPdf en lib/invoiceExtraction.ts — Claude lee el
// PDF directamente (texto + diseño visual) cuando no hay capa de texto utilizable.
export async function extractProofFromPdf(base64Pdf: string): Promise<ExtractedProofFields> {
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
          { type: 'text', text: 'Extrae los datos de este comprobante de pago.' },
        ] as any,
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}
