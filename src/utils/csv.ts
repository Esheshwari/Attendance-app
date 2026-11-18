import type { TeamOverviewData } from '../types';
import { buildGoogleMapsUrl } from './gps';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportAttendanceCsv(data: TeamOverviewData): void {
  const empMap = new Map(data.employees.map((e) => [e.email.toLowerCase(), e]));

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

  for (const log of data.attendance) {
    const emp = empMap.get(log.employeeEmail.toLowerCase());
    const inDate = new Date(log.punchInAt);
    const outDate = log.punchOutAt ? new Date(log.punchOutAt) : null;
    const hours =
      log.totalMinutes !== null ? (log.totalMinutes / 60).toFixed(2) : 'In Progress';

    rows.push([
      'Attendance',
      emp?.employeeId || '-',
      emp?.fullName || log.employeeEmail,
      log.employeeEmail,
      emp?.mobileNumber || '-',
      emp?.department || '-',
      emp?.role || '-',
      inDate.toLocaleDateString('en-IN'),
      log.workMode,
      inDate.toLocaleString('en-IN'),
      outDate ? outDate.toLocaleString('en-IN') : 'Active Shift',
      `${hours}${log.totalMinutes !== null ? ' hrs' : ''}`,
      log.punchInLocation.city || '-',
      log.punchInLocation.placeCategory || '-',
      `${log.punchInLocation.lat.toFixed(6)}, ${log.punchInLocation.lng.toFixed(6)}`,
      log.punchInLocation.address,
      buildGoogleMapsUrl(log.punchInLocation.lat, log.punchInLocation.lng),
      log.punchOutLocation?.city || '-',
      log.punchOutLocation?.placeCategory || '-',
      log.punchOutLocation
        ? `${log.punchOutLocation.lat.toFixed(6)}, ${log.punchOutLocation.lng.toFixed(6)}`
        : '-',
      log.punchOutLocation?.address || '-',
      log.punchOutLocation
        ? buildGoogleMapsUrl(log.punchOutLocation.lat, log.punchOutLocation.lng)
        : '-',
      log.punchInLocation.simulated || log.punchOutLocation?.simulated ? 'Demo GPS Mode' : 'Verified GPS',
    ]);
  }

  for (const lv of data.leaves) {
    const emp = empMap.get(lv.employeeEmail.toLowerCase());
    rows.push([
      'Leave / Absence',
      emp?.employeeId || '-',
      emp?.fullName || lv.employeeEmail,
      lv.employeeEmail,
      emp?.mobileNumber || '-',
      emp?.department || '-',
      emp?.role || '-',
      `${lv.startDate} to ${lv.endDate}`,
      lv.leaveType,
      '-',
      '-',
      `${lv.daysCount} day(s)`,
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

  const csvContent = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `vantrex-attendance-report-${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
