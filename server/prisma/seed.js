/**
 * Seed: the seven real projects and the training spine.
 *
 * Re-runnable. It replaces the placeholder rhythms from the original scaffold
 * with the real weekly rhythm, then clears pending template blocks from today
 * forward so the new spine materialises.
 *
 * It never deletes a Project, because historical Blocks and Tasks reference
 * them by foreign key. Old projects stay; they simply stop being used.
 * It never deletes a Block you authored or completed: the clear is filtered to
 * source 'template' and status 'pending', the same filter rebuildFuture uses.
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const today = () => new Date().toISOString().slice(0, 10);

/* Subject-level projects. Topic is a free-text label on the block, never a
   nested project. Colours are data, not design tokens: distinguishable, and
   deliberately outside mint's green band so a project colour never reads as
   the emitter. */
const projects = [
  { id: 'fm', name: 'Further Maths', color: '#2F5FA8', order: 0 },
  { id: 'maths', name: 'Maths', color: '#4B86C4', order: 1 },
  { id: 'econ', name: 'Economics', color: '#B8842B', order: 2 },
  { id: 'phil', name: 'Philosophy', color: '#9C5A46', order: 3 },
  { id: 'tara', name: 'TARA', color: '#A83A32', order: 4 },
  { id: 'oxprep', name: 'Oxford Prep', color: '#6E6350', order: 5 },
  { id: 'train', name: 'Training', color: '#3E7D8C', order: 6 },
];

/* The spine. Non-negotiable, materialising indefinitely. 0 = Sunday.
   Travel padding is a later step: these are the sessions themselves. */
const SPINE = [
  { title: 'BJJ No-Gi', days: [2], startMin: 1080, endMin: 1140 }, // Tue 18:00
  { title: 'MMA', days: [2], startMin: 1140, endMin: 1200 }, //       Tue 19:00
  { title: 'MT Bag/Pads', days: [3], startMin: 1080, endMin: 1140 }, // Wed 18:00
  { title: 'MT Technique', days: [3], startMin: 1140, endMin: 1200 }, // Wed 19:00
  { title: 'MT Technique', days: [4], startMin: 1140, endMin: 1200 }, // Thu 19:00
  { title: 'MMA', days: [6], startMin: 780, endMin: 840 }, //         Sat 13:00
];

/* Placeholder rhythms from the original scaffold, matched byte for byte. */
const SCAFFOLD_RHYTHMS = [
  'Wake — no phone, water',
  'School',
  'Deep work — StudentSolve',
  'Training',
  'Shutdown — review and plan tomorrow',
];

const spineTitles = [...new Set(SPINE.map((r) => r.title))];

for (const p of projects) {
  await prisma.project.upsert({ where: { id: p.id }, update: p, create: p });
}
console.log(`Projects upserted: ${projects.length}`);

// Drop the scaffold rhythms, and any previous run of this seed, so re-running
// resets the spine rather than duplicating it.
const dropped = await prisma.rhythm.deleteMany({
  where: { title: { in: [...SCAFFOLD_RHYTHMS, ...spineTitles] } },
});
console.log(`Rhythms removed: ${dropped.count}`);

await prisma.rhythm.createMany({
  data: SPINE.map((r) => ({ ...r, projectId: 'train', fixed: true })),
});
console.log(`Spine rhythms created: ${SPINE.length}`);

// Same filter as rebuildFuture, but from today rather than tomorrow: a seed is
// a deliberate reset, not a passive rhythm edit, so today rebuilds too.
const day = today();
const clearedBlocks = await prisma.block.deleteMany({
  where: { date: { gte: day }, source: 'template', status: 'pending' },
});
const clearedStamps = await prisma.dayStamp.deleteMany({ where: { date: { gte: day } } });
console.log(
  `Pending template blocks cleared from ${day}: ${clearedBlocks.count} (${clearedStamps.count} day stamps)`,
);

console.log('Seeded. Open a day to materialise the spine.');
await prisma.$disconnect();
