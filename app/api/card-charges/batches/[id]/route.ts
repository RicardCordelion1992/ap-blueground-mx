
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me || me.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const batch = await prisma.cardImportBatch.findUnique({ where: { id: params.id } });
  if (!batch) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  await prisma.cardImportBatch.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
