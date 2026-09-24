import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const categories = await prisma.expenseCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  return NextResponse.json(categories);
}
