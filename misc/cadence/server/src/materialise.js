import { prisma } from './db.js';

/**
 * Build a date's blocks from the recurring rhythms — exactly once.
 * The DayStamp guard is the whole point: without it, re-opening a day would
 * resurrect blocks you deleted or duplicate ones you moved.
 */
export async function materialise(date) {
  const existing = await prisma.dayStamp.findUnique({ where: { date } });
  if (existing) return;

  const dow = new Date(date + 'T12:00:00').getDay();
  const rhythms = await prisma.rhythm.findMany();
  const due = rhythms.filter((r) => r.days.includes(dow));

  await prisma.$transaction([
    prisma.block.createMany({
      data: due.map((r) => ({
        date,
        title: r.title,
        startMin: r.startMin,
        endMin: r.endMin,
        fixed: r.fixed,
        source: 'template',
        rhythmId: r.id,
        projectId: r.projectId,
      })),
    }),
    prisma.dayStamp.create({ data: { date } }),
  ]);
}

/** Drop stamps for future dates so template edits take effect tomorrow, never today. */
export async function rebuildFuture(today) {
  await prisma.block.deleteMany({
    where: { date: { gt: today }, source: 'template', status: 'pending' },
  });
  await prisma.dayStamp.deleteMany({ where: { date: { gt: today } } });
}
