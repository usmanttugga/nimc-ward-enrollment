import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

const enrollmentSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  stateId: z.string().min(1),
  lgaId: z.string().min(1),
  wardId: z.string().min(1),
  deviceId: z.string().min(1),
  dailyFigures: z.number().int().min(0),
  issuesComplaints: z.string().optional(),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = enrollmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors });
    return;
  }
  const data = parsed.data;
  const record = await prisma.enrollment.create({
    data: {
      date: new Date(data.date),
      stateId: data.stateId,
      lgaId: data.lgaId,
      wardId: data.wardId,
      deviceId: data.deviceId,
      dailyFigures: data.dailyFigures,
      issuesComplaints: data.issuesComplaints,
      agentId: req.user!.userId,
    },
  });
  res.status(201).json(record);
});

router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  const records = await prisma.enrollment.findMany({
    where: { agentId: req.user!.userId },
    include: { ward: { include: { lga: { include: { state: true } } } } },
    orderBy: { submittedAt: 'desc' },
  });
  res.json(records);
});

export default router;
