import type { VercelRequest, VercelResponse } from '@vercel/node';
import { applyCors, ensureSchema, getSql } from './_db.js';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

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

    const empMap = new Map(employeesRows.map((e) => [String(e.email).toLowerCase(), e]));
    const emailsWithRecords = new Set<string>();

    const headers = [
      'Record Type',
      'Employee ID',
      'Full Name',
      'Email',
      'Mobile Number',
      'Department',
      'Role',
      'Date / Range',
      'Work Mode / Leave Type',
      'Punch In Time',
      'Punch Out Time',
      'Total Hours / Days',
      'Entry City',
      'Entry Place Type',
      'Entry GPS Coordinates',
      'Entry Address',
      'Entry Google Maps URL',
      'Exit City',
      'Exit Place Type',
      'Exit GPS Coordinates',
      'Exit Address',
      'Exit Google Maps URL',
      'Notes / Reason',
    ];

    const rows: string[][] = [headers];

    for (const r of attendanceRows) {
      const email = String(r.employee_email).toLowerCase();
      emailsWithRecords.add(email);
      const emp = empMap.get(email);
      const inDate = new Date(r.punch_in_at);
      const outDate = r.punch_out_at ? new Date(r.punch_out_at) : null;
      const hours = r.total_minutes !== null ? (Number(r.total_minutes) / 60).toFixed(2) : 'In Progress';
      const inLat = Number(r.punch_in_lat);
      const inLng = Number(r.punch_in_lng);
      const hasOut = r.punch_out_lat !== null && r.punch_out_lng !== null;
      const outLat = hasOut ? Number(r.punch_out_lat) : null;
      const outLng = hasOut ? Number(r.punch_out_lng) : null;

      rows.push([
        'Attendance',
        emp?.employee_id || '-',
        emp?.full_name || r.employee_email,
        r.employee_email,
        emp?.mobile_number || '-',
        emp?.department || '-',
        emp?.role || '-',
        inDate.toLocaleDateString('en-IN'),
        r.work_mode,
        inDate.toLocaleString('en-IN'),
        outDate ? outDate.toLocaleString('en-IN') : 'Active Shift',
        `${hours}${r.total_minutes !== null ? ' hrs' : ''}`,
        r.punch_in_city || '-',
        r.punch_in_place_type || '-',
        `${inLat.toFixed(6)}, ${inLng.toFixed(6)}`,
        r.punch_in_address || '-',
        `https://www.google.com/maps?q=${inLat.toFixed(6)},${inLng.toFixed(6)}`,
        r.punch_out_city || '-',
        r.punch_out_place_type || '-',
        outLat !== null && outLng !== null ? `${outLat.toFixed(6)}, ${outLng.toFixed(6)}` : '-',
        r.punch_out_address || '-',
        outLat !== null && outLng !== null
          ? `https://www.google.com/maps?q=${outLat.toFixed(6)},${outLng.toFixed(6)}`
          : '-',
        r.punch_in_simulated || r.punch_out_simulated ? 'Demo GPS Mode' : 'Verified GPS',
      ]);
    }

    for (const lv of leaveRows) {
      const email = String(lv.employee_email).toLowerCase();
      emailsWithRecords.add(email);
      const emp = empMap.get(email);
      rows.push([
        'Leave / Absence',
        emp?.employee_id || '-',
        emp?.full_name || lv.employee_email,
        lv.employee_email,
        emp?.mobile_number || '-',
        emp?.department || '-',
        emp?.role || '-',
        `${lv.start_date} to ${lv.end_date}`,
        lv.leave_type,
        '-',
        '-',
        `${lv.days_count} day(s)`,
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        '-',
        lv.reason,
      ]);
    }

    for (const emp of employeesRows) {
      const email = String(emp.email).toLowerCase();
      if (!emailsWithRecords.has(email)) {
        rows.push([
          'Registered Profile',
          emp.employee_id,
          emp.full_name,
          emp.email,
          emp.mobile_number || '-',
          emp.department,
          emp.role,
          new Date(emp.created_at).toLocaleDateString('en-IN'),
          '-',
          '-',
          '-',
          '0 hrs',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          '-',
          'No punch or leave records yet',
        ]);
      }
    }

    const csv = '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
    const dateStamp = new Date().toISOString().slice(0, 10);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vantrex-attendance-report-${dateStamp}.csv"`
    );
    return res.status(200).send(csv);
  } catch (error) {
    console.error('CSV Export API error:', error);
    return res.status(500).json({ error: 'Failed to generate CSV report.' });
  }
}
