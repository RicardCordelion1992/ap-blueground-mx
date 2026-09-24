'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function MarkPaidButton({ invoiceId, disabled }: { invoiceId: string; disabled: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function markPaid() {
    setSaving(true);
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID' }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <button onClick={markPaid} disabled={disabled || saving} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
        {saving ? 'Guardando…' : 'Marcar como pagada'}
      </button>
      {disabled && <p className="text-xs text-amber-700 mt-1">El proveedor no está "Ready" — completa su expediente para poder pagar.</p>}
    </div>
  );
}
