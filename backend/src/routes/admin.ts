import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { stringify } from 'csv-stringify/sync';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/authenticate';
import { assignAggregatorId } from '../services/aggregatorIdService';

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

/**
 * POST /admin/assign-aggregator-id
 * Assign an aggregator ID to a user
 * 
 * Validates: Requirements 7.1, 7.2
 */
router.post('/assign-aggregator-id', async (req: AuthRequest, res: Response) => {
  try {
    // Extract userId from request body
    const { userId } = req.body;
    
    // Validate userId is provided
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ 
        error: 'Invalid request: userId is required and must be a string' 
      });
      return;
    }
    
    // Call the aggregator ID assignment service
    const aggregatorId = await assignAggregatorId(userId);
    
    // Return the assigned ID in the response
    res.status(200).json({ 
      success: true,
      aggregatorId,
      userId 
    });
    
  } catch (error: any) {
    // Handle specific error cases
    if (error.message?.includes('not found')) {
      res.status(404).json({ 
        error: 'User not found',
        details: error.message 
      });
      return;
    }
    
    if (error.message?.includes('already has aggregator ID')) {
      res.status(409).json({ 
        error: 'User already has an aggregator ID',
        details: error.message 
      });
      return;
    }
    
    // Generic error handling
    console.error('Error assigning aggregator ID:', error);
    res.status(500).json({ 
      error: 'Failed to assign aggregator ID',
      details: error.message 
    });
  }
});

export default router;
