'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Row = {
  id: string;
  vendorName: string;
  categoryName: string | null;
  periodLabel: string;
  buildingLabel: string;
  buildingNames: string[];
  total: number;
  dueDate: string | null;
  payable: boolean;
  monthKey: string;
  monthLabel: string;
};

type MonthOption = { key: string; label: string };

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

function PaymentActionCell({ invoiceId, canMarkPaid }: { invoiceId: string; canMarkPaid: boolean }) {
  const [state, setState] = useState<'idle' | 'working' | 'paidProof' | 'paidCard'>('idle');
  const [proofViewUrl, setProofViewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadProof(file: File) {
    setState('working');
    setError(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`/api/invoices/${invoiceId}/payment-proof`, { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'No se pudo subir el comprobante');
      setState('idle');
      return;
    }
    setProofViewUrl(data.proofViewUrl);
    setState('paidProof');
  }

  async function markPaidCard() {
    setState('working');
    setError(null);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', paidVia: 'Tarjeta corporativa', paidDate: new Date().toISOString() }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || 'No se pudo marcar como pagada');
      setState('idle');
      return;
    }
    setState('paidCard');
  }

  if (state === 'paidProof') {
    return (
      <div className="text-xs">
        <span className="text-green-700 font-medium">✓ Pagada</span>
        {proofViewUrl && (
          <>
            {' · '}
            <a href={proofViewUrl} target="_blank" className="text-brand-600 hover:underline">
              Ver comprobante
            </a>
          </>
        )}
      </div>
    );
  }

  if (state === 'paidCard') {
    return <span className="text-xs text-green-700 font-medium">✓ Pagada con tarjeta</span>;
  }

  if (!canMarkPaid) {
    return <p className="text-xs text-gray-400">Solo un administrador puede marcar como pagada.</p>;
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex flex-col gap-1">
        <label className="btn-secondary text-xs cursor-pointer text-center">
          {state === 'working' ? 'Subiendo…' : 'Subir comprobante'}
          <input
            type="file"
            className="hidden"
            accept="application/pdf,image/*"
            disabled={state === 'working'}
            onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])}
          />
        </label>
        <button
          onClick={markPaidCard}
          disabled={state === 'working'}
          className="btn-secondary text-xs disabled:opacity-40"
        >
          Marcar pagada con tarjeta
        </button>
      </div>
    </div>
  );
}

export default function PagarTable({
  invoices,
  buildingOptions,
  categoryOptions,
  monthOptions,
  canMarkPaid,
}: {
  invoices: Row[];
  buildingOptions: string[];
  categoryOptions: string[];
  monthOptions: MonthOption[];
  canMarkPaid: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paidVia, setPaidVia] = useState('Tarjeta de crédito');
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [vendorQuery, setVendorQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (vendorQuery.trim() && !inv.vendorName.toLowerCase().includes(vendorQuery.trim().toLowerCase())) {
        return false;
      }
      if (buildingFilter && !inv.buildingNames.includes(buildingFilter)) {
        return false;
      }
      if (categoryFilter && inv.categoryName !== categoryFilter) {
        return false;
      }
      if (monthFilter && inv.monthKey !== monthFilter) {
        return false;
      }
      return true;
    });
  }, [invoices, vendorQuery, buildingFilter, categoryFilter, monthFilter]);

  const selectableRows = useMemo(() => filteredInvoices, [filteredInvoices]);

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
      <div className="card p-3 flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">Buscar proveedor</label>
          <input
            type="text"
            className="input"
            placeholder="Nombre del proveedor…"
            value={vendorQuery}
            onChange={(e) => setVendorQuery(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Mes</label>
          <select className="input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            <option value="">Todos</option>
            {monthOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Edificio</label>
          <select className="input" value={buildingFilter} onChange={(e) => setBuildingFilter(e.target.value)}>
            <option value="">Todos</option>
            {buildingOptions.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Categoría</label>
          <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas</option>
            {categoryOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {canMarkPaid && selected.size > 0 && (
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
                {canMarkPaid && (
                  <input
                    type="checkbox"
                    checked={selectableRows.length > 0 && selected.size === selectableRows.length}
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
              <th className="px-4 py-2 font-medium">Vencimiento</th>
              <th className="px-4 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((inv) => (
              <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                <td className="px-4 py-2">
                  {canMarkPaid && (
                    <input
                      type="checkbox"
                      checked={selected.has(inv.id)}
                      onChange={() => toggle(inv.id)}
                    />
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
                <td className="px-4 py-2 text-gray-500">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-MX') : '—'}</td>
                <td className="px-4 py-2">
                  <PaymentActionCell invoiceId={inv.id} canMarkPaid={canMarkPaid} />
                </td>
              </tr>
            ))}
            {filteredInvoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No hay facturas que coincidan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
