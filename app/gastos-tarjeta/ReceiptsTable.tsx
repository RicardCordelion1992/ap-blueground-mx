'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: string; name: string };

type Row = {
  id: string;
  uploadedByName: string;
  provider: string;
  amount: number | null;
  expenseDate: string | null;
  description: string | null;
  buildingId: string;
  buildingName: string;
  categoryId: string | null;
  categoryName: string | null;
  previewUrl: string | null;
  createdAt: string;
};

const PROVIDER_LABEL: Record<string, string> = { BREX: 'Brex', JEEVES: 'Jeeves' };

const fmt = (n: number | null) => (n !== null ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : '—');

export default function ReceiptsTable({
  receipts,
  buildings,
  categories,
  showUploadedBy,
}: {
  receipts: Row[];
  buildings: Option[];
  categories: Option[];
  showUploadedBy: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [saving, setSaving] = useState(false);

  function startEdit(r: Row) {
    setEditingId(r.id);
    setDraft({ buildingId: r.buildingId, categoryId: r.categoryId, amount: r.amount, description: r.description });
  }

  async function save(id: string) {
    setSaving(true);
    await fetch(`/api/card-receipts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        buildingId: draft.buildingId,
        categoryId: draft.categoryId || null,
        amount: draft.amount,
        description: draft.description,
      }),
    });
    setSaving(false);
    setEditingId(null);
    router.refresh();
  }

  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b border-gray-100">
          <tr>
            {showUploadedBy && <th className="px-4 py-2 font-medium">Persona</th>}
            <th className="px-4 py-2 font-medium">Tarjeta</th>
            <th className="px-4 py-2 font-medium">Fecha</th>
            <th className="px-4 py-2 font-medium">Monto</th>
            <th className="px-4 py-2 font-medium">Concepto</th>
            <th className="px-4 py-2 font-medium">Edificio</th>
            <th className="px-4 py-2 font-medium">Categoría</th>
            <th className="px-4 py-2 font-medium">Comprobante</th>
            <th className="px-4 py-2 font-medium">Acción</th>
          </tr>
        </thead>
        <tbody>
          {receipts.map((r) => {
            const editing = editingId === r.id;
            return (
              <tr key={r.id} className="border-b border-gray-50 last:border-0 align-top">
                {showUploadedBy && <td className="px-4 py-2">{r.uploadedByName}</td>}
                <td className="px-4 py-2 text-gray-600">{PROVIDER_LABEL[r.provider] || r.provider}</td>
                <td className="px-4 py-2 text-gray-500">
                  {r.expenseDate ? new Date(r.expenseDate).toLocaleDateString('es-MX') : '—'}
                </td>
                <td className="px-4 py-2">
                  {editing ? (
                    <input
                      type="number"
                      step="0.01"
                      className="input py-1 w-28"
                      value={draft.amount ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value === '' ? null : Number(e.target.value) }))}
                    />
                  ) : (
                    fmt(r.amount)
                  )}
                </td>
                <td className="px-4 py-2 text-gray-600 max-w-[200px]">
                  {editing ? (
                    <input
                      className="input py-1"
                      value={draft.description ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                    />
                  ) : (
                    r.description || '—'
                  )}
                </td>
                <td className="px-4 py-2">
                  {editing ? (
                    <select
                      className="input py-1"
                      value={draft.buildingId}
                      onChange={(e) => setDraft((d) => ({ ...d, buildingId: e.target.value }))}
                    >
                      {buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    r.buildingName
                  )}
                </td>
                <td className="px-4 py-2">
                  {editing ? (
                    <select
                      className="input py-1"
                      value={draft.categoryId ?? ''}
                      onChange={(e) => setDraft((d) => ({ ...d, categoryId: e.target.value }))}
                    >
                      <option value="">—</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    r.categoryName || '—'
                  )}
                </td>
                <td className="px-4 py-2">
                  {r.previewUrl ? (
                    <a href={r.previewUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-xs">
                      Ver
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-2">
                  {editing ? (
                    <div className="flex gap-2">
                      <button disabled={saving} onClick={() => save(r.id)} className="text-xs text-brand-600 hover:underline">
                        {saving ? 'Guardando…' : 'Guardar'}
                      </button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:underline">
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => startEdit(r)} className="text-xs text-brand-600 hover:underline">
                      Corregir
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {receipts.length === 0 && (
            <tr>
              <td colSpan={showUploadedBy ? 9 : 8} className="px-4 py-8 text-center text-gray-400">
                Todavía no hay comprobantes de gastos de tarjeta.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
