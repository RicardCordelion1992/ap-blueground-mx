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
  const
