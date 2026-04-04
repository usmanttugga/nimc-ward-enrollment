import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import enrollmentRoutes from './routes/enrollment';
import adminRoutes from './routes/admin';
import geoRoutes from './routes/geo';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/enrollment', enrollmentRoutes);
app.use('/admin', adminRoutes);
app.use('/geo', geoRoutes);

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

export default app;
