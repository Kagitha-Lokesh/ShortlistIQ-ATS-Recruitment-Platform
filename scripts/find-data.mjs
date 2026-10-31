import { createRequire } from 'module';
import path from 'path';

const require = createRequire(path.resolve('apps/api/package.json'));
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    const batches = await prisma.batch.findMany({
      select: {
        id: true,
        name: true,
        candidates: { select: { id: true, fullName: true }, take: 2 },
        forms: { select: { id: true, slug: true }, take: 1 }
      },
      take: 2
    });
    const checks = await prisma.candidateCheck.findMany({
      select: { id: true, jobTitle: true },
      take: 2
    });
    const users = await prisma.profile.findMany({
      where: { role: 'hr' },
      select: { id: true, fullName: true, orgId: true },
      take: 1
    });
    console.log(JSON.stringify({ batches, checks, users }, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
