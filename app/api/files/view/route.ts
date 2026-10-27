import { NextRequest, NextResponse } from 'next/server';
import { signDocUrl, DOCS_BUCKET, INVOICES_BUCKET } from '@/lib/signedUrl';
import { getCurrentUser } from '@/lib/currentUser';

const ALLOWED_BUCKETS = new Set([DOCS_BUCKET, INVOICES_BUCKET]);

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const bucket = searchParams.get('bucket') || '';
  const path = searchParams.get('path') || '';

  if (!ALLOWED_BUCKETS.has(bucket) || !path) {
    return NextResponse.json({ error: 'Parámetros inválidos' }, { status: 400 });
  }

  const url = await signDocUrl(bucket, path);
  if (!url) {
    return NextResponse.json({ error: 'No se pudo generar la liga del archivo' }, { status: 404 });
  }

  return NextResponse.redirect(url);
}
