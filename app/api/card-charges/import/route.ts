import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type ParsedRow = {
  chargeDate: Date | null;
  amount: number | null;
  cardHolderName: string | null;
  descriptor: string | null;
  cardLast4: string | null;
};

function excelDateToJS(value: any): Date | null {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const d = XLSX.SSF?.parse_date_code
      ? XLSX.SSF.parse_date_code(value)
      : null;
    if (d) {
      return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, d.S || 0));
    }
  }
  if (typeof value === 'string') {
    const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      return new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function parseAmount(value: any): number | null {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.\-]/g, '');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

function detectFormat(headers: string[]): 'BREX' | 'JEEVES' | 'UNKNOWN' {
  const set = new Set(headers.map((h) => (h || '').toString().trim()));
  if (set.has('Itemized expense parent ID') && set.has('Transaction date')) {
    return 'BREX';
  }
  if (set.has('Unique ID') && set.has('Created At UTC')) {
    return 'JEEVES';
  }
  return 'UNKNOWN';
}

function parseBrexRows(headers: string[], rows: any[][]): ParsedRow[] {
  const idx = (name: string) => headers.indexOf(name);
  const iDate = idx('Transaction date');
  const iAmount = idx('Amount');
  const iUser = idx('User');
  const iMerchant = idx('Merchant');
  const iLast4 = idx('Card last 4');

  return rows.map((row) => ({
    chargeDate: iDate >= 0 ? excelDateToJS(row[iDate]) : null,
    amount: iAmount >= 0 ? parseAmount(row[iAmount]) : null,
    cardHolderName: iUser >= 0 ? (row[iUser] ? String(row[iUser]).trim() : null) : null,
    descriptor: iMerchant >= 0 ? (row[iMerchant] ? String(row[iMerchant]).trim() : null) : null,
    cardLast4: iLast4 >= 0 ? (row[iLast4] ? String(row[iLast4]).trim().slice(-4) : null) : null,
  }));
}

function parseJeevesRows(headers: string[], rows: any[][]): ParsedRow[] {
  const idx = (name: string) => headers.indexOf(name);
  const iDate = idx('Created At UTC') >= 0 ? idx('Created At UTC') : idx('Posted At UTC');
  const iAmount =
    idx('Amount (origin currency)') >= 0
      ? idx('Amount (origin currency)')
      : idx('Amount (destination currency)');
  const iUser = idx('User');
  const iDesc = idx('Payment Description') >= 0 ? idx('Payment Description') : idx('Payee');
  const iPayee = idx('Payee');
  const iLast4 = idx('Card Number (last four)') >= 0 ? idx('Card Number (last four)') : idx('Card Name');

  return rows.map((row) => {
    const descRaw = iDesc >= 0 ? row[iDesc] : null;
    const payeeRaw = iPayee >= 0 ? row[iPayee] : null;
    return {
      chargeDate: iDate >= 0 ? excelDateToJS(row[iDate]) : null,
      amount: iAmount >= 0 ? parseAmount(row[iAmount]) : null,
      cardHolderName: iUser >= 0 ? (row[iUser] ? String(row[iUser]).trim() : null) : null,
      descriptor: descRaw
        ? String(descRaw).trim()
        : payeeRaw
        ? String(payeeRaw).trim()
        : null,
      cardLast4:
        iLast4 >= 0 && row[iLast4] ? String(row[iLast4]).trim().slice(-4) : null,
    };
  });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || (me.role !== 'ADMIN' && me.role !== 'FINANCE')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) {
    return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });

  if (allRows.length < 2) {
    return NextResponse.json({ error: 'El archivo no tiene datos' }, { status: 400 });
  }

  const headers = (allRows[0] || []).map((h) => (h ? String(h).trim() : ''));
  const dataRows = allRows.slice(1).filter((r) => r && r.some((c) => c !== null && c !== ''));

  const format = detectFormat(headers);
  if (format === 'UNKNOWN') {
    return NextResponse.json(
      { error: 'No se reconoce el formato del estado de cuenta (ni Brex ni Jeeves)' },
      { status: 400 }
    );
  }

  const parsedRows =
    format === 'BREX' ? parseBrexRows(headers, dataRows) : parseJeevesRows(headers, dataRows);

  // chargeDate y descriptor son obligatorios en el modelo CardCharge —
  // se descartan silenciosamente las filas sin fecha o sin monto (vacías / totales / encabezados sueltos).
  const validRows = parsedRows.filter((r) => r.amount !== null && r.chargeDate !== null);

  const allUsers = await prisma.user.findMany({ select: { id: true, name: true } });
  const nameToId = new Map(allUsers.map((u) => [u.name.trim().toLowerCase(), u.id]));

  const batch = await prisma.cardImportBatch.create({
    data: {
      fileName: file.name,
      importedById: me.id,
    },
  });

  let matched = 0;
  let unmatched = 0;

  for (const row of validRows) {
    const assignedUserId = row.cardHolderName
      ? nameToId.get(row.cardHolderName.trim().toLowerCase()) || null
      : null;

    if (assignedUserId) matched++;
    else unmatched++;

    await prisma.cardCharge.create({
      data: {
        batchId: batch.id,
        chargeDate: row.chargeDate as Date,
        descriptor: row.descriptor || '(sin descripción)',
        amount: row.amount as number,
        cardHolder: row.cardHolderName,
        cardLast4: row.cardLast4,
        assignedUserId,
        status: 'UNMATCHED',
      },
    });
  }

  return NextResponse.json({
    batchId: batch.id,
    format,
    total: validRows.length,
    matched,
    unmatched,
  });
}
