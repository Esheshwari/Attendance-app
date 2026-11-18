import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureSchema, getSql } from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const sql = getSql();

    const [employeesRows, attendanceRows, leaveRows] = await Promise.all([
      sql`SELECT id, email, full_name, employee_id, mobile_number, department, role, created_at FROM employees ORDER BY created_at DESC`,
      sql`SELECT * FROM attendance_logs ORDER BY punch_in_at DESC`,
      sql`SELECT * FROM leave_requests ORDER BY created_at DESC`,
    ]);

    return res.status(200).json({
      employees: employeesRows.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.full_name,
        employeeId: r.employee_id,
        mobileNumber: r.mobile_number || '',
        department: r.department,
        role: r.role,
        createdAt: r.created_at,
      })),
      attendance: attendanceRows.map((r) => ({
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
      })),
      leaves: leaveRows.map((r) => ({
        id: r.id,
        employeeEmail: r.employee_email,
        leaveType: r.leave_type,
        startDate: r.start_date,
        endDate: r.end_date,
        daysCount: Number(r.days_count),
        reason: r.reason,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('Team API error:', error);
    return res.status(500).json({ error: 'Failed to load team HR overview.' });
  }
}
