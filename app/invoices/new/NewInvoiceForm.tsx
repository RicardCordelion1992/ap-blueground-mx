'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type Vendor = { id: string; name: string; readiness: 'READY' | 'INCOMPLETE' };
type Unit = { id: string; unitNumber: string };
type Building = { id: string; name: string; units: Unit[] };
type Category = { id: string; name: string };

type Allocation = { buildingId: string; unitId: string; amount: string };

export default function NewInvoiceForm({
  vendors,
  buildings: initialBuildings,
  categories,
}: {
  vendors: Vendor[];
  buildings: Building[];
  categories: Category[];
}) {
  const router = useRouter();
  const [buildings, setBuildings] = useState(initialBuildings);
  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10));
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [subtotal, setSubtotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [total, setTotal] = useState('');
  const [notes, setNotes] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [allocations, setAllocations] = useState<Allocation[]>([{ buildingId: '', unitId: '', amount: '' }]);
  const [extracting, setExtracting] = useState(false);
  const [extractNote, setExtractNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState('');

  const totalNum = parseFloat(total) || 0;
  const allocatedSum = allocations.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const diff = totalNum - allocatedSum;

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  async function handleFile(file: File) {
    setExtracting(true);
    setExtractNote(null);
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/invoices/extract', { method: 'POST', body: fd });
    const body = await res.json();
    setExtracting(false);

    if (body.fileUrl) {
      setFileUrl(body.fileUrl);
      setFileName(body.fileName);
    }

    if (!res.ok) {
      setExtractNote(body.error || 'No se pudo extraer automáticamente. Captura los datos manualmente.');
      return;
    }

    const f = body.fields || {};
    if (f.invoiceNumber) setInvoiceNumber(f.invoiceNumber);
    if (f.issueDate) setIssueDate(f.issueDate);
    if (f.subtotal) setSubtotal(String(f.subtotal));
    if (f.taxAmount) setTaxAmount(String(f.taxAmount));
    if (f.total) setTotal(String(f.total));

    if (f.vendorRfc) {
      const match = vendors.find((v) => v.name.toLowerCase().includes((f.vendorName || '').toLowerCase()));
      if (match) setVendorId(match.id);
    }
    if (f.suggestedCategory) {
      const cat = categories.find((c) => c.name.toLowerCase() === String(f.suggestedCategory).toLowerCase());
      if (cat) setCategoryId(cat.id);
    }

    const matchedBuildings: string[] = [];
    if (Array.isArray(f.suggestedBuildings)) {
      for (const name of f.suggestedBuildings) {
        const b = buildings.find((bd) => bd.name.toLowerCase() === String(name).toLowerCase());
        if (b) matchedBuildings.push(b.id);
      }
    }
    if (matchedBuildings.length > 0 && f.total) {
      const share = (parseFloat(f.total) / matchedBuildings.length).toFixed(2);
      setAllocations(matchedBuildings.map((buildingId) => ({ buildingId, unitId: '', amount: share })));
    }

    setExtractNote('Datos extraídos automáticamente — revisa antes de guardar.');
  }

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

    setSaving(true);
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorId,
        invoiceNumber: invoiceNumber || null,
        categoryId: categoryId || null,
        receivedDate,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        subtotal: subtotal ? parseFloat(subtotal) : null,
        taxAmount: taxAmount ? parseFloat(taxAmount) : null,
        total: totalNum,
        notes: notes || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        allocations: allocations
          .filter((a) => a.buildingId && a.amount)
          .map((a) => ({ buildingId: a.buildingId, unitId: a.unitId || null, amount: parseFloat(a.amount) })),
      }),
    });
    setSaving(false);

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === 'string' ? body.error : 'No se pudo guardar la factura.');
      return;
    }
    const invoice = await res.json();
    router.push(`/invoices/${invoice.id}`);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card p-4">
        <label className="label">Subir factura (PDF o imagen) — extracción automática</label>
        <input
          type="file"
          accept="application/pdf,image/*"
          disabled={extracting}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="text-sm"
        />
        {extracting && <p className="text-sm text-brand-600 mt-2">Extrayendo datos…</p>}
        {extractNote && <p className="text-sm text-gray-600 mt-2">{extractNote}</p>}
      </div>

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

      <div className="flex justify-end">
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? 'Guardando…' : 'Guardar factura'}
        </button>
      </div>
    </form>
  );
}
