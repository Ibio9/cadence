import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const projects = [
  { id: 'ss', name: 'StudentSolve', color: '#5FB98F', order: 0 },
  { id: 'school', name: 'School', color: '#6F8FD4', order: 1 },
  { id: 'alevel', name: 'A-levels', color: '#C89B3C', order: 2 },
  { id: 'ppe', name: 'PPE / Oxford', color: '#C77FD4', order: 3 },
  { id: 'train', name: 'Training', color: '#D4685F', order: 4 },
  { id: 'life', name: 'Life', color: '#8A90A3', order: 5 },
];

const rhythms = [
  { title: 'Wake — no phone, water', startMin: 390, endMin: 420, days: [1, 2, 3, 4, 5], projectId: 'life', fixed: true },
  { title: 'School', startMin: 510, endMin: 960, days: [1, 2, 3, 4, 5], projectId: 'school', fixed: true },
  { title: 'Deep work — StudentSolve', startMin: 1050, endMin: 1170, days: [1, 2, 3, 4, 5], projectId: 'ss', fixed: true },
  { title: 'Training', startMin: 1170, endMin: 1275, days: [1, 3, 5], projectId: 'train', fixed: true },
  { title: 'Shutdown — review and plan tomorrow', startMin: 1320, endMin: 1350, days: [0, 1, 2, 3, 4, 5, 6], projectId: 'life', fixed: true },
];

for (const p of projects) await prisma.project.upsert({ where: { id: p.id }, update: p, create: p });
if ((await prisma.rhythm.count()) === 0) await prisma.rhythm.createMany({ data: rhythms });
console.log('Seeded.');
await prisma.$disconnect();
