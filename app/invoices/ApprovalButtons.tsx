'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ApprovalButtons({ invoiceId, canApprove }: { invoiceId: string; canApprove: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState<'approve' | 'reject' | null>(null);

  async function setStatus(status: 'APPROVED' | 'REJECTED') {
    let rejectedReason: string | undefined;
    if (status === 'REJECTED') {
      rejectedReason = window.prompt('Motivo del rechazo (opcional):') || undefined;
    }
    setSaving(status === 'APPROVED' ? 'approve' : 'reject');
    await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, rejectedReason }),
    });
    setSaving(null);
    router.refresh();
  }

  if (!canApprove) {
    return <p className="text-xs text-gray-400">Solo un administrador puede aprobar.</p>;
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => setStatus('APPROVED')}
        disabled={saving !== null}
        className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving === 'approve' ? 'Aprobando…' : 'Aprobar'}
      </button>
      <button
        onClick={() => setStatus('REJECTED')}
        disabled={saving !== null}
        className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving === 'reject' ? 'Rechazando…' : 'Rechazar'}
      </button>
    </div>
  );
}
