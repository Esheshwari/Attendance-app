import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureSchema, getSql } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    await sql`DELETE FROM leave_requests`;
    await sql`DELETE FROM attendance_logs`;
    await sql`DELETE FROM employees`;
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Reset API error:', error);
    return res.status(500).json({ error: 'Failed to reset system data.' });
  }
}
