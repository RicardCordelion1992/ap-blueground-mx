'use client';

import { useState } from 'react';
import Link from 'next/link';

type RowResult = { name: string; status: 'created' | 'skipped' | 'error'; message: string };
type ImportResponse = { created: number; skipped: number; errors: number; results: RowResult[] };

const STATUS_LABEL: Record<RowResult['status'], string> = {
created: 'Creado',
skipped: 'Omitido',
error: 'Error',
};

const STATUS_CLASS: Record<RowResult['status'], string> = {
created: 'badge-ready',
skipped: 'badge-incomplete',
error: 'badge-incomplete',
};

export default function ImportVendorsPage() {
const [csv, setCsv] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const [result, setResult] = useState<ImportResponse | null>(null);

async function submit() {
setLoading(true);
setError(null);
setResult(null);
const res = await fetch('/api/vendors/import', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({ csv }),
});
setLoading(false);
const body = await res.json();
if (!res.ok) {
setError(typeof body.error === 'string' ? body.error : 'No se pudo importar.');
return;
}
setResult(body);
}

return (
<div className="max-w-3xl space-y-4">
<div>
<h1 className="text-xl font-semibold">Importar proveedores (carga masiva)</h1>
<p className="text-sm text-gray-500">
Para precargar varios proveedores de un jalón — pensado para la primera carga, no para el uso diario (eso sigue siendo{' '}
<Link href="/vendors/new" className="text-brand-600 hover:underline">
+ Nuevo proveedor
</Link>
).
</p>
</div>

<div className="card p-6 space-y-3">
<p className="text-sm text-gray-600">
Pega aquí el contenido exportado como CSV (Archivo → Descargar → Valores separados por comas), con la primera fila de
encabezados: <code className="text-xs bg-gray-100 px-1 rounded">Vendor name, RFC, Address, Account, CLABE, Bank name,
SWIFT code, Contacto (nombre), Teléfono, Email, Tipo, Estatus de datos, Día de pago, Alertas</code>.
</p>
<textarea
className="input font-mono text-xs"
rows={12}
placeholder="Vendor name,RFC,Address,..."
value={csv}
onChange={(e) => setCsv(e.target.value)}
/>
{error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">{error}</p>}
<div className="flex justify-end">
<button onClick={submit} disabled={loading || !csv.trim()} className="btn-primary">
{loading ? 'Importando…' : 'Importar'}
</button>
</div>
</div>

{result && (
<div className="card overflow-hidden">
<div className="px-4 py-3 border-b border-gray-100 flex items-center gap-4 text-sm">
<span className="font-medium">Resultado:</span>
<span>{result.created} creados</span>
<span>{result.skipped} omitidos</span>
<span>{result.errors} con error</span>
</div>
<table className="w-full text-sm">
<thead className="text-left text-gray-500 border-b border-gray-100">
<tr>
<th className="px-4 py-2 font-medium">Proveedor</th>
<th className="px-4 py-2 font-medium">Resultado</th>
<th className="px-4 py-2 font-medium">Detalle</th>
</tr>
</thead>
<tbody>
{result.results.map((r, i) => (
<tr key={i} className="border-b border-gray-50 last:border-0">
<td className="px-4 py-2">{r.name}</td>
<td className="px-4 py-2">
<span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
</td>
<td className="px-4 py-2 text-gray-600">{r.message}</td>
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
);
}
