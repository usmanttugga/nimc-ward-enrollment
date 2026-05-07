/**
 * Unit Tests for Admin Routes - Aggregator ID Assignment Endpoint
 * 
 * Tests the POST /admin/assign-aggregator-id endpoint
 * 
 * Validates: Requirements 7.1, 7.2
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { Response } from 'express';
import adminRoutes from './admin';
import * as aggregatorIdService from '../services/aggregatorIdService';
import { AuthRequest } from '../middleware/authenticate';

// Mock the aggregator ID service
vi.mock('../services/aggregatorIdService', () => ({
  assignAggregatorId: vi.fn()
}));

// Mock the authenticate and requireAdmin middleware
vi.mock('../middleware/authenticate', () => ({
  authenticate: (req: AuthRequest, _res: Response, next: () => void) => {
    req.user = { 
      userId: 'test-admin-uid', 
      role: 'ADMIN' as const,
      email: 'admin@test.com',
      name: 'Test Admin'
    };
    next();
  },
  requireAdmin: (_req: AuthRequest, _res: Response, next: () => void) => {
    next();
  }
}));

// Mock Prisma Client
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    enrollment: {
      findMany: vi.fn().mockResolvedValue([])
    },
    user: {
      findMany: vi.fn().mockResolvedValue([])
    }
  }))
}));

describe('POST /admin/assign-aggregator-id', () => {
  let app: express.Application;

  beforeEach(() => {
    // Create a fresh Express app for each test
    app = express();
    app.use(express.json());
    app.use('/admin', adminRoutes);
    
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it('should assign aggregator ID successfully and return 200', async () => {
    // Mock successful ID assignment
    const mockAssignAggregatorId = vi.mocked(aggregatorIdService.assignAggregatorId);
    mockAssignAggregatorId.mockResolvedValue('007');

    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 'test-user-123' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      aggregatorId: '007',
      userId: 'test-user-123'
    });

    expect(mockAssignAggregatorId).toHaveBeenCalledWith('test-user-123');
    expect(mockAssignAggregatorId).toHaveBeenCalledTimes(1);
  });

  it('should return 400 when userId is missing', async () => {
    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({})
      .expect(400);

    expect(response.body).toEqual({
      error: 'Invalid request: userId is required and must be a string'
    });

    expect(aggregatorIdService.assignAggregatorId).not.toHaveBeenCalled();
  });

  it('should return 400 when userId is not a string', async () => {
    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 12345 })
      .expect(400);

    expect(response.body).toEqual({
      error: 'Invalid request: userId is required and must be a string'
    });

    expect(aggregatorIdService.assignAggregatorId).not.toHaveBeenCalled();
  });

  it('should return 400 when userId is empty string', async () => {
    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: '' })
      .expect(400);

    expect(response.body).toEqual({
      error: 'Invalid request: userId is required and must be a string'
    });

    expect(aggregatorIdService.assignAggregatorId).not.toHaveBeenCalled();
  });

  it('should return 404 when user is not found', async () => {
    const mockAssignAggregatorId = vi.mocked(aggregatorIdService.assignAggregatorId);
    mockAssignAggregatorId.mockRejectedValue(
      new Error('User with ID nonexistent-user not found')
    );

    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 'nonexistent-user' })
      .expect(404);

    expect(response.body).toEqual({
      error: 'User not found',
      details: 'User with ID nonexistent-user not found'
    });

    expect(mockAssignAggregatorId).toHaveBeenCalledWith('nonexistent-user');
  });

  it('should return 409 when user already has an aggregator ID', async () => {
    const mockAssignAggregatorId = vi.mocked(aggregatorIdService.assignAggregatorId);
    mockAssignAggregatorId.mockRejectedValue(
      new Error('User test-user-123 already has aggregator ID: 005')
    );

    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 'test-user-123' })
      .expect(409);

    expect(response.body).toEqual({
      error: 'User already has an aggregator ID',
      details: 'User test-user-123 already has aggregator ID: 005'
    });

    expect(mockAssignAggregatorId).toHaveBeenCalledWith('test-user-123');
  });

  it('should return 500 for generic service errors', async () => {
    const mockAssignAggregatorId = vi.mocked(aggregatorIdService.assignAggregatorId);
    mockAssignAggregatorId.mockRejectedValue(
      new Error('Firestore connection timeout')
    );

    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 'test-user-123' })
      .expect(500);

    expect(response.body).toEqual({
      error: 'Failed to assign aggregator ID',
      details: 'Firestore connection timeout'
    });

    expect(mockAssignAggregatorId).toHaveBeenCalledWith('test-user-123');
  });

  it('should handle assignment after retry (gap filling)', async () => {
    const mockAssignAggregatorId = vi.mocked(aggregatorIdService.assignAggregatorId);
    mockAssignAggregatorId.mockResolvedValue('003');

    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 'new-aggregator' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      aggregatorId: '003',
      userId: 'new-aggregator'
    });

    expect(mockAssignAggregatorId).toHaveBeenCalledWith('new-aggregator');
  });

  it('should handle assignment of next sequential ID', async () => {
    const mockAssignAggregatorId = vi.mocked(aggregatorIdService.assignAggregatorId);
    mockAssignAggregatorId.mockResolvedValue('015');

    const response = await request(app)
      .post('/admin/assign-aggregator-id')
      .send({ userId: 'another-aggregator' })
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      aggregatorId: '015',
      userId: 'another-aggregator'
    });

    expect(mockAssignAggregatorId).toHaveBeenCalledWith('another-aggregator');
  });
});
