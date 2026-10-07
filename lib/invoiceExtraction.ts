import Anthropic from '@anthropic-ai/sdk';

export type ExtractedInvoiceFields = {
  vendorName?: string;
  vendorRfc?: string;
  invoiceNumber?: string;
  issueDate?: string; // ISO yyyy-mm-dd
  billingStart?: string;
  billingEnd?: string;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  currency?: string;
  suggestedCategory?: string;
  suggestedBuildings?: string[]; // building names mentioned in the invoice text
};

const SYSTEM_PROMPT = `Extraes datos estructurados de facturas mexicanas (CFDI) para un sistema de cuentas por pagar.
Devuelve SOLO un objeto JSON válido, sin texto adicional, con estas llaves (usa null si no encuentras el dato):
vendorName, vendorRfc, invoiceNumber, issueDate (formato YYYY-MM-DD), billingStart, billingEnd,
subtotal (número), taxAmount (número), total (número), currency (MXN/USD),
suggestedCategory (una categoría de gasto breve en español), suggestedBuildings (arreglo de nombres de edificio si el texto menciona alguno).`;

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

// Text-first extraction: works for standard CFDI PDFs where the text layer
// is embedded (the common case). Much cheaper/faster than vision and avoids
// the "images not supported" failure mode seen in the prototype.
export async function extractFromText(invoiceText: string): Promise<ExtractedInvoiceFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Texto de la factura:\n\n${invoiceText.slice(0, 12000)}` }],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}

// Vision fallback for scanned/photographed invoices with no text layer.
export async function extractFromImage(base64Png: string): Promise<ExtractedInvoiceFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Png } },
          { type: 'text', text: 'Extrae los datos de esta factura.' },
        ],
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}

// Native PDF fallback: Claude lee el PDF directamente (texto + diseño visual),
// usado cuando pdf-parse no logra leer la estructura interna del archivo, o
// cuando no hay una capa de texto utilizable (por ejemplo, facturas escaneadas).
// Esto evita depender de que la librería local entienda el PDF exacto que
// produjo el sistema de facturación del proveedor.
export async function extractFromPdf(base64Pdf: string): Promise<ExtractedInvoiceFields> {
  const client = getClient();
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf } },
          { type: 'text', text: 'Extrae los datos de esta factura.' },
        ],
      },
    ],
  });
  const text = msg.content.filter((b) => b.type === 'text').map((b: any) => b.text).join('\n');
  return parseJsonLoose(text);
}
