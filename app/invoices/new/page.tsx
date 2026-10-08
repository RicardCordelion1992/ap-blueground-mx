import { prisma } from '@/lib/prisma';
import NewInvoiceForm from './NewInvoiceForm';
import { INVOICES_BUCKET, signDocUrl } from '@/lib/signedUrl';

export const dynamic = 'force-dynamic';

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: { inbound?: string };
}) {
  const [vendors, buildings, categories] = await Promise.all([
    prisma.vendor.findMany({ select: { id: true, name: true, readiness: true }, orderBy: { name: 'asc' } }),
    prisma.building.findMany({ include: { units: true }, orderBy: { name: 'asc' } }),
    prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);

  // Si venimos de la Bandeja de correo (/invoices/bandeja), prellenamos el
  // formulario con lo que ya se extrajo cuando llegó el correo, en vez de
  // pedir subir el archivo de nuevo.
  let initialInbound: {
    id: string;
    fromEmail: string;
    fields: Record<string, any>;
    fileUrl: string;
    previewUrl: string | null;
    fileName: string;
  } | null = null;

  if (searchParams.inbound) {
    const inboundEmail = await prisma.inboundInvoiceEmail.findUnique({ where: { id: searchParams.inbound } });
    if (inboundEmail && inboundEmail.status === 'PENDING_REVIEW') {
      let fields: Record<string, any> = {};
      if (inboundEmail.extractedFields) {
        try {
          fields = JSON.parse(inboundEmail.extractedFields);
        } catch {
          fields = {};
        }
      }
      const previewUrl = await signDocUrl(INVOICES_BUCKET, inboundEmail.fileUrl);
      initialInbound = {
        id: inboundEmail.id,
        fromEmail: inboundEmail.fromEmail,
        fields,
        fileUrl: inboundEmail.fileUrl,
        previewUrl,
        fileName: inboundEmail.fileName || 'factura',
      };
    }
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-xl font-semibold mb-4">Nueva factura</h1>
      <NewInvoiceForm
        vendors={vendors}
        buildings={buildings}
        categories={categories}
        initialInbound={initialInbound}
      />
    </div>
  );
}
