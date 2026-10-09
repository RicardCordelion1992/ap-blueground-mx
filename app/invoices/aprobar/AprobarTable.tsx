'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ApprovalButtons from '../ApprovalButtons';

type Row = {
  id: string;
  vendorName: string;
  categoryName: string | null;
  periodLabel: string;
  buildingLabel: string;
  total: number;
  receivedDate: string;
};

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export default function AprobarTable({ invoices, canApprove }: { invoices: Row[]; canApprove: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const allIds = useMemo(() => invoices.map((r) => r.id), [invoices]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }

  async function approveSelected() {
    if (selected.size === 0) return;
    setSaving(true);
    setResultMsg(null);
    const res = await fetch('/api/invoices/bulk-approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceIds: [...selected] }),
    });
    const data = await res.json();
    setSaving(false);
    const skippedCount = data.skipped?.length || 0;
    setResultMsg(
      `${data.updated?.length || 0} factura(s) aprobadas${skippedCount > 0 ? `, ${skippedCount} omitida(s) (revisa su estado)` : ''}.`
    );
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {canApprove && selected.size > 0 && (
        <div className="card p-4 flex flex-wrap items-center gap-3 bg-brand-50 border border-brand-200">
          <button onClick={approveSelected} disabled={saving} className="btn-primary disabled:opacity-40">
            {saving ? 'Aprobando…' : `Aprobar ${selected.size} factura(s)`}
          </button>
          <button onClick={() => setSelected(new Set())} className="btn-secondary">
            Cancelar selección
          </button>
        </div>
      )}
      {resultMsg && <p className="text-sm text-gray-600">{resultMsg}</p>}

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">
                {canApprove && (
                  <input
                    type="checkbox"
                    checked={allIds.length > 0 && selected.size === allIds.length}
                    onChange={toggleAll}
                    title="Seleccionar todas"
                  />
                )}
              </th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Periodo</th>
              <th className="px-4 py-2 font-medium">Edificio(s)</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Recibida</th>
              <th className="px-4 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  {canApprove && (
                    <input type="checkbox" checked={selected.has(inv.id)} onChange={() => toggle(inv.id)} />
                  )}
                </td>
                <td className="px-4 py-2">
                  <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-medium">
                    {inv.vendorName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{inv.categoryName || '—'}</td>
                <td className="px-4 py-2 text-gray-600">{inv.periodLabel}</td>
                <td className="px-4 py-2 text-gray-600">{inv.buildingLabel}</td>
                <td className="px-4 py-2">{fmt(inv.total)}</td>
                <td className="px-4 py-2 text-gray-500">{new Date(inv.receivedDate).toLocaleDateString('es-MX')}</td>
                <td className="px-4 py-2">
                  <ApprovalButtons invoiceId={inv.id} canApprove={canApprove} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No hay facturas pendientes de aprobación.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
