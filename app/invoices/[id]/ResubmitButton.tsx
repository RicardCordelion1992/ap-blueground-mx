'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ResubmitButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function resubmit() {
    setSaving(true);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING' }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <button onClick={resubmit} disabled={saving} className="btn-secondary text-sm disabled:opacity-40 disabled:cursor-not-allowed">
      {saving ? 'Reenviando…' : 'Reenviar a revisión'}
    </button>
  );
}
