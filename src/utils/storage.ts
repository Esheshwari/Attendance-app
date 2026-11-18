import type {
  AttendanceLog,
  Employee,
  EmployeeRole,
  GpsLocation,
  LeaveRequest,
  LeaveType,
  TeamOverviewData,
  WorkMode,
} from '../types';

const KEYS = {
  employees: 'vantrex_employees_v1',
  attendance: 'vantrex_attendance_v1',
  leaves: 'vantrex_leaves_v1',
  sessionEmail: 'vantrex_session_email_v1',
} as const;

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

let backendProbePromise: Promise<boolean> | null = null;

export function getDomainError(email: string): string | null {
  const trimmed = email.trim();
  if (!trimmed) {
    return 'Please enter your official @vantrexchemicals.com email address.';
  }
  const valid = /^[a-zA-Z0-9._%+-]+@vantrexchemicals\.com$/i.test(trimmed);
  if (!valid) {
    return 'Access Restricted: Only official @vantrexchemicals.com email addresses are permitted.';
  }
  return null;
}

export function getMobileNumberError(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) {
    return 'Please enter your mobile number.';
  }
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return 'Please enter a valid 10 to 15 digit mobile number (e.g. +91 98765 43210).';
  }
  return null;
}

export async function isNeonBackendAvailable(): Promise<boolean> {
  if (backendProbePromise) return backendProbePromise;

  backendProbePromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 3500);
      const res = await fetch(`${API_BASE}/api/health`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      window.clearTimeout(timer);

      if (!res.ok) return false;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) return false;
      const data = await res.json();
      return Boolean(data?.ok && data?.database === 'neon');
    } catch {
      return false;
    }
  })();

  return backendProbePromise;
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function getSavedSessionEmail(): string | null {
  try {
    return localStorage.getItem(KEYS.sessionEmail);
  } catch {
    return null;
  }
}

export function setSavedSessionEmail(email: string | null): void {
  if (!email) {
    localStorage.removeItem(KEYS.sessionEmail);
  } else {
    localStorage.setItem(KEYS.sessionEmail, email.trim().toLowerCase());
  }
}

export async function loginWithEmail(
  rawEmail: string
): Promise<{ status: 'found'; employee: Employee } | { status: 'needs_registration' }> {
  const email = rawEmail.trim().toLowerCase();
  const domainErr = getDomainError(email);
  if (domainErr) {
    throw new Error(domainErr);
  }

  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'login', email }),
    });

    if (res.status === 404) {
      return { status: 'needs_registration' };
    }
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to sign in.');
    }
    setSavedSessionEmail(data.employee.email);
    return { status: 'found', employee: data.employee };
  }

  const employees = readLocal<Employee[]>(KEYS.employees, []);
  const existing = employees.find((e) => e.email.toLowerCase() === email);
  if (!existing) {
    return { status: 'needs_registration' };
  }
  setSavedSessionEmail(existing.email);
  return { status: 'found', employee: existing };
}

export async function registerEmployee(input: {
  email: string;
  fullName: string;
  employeeId: string;
  mobileNumber: string;
  department: string;
  role: EmployeeRole;
}): Promise<Employee> {
  const email = input.email.trim().toLowerCase();
  const domainErr = getDomainError(email);
  if (domainErr) {
    throw new Error(domainErr);
  }

  const phoneErr = getMobileNumberError(input.mobileNumber);
  if (phoneErr) {
    throw new Error(phoneErr);
  }

  const newEmp: Employee = {
    id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email,
    fullName: input.fullName.trim(),
    employeeId: input.employeeId.trim().toUpperCase(),
    mobileNumber: input.mobileNumber.trim(),
    department: input.department.trim(),
    role: input.role,
    createdAt: new Date().toISOString(),
  };

  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'register', ...newEmp }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Registration failed.');
    }
    setSavedSessionEmail(data.employee.email);
    return data.employee;
  }

  const employees = readLocal<Employee[]>(KEYS.employees, []);
  const idx = employees.findIndex((e) => e.email.toLowerCase() === email);
  if (idx >= 0) {
    employees[idx] = { ...employees[idx], ...newEmp, id: employees[idx].id };
    writeLocal(KEYS.employees, employees);
    setSavedSessionEmail(email);
    return employees[idx];
  }

  employees.unshift(newEmp);
  writeLocal(KEYS.employees, employees);
  setSavedSessionEmail(email);
  return newEmp;
}

