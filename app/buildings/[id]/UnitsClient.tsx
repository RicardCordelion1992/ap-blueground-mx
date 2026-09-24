'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Unit = { id: string; unitNumber: string; poCode: string | null };

export default function UnitsClient({ buildingId, units: initial }: { buildingId: string; units: Unit[] }) {
  const [units, setUnits] = useState(initial);
  const [unitNumber, setUnitNumber] = useState('');
  const [poCode, setPoCode] = useState('');
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitNumber.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/buildings/${buildingId}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitNumber, poCode: poCode || null }),
    });
    setSaving(false);
    if (res.ok) {
      const unit = await res.json();
      setUnits((u) => [...u, unit]);
      setUnitNumber('');
      setPoCode('');
      router.refresh();
    }
  }

  return (
    <div className="card">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="font-medium text-sm">Unidades (depas)</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="text-left text-gray-500 border-b border-gray-100">
          <tr>
            <th className="px-4 py-2 font-medium">Depa</th>
            <th className="px-4 py-2 font-medium">PO (Property Onboarding)</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u) => (
            <tr key={u.id} className="border-b border-gray-50 last:border-0">
              <td className="px-4 py-2">{u.unitNumber}</td>
              <td className="px-4 py-2 text-gray-600">{u.poCode || '—'}</td>
            </tr>
          ))}
          {units.length === 0 && (
            <tr>
              <td colSpan={2} className="px-4 py-6 text-center text-gray-400">
                Sin unidades registradas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <form onSubmit={addUnit} className="flex gap-2 p-4 border-t border-gray-100">
        <input className="input" placeholder="Número de depa" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} />
        <input className="input" placeholder="Código PO" value={poCode} onChange={(e) => setPoCode(e.target.value)} />
        <button className="btn-primary whitespace-nowrap" disabled={saving}>
          {saving ? 'Agregando…' : '+ Agregar depa'}
        </button>
      </form>
    </div>
  );
}
