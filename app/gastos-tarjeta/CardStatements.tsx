'use client';

import { useState } from 'react';
import CardChargesTable from './CardChargesTable';

type Option = { id: string; name: string };

type BatchSummary = {
  id: string;
  label: string;
  createdAt: string;
  total: number;
  pending: number;
  classified: number;
  ignored: number;
};

type ChargeRow = {
  id: string;
  batchId: string | null;
  chargeDate: string;
  descriptor: string;
  amount: number;
  cardHolder: string | null;
  cardLast4: string | null;
  assignedUserName: string | null;
  status: string;
  buildingName: string | null;
  categoryName: string | null;
};

export default function CardStatements({
  batches,
  charges,
  buildings,
  categories,
  showCardHolder,
}: {
  batches: BatchSummary[];
  charges: ChargeRow[];
  buildings: Option[];
  categories: Option[];
  showCardHolder: boolean;
}) {
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    batches.length > 0 ? batches[0].id : null
  );

  if (batches.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no se ha importado ningún estado de cuenta.</p>;
  }

  const selected = batches.find((b) => b.id === selectedBatchId) || batches[0];
  const batchCharges = charges.filter((c) => c.batchId === selected.id);
  const pendingCharges = batchCharges.filter((c) => c.status === 'UNMATCHED');
  const resolvedCharges = batchCharges.filter((c) => c.status !== 'UNMATCHED');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Estados de cuenta importados</h3>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <button
              key={b.id}
              onClick={() => setSelectedBatchId(b.id)}
              className={`text-left px-3 py-2 rounded-md border text-sm ${
                b.id === selected.id ? 'border-black bg-gray-100' : 'border-gray-200'
              }`}
            >
              <div className="font-medium">{b.label}</div>
              <div className="text-xs text-gray-500">
                {b.pending} pendientes · {b.classified} clasificados
                {b.ignored > 0 ? ` · ${b.ignored} ignorados` : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-2">Pendientes de clasificar — {selected.label}</h4>
        <CardChargesTable
          charges={pendingCharges}
          buildings={buildings}
          categories={categories}
          showCardHolder={showCardHolder}
        />
      </div>

      {resolvedCharges.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">Ya clasificados — {selected.label}</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left">Fecha</th>
                  <th className="px-2 py-1 text-left">Comercio</th>
                  <th className="px-2 py-1 text-right">Monto</th>
                  {showCardHolder && <th className="px-2 py-1 text-left">Persona</th>}
                  <th className="px-2 py-1 text-left">Edificio</th>
                  <th className="px-2 py-1 text-left">Categoría</th>
                  <th className="px-2 py-1 text-left">Estatus</th>
                </tr>
              </thead>
              <tbody>
                {resolvedCharges.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1 whitespace-nowrap">
                      {new Date(c.chargeDate).toLocaleDateString('es-MX')}
                    </td>
                    <td className="px-2 py-1">{c.descriptor}</td>
                    <td className="px-2 py-1 text-right">
                      ${c.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </td>
                    {showCardHolder && (
                      <td className="px-2 py-1">{c.assignedUserName || c.cardHolder || '—'}</td>
                    )}
                    <td className="px-2 py-1">{c.buildingName || '—'}</td>
                    <td className="px-2 py-1">{c.categoryName || '—'}</td>
                    <td className="px-2 py-1">
                      {c.status === 'IGNORED' ? 'Ignorado' : 'Clasificado'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
