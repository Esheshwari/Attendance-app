import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureSchema, getSql, isOfficialVantrexEmail } from './_db.js';

function mapLeaveRow(r: Record<string, any>) {
  return {
    id: r.id,
    employeeEmail: r.employee_email,
    leaveType: r.leave_type,
    startDate: r.start_date,
    endDate: r.end_date,
    daysCount: Number(r.days_count),
    reason: r.reason,
    createdAt: r.created_at,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  try {
    await ensureSchema();
    const sql = getSql();

    if (req.method === 'GET') {
      const email = String(req.query.email || '').trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ error: 'Email query parameter is required.' });
      }
      const rows = await sql`
        SELECT * FROM leave_requests
        WHERE employee_email = ${email}
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ leaves: rows.map(mapLeaveRow) });
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
      const email = String(body.employeeEmail || '').trim().toLowerCase();
      if (!isOfficialVantrexEmail(email)) {
        return res.status(403).json({ error: 'Invalid corporate email.' });
      }

      const id = body.id ? String(body.id) : `lv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const daysCount = Math.max(1, Number(body.daysCount || 1));

      const rows = await sql`
        INSERT INTO leave_requests (
          id, employee_email, leave_type, start_date, end_date, days_count, reason
        ) VALUES (
          ${id}, ${email}, ${body.leaveType}, ${String(body.startDate)},
          ${String(body.endDate)}, ${daysCount}, ${String(body.reason || '')}
        )
        RETURNING *
      `;
      return res.status(201).json({ leave: mapLeaveRow(rows[0]) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Leaves API error:', error);
    return res.status(500).json({ error: 'Leave service failed.' });
  }
}
