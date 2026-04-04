import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/states', async (_req: Request, res: Response) => {
  const states = await prisma.state.findMany({ orderBy: { name: 'asc' } });
  res.json(states);
});

router.get('/states/:stateId/lgas', async (req: Request, res: Response) => {
  const lgas = await prisma.lga.findMany({
    where: { stateId: req.params.stateId },
    orderBy: { name: 'asc' },
  });
  res.json(lgas);
});

router.get('/lgas/:lgaId/wards', async (req: Request, res: Response) => {
  const wards = await prisma.ward.findMany({
    where: { lgaId: req.params.lgaId },
    orderBy: { name: 'asc' },
  });
  res.json(wards);
});

export default router;
