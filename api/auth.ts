import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  applyCors,
  ensureSchema,
  getSql,
  isOfficialVantrexEmail,
  isValidMobileNumber,
} from './_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const sql = getSql();
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const action = body.action as 'login' | 'register';
    const rawEmail = String(body.email || '').trim().toLowerCase();

    if (!isOfficialVantrexEmail(rawEmail)) {
      return res.status(403).json({
        error: 'Access Restricted: Only official @vantrexchemicals.com email addresses are permitted.',
      });
    }

    if (action === 'login') {
      const rows = await sql`
        SELECT id, email, full_name, employee_id, mobile_number, department, role, created_at
        FROM employees
        WHERE email = ${rawEmail}
        LIMIT 1
      `;
      if (rows.length === 0) {
        return res.status(404).json({ needsRegistration: true });
      }
      const r = rows[0];
      return res.status(200).json({
        employee: {
          id: r.id,
          email: r.email,
          fullName: r.full_name,
          employeeId: r.employee_id,
          mobileNumber: r.mobile_number || '',
          department: r.department,
          role: r.role,
          createdAt: r.created_at,
        },
      });
    }

    if (action === 'register') {
      const fullName = String(body.fullName || '').trim();
      const employeeId = String(body.employeeId || '').trim().toUpperCase();
      const mobileNumber = String(body.mobileNumber || '').trim();
      const department = String(body.department || '').trim();
      const role = body.role === 'Manager / Admin' ? 'Manager / Admin' : 'Employee';

      if (!fullName || !employeeId || !department || !mobileNumber) {
        return res.status(400).json({
          error: 'Full Name, Employee ID, Mobile Number, and Department are required.',
        });
      }

      if (!isValidMobileNumber(mobileNumber)) {
        return res.status(400).json({
          error: 'Please enter a valid 10 to 15 digit mobile number.',
        });
      }

      const id = body.id ? String(body.id) : `emp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const rows = await sql`
        INSERT INTO employees (id, email, full_name, employee_id, mobile_number, department, role)
        VALUES (${id}, ${rawEmail}, ${fullName}, ${employeeId}, ${mobileNumber}, ${department}, ${role})
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          employee_id = EXCLUDED.employee_id,
          mobile_number = EXCLUDED.mobile_number,
          department = EXCLUDED.department,
          role = EXCLUDED.role
        RETURNING id, email, full_name, employee_id, mobile_number, department, role, created_at
      `;

      const r = rows[0];
      return res.status(200).json({
        employee: {
          id: r.id,
          email: r.email,
          fullName: r.full_name,
          employeeId: r.employee_id,
          mobileNumber: r.mobile_number || '',
          department: r.department,
          role: r.role,
          createdAt: r.created_at,
        },
      });
    }

    return res.status(400).json({ error: 'Invalid action.' });
  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Authentication service failed.' });
  }
}
