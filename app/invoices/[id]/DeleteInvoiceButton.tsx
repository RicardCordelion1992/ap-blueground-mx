'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function remove() {
    if (!window.confirm('¿Seguro que quieres eliminar esta factura? Esta acción no se puede deshacer.')) return;
    setSaving(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
    setSaving(false);
    if (res.ok) {
      router.push('/invoices');
    } else {
      const body = await res.json().catch(() => ({}));
      alert(typeof body.error === 'string' ? body.error : 'No se pudo eliminar la factura.');
    }
  }

  return (
    <button
      onClick={remove}
      disabled={saving}
      className="btn-secondary text-sm text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {saving ? 'Eliminando…' : 'Eliminar'}
    </button>
  );
}
