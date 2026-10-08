'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function DiscardButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function discard() {
    if (!window.confirm('¿Descartar esta factura recibida por correo? No se podrá recuperar.')) return;
    setBusy(true);
    await fetch(`/api/inbound-emails/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discard: true }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={discard}
      disabled={busy}
      className="text-xs text-red-600 hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {busy ? '…' : 'Descartar'}
    </button>
  );
}
