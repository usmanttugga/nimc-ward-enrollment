import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, signToken } from '../services/authService';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'Validation failed', fields: parsed.error.flatten().fieldErrors });
    return;
  }
  const { email, password, name } = parsed.data;
  const user = await registerUser(email, password, name);
  if (!user) {
    res.status(409).json({ error: 'Email already registered' });
    return;
  }
  const token = signToken({ userId: user.id, role: user.role, email: user.email, name: user.name });
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json({ error: 'Validation failed' });
    return;
  }
  const { email, password } = parsed.data;
  const user = await loginUser(email, password);
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }
  const token = signToken({ userId: user.id, role: user.role, email: user.email, name: user.name });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

export default router;
