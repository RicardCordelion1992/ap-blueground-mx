import { createAdminClient } from '@/lib/supabase/server';

// Vendor AML/KYC documents and invoice files are sensitive (IDs, bank info,
// fiscal data) so both Storage buckets are created PRIVATE — see SETUP.md.
// We store only the object path in the DB (Vendor Document.fileUrl /
// Invoice.fileUrl) and mint a short-lived signed URL on every read instead
// of a permanent public link.
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — plenty to open/download once

export async function signDocUrl(bucket: string, path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // Already-migrated rows or anything accidentally stored as a full URL: pass through.
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data.signedUrl;
}

export const DOCS_BUCKET = process.env.SUPABASE_DOCS_BUCKET || 'vendor-documents';
export const INVOICES_BUCKET = process.env.SUPABASE_INVOICES_BUCKET || 'invoice-files';
