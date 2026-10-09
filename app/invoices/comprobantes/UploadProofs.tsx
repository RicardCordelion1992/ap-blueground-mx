'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function UploadProofs() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setSummary(null);

    const form = new FormData();
    for (const file of Array.from(files)) form.append('files', file);

    const res = await fetch('/api/payment-proofs', { method: 'POST', body: form });
    const data = await res.json();
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';

    if (!res.ok) {
      setSummary(data.error || 'Ocurrió un error al subir los comprobantes.');
      return;
    }

    const results: any[] = data.results || [];
    const matched = results.filter((r) => r.status === 'AUTO_MATCHED').length;
    const review = results.filter((r) => r.status === 'NEEDS_REVIEW').length;
    const errors = results.filter((r) => r.error).length;
    setSummary(
      `${results.length} archivo(s) procesados: ${matched} relacionados automáticamente, ${review} necesitan revisión manual${
        errors > 0 ? `, ${errors} con error` : ''
      }.`
    );
    router.refresh();
  }

  return (
    <div className="card p-4 space-y-2">
      <label className="label">Subir comprobantes (puedes seleccionar varios PDF/imágenes a la vez)</label>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading}
        className="block text-sm"
      />
      {uploading && <p className="text-sm text-gray-500">Procesando comprobantes… esto puede tardar un poco por archivo.</p>}
      {summary && <p className="text-sm text-gray-700">{summary}</p>}
    </div>
  );
}
