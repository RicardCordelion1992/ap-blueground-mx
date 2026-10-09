import { prisma } from '@/lib/prisma';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';
import UploadProofs from './UploadProofs';
import AssignProof from './AssignProof';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<string, string> = {
  NEEDS_REVIEW: 'Necesita revisión',
  AUTO_MATCHED: 'Relacionado automáticamente',
  CONFIRMED: 'Confirmado',
  PENDING_REVIEW: 'Procesando…',
};

export default async function ComprobantesPage() {
  const proofs = await prisma.paymentProof.findMany({
    include: {
      uploadedBy: { select: { name: true } },
      allocations: { include: { invoice: { include: { vendor: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const rows = await Promise.all(
    proofs.map(async (p) => ({
      id: p.id,
      fileName: p.fileName,
      previewUrl: await signDocUrl(INVOICES_BUCKET, p.fileUrl),
      status: p.status,
      extractedAmount: p.extractedAmount ? Number(p.extractedAmount) : null,
      extractedDate: p.extractedDate ? p.extractedDate.toISOString() : null,
      extractedBeneficiary: p.extractedBeneficiary,
      extractedReference: p.extractedReference,
      uploadedByName: p.uploadedBy?.name || null,
      createdAt: p.createdAt.toISOString(),
      allocations: p.allocations.map((a) => ({
        invoiceId: a.invoiceId,
        vendorName: a.invoice.vendor.name,
        total: Number(a.invoice.total),
        matchedBy: a.matchedBy,
      })),
    }))
  );

  const needsReview = rows.filter((r) => r.status === 'NEEDS_REVIEW');
  const rest = rows.filter((r) => r.status !== 'NEEDS_REVIEW');

  const fmt = (n: number | null) => (n === null ? '—' : `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Comprobantes de pago</h1>
        <p className="text-sm text-gray-500">
          Sube uno o varios comprobantes a la vez — la IA identifica a qué factura(s) corresponden y las marca como
          pagadas. Si hay duda, el comprobante queda abajo en "Necesita revisión" para asignarlo a mano.
        </p>
      </div>

      <UploadProofs />

      {needsReview.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-medium text-sm text-amber-700">⚠ Necesitan revisión manual ({needsReview.length})</h2>
          {needsReview.map((r) => (
            <div key={r.id} className="card p-4 space-y-2 border border-amber-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{r.fileName}</p>
                  <p className="text-xs text-gray-500">
                    Monto extraído: {fmt(r.extractedAmount)} · Beneficiario: {r.extractedBeneficiary || '—'} · Fecha:{' '}
                    {r.extractedDate ? new Date(r.extractedDate).toLocaleDateString('es-MX') : '—'}
                  </p>
                </div>
                {r.previewUrl && (
                  <a href={r.previewUrl} target="_blank" rel="noreferrer" className="btn-secondary text-sm">
                    Ver comprobante
                  </a>
                )}
              </div>
              <AssignProof proofId={r.id} suggestedAmount={r.extractedAmount} suggestedName={r.extractedBeneficiary} />
            </div>
          ))}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h2 className="font-medium text-sm">Historial</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">Archivo</th>
              <th className="px-4 py-2 font-medium">Monto</th>
              <th className="px-4 py-2 font-medium">Factura(s) relacionada(s)</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Subido por</th>
            </tr>
          </thead>
          <tbody>
            {rest.map((r) => (
              <tr key={r.id} className="border-b border-gray-50 last:border-0">
                <td className="px-4 py-2">
                  {r.previewUrl ? (
                    <a href={r.previewUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">
                      {r.fileName}
                    </a>
                  ) : (
                    r.fileName
                  )}
                </td>
                <td className="px-4 py-2">{fmt(r.extractedAmount)}</td>
                <td className="px-4 py-2 text-gray-600">
                  {r.allocations.length === 0
                    ? '—'
                    : r.allocations.map((a) => a.vendorName).join(', ')}
                </td>
                <td className="px-4 py-2 text-gray-600">{STATUS_LABEL[r.status] || r.status}</td>
                <td className="px-4 py-2 text-gray-500">{r.uploadedByName || '—'}</td>
              </tr>
            ))}
            {rest.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Todavía no hay comprobantes subidos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
