import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import type { TeamOverviewData } from '../types';
import { buildGoogleMapsUrl } from './gps';
import { getApiBaseUrl, isNeonBackendAvailable } from './storage';

function escapeCsvCell(value: unknown): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export interface CsvExportResult {
  ok: boolean;
  fileName: string;
  rowCount: number;
  csvContent: string;
  message: string;
  serverDownloadUrl?: string;
}

export function buildAttendanceCsv(data: TeamOverviewData): {
  csvContent: string;
  rowCount: number;
  fileName: string;
} {
  const empMap = new Map(data.employees.map((e) => [e.email.toLowerCase(), e]));
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

  for (const log of data.attendance) {
    const email = log.employeeEmail.toLowerCase();
    emailsWithRecords.add(email);
    const emp = empMap.get(email);
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
      log.punchInLocation.simulated || log.punchOutLocation?.simulated
        ? 'Demo GPS Mode'
        : 'Verified GPS',
    ]);
  }

  for (const lv of data.leaves) {
    const email = lv.employeeEmail.toLowerCase();
    emailsWithRecords.add(email);
    const emp = empMap.get(email);
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

  for (const emp of data.employees) {
    const email = emp.email.toLowerCase();
    if (!emailsWithRecords.has(email)) {
      rows.push([
        'Registered Profile',
        emp.employeeId,
        emp.fullName,
        emp.email,
        emp.mobileNumber || '-',
        emp.department,
        emp.role,
        new Date(emp.createdAt).toLocaleDateString('en-IN'),
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

  const csvContent =
    '\uFEFF' + rows.map((row) => row.map(escapeCsvCell).join(',')).join('\r\n');
  const dateStamp = new Date().toISOString().slice(0, 10);
  const fileName = `vantrex-attendance-report-${dateStamp}.csv`;

  return {
    csvContent,
    rowCount: rows.length - 1,
    fileName,
  };
}

export async function exportAttendanceCsv(data: TeamOverviewData): Promise<CsvExportResult> {
  const { csvContent, rowCount, fileName } = buildAttendanceCsv(data);
  const neonAvailable = await isNeonBackendAvailable();
  const serverDownloadUrl = neonAvailable
    ? `${getApiBaseUrl()}/api/export`
    : undefined;

  if (Capacitor.isNativePlatform()) {
    try {
      const writeRes = await Filesystem.writeFile({
        path: fileName,
        data: csvContent,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: 'Vantrex Attendance Report',
        text: `Vantrex Chemicals Attendance Report (${rowCount} records)`,
        files: [writeRes.uri],
        dialogTitle: 'Save or Share Attendance CSV',
      });

      return {
        ok: true,
        fileName,
        rowCount,
        csvContent,
        serverDownloadUrl,
        message: `Prepared ${fileName} (${rowCount} rows) for saving or sharing.`,
      };
    } catch (err: any) {
      const msg = String(err?.message || '').toLowerCase();
      if (msg.includes('cancel')) {
        return {
          ok: true,
          fileName,
          rowCount,
          csvContent,
          serverDownloadUrl,
          message: `CSV ready (${rowCount} rows). Re-tap Export to share or copy CSV below.`,
        };
      }
      // Fallback: write directly to Documents directory if Share sheet failed
      try {
        await Filesystem.writeFile({
          path: fileName,
          data: csvContent,
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        return {
          ok: true,
          fileName,
          rowCount,
          csvContent,
          serverDownloadUrl,
          message: `Saved ${fileName} (${rowCount} rows) to Documents folder.`,
        };
      } catch {
        return {
          ok: false,
          fileName,
          rowCount,
          csvContent,
          serverDownloadUrl,
          message:
            err?.message || 'Unable to save file on device. Use Copy CSV below.',
        };
      }
    }
  }

  // Web / Desktop / Mobile Browser download
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.setTimeout(() => URL.revokeObjectURL(url), 10000);

    return {
      ok: true,
      fileName,
      rowCount,
      csvContent,
      serverDownloadUrl,
      message: `Downloaded ${fileName} (${rowCount} rows).`,
    };
  } catch (err: any) {
    return {
      ok: false,
      fileName,
      rowCount,
      csvContent,
      serverDownloadUrl,
      message:
        err?.message || 'Browser blocked direct download. Use Copy CSV or Direct Link below.',
    };
  }
}
