'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Vendor = { id: string; name: string; readiness: 'READY' | 'INCOMPLETE' };
type Unit = { id: string; unitNumber: string };
type Building = { id: string; name: string; units: Unit[] };
type Category = { id: string; name: string };
type Allocation = { buildingId: string; unitId: string; amount: string };

type InitialInvoice = {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  categoryId: string;
  receivedDate: string;
  issueDate: string;
  dueDate: string;
  period: string;
  subtotal: string;
  taxAmount: string;
  total: string;
  notes: string;
  allocations: Allocation[];
};

function periodToRange(period: string): { billingStart: string | null; billingEnd: string | null } {
  if (!period) return { billingStart: null, billingEnd: null };
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return { billingStart: null, billingEnd: null };
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { billingStart: start.toISOString().slice(0, 10), billingEnd: end.toISOString().slice(0, 10) };
}

export default function EditInvoiceForm({
  invoice,
  vendors: initialVendors,
  buildings: initialBuildings,
  categories,
}: {
  invoice: InitialInvoice;
  vendors: Vendor[];
  buildings: Building[];
  categories: Category[];
}) {
  const router = useRouter();
  const [buildings, setBuildings] = useState(initialBuildings);
  const [vendors, setVendors] = useState(initialVendors);
  const [vendorId, setVendorId] = useState(invoice.vendorId);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber);
  const [categoryId, setCategoryId] = useState(invoice.categoryId);
  const [receivedDate, setReceivedDate] = useState(invoice.receivedDate);
  const [issueDate, setIssueDate] = useState(invoice.issueDate);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [period, setPeriod] = useState(invoice.period);
  const [subtotal, setSubtotal] = useState(invoice.subtotal);
  const [taxAmount, setTaxAmount] = useState(invoice.taxAmount);
  const [total, setTotal] = useState(invoice.total);
  const [notes, setNotes] = useState(invoice.notes);
  const [allocations, setAllocations] = useState<Allocation[]>(
    invoice.allocations.length > 0 ? invoice.allocations : [{ buildingId: '', unitId: '', amount: '' }]
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState('');
  const [newVendorName, setNewVendorName] = useState('');

  const totalNum = parseFloat(total) || 0;
  const allocatedSum = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const diff = totalNum - allocatedSum;

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  function updateAllocation(i: number, patch: Partial<Allocation>) {
    setAllocations((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function addAllocationRow() {
    setAllocations((rows) => [...rows, { buildingId: '', unitId: '', amount: '' }]);
  }

  function removeAllocationRow(i: number) {
    setAllocations((rows) => rows.filter((_, idx) => idx !== i));
  }

  function splitEvenly() {
    const valid = allocations.filter((a) => a.buildingId);
    if (valid.length === 0 || !totalNum) return;
    const share = (totalNum / valid.length).toFixed(2);
    setAllocations((rows) => rows.map((r) => (r.buildingId ? { ...r, amount: share } : r)));
  }

  async function addBuildingInline() {
    if (!newBuildingName.trim()) return;
    const res = await fetch('/api/buildings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBuildingName.trim() }),
    });
    if (res.ok) {
      const b = await res.json();
      setBuildings((prev) => [...prev, { ...b, units: [] }].sort((a, c) => a.name.localeCompare(c.name)));
      setNewBuildingName('');
    }
  }

  async function addVendorInline() {
    if (!newVendorName.trim()) return;
    const res = await fetch('/api/vendors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newVendorName.trim() }),
    });
    if (res.ok) {
      const v = await res.json();
      setVendors((prev) => [...prev, v].sort((a, b) => a.name.localeCompare(b.name)));
      setVendorId(v.id);
      setNewVendorName('');
    } else {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'No se pudo crear el proveedor.');
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (Math.abs(diff) > 0.5) {
      setError(`La suma de las asignaciones ($${allocatedSum.toFixed(2)}) no coincide con el total ($${totalNum.toFixed(2)}).`);
      return;
    }
    if (!vendorId) {
      setError('Selecciona un proveedor.');
      return;
    }

    const { billingStart, billingEnd } = periodToRange(period);

    setSaving(true);
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        invoiceNumber: invoiceNumber || null,
        categoryId: categoryId || null,
        receivedDate,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        billingStart,
        billingEnd,
        subtotal: subtotal || null,
        taxAmount: taxAmount || null,
        total: totalNum,
        notes: notes || null,
        allocations: allocations
          .filter((a) => a.buildingId && a.amount)
          .map((a) => ({ buildingId: a.buildingId, unitId: a.unitId || null, amount: parseFloat(a.amount) })),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'No se pudo guardar la factura.');
      return;
    }

    router.push(`/invoices/${invoice.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-6 max-w-2xl">
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Proveedor *</label>
          <select required className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            <option value="">Selecciona…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.readiness === 'INCOMPLETE' ? '(expediente incompleto)' : ''}
              </option>
            ))}
          </select>
          {selectedVendor?.readiness === 'INCOMPLETE' && (
            <p className="text-xs text-amber-700 mt-1">
              Este proveedor no está "Ready" — la factura se guardará como <strong>no pagable</strong> hasta completar su expediente.
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <input
              className="input flex-1"
              placeholder="¿No está el proveedor? Agrégalo aquí sin salir del formulario"
              value={newVendorName}
              onChange={(e) => setNewVendorName(e.target.value)}
            />
            <button type="button" className="btn-secondary whitespace-nowrap" onClick={addVendorInline}>
              + Nuevo proveedor
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">No. de factura</label>
            <input className="input" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha de recepción *</label>
            <input type="date" required className="input" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Fecha de emisión</label>
            <input type="date" className="input" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Fecha de vencimiento</label>
            <input type="date" className="input" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <label className="label">Periodo (mes al que corresponde)</label>
            <input type="month" className="input" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Subtotal</label>
            <input type="number" step="0.01" className="input" value={subtotal} onChange={(e) => setSubtotal(e.target.value)} />
          </div>
          <div>
            <label className="label">Impuestos</label>
            <input type="number" step="0.01" className="input" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Total *</label>
            <input type="number" step="0.01" required className="input" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Notas</label>
          <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </div>

      <div className="card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-sm">Asignación por edificio (sin límite)</h2>
          <button type="button" onClick={splitEvenly} className="text-xs text-brand-600 hover:underline">
            Dividir en partes iguales
          </button>
        </div>

        {allocations.map((row, i) => {
          const building = buildings.find((b) => b.id === row.buildingId);
          const pct = totalNum > 0 && row.amount ? ((parseFloat(row.amount) / totalNum) * 100).toFixed(1) : '0.0';
          return (
            <div key={i} className="flex items-center gap-2">
              <select
                className="input flex-1"
                value={row.buildingId}
                onChange={(e) => updateAllocation(i, { buildingId: e.target.value, unitId: '' })}
              >
                <option value="">Edificio…</option>
                {buildings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                className="input w-36"
                value={row.unitId}
                disabled={!building || building.units.length === 0}
                onChange={(e) => updateAllocation(i, { unitId: e.target.value })}
              >
                <option value="">Depa (opcional)</option>
                {building?.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unitNumber}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Monto"
                className="input w-32"
                value={row.amount}
                onChange={(e) => updateAllocation(i, { amount: e.target.value })}
              />
              <span className="text-xs text-gray-500 w-12 text-right">{pct}%</span>
              <button type="button" onClick={() => removeAllocationRow(i)} className="text-gray-400 hover:text-red-600 text-sm">
                ✕
              </button>
            </div>
          );
        })}

        <button type="button" onClick={addAllocationRow} className="text-sm text-brand-600 hover:underline">
          + Agregar edificio
        </button>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <input
            className="input flex-1"
            placeholder="¿Falta un edificio? Agrégalo aquí sin salir del formulario"
            value={newBuildingName}
            onChange={(e) => setNewBuildingName(e.target.value)}
          />
          <button type="button" className="btn-secondary whitespace-nowrap" onClick={addBuildingInline}>
            + Nuevo edificio
          </button>
        </div>

        <p className={`text-sm ${Math.abs(diff) > 0.5 ? 'text-red-600' : 'text-green-700'}`}>
          Asignado: ${allocatedSum.toFixed(2)} de ${totalNum.toFixed(2)} {Math.abs(diff) > 0.5 ? `(faltan $${diff.toFixed(2)})` : '✓'}
        </p>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}

      <div className="flex justify-end gap-2">
        <a href={`/invoices/${invoice.id}`} className="btn-secondary">
          Cancelar
        </a>
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}
