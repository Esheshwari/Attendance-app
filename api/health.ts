import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureSchema, getSql } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      ok: false,
      database: 'unconfigured',
      message: 'DATABASE_URL environment variable is not set.',
    });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`SELECT 1`;
    return res.status(200).json({ ok: true, database: 'neon' });
  } catch (error) {
    console.error('Neon health check failed:', error);
    return res.status(500).json({
      ok: false,
      database: 'error',
      message: 'Failed to connect to Neon PostgreSQL.',
    });
  }
}