export async function fetchEmployeeData(email: string): Promise<{
  attendance: AttendanceLog[];
  leaves: LeaveRequest[];
}> {
  const normalized = email.trim().toLowerCase();
  const useNeon = await isNeonBackendAvailable();

  if (useNeon) {
    const [attRes, lvRes] = await Promise.all([
      fetch(`${API_BASE}/api/attendance?email=${encodeURIComponent(normalized)}`),
      fetch(`${API_BASE}/api/leaves?email=${encodeURIComponent(normalized)}`),
    ]);
    const attData = await attRes.json();
    const lvData = await lvRes.json();
    if (!attRes.ok || !lvRes.ok) {
      throw new Error('Failed to load employee records.');
    }
    return {
      attendance: attData.logs || [],
      leaves: lvData.leaves || [],
    };
  }

  const allAttendance = readLocal<AttendanceLog[]>(KEYS.attendance, []);
  const allLeaves = readLocal<LeaveRequest[]>(KEYS.leaves, []);

  return {
    attendance: allAttendance
      .filter((a) => a.employeeEmail.toLowerCase() === normalized)
      .sort((a, b) => new Date(b.punchInAt).getTime() - new Date(a.punchInAt).getTime()),
    leaves: allLeaves
      .filter((l) => l.employeeEmail.toLowerCase() === normalized)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
  };
}

export async function punchInEmployee(input: {
  employeeEmail: string;
  workMode: WorkMode;
  location: GpsLocation;
}): Promise<AttendanceLog> {
  const normalized = input.employeeEmail.trim().toLowerCase();
  const newLog: AttendanceLog = {
    id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    employeeEmail: normalized,
    workMode: input.workMode,
    punchInAt: new Date().toISOString(),
    punchInLocation: input.location,
    punchOutAt: null,
    punchOutLocation: null,
    totalMinutes: null,
  };

  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: newLog.id,
        employeeEmail: normalized,
        workMode: input.workMode,
        punchInAt: newLog.punchInAt,
        punchInLocation: input.location,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Punch In failed.');
    }
    return data.log;
  }

  const all = readLocal<AttendanceLog[]>(KEYS.attendance, []);
  const active = all.find((a) => a.employeeEmail.toLowerCase() === normalized && !a.punchOutAt);
  if (active) {
    throw new Error('An active shift is already in progress.');
  }
  all.unshift(newLog);
  writeLocal(KEYS.attendance, all);
  return newLog;
}

export async function punchOutEmployee(input: {
  logId: string;
  punchInAt: string;
  location: GpsLocation;
}): Promise<AttendanceLog> {
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - new Date(input.punchInAt).getTime());
  const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
  const punchOutAt = now.toISOString();

  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/attendance`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: input.logId,
        punchOutAt,
        punchOutLocation: input.location,
        totalMinutes,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Punch Out failed.');
    }
    return data.log;
  }

  const all = readLocal<AttendanceLog[]>(KEYS.attendance, []);
  const idx = all.findIndex((a) => a.id === input.logId);
  if (idx < 0) {
    throw new Error('Active attendance record not found.');
  }
  const updated: AttendanceLog = {
    ...all[idx],
    punchOutAt,
    punchOutLocation: input.location,
    totalMinutes,
  };
  all[idx] = updated;
  writeLocal(KEYS.attendance, all);
  return updated;
}

export async function submitLeaveRequest(input: {
  employeeEmail: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
}): Promise<LeaveRequest> {
  const normalized = input.employeeEmail.trim().toLowerCase();
  const newLeave: LeaveRequest = {
    id: `lv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    employeeEmail: normalized,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    daysCount: Math.max(1, input.daysCount),
    reason: input.reason.trim(),
    createdAt: new Date().toISOString(),
  };

  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/leaves`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLeave),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save leave request.');
    }
    return data.leave;
  }

  const all = readLocal<LeaveRequest[]>(KEYS.leaves, []);
  all.unshift(newLeave);
  writeLocal(KEYS.leaves, all);
  return newLeave;
}

export async function fetchTeamOverview(): Promise<TeamOverviewData> {
  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/team`);
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to load team overview.');
    }
    return {
      employees: data.employees || [],
      attendance: data.attendance || [],
      leaves: data.leaves || [],
    };
  }

  return {
    employees: readLocal<Employee[]>(KEYS.employees, []),
    attendance: readLocal<AttendanceLog[]>(KEYS.attendance, []),
    leaves: readLocal<LeaveRequest[]>(KEYS.leaves, []),
  };
}

export async function resetAllSystemData(): Promise<void> {
  const useNeon = await isNeonBackendAvailable();
  if (useNeon) {
    const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
    if (!res.ok) {
      throw new Error('Failed to reset remote database.');
    }
  }
  localStorage.removeItem(KEYS.employees);
  localStorage.removeItem(KEYS.attendance);
  localStorage.removeItem(KEYS.leaves);
  localStorage.removeItem(KEYS.sessionEmail);
}
