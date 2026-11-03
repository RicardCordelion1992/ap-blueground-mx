'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BulkReadyButton({ vendorIds }: { vendorIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (vendorIds.length === 0) return;
    if (!confirm(`¿Marcar como Ready (manual) a los ${vendorIds.length} proveedores de esta lista?`)) return;

    setLoading(true);
    setMessage(null);
    let ok = 0;
    let failed = 0;
    for (const id of vendorIds) {
      try {
        const res = await fetch(`/api/vendors/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ readinessOverride: true }),
        });
        if (res.ok) ok++;
        else failed++;
      } catch {
        failed++;
      }
    }
    setLoading(false);
    setMessage(`Se marcaron ${ok} proveedores como Ready.${failed ? ` ${failed} fallaron.` : ''}`);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleClick} disabled={loading || vendorIds.length === 0} className="btn-secondary">
        {loading ? 'Marcando…' : `Marcar todos como Ready (${vendorIds.length})`}
      </button>
      {message && <span className="text-xs text-gray-500">{message}</span>}
    </div>
  );
}
