import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate, requireAdmin);

router.get('/enrollments', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.enrollment.findMany({
    include: {
      agent: { select: { name: true, email: true } },
      ward: { include: { lga: { include: { state: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(records);
});

router.get('/enrollments/export', async (_req: AuthRequest, res: Response) => {
  const records = await prisma.enrollment.findMany({
    include: {
      agent: { select: { name: true, email: true } },
      ward: { include: { lga: { include: { state: true } } } },
    },
    orderBy: { submittedAt: 'desc' },
  });

  const rows = records.map((r) => ({
    Date: r.date.toISOString().split('T')[0],
    Agent: r.agent.name,
    Email: r.agent.email,
    State: r.ward.lga.state.name,
    LGA: r.ward.lga.name,
    Ward: r.ward.name,
    'Device ID': r.deviceId,
    'Daily Figures': r.dailyFigures,
    'Issues/Complaints': r.issuesComplaints || '',
    'Submitted At': r.submittedAt.toISOString(),
  }));

  const csv = stringify(rows, { header: true });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="enrollments.csv"');
  res.send(csv);
});

router.get('/agents', async (_req: AuthRequest, res: Response) => {
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT' },
    select: { id: true, name: true, email: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(agents);
});

export default router;
