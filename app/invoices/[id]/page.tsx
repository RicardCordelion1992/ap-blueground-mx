import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import MarkPaidButton from './MarkPaidButton';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: { vendor: true, category: true, allocations: { include: { building: true, unit: true } }, createdBy: true },
  });
  if (!invoice) notFound();

  const signedFileUrl = await signDocUrl(INVOICES_BUCKET, invoice.fileUrl);
  // PDF se embebe en un iframe; cualquier otra cosa (png/jpg) se muestra como imagen.
  const isPdfPreview = /\.pdf($|\?)/i.test(invoice.fileUrl || '') || /\.pdf$/i.test(invoice.fileName || '');

  return (
    <div className="max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold">{invoice.vendor.name}</h1>
            <p className="text-sm text-gray-500">
              Factura {invoice.invoiceNumber || 's/n'} · Recibida {new Date(invoice.receivedDate).toLocaleDateString('es-MX')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {invoice.status === 'PAID' ? (
              <span className="badge bg-gray-100 text-gray-700">Pagada</span>
            ) : invoice.payable ? (
              <span className="badge-ready">Pagable</span>
            ) : (
              <span className="badge-incomplete">No pagable — proveedor incompleto</span>
            )}
          </div>
        </div>

        {invoice.status === 'PENDING' && <MarkPaidButton invoiceId={invoice.id} disabled={!invoice.payable} />}

        <div className="card p-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Subtotal</p>
            <p className="font-medium">${Number(invoice.subtotal ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-gray-500">Impuestos</p>
            <p className="font-medium">${Number(invoice.taxAmount ?? 0).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-gray-500">Total</p>
            <p className="font-medium">${Number(invoice.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</p>
          </div>
          <div>
            <p className="text-gray-500">Categoría</p>
            <p className="font-medium">{invoice.category?.name || '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Vencimiento</p>
            <p className="font-medium">{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('es-MX') : '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Capturada por</p>
            <p className="font-medium">{invoice.createdBy?.name || '—'}</p>
          </div>
        </div>

        {signedFileUrl && (
          <a href={signedFileUrl} target="_blank" className="btn-secondary inline-block text-sm">
            Ver archivo original
          </a>
        )}

        <div className="card">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-medium text-sm">Asignación por edificio / unidad</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 font-medium">Edificio</th>
                <th className="px-4 py-2 font-medium">Unidad</th>
                <th className="px-4 py-2 font-medium">Monto</th>
                <th className="px-4 py-2 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {invoice.allocations.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-4 py-2">{a.building.name}</td>
                  <td className="px-4 py-2 text-gray-600">{a.unit?.unitNumber || '—'}</td>
                  <td className="px-4 py-2">${Number(a.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-2 text-gray-600">{((Number(a.amount) / Number(invoice.total)) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {signedFileUrl && (
        <div className="card p-4 space-y-2 lg:sticky lg:top-4">
          <p className="text-sm font-medium text-gray-700">Vista previa del archivo</p>
          {isPdfPreview ? (
            <iframe src={signedFileUrl} title="Vista previa de la factura" className="w-full h-[70vh] rounded-md border border-gray-200" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signedFileUrl} alt="Vista previa de la factura" className="w-full rounded-md border border-gray-200" />
          )}
          <a href={signedFileUrl} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">
            Abrir en una pestaña nueva
          </a>
        </div>
      )}
    </div>
  );
}
