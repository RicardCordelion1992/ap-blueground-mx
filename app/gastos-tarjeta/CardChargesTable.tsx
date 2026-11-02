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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState('');
  const [bulkBuildingId, setBulkBuildingId] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  function setSelection(id: string, field: 'buildingId' | 'categoryId', value: string) {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value } as any,
    }));
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === charges.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(charges.map((c) => c.id)));
    }
  }

  function selectMatching() {
    if (!filterText.trim()) return;
    const needle = filterText.trim().toLowerCase();
    const matching = charges.filter((c) => c.descriptor.toLowerCase().includes(needle));
    setSelectedIds(new Set(matching.map((c) => c.id)));
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
        let detail = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) detail += `: ${data.error}`;
        } catch {}
        setError(detail);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Error de red');
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
        let detail = `HTTP ${res.status}`;
        try {
          const data = await res.json();
          if (data?.error) detail += `: ${data.error}`;
        } catch {}
        setError(detail);
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err?.message || 'Error de red');
    } finally {
      setSavingId(null);
    }
  }

  async function handleBulkClassify() {
    if (!bulkBuildingId || !bulkCategoryId || selectedIds.size === 0) {
      setBulkMessage('Elige edificio y categoría, y selecciona al menos un cargo');
      return;
    }
    setBulkSaving(true);
    setBulkMessage(null);
    let ok = 0;
    const errors: string[] = [];
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/card-charges/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ buildingId: bulkBuildingId, categoryId: bulkCategoryId }),
        });
        if (res.ok) {
          ok++;
        } else {
          let detail = `HTTP ${res.status}`;
          try {
            const data = await res.json();
            if (data?.error) detail += `: ${data.error}`;
          } catch {}
          errors.push(detail);
        }
      } catch (err: any) {
        errors.push(err?.message || 'Error de red');
      }
    }
    setBulkSaving(false);
    setSelectedIds(new Set());
    if (errors.length > 0) {
      const uniqueErrors = Array.from(new Set(errors));
      setBulkMessage(`Se clasificaron ${ok} cargos. ${errors.length} fallaron: ${uniqueErrors.join(' | ')}`);
    } else {
      setBulkMessage(`Se clasificaron ${ok} cargos.`);
    }
    router.refresh();
  }

  if (charges.length === 0) {
    return <p className="text-sm text-gray-500">No hay cargos de tarjeta pendientes de clasificar.</p>;
  }

  return (
    <div className="overflow-x-auto">
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <div className="flex flex-wrap items-end gap-2 mb-3 p-2 bg-gray-50 border rounded-md">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Buscar por comercio (ej. Uber)</label>
          <div className="flex gap-1">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Uber"
              className="border rounded px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={selectMatching}
              className="px-2 py-1 bg-gray-200 rounded text-xs"
            >
              Seleccionar coincidencias
            </button>
          </div>
        </div>

        {selectedIds.size > 0 && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Edificio</label>
              <select
                className="border rounded px-1 py-1 text-sm"
                value={bulkBuildingId}
                onChange={(e) => setBulkBuildingId(e.target.value)}
              >
                <option value="">Elegir...</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">Categoría</label>
              <select
                className="border rounded px-1 py-1 text-sm"
                value={bulkCategoryId}
                onChange={(e) => setBulkCategoryId(e.target.value)}
              >
                <option value="">Elegir...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={handleBulkClassify}
              disabled={bulkSaving}
              className="px-3 py-1.5 bg-black text-white text-sm rounded disabled:opacity-50"
            >
              {bulkSaving ? 'Clasificando...' : `Clasificar ${selectedIds.size} seleccionados`}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-2 py-1 text-xs text-gray-600 underline"
            >
              Cancelar selección
            </button>
          </>
        )}
      </div>
      {bulkMessage && <p className="text-sm text-green-700 mb-2">{bulkMessage}</p>}

      <table className="min-w-full text-sm border">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1">
              <input
                type="checkbox"
                checked={selectedIds.size === charges.length}
                onChange={toggleSelectAll}
              />
            </th>
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
              <td className="px-2 py-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelected(c.id)}
                />
              </td>
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
