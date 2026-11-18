import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureSchema, getSql, isOfficialVantrexEmail } from './_db.js';

function mapAttendanceRow(r: Record<string, any>) {
  return {
    id: r.id,
    employeeEmail: r.employee_email,
    workMode: r.work_mode,
    punchInAt: r.punch_in_at,
    punchInLocation: {
      lat: Number(r.punch_in_lat),
      lng: Number(r.punch_in_lng),
      accuracy: r.punch_in_accuracy !== null ? Number(r.punch_in_accuracy) : null,
      address: r.punch_in_address,
      city: r.punch_in_city || '',
      placeCategory: r.punch_in_place_type || undefined,
      placeName: r.punch_in_place_name || '',
      simulated: Boolean(r.punch_in_simulated),
    },
    punchOutAt: r.punch_out_at || null,
    punchOutLocation:
      r.punch_out_lat !== null && r.punch_out_lng !== null
        ? {
            lat: Number(r.punch_out_lat),
            lng: Number(r.punch_out_lng),
            accuracy: r.punch_out_accuracy !== null ? Number(r.punch_out_accuracy) : null,
            address: r.punch_out_address || '',
            city: r.punch_out_city || '',
            placeCategory: r.punch_out_place_type || undefined,
            placeName: r.punch_out_place_name || '',
            simulated: Boolean(r.punch_out_simulated),
          }
        : null,
    totalMinutes: r.total_minutes !== null ? Number(r.total_minutes) : null,
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
        SELECT * FROM attendance_logs
        WHERE employee_email = ${email}
        ORDER BY punch_in_at DESC
      `;
      return res.status(200).json({ logs: rows.map(mapAttendanceRow) });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    if (req.method === 'POST') {
      const email = String(body.employeeEmail || '').trim().toLowerCase();
      if (!isOfficialVantrexEmail(email)) {
        return res.status(403).json({ error: 'Invalid corporate email.' });
      }

      const active = await sql`
        SELECT id FROM attendance_logs
        WHERE employee_email = ${email} AND punch_out_at IS NULL
        LIMIT 1
      `;
      if (active.length > 0) {
        return res.status(409).json({ error: 'An active shift is already in progress.' });
      }

      const id = body.id ? String(body.id) : `att_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const loc = body.punchInLocation || {};
      const punchInAt = body.punchInAt || new Date().toISOString();

      const rows = await sql`
        INSERT INTO attendance_logs (
          id, employee_email, work_mode, punch_in_at,
          punch_in_lat, punch_in_lng, punch_in_accuracy, punch_in_address,
          punch_in_city, punch_in_place_type, punch_in_place_name, punch_in_simulated
        ) VALUES (
          ${id}, ${email}, ${body.workMode}, ${punchInAt},
          ${Number(loc.lat)}, ${Number(loc.lng)},
          ${loc.accuracy !== undefined && loc.accuracy !== null ? Number(loc.accuracy) : null},
          ${String(loc.address || '')},
          ${String(loc.city || '')},
          ${String(loc.placeCategory || '')},
          ${String(loc.placeName || '')},
          ${Boolean(loc.simulated)}
        )
        RETURNING *
      `;
      return res.status(201).json({ log: mapAttendanceRow(rows[0]) });
    }

    if (req.method === 'PATCH') {
      const id = String(body.id || '').trim();
      const loc = body.punchOutLocation || {};
      const punchOutAt = body.punchOutAt || new Date().toISOString();
      const totalMinutes = Number(body.totalMinutes ?? 0);

      if (!id) {
        return res.status(400).json({ error: 'Attendance log ID is required.' });
      }

      const rows = await sql`
        UPDATE attendance_logs SET
          punch_out_at = ${punchOutAt},
          punch_out_lat = ${Number(loc.lat)},
          punch_out_lng = ${Number(loc.lng)},
          punch_out_accuracy = ${loc.accuracy !== undefined && loc.accuracy !== null ? Number(loc.accuracy) : null},
          punch_out_address = ${String(loc.address || '')},
          punch_out_city = ${String(loc.city || '')},
          punch_out_place_type = ${String(loc.placeCategory || '')},
          punch_out_place_name = ${String(loc.placeName || '')},
          punch_out_simulated = ${Boolean(loc.simulated)},
          total_minutes = ${totalMinutes}
        WHERE id = ${id}
        RETURNING *
      `;
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Attendance record not found.' });
      }
      return res.status(200).json({ log: mapAttendanceRow(rows[0]) });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Attendance API error:', error);
    return res.status(500).json({ error: 'Attendance service failed.' });
  }
}
