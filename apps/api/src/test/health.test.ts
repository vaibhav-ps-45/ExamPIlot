import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../lib/prisma.js';

describe('health endpoints', () => {
  afterEach(() => vi.restoreAllMocks());

  it('keeps liveness available without a database check', async () => {
    const response = await request(createApp()).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uptime');
  });

  it('reports ready when the database answers SELECT 1', async () => {
    vi.spyOn(prisma, '$queryRaw').mockResolvedValue([] as never);
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready', database: 'available' });
  });

  it('returns 503 when the database is unavailable', async () => {
    vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('database offline'));
    const response = await request(createApp()).get('/health/ready');
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'not_ready', database: 'unavailable' });
  });
});
