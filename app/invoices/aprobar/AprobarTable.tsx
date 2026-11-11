'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ApprovalButtons from '../ApprovalButtons';

type Row = {
  id: string;
  vendorName: string;
  categoryName: string | null;
  buildingLabel: string;
  buildingNames: string[];
  total: number;
  receivedDate: string;
  monthKey: string;
  monthLabel: string;
};

type MonthOption = { key: string; label: string };

const fmt = (n: number) => `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

export default function AprobarTable({
  invoices,
  canApprove,
  buildingOptions,
  categoryOptions,
  monthOptions,
}: {
  invoices: Row[];
  canApprove: boolean;
  buildingOptions: string[];
  categoryOptions: string[];
  monthOptions: MonthOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [vendorQuery, setVendorQuery] = useState('');
  const [buildingFilter, setBuildingFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (vendorQuery.trim() && !inv.vendorName.toLowerCase().includes(vendorQuery.trim().toLowerCase())) {
        return false;
      }
      if (buildingFilter && !inv.buildingNames.includes(buildingFilter)) {
        return false;
      }
      if (categoryFilter && inv.categoryName !== categoryFilter) {
        return false;
      }
      if (monthFilter && inv.monthKey !== monthFilter) {
        return false;
      }
      return true;
    });
  }, [invoices, vendorQuery, buildingFilter, categoryFilter, monthFilter]);

  const allIds = useMemo(() => filteredInvoices.map((r) => r.id), [filteredInvoices]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }
