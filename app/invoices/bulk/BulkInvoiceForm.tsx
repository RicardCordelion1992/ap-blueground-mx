'use client';

import { useState } from 'react';
import Link from 'next/link';

type Vendor = { id: string; name: string; readiness: 'READY' | 'INCOMPLETE' };
type Unit = { id: string; unitNumber: string };
type Building = { id: string; name: string; units: Unit[] };
type Category = { id: string; name: string };

type ExtractedFields = {
  vendorName?: string;
  vendorRfc?: string;
  invoiceNumber?: string;
  issueDate?: string;
  billingStart?: string;
  billingEnd?: string;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  currency?: string;
  suggestedCategory?: string;
  suggestedBuildings?: string[];
};

type RowResult = {
  fileName: string;
  status: 'pending' | 'processing' | 'ok' | 'error';
  message?: string;
  invoiceId?: string;
};

export default function BulkInvoiceForm({
  vendors,
  buildings,
  categories,
}: {
  vendors: Vendor[];
  buildings: Building[];
  categories: Category[];
}) {
  const [vendorId, setVendorId] = useState('');
  const [buildingId, setBuildingId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<RowResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selectedVendor = vendors.find((v) => v.id === vendorId);

  function handleFilesSelected(selected: FileList | null) {
    const list = Array.from(selected || []);
    setFiles(list);
    setResults(list.map((f) => ({ fileName: f.name, status: 'pending' })));
  }

  async function processAll() {
    setError(null);
    if (!vendorId) {
      setError('Selecciona un proveedor.');
      return;
    }
    if (!buildingId) {
      setError('Selecciona un edificio.');
      return;
    }
    if (files.length === 0) {
      setError('Selecciona al menos un archivo.');
      return;
    }

    setProcessing(true);
    const rows: RowResult[] = files.map((f) => ({ fileName: f.name, status: 'pending' }));
    setResults([...rows]);

    for (let i = 0; i < files.length; i++) {
      rows[i] = { ...rows[i], status: 'processing' };
      setResults([...rows]);

      try {
        const fd = new FormData();
        fd.append('file', files[i]);
        const extractRes = await fetch('/api/invoices/extract', { method: 'POST', body: fd });
        const extractBody = await extractRes.json();

        if (!extractRes.ok) {
          rows[i] = { ...rows[i], status: 'error', message: extractBody.error || 'No se pudo leer el archivo.' };
          setResults([...rows]);
          continue;
        }

        const fields: ExtractedFields = extractBody.fields || {};
        const total = typeof fields.total === 'number' ? fields.total : parseFloat(String(fields.total || '0')) || 0;

        let resolvedCategoryId = categoryId;
        if (!resolvedCategoryId && fields.suggestedCategory) {
          const cat = categories.find((c) => c.name.toLowerCase() === String(fields.suggestedCategory).toLowerCase());
          if (cat) resolvedCategoryId = cat.id;
        }

        const createRes = await fetch('/api/invoices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            vendorId,
            invoiceNumber: fields.invoiceNumber || null,
            categoryId: resolvedCategoryId || null,
            receivedDate: new Date().toISOString().slice(0, 10),
            issueDate: fields.issueDate || null,
            dueDate: null,
            billingStart: fields.billingStart || null,
            billingEnd: fields.billingEnd || null,
            subtotal: typeof fields.subtotal === 'number' ? fields.subtotal : null,
            taxAmount: typeof fields.taxAmount === 'number' ? fields.taxAmount : null,
            total,
            notes: null,
            fileUrl: extractBody.fileUrl || null,
            fileName: extractBody.fileName || files[i].name,
            inboundEmailId: null,
            allocations: [{ buildingId, unitId: null, amount: total }],
          }),
        });

        if (!createRes.ok) {
          const createBody = await createRes.json().catch(() => ({}));
          rows[i] = { ...rows[i], status: 'error', message: typeof createBody.error === 'string' ? createBody.error : 'No se pudo guardar la factura.' };
          setResults([...rows]);
          continue;
        }

        const invoice = await createRes.json();
        rows[i] = { ...rows[i], status: 'ok', invoiceId: invoice.id, message: total ? `$${total.toFixed(2)}` : 'Guardada sin monto detectado — revísala' };
        setResults([...rows]);
      } catch (err) {
        rows[i] = { ...rows[i], status: 'error', message: 'Error inesperado al procesar este archivo.' };
        setResults([...rows]);
      }
    }

    setProcessing(false);
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const doneCount = okCount + errorCount;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card p-6 space-y-4">
        <div>
          <label className="label">Proveedor * (mismo para todas las facturas de este lote)</label>
          <select required className="input" value={vendorId} onChange={(e) => setVendorId(e.target.value)} disabled={processing}>
            <option value="">Selecciona…</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.readiness === 'INCOMPLETE' ? '(expediente incompleto)' : ''}
              </option>
            ))}
          </select>
          {selectedVendor?.readiness === 'INCOMPLETE' && (
            <p className="text-xs text-amber-700 mt-1">
              Este proveedor no está "Ready" — las facturas se guardarán como <strong>no pagables</strong> hasta completar su expediente.
            </p>
          )}
        </div>

        <div>
          <label className="label">Edificio * (mismo para todas, 100% del monto se asigna aquí)</label>
          <select required className="input" value={buildingId} onChange={(e) => setBuildingId(e.target.value)} disabled={processing}>
            <option value="">Selecciona…</option>
            {buildings.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Categoría (opcional — si no la eliges, se intenta detectar por archivo)</label>
          <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={processing}>
            <option value="">— Detectar automáticamente —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Archivos (PDF o imagen) — selecciona todos juntos</label>
          <input
            type="file"
            multiple
            accept="application/pdf,image/*"
            disabled={processing}
            onChange={(e) => handleFilesSelected(e.target.files)}
            className="text-sm"
          />
          <p className="text-xs text-gray-500 mt-1">
            Cada archivo se procesa con la IA y se guarda automáticamente con el proveedor, edificio y categoría de
            arriba — sin pedirte revisar cada uno. Al final verás un resumen de lo que se guardó bien y lo que tuvo
            algún problema.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}

        <button type="button" onClick={processAll} disabled={processing || files.length === 0} className="btn-primary">
          {processing ? `Procesando ${doneCount + 1} de ${files.length}…` : `Procesar y guardar ${files.length || ''} factura(s)`}
        </button>
      </div>

      {results.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 font-medium">Archivo</th>
                <th className="px-4 py-2 font-medium">Estatus</th>
                <th className="px-4 py-2 font-medium">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2">{r.fileName}</td>
                  <td className="px-4 py-2">
                    {r.status === 'pending' && <span className="text-gray-400">Pendiente</span>}
                    {r.status === 'processing' && <span className="text-brand-600">Procesando…</span>}
                    {r.status === 'ok' && <span className="text-green-700">Guardada ✓</span>}
                    {r.status === 'error' && <span className="text-red-600">Error</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {r.status === 'ok' && r.invoiceId ? (
                      <Link href={`/invoices/${r.invoiceId}`} className="text-brand-600 hover:underline">
                        {r.message} · Ver factura
                      </Link>
                    ) : (
                      r.message || '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!processing && doneCount === results.length && (
            <p className="text-sm text-gray-600 p-4 border-t border-gray-100">
              {okCount} guardada{okCount === 1 ? '' : 's'} correctamente
              {errorCount > 0 ? ` · ${errorCount} con error (revísalas e intenta subirlas de nuevo o captúralas manualmente)` : ''}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
