'use client';

import { useState } from 'react';
import Link from 'next/link';

type InvoiceRow = {
  id: string;
  vendorName: string;
  categoryName: string | null;
  period: string;
  buildingLabel: string;
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

function InvoiceRowsTable({ rows }: { rows: InvoiceRow[] }) {
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
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
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
}: {
  rows: InvoiceRow[];
  monthGroups: MonthGroup[];
}) {
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(
    monthGroups.length > 0 ? monthGroups[0].key : null
  );

  return (
    <div className="space-y-3">
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
            <InvoiceRowsTable rows={rows.filter((r) => r.monthKey === selectedMonthKey)} />
          </>
        )
      ) : (
        <InvoiceRowsTable rows={rows} />
      )}
    </div>
  );
}
