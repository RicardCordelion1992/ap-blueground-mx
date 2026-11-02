'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: string; name: string };

type ChargeRow = {
  id: string;
  chargeDate: string;
  descriptor: string;
  amount: number;
  cardHolder: string | null;
  cardLast4: string | null;
  assignedUserName: string | null;
};

export default function CardChargesTable({
  charges,
  buildings,
  categories,
  showCardHolder,
}: {
  charges: ChargeRow[];
  buildings: Option[];
  categories: Option[];
  showCardHolder: boolean;
}) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, { buildingId: string; categoryId: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setSelection(id: string, field: 'buildingId' | 'categoryId', value: string) {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value } as any,
    }));
  }

  async function handleSave(id: string) {
    const sel = selections[id];
    if (!sel?.buildingId || !sel?.categoryId) {
      setError('Elige edificio y categoría antes de guardar');
      return;
    }
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`/api/card-charges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildingId: sel.buildingId, categoryId: sel.categoryId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo guardar');
      } else {
        router.refresh();
      }
    } finally {
      setSavingId(null);
    }
  }

  async function handleIgnore(id: string) {
    setError(null);
    setSavingId(id);
    try {
      const res = await fetch(`/api/card-charges/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ignore: true }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'No se pudo ignorar');
      } else {
        router.refresh();
      }
    } finally {
      setSavingId(null);
    }
  }

  if (charges.length === 0) {
    return <p className="text-sm text-gray-500">No hay cargos de tarjeta pendientes de clasificar.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <table className="min-w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left">Fecha</th>
            <th className="px-2 py-1 text-left">Comercio</th>
            <th className="px-2 py-1 text-right">Monto</th>
            {showCardHolder && <th className="px-2 py-1 text-left">Persona</th>}
            <th className="px-2 py-1 text-left">Edificio</th>
            <th className="px-2 py-1 text-left">Categoría</th>
            <th className="px-2 py-1 text-left">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {charges.map((c) => (
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
              <td className="px-2 py-1">
                <select
                  className="border rounded px-1 py-0.5 text-sm"
                  value={selections[c.id]?.buildingId || ''}
                  onChange={(e) => setSelection(c.id, 'buildingId', e.target.value)}
                >
                  <option value="">Elegir...</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1">
                <select
                  className="border rounded px-1 py-0.5 text-sm"
                  value={selections[c.id]?.categoryId || ''}
                  onChange={(e) => setSelection(c.id, 'categoryId', e.target.value)}
                >
                  <option value="">Elegir...</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-2 py-1 whitespace-nowrap">
                <button
                  onClick={() => handleSave(c.id)}
                  disabled={savingId === c.id}
                  className="px-2 py-1 bg-black text-white rounded text-xs mr-1 disabled:opacity-50"
                >
                  Guardar
                </button>
                <button
                  onClick={() => handleIgnore(c.id)}
                  disabled={savingId === c.id}
                  className="px-2 py-1 bg-gray-200 rounded text-xs disabled:opacity-50"
                >
                  Ignorar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
