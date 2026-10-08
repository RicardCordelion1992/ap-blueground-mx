import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import DiscardButton from './DiscardButton';

export const dynamic = 'force-dynamic';

export default async function BandejaPage() {
  const emails = await prisma.inboundInvoiceEmail.findMany({
    where: { status: 'PENDING_REVIEW' },
    orderBy: { receivedAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Bandeja de correo</h1>
        <p className="text-sm text-gray-500">
          Facturas recibidas por reenvío de correo, aún sin capturar. Ábrelas para revisar los datos
          precargados, confirmar proveedor/edificio y guardarlas — ahí entran al flujo normal de aprobación.
        </p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-4 py-2 font-medium">De</th>
              <th className="px-4 py-2 font-medium">Asunto</th>
              <th className="px-4 py-2 font-medium">Archivo</th>
              <th className="px-4 py-2 font-medium">Recibido</th>
              <th className="px-4 py-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => {
              let preview: { vendorName?: string; total?: number } = {};
              if (e.extractedFields) {
                try {
                  preview = JSON.parse(e.extractedFields);
                } catch {
                  preview = {};
                }
              }
              return (
                <tr key={e.id} className="border-b border-gray-50 last:border-0 align-top">
                  <td className="px-4 py-2 text-gray-600">{e.fromEmail}</td>
                  <td className="px-4 py-2">
                    {e.subject || <span className="text-gray-400">(sin asunto)</span>}
                    {preview.vendorName && (
                      <p className="text-xs text-gray-500">
                        {preview.vendorName}
                        {preview.total
                          ? ` · $${Number(preview.total).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
                          : ''}
                      </p>
                    )}
                    {!e.extractedFields && (
                      <p className="text-xs text-amber-700">No se pudo extraer automáticamente — captura a mano.</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{e.fileName || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(e.receivedAt).toLocaleString('es-MX')}</td>
                  <td className="px-4 py-2">
                    <div className="flex gap-3 items-center">
                      <Link href={`/invoices/new?inbound=${e.id}`} className="text-xs text-brand-600 hover:underline">
                        Revisar y capturar
                      </Link>
                      <DiscardButton id={e.id} />
                    </div>
                  </td>
                </tr>
              );
            })}
            {emails.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No hay facturas pendientes en la bandeja de correo.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
