import { neon } from '@neondatabase/serverless';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let schemaInitialized = false;

export function applyCors(req: VercelRequest, res: VercelResponse): boolean {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not configured.');
  }
  return neon(url);
}

export async function ensureSchema() {
  if (schemaInitialized) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      mobile_number TEXT NOT NULL DEFAULT '',
      department TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Employee', 'Manager / Admin')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    ALTER TABLE employees
    ADD COLUMN IF NOT EXISTS mobile_number TEXT NOT NULL DEFAULT ''
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS attendance_logs (
      id TEXT PRIMARY KEY,
      employee_email TEXT NOT NULL REFERENCES employees(email) ON DELETE CASCADE,
      work_mode TEXT NOT NULL CHECK (work_mode IN ('On-Site / Plant', 'Client Visit / Field', 'Remote')),
      punch_in_at TIMESTAMPTZ NOT NULL,
      punch_in_lat DOUBLE PRECISION NOT NULL,
      punch_in_lng DOUBLE PRECISION NOT NULL,
      punch_in_accuracy DOUBLE PRECISION,
      punch_in_address TEXT NOT NULL,
      punch_in_city TEXT NOT NULL DEFAULT '',
      punch_in_place_type TEXT NOT NULL DEFAULT '',
      punch_in_place_name TEXT NOT NULL DEFAULT '',
      punch_in_simulated BOOLEAN NOT NULL DEFAULT FALSE,
      punch_out_at TIMESTAMPTZ,
      punch_out_lat DOUBLE PRECISION,
      punch_out_lng DOUBLE PRECISION,
      punch_out_accuracy DOUBLE PRECISION,
      punch_out_address TEXT,
      punch_out_city TEXT,
      punch_out_place_type TEXT,
      punch_out_place_name TEXT,
      punch_out_simulated BOOLEAN DEFAULT FALSE,
      total_minutes INTEGER
    )
  `;

  await sql`
    ALTER TABLE attendance_logs
    ADD COLUMN IF NOT EXISTS punch_in_city TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS punch_in_place_type TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS punch_in_place_name TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS punch_out_city TEXT,
    ADD COLUMN IF NOT EXISTS punch_out_place_type TEXT,
    ADD COLUMN IF NOT EXISTS punch_out_place_name TEXT
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_attendance_email_time
      ON attendance_logs (employee_email, punch_in_at DESC)
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id TEXT PRIMARY KEY,
      employee_email TEXT NOT NULL REFERENCES employees(email) ON DELETE CASCADE,
      leave_type TEXT NOT NULL CHECK (leave_type IN ('Sick Leave', 'Casual Leave', 'Official Duty')),
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL CHECK (days_count >= 1),
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_leaves_email_date
      ON leave_requests (employee_email, start_date DESC)
  `;

  schemaInitialized = true;
}

export function isOfficialVantrexEmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@vantrexchemicals\.com$/i.test(email.trim());
}

export function isValidMobileNumber(phone: string): boolean {
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 10 && digits.length <= 15;
}
