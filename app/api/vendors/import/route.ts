import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { recomputeVendorReadiness } from '@/lib/readiness';
import { logAudit } from '@/lib/audit';

// Carga masiva de proveedores por una sola vez (precarga inicial), pegando el CSV exportado
// de la hoja "Proveedores precarga facturación". No reemplaza el alta individual — es solo
// para no tener que llenar el formulario proveedor por proveedor la primera vez.
//
// Columnas esperadas (en este orden, con encabezado):
// Vendor name, RFC, Address, Account, CLABE, Bank name, SWIFT code (If applies),
// Contacto (nombre), Teléfono, Email, Tipo, Estatus de datos, Día de pago, Alertas

const EXPECTED_HEADERS = [
'Vendor name',
'RFC',
'Address',
'Account',
'CLABE',
'Bank name',
'SWIFT code (If applies)',
'Contacto (nombre)',
'Teléfono',
'Email',
'Tipo',
'Estatus de datos',
'Día de pago',
'Alertas',
];

// Parser CSV simple (no hay librería csv en el proyecto): soporta campos entre comillas
// dobles con comas y comillas escapadas ("") dentro, que es el formato que exporta
// Google Sheets / Excel.
function parseCsv(text: string): string[][] {
const rows: string[][] = [];
let row: string[] = [];
let field = '';
let inQuotes = false;
const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
for (let i = 0; i < s.length; i++) {
const c = s[i];
if (inQuotes) {
if (c === '"') {
if (s[i + 1] === '"') {
field += '"';
i++;
} else {
inQuotes = false;
}
} else {
field += c;
}
} else if (c === '"') {
inQuotes = true;
} else if (c === ',') {
row.push(field);
field = '';
} else if (c === '\n') {
row.push(field);
rows.push(row);
row = [];
field = '';
} else {
field += c;
}
}
if (field.length > 0 || row.length > 0) {
row.push(field);
rows.push(row);
}
return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const MORAL_HINTS = [
'S.A. DE C.V.',
'SA DE CV',
'S DE RL',
'S. DE R.L.',
'DE R.L.',
'S.C.',
' SC',
'S.A.P.I.',
'SAPI',
'S.A.B.',
'SAB',
'FIDEICOMISO',
];

function guessPersonType(name: string, rfc: string | null): 'FISICA' | 'MORAL' {
if (rfc) {
if (rfc.length === 12) return 'MORAL';
if (rfc.length === 13) return 'FISICA';
}
const upper = name.toUpperCase();
if (MORAL_HINTS.some((h) => upper.includes(h))) return 'MORAL';
return 'FISICA';
}

function normalizeRfc(raw: string): string | null {
const rfc = raw.trim().toUpperCase().replace(/[^A-ZÑ&0-9]/g, '');
if (/^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/.test(rfc)) return rfc;
return null;
}

type RowResult = { name: string; status: 'created' | 'skipped' | 'error'; message: string };

export async function POST(req: NextRequest) {
const user = await getCurrentUser();
if (!user || user.role !== 'ADMIN') {
return NextResponse.json({ error: 'Solo un administrador puede hacer carga masiva.' }, { status: 403 });
}

const { csv } = await req.json();
if (typeof csv !== 'string' || !csv.trim()) {
return NextResponse.json({ error: 'Pega el contenido del CSV.' }, { status: 400 });
}

const table = parseCsv(csv);
if (table.length < 2) {
return NextResponse.json({ error: 'No se encontraron filas de datos.' }, { status: 400 });
}

const header = table[0].map((h) => h.trim().replace(/\s+/g, ' '));
const col = (name: string) => header.findIndex((h) => h.toLowerCase().startsWith(name.toLowerCase()));
const idx = {
name: col('Vendor name'),
rfc: col('RFC'),
address: col('Address'),
account: col('Account'),
clabe: col('CLABE'),
bank: col('Bank name'),
swift: col('SWIFT'),
contact: col('Contacto'),
phone: col('Teléfono') >= 0 ? col('Teléfono') : col('Telefono'),
email: col('Email'),
tipo: col('Tipo'),
estatus: col('Estatus'),
diaPago: col('Día de pago') >= 0 ? col('Día de pago') : col('Dia de pago'),
alertas: col('Alertas'),
};

if (idx.name < 0) {
return NextResponse.json(
{ error: `No encontré la columna "Vendor name" en el encabezado. Encabezado recibido: ${header.join(' | ')}` },
{ status: 400 }
);
}

// Categorías por default a partir de la columna "Tipo": "Rentas" reutiliza la categoría
// existente "Renta"; "Utilities" se crea/usa como categoría propia (el detalle fino de
// mantenimiento/seguridad/etc. se puede re-clasificar después, factura por factura).
const rentaCategory = await prisma.expenseCategory.findUnique({ where: { name: 'Renta' } });
const utilitiesCategory = await prisma.expenseCategory.upsert({
where: { name: 'Utilities' },
update: {},
create: { name: 'Utilities', sortOrder: 100 },
});

const results: RowResult[] = [];
const rfcsSeenThisBatch = new Set<string>();
let created = 0;
let skipped = 0;
let errored = 0;

for (const cells of table.slice(1)) {
const get = (i: number) => (i >= 0 && i < cells.length ? cells[i].trim() : '');
const name = get(idx.name);
if (!name) continue; // fila vacía

try {
const rfcRaw = get(idx.rfc);
const rfc = rfcRaw ? normalizeRfc(rfcRaw) : null;
const rfcInvalid = rfcRaw && !rfc;

if (rfc) {
if (rfcsSeenThisBatch.has(rfc)) {
results.push({ name, status: 'skipped', message: `RFC ${rfc} repetido dentro del mismo archivo — se omitió esta fila.` });
skipped++;
continue;
}
const existing = await prisma.vendor.findUnique({ where: { rfc } });
if (existing) {
results.push({ name, status: 'skipped', message: `Ya existe un proveedor con RFC ${rfc} (${existing.name}) — se omitió.` });
skipped++;
continue;
}
}

const tipo = get(idx.tipo);
const defaultCategoryId =
tipo.toLowerCase() === 'rentas'
? rentaCategory?.id ?? null
: tipo.toLowerCase() === 'utilities'
? utilitiesCategory.id
: null;

const emailRaw = get(idx.email);
const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw : null;

const diaPagoRaw = get(idx.diaPago);
const diaPago = /^\d{1,2}$/.test(diaPagoRaw) && Number(diaPagoRaw) >= 1 && Number(diaPagoRaw) <= 31 ? Number(diaPagoRaw) : null;

const estatus = get(idx.estatus);
const alertas = get(idx.alertas);
const noteParts = [
'Carga inicial (precarga facturación).',
estatus ? `Estatus de datos original: ${estatus}.` : '',
alertas ? `Alertas: ${alertas}.` : '',
rfcInvalid ? `RFC original "${rfcRaw}" no tiene formato válido — se guardó sin RFC, pendiente de confirmar.` : '',
].filter(Boolean);

const vendor = await prisma.vendor.create({
data: {
personType: guessPersonType(name, rfc),
name,
rfc,
fiscalAddress: get(idx.address) || null,
bankName: get(idx.bank) || null,
clabe: get(idx.clabe) || null,
accountNumber: get(idx.account) || null,
swiftCode: get(idx.swift) || null,
contactName: get(idx.contact) || null,
phone: get(idx.phone) || null,
email: emailValid,
paymentDueDay: diaPago,
defaultCategoryId,
notes: noteParts.join(' '),
},
});

if (rfc) rfcsSeenThisBatch.add(rfc);
await recomputeVendorReadiness(vendor.id);
await logAudit(user.id, 'create', 'Vendor', vendor.id, `${vendor.name} (carga masiva)`);

results.push({ name, status: 'created', message: rfcInvalid ? 'Creado como borrador (RFC pendiente de corregir).' : 'Creado.' });
created++;
} catch (e: any) {
results.push({ name, status: 'error', message: e?.message || 'Error desconocido al crear.' });
errored++;
}
}

return NextResponse.json({ created, skipped, errors: errored, results });
}
