'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type InvoiceRow = {
  id: string;
  vendorName: string;
  categoryName: string | null;
  period: string;
  buildingLabel: string;
  buildingNames: string[];
  total: number;
  receivedDate: string;
  status: string;
  payable: boolean;
  monthKey: string;
  monthLabel: string;
};

type MonthGroup = {
  key: string;
  label: string;
  count: number;
  total: number;
};

function StatusBadge({ status, payable }: { status: string; payable: boolean }) {
  if (status === 'PAID') return <span className="badge bg-gray-100 text-gray-700">Pagada</span>;
  if (status === 'APPROVED') {
    return payable ? (
      <span className="badge-ready">Aprobada · Pagable</span>
    ) : (
      <span className="badge-incomplete">Aprobada · No pagable</span>
    );
  }
  if (status === 'REJECTED') return <span className="badge bg-red-50 text-red-700">Rechazada</span>;
  return <span className="badge bg-amber-50 text-amber-700">Por aprobar</span>;
}

function ReturnToApprovalButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function handleClick() {
    if (
      !confirm(
        '¿Regresar esta factura a "Por aprobar"? Perderá su estatus de pagada y volverá a pasar por el flujo de aprobación.'
      )
    ) {
      return;
    }
    setWorking(true);
    const res = await fetch(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PENDING' }),
    });
    setWorking(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || 'No se pudo regresar la factura.');
      return;
    }
    router.refresh();
  }

  return (
    <button onClick={handleClick} disabled={working} className="text-xs text-brand-600 hover:underline disabled:opacity-40">
      {working ? 'Regresando…' : 'Regresar a por aprobar'}
    </button>
  );
}

function InvoiceRowsTable({ rows, isAdmin }: { rows: InvoiceRow[]; isAdmin: boolean }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b border-gray-100">
          <tr>
            <th className="px-4 py-2 font-medium">Proveedor</th>
            <th className="px-4 py-2 font-medium">Categoría</th>
            <th className="px-4 py-2 font-medium">Periodo</th>
            <th className="px-4 py-2 font-medium">Edificio(s)</th>
            <th className="px-4 py-2 font-medium">Total</th>
            <th className="px-4 py-2 font-medium">Recibida</th>
            <th className="px-4 py-2 font-medium">Estatus</th>
            <th className="px-4 py-2 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((inv) => (
            <tr key={inv.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <td className="px-4 py-2">
                <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline font-medium">
                  {inv.vendorName}
                </Link>
              </td>
              <td className="px-4 py-2 text-gray-600">{inv.categoryName || '—'}</td>
              <td className="px-4 py-2 text-gray-600">{inv.period}</td>
              <td className="px-4 py-2 text-gray-600">{inv.buildingLabel}</td>
              <td className="px-4 py-2">${inv.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
              <td className="px-4 py-2 text-gray-500">{new Date(inv.receivedDate).toLocaleDateString('es-MX')}</td>
              <td className="px-4 py-2">
                <StatusBadge status={inv.status} payable={inv.payable} />
              </td>
              <td className="px-4 py-2">
                {isAdmin && inv.status === 'PAID' && <ReturnToApprovalButton invoiceId={inv.id} />}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                Sin facturas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function InvoicesTable({
  rows,
  monthGroups,
  isAdmin,
  buildingOptions,
}: {
  rows: InvoiceRow[];
  monthGroups: MonthGroup[];
  isAdmin: boolean;
  buildingOptions: string[];
}) {
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(
    monthGroups.length > 0 ? monthGroups[0].key : null
  );
  const [vendorQuery, setVendorQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (vendorQuery.trim() && !r.vendorName.toLowerCase().includes(vendorQuery.trim().toLowerCase())) {
        return false;
      }
      if (buildingFilter && !r.buildingNames.includes(buildingFilter)) {
        return false;
      }
      return true;
    });
  }, [rows, vendorQuery, buildingFilter]);

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
      </div>

      <div className="flex gap-2 text-sm">
        <button
          onClick={() => setViewMode('month')}
          className={`px-3 py-1.5 rounded-md border ${
            viewMode === 'month' ? 'border-black bg-gray-100' : 'border-gray-200 text-gray-600'
          }`}
        >
          Por mes
        </button>
        <button
          onClick={() => setViewMode('all')}
          className={`px-3 py-1.5 rounded-md border ${
            viewMode === 'all' ? 'border-black bg-gray-100' : 'border-gray-200 text-gray-600'
          }`}
        >
          Ver todas
        </button>
      </div>

      {viewMode === 'month' ? (
        monthGroups.length === 0 ? (
          <p className="text-sm text-gray-500">No hay facturas.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {monthGroups.map((g) => (
                <button
                  key={g.key}
                  onClick={() => setSelectedMonthKey(g.key)}
                  className={`text-left px-3 py-2 rounded-md border text-sm ${
                    g.key === selectedMonthKey ? 'border-black bg-gray-100' : 'border-gray-200'
                  }`}
                >
                  <div className="font-medium">{g.label}</div>
                  <div className="text-xs text-gray-500">
                    {g.count} facturas · ${g.total.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </button>
              ))}
            </div>
            <InvoiceRowsTable rows={filteredRows.filter((r) => r.monthKey === selectedMonthKey)} isAdmin={isAdmin} />
          </>
        )
      ) : (
        <InvoiceRowsTable rows={filteredRows} isAdmin={isAdmin} />
      )}
    </div>
  );
}
