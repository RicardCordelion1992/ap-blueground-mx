'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CardChargesTable from './CardChargesTable';

type Option = { id: string; name: string };

type BatchSummary = {
  id: string;
  label: string;
  createdAt: string;
  total: number;
  totalAmount: number;
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
  const router = useRouter();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(
    batches.length > 0 ? batches[0].id : null
  );
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingLabel, setSavingLabel] = useState(false);
  const [userFilter, setUserFilter] = useState('');

  if (batches.length === 0) {
    return <p className="text-sm text-gray-500">Todavía no se ha importado ningún estado de cuenta.</p>;
  }

  const selected = batches.find((b) => b.id === selectedBatchId) || batches[0];
  const rawBatchCharges = charges.filter((c) => c.batchId === selected.id);
  const userOptions = Array.from(
    new Set(rawBatchCharges.map((c) => c.assignedUserName || c.cardHolder).filter((n): n is string => !!n))
  ).sort();
  const batchCharges = userFilter
    ? rawBatchCharges.filter((c) => (c.assignedUserName || c.cardHolder) === userFilter)
    : rawBatchCharges;
  const pendingCharges = batchCharges.filter((c) => c.status === 'UNMATCHED');
  const resolvedCharges = batchCharges.filter((c) => c.status !== 'UNMATCHED');

  function selectBatch(id: string) {
    setSelectedBatchId(id);
    setUserFilter('');
  }

  function startEdit(b: BatchSummary) {
    setEditingBatchId(b.id);
    setEditValue(b.label);
  }

  async function saveLabel(batchId: string) {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    setSavingLabel(true);
    await fetch(`/api/card-charges/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: trimmed }),
    });
    setSavingLabel(false);
    setEditingBatchId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold mb-2">Estados de cuenta importados</h3>
        <div className="flex flex-wrap gap-2">
          {batches.map((b) => (
            <div
              key={b.id}
              className={`px-3 py-2 rounded-md border text-sm ${
                b.id === selected.id ? 'border-black bg-gray-100' : 'border-gray-200'
              }`}
            >
              {editingBatchId === b.id ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="border rounded px-1 py-0.5 text-sm"
                    autoFocus
                  />
                  <button
                    onClick={() => saveLabel(b.id)}
                    disabled={savingLabel}
                    className="text-xs text-brand-600 hover:underline"
                  >
                    {savingLabel ? '...' : 'Guardar'}
                  </button>
                  <button
                    onClick={() => setEditingBatchId(null)}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div onClick={() => selectBatch(b.id)} className="cursor-pointer text-left">
                  <div className="font-medium flex items-center gap-1">
                    {b.label}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(b);
                      }}
                      className="text-gray-400 hover:text-gray-700"
                      title="Editar nombre"
                    >
                      ✎
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    {b.pending} pendientes · {b.classified} clasificados
                    {b.ignored > 0 ? ` · ${b.ignored} ignorados` : ''}
                  </div>
                  <div className="text-xs font-medium text-gray-700 mt-0.5">
                    Total: ${b.totalAmount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {userOptions.length > 1 && (
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Filtrar por persona</label>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          >
            <option value="">Todas</option>
            {userOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

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
