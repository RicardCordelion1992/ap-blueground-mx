'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Candidate = {
  id: string;
  vendor: { name: string };
  total: string | number;
  invoiceNumber: string | null;
};

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export default function AssignProof({
  proofId,
  suggestedAmount,
  suggestedName,
}: {
  proofId: string;
  suggestedAmount: number | null;
  suggestedName: string | null;
}) {
  const router = useRouter();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [query, setQuery] = useState(suggestedName || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/invoices?status=APPROVED')
      .then((r) => r.json())
      .then((data) => setCandidates(Array.isArray(data) ? data : []))
      .catch(() => setCandidates([]));
  }, []);

  const filtered = candidates.filter((c) =>
    query.trim() ? c.vendor.name.toLowerCase().includes(query.toLowerCase()) : true
  );

  const selectedTotal = [...selected].reduce((sum, id) => {
    const c = candidates.find((x) => x.id === id);
    return sum + (c ? Number(c.total) : 0);
  }, 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirm() {
    if (selected.size === 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/payment-proofs/${proofId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceIds: [...selected] }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || 'No se pudo asignar.');
      return;
    }
    router.refresh();
  }

  const amountDiffers = suggestedAmount != null && Math.abs(selectedTotal - suggestedAmount) > 1;

  return (
    <div className="space-y-2 border-t border-amber-100 pt-2">
      <input
        type="text"
        className="input"
        placeholder="Buscar proveedor…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="max-h-40 overflow-y-auto border border-gray-100 rounded">
        {filtered.map((c) => (
          <label key={c.id} className="flex items-center gap-2 px-2 py-1 text-sm hover:bg-gray-50 cursor-pointer">
            <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
            <span className="flex-1">
              {c.vendor.name} {c.invoiceNumber ? `· #${c.invoiceNumber}` : ''}
            </span>
            <span className="text-gray-500">{fmt(Number(c.total))}</span>
          </label>
        ))}
        {filtered.length === 0 && <p className="text-xs text-gray-400 px-2 py-2">Sin facturas aprobadas que coincidan.</p>}
      </div>
      <div className="flex items-center justify-between text-xs text-gray-600">
        <span>
          Seleccionado: {fmt(selectedTotal)}
          {amountDiffers && suggestedAmount != null && (
            <span className="text-amber-600"> (el comprobante dice {fmt(suggestedAmount)} — revisa antes de confirmar)</span>
          )}
        </span>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button onClick={confirm} disabled={selected.size === 0 || saving} className="btn-primary text-sm disabled:opacity-40">
        {saving ? 'Guardando…' : `Asignar y marcar ${selected.size || ''} factura(s) como pagada(s)`}
      </button>
    </div>
  );
}
