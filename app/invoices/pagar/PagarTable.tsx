'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MarkPaidButton from '../[id]/MarkPaidButton';

type Row = {
  id: string;
  vendorName: string;
  categoryName: string | null;
  buildingLabel: string;
  total: number;
  dueDate: string | null;
  payable: boolean;
};

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export default function PagarTable({ invoices }: { invoices: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidVia, setPaidVia] = useState('Tarjeta de crédito');
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const selectableRows = useMemo(() => invoices.filter((inv) => inv.payable), [invoices]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === selectableRows.length ? new Set() : new Set(selectableRows.map((r) => r.id))));
  }

  async function markSelectedPaid() {
    if (selected.size === 0) return;
    setSaving(true);
    setResultMsg(null);
    const res = await fetch('/api/invoices/bulk-pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceIds: [...selected], paidDate, paidVia: paidVia || null }),
    });
    const data = await res.json();
    setSaving(false);
    const skippedCount = data.skipped?.length || 0;
    setResultMsg(
      `${data.updated?.length || 0} factura(s) marcadas como pagadas${skippedCount > 0 ? `, ${skippedCount} omitida(s) (revisa su estado)` : ''}.`
    );
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="card p-4 flex flex-wrap items-end gap-3 bg-brand-50 border border-brand-200">
          <div>
            <label className="label">Fecha de pago</label>
            <input type="date" className="input" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Vía de pago</label>
            <input
              type="text"
              className="input"
              placeholder="ej. Tarjeta **** 1234, Transferencia"
              value={paidVia}
              onChange={(e) => setPaidVia(e.target.value)}
            />
          </div>
          <button onClick={markSelectedPaid} disabled={saving} className="btn-primary disabled:opacity-40">
            {saving ? 'Guardando…' : `Marcar ${selected.size} factura(s) como pagadas`}
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
                <input
                  type="checkbox"
                  checked={selectableRows.length > 0 && selected.size === selectableRows.length}
                  onChange={toggleAll}
                  title="Seleccionar todas las que se pueden pagar"
                />
              </th>
              <th className="px-4 py-2 font-medium">Proveedor</th>
              <th className="px-4 py-2 font-medium">Categoría</th>
              <th className="px-4 py-2 font-medium">Edificio(s)</th>
              <th className="px-4 py-2 font-medium">Total</th>
              <th className="px-4 py-2 font-medium">Vencimiento</th>
              <th className="px-4 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    disabled={!inv.payable}
                    checked={selected.has(inv.id)}
                    onChange={() => toggle(inv.id)}
                  />
                </td>
                <td className="px-4 py-2">
                  <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-medium">
                    {inv.vendorName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-gray-600">{inv.categoryName || '—'}</td>
                <td className="px-4 py-2 text-gray-600">{inv.buildingLabel}</td>
                <td className="px-4 py-2">{fmt(inv.total)}</td>
                <td className="px-4 py-2 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-MX') : '—'}</td>
                <td className="px-4 py-2">
                  <MarkPaidButton invoiceId={inv.id} disabled={!inv.payable} />
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No hay facturas aprobadas en espera de pago.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
