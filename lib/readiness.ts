import { prisma } from '@/lib/prisma';
import { PersonType, DocStatus } from '@prisma/client';

// Fields required in the vendor profile before it can be "Ready".
// Some fields only apply to one person type.
const BASE_REQUIRED_FIELDS = ['name', 'rfc', 'fiscalAddress', 'taxRegime', 'email', 'bankName', 'clabe'] as const;
const MORAL_REQUIRED_FIELDS = ['legalRepName', 'legalRepRfc'] as const;

type VendorForReadiness = {
  personType: PersonType;
  name: string;
  rfc: string | null;
  curp: string | null;
  legalRepName: string | null;
  legalRepRfc: string | null;
  fiscalAddress: string | null;
  taxRegime: string | null;
  email: string | null;
  bankName: string | null;
  clabe: string | null;
};

export function missingVendorFields(vendor: VendorForReadiness): string[] {
  const missing: string[] = [];
  for (const f of BASE_REQUIRED_FIELDS) {
    if (!vendor[f as keyof VendorForReadiness]) missing.push(f);
  }
  if (vendor.personType === 'MORAL') {
    for (const f of MORAL_REQUIRED_FIELDS) {
      if (!vendor[f as keyof VendorForReadiness]) missing.push(f);
    }
  } else if (vendor.personType === 'FISICA') {
    if (!vendor.curp) missing.push('curp');
  }
  return missing;
}

// Recomputes and persists a vendor's readiness (INCOMPLETE / READY) based on:
//   1. all required profile fields being filled, and
//   2. every required, non-expired DocumentType (applicable to this person
//      type) having a VendorDocument with status VALID or RECEIVED.
// Call this after any vendor field edit or document status change.
export async function recomputeVendorReadiness(vendorId: string) {
  const vendor = await prisma.vendor.findUniqueOrThrow({
    where: { id: vendorId },
    include: { documents: { include: { docType: true } } },
  });

  const missingFields = missingVendorFields(vendor);

  const requiredDocTypes = await prisma.documentType.findMany({
    where: {
      required: true,
      OR: [{ appliesTo: null }, { appliesTo: vendor.personType }],
    },
  });

  const now = new Date();
  const missingDocs = requiredDocTypes.filter((docType) => {
    const doc = vendor.documents.find((d) => d.docTypeId === docType.id);
    if (!doc) return true;
    if (doc.status !== DocStatus.VALID && doc.status !== DocStatus.RECEIVED) return true;
    if (docType.expires && doc.expiresDate && doc.expiresDate < now) return true;
    return false;
  });

  const ready = missingFields.length === 0 && missingDocs.length === 0;

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { readiness: ready ? 'READY' : 'INCOMPLETE' },
  });

  return {
    ready,
    missingFields,
    missingDocs: missingDocs.map((d) => d.name),
  };
}
