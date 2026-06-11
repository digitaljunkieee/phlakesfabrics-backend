import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

import app from '../../express/app';
import { mountedRoutes } from '../../express/app';

const hasLocalEnvFile =
  fs.existsSync(path.resolve(process.cwd(), '.env')) ||
  fs.existsSync(path.resolve(process.cwd(), 'backend', '.env'));

describe('Express API app', () => {
  test('serves health checks', async () => {
    const response = await request(app).get('/health').expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.service).toBe('phlakesfabrics-express');
    expect(response.body.status).toBe('ok');
  });

  test('mounts discovered Next API route handlers', async () => {
    expect(mountedRoutes.length).toBeGreaterThan(20);

    const response = await request(app).get('/api/_health/env').expect(200);

    expect(response.body).toHaveProperty('mongoDb');
    expect(response.body).toHaveProperty('nodeEnv');
    if (hasLocalEnvFile) {
      expect(response.body.mongoDb).toBe(true);
    }
  });

  test('returns JSON for unknown API routes', async () => {
    const response = await request(app).get('/api/unknown-route').expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('API route not found');
    expect(response.body.mountedRouteCount).toBeGreaterThan(20);
  });
});
