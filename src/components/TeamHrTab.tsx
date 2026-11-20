import React, { useMemo, useState } from 'react';
import {
  CalendarOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Mail,
  Map as MapIcon,
  Phone,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import type { AttendanceLog, LiveEmployeeStatus, TeamOverviewData } from '../types';
import { exportAttendanceCsv, type CsvExportResult } from '../utils/csv';
import { buildGoogleMapsUrl } from '../utils/gps';
import { renderPlaceIcon } from './DashboardTab';
import { LocationMapModal } from './LocationMapModal';
import { LocationTraceMap, type MapMarkerPoint } from './LocationTraceMap';

interface TeamHrTabProps {
  data: TeamOverviewData;
  onRefresh: () => Promise<void>;
}

type StatusFilter = 'all' | LiveEmployeeStatus;
type HrViewMode = 'roster' | 'punches';

function formatHours(minutes: number | null): string {
  if (minutes === null) return 'In Progress';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export function TeamHrTab({ data, onRefresh }: TeamHrTabProps) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [viewMode, setViewMode] = useState<HrViewMode>('roster');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [geoQuery, setGeoQuery] = useState('');
  const [expandedEmpId, setExpandedEmpId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<CsvExportResult | null>(null);
  const [copiedCsv, setCopiedCsv] = useState(false);
  const [tracedShift, setTracedShift] = useState<{
    name: string;
    log: AttendanceLog;
  } | null>(null);

  const empByEmail = useMemo(() => {
    return new Map(data.employees.map((e) => [e.email.toLowerCase(), e]));
  }, [data.employees]);

  const roster = useMemo(() => {
    return data.employees.map((emp) => {
      const email = emp.email.toLowerCase();
      const empLogs = data.attendance
        .filter((a) => a.employeeEmail.toLowerCase() === email)
        .sort((a, b) => new Date(b.punchInAt).getTime() - new Date(a.punchInAt).getTime());
      const empLeaves = data.leaves.filter((l) => l.employeeEmail.toLowerCase() === email);

      const activeShift = empLogs.find((a) => !a.punchOutAt) || null;
      const latestShift = empLogs[0] || null;

      const isOnLeaveToday = empLeaves.some(
        (lv) => lv.startDate <= todayIso && lv.endDate >= todayIso
      );

      let status: LiveEmployeeStatus = 'Checked Out';
      if (activeShift) {
        status = 'On Duty';
      } else if (isOnLeaveToday) {
        status = 'On Leave';
      }

      const uniqueDaysWorked = new Set(
        empLogs.map((log) => new Date(log.punchInAt).toISOString().slice(0, 10))
      ).size;

      const leavesTaken = empLeaves.reduce((sum, lv) => sum + lv.daysCount, 0);

      const latestLocation =
        activeShift?.punchInLocation ||
        latestShift?.punchOutLocation ||
        latestShift?.punchInLocation ||
        null;

      const latestLocationLabel = activeShift
        ? 'Active Check-In'
        : latestShift?.punchOutLocation
        ? 'Last Check-Out'
        : 'Last Check-In';

      const latestTimestamp = activeShift
        ? activeShift.punchInAt
        : latestShift?.punchOutAt || latestShift?.punchInAt || null;

      return {
        emp,
        empLogs,
        status,
        workMode: activeShift?.workMode || latestShift?.workMode || null,
        uniqueDaysWorked,
        leavesTaken,
        latestShift: activeShift || latestShift,
        latestLocation,
        latestLocationLabel,
        latestTimestamp,
      };
    });
  }, [data, todayIso]);

  const activeCities = useMemo(() => {
    const cityCounts = new Map<string, number>();
    for (const item of roster) {
      const city =
        item.latestLocation?.city ||
        item.latestLocation?.address.split(',').slice(-2, -1)[0]?.trim();
      if (city) {
        cityCounts.set(city, (cityCounts.get(city) || 0) + 1);
      }
    }
    return Array.from(cityCounts.entries()).sort((a, b) => b[1] - a[1]);
  }, [roster]);

  const filteredRoster = useMemo(() => {
    const q = geoQuery.trim().toLowerCase();
    return roster.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        item.emp.fullName,
        item.emp.employeeId,
        item.emp.email,
        item.emp.mobileNumber,
        item.emp.department,
        item.latestLocation?.city || '',
        item.latestLocation?.placeCategory || '',
        item.latestLocation?.address || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [roster, statusFilter, geoQuery]);

  const filteredAllPunches = useMemo(() => {
    const q = geoQuery.trim().toLowerCase();
    return data.attendance
      .slice()
      .sort((a, b) => new Date(b.punchInAt).getTime() - new Date(a.punchInAt).getTime())
      .filter((log) => {
        if (!q) return true;
        const emp = empByEmail.get(log.employeeEmail.toLowerCase());
        const haystack = [
          emp?.fullName || '',
          emp?.employeeId || '',
          log.employeeEmail,
          emp?.mobileNumber || '',
          emp?.department || '',
          log.workMode,
          log.punchInLocation.city || '',
          log.punchInLocation.placeCategory || '',
          log.punchInLocation.address,
          log.punchOutLocation?.city || '',
          log.punchOutLocation?.address || '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
  }, [data.attendance, empByEmail, geoQuery]);

  const mapMarkers: MapMarkerPoint[] = useMemo(() => {
    return filteredRoster
      .filter((item) => Boolean(item.latestLocation))
      .map((item) => {
        const loc = item.latestLocation!;
        return {
          id: item.emp.id,
          lat: loc.lat,
          lng: loc.lng,
          title: `${item.emp.fullName} (${item.emp.employeeId})`,
          city: loc.city,
          placeCategory: loc.placeCategory,
          subtitle: loc.address,
          color:
            item.status === 'On Duty'
              ? 'emerald'
              : item.status === 'On Leave'
              ? 'amber'
              : 'slate',
          mapsUrl: buildGoogleMapsUrl(loc.lat, loc.lng),
        };
      });
  }, [filteredRoster]);

  const onDutyCount = roster.filter((r) => r.status === 'On Duty').length;
  const onLeaveCount = roster.filter((r) => r.status === 'On Leave').length;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setCopiedCsv(false);
    try {
      const result = await exportAttendanceCsv(data);
      setExportResult(result);
    } finally {
      setExporting(false);
    }
  };

  const handleCopyCsv = async () => {
    if (!exportResult?.csvContent) return;
    try {
      await navigator.clipboard.writeText(exportResult.csvContent);
      setCopiedCsv(true);
      return;
    } catch {
      // Fallback for restricted WebViews/iframes
    }
    try {
      const textarea = document.createElement('textarea');
      textarea.value = exportResult.csvContent;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (copied) {
        setCopiedCsv(true);
      }
    } catch {
      // Clipboard unavailable
    }
  };

  return (
    <div className="space-y-4">
      {/* HR Summary & Export Action */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-900">Team & HR Geography Monitor</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live workforce status, punch logs, city & shop/home audit
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh team data"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#1e40af] hover:bg-blue-50 transition-colors shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <p className="text-[11px] text-slate-500">Registered</p>
            <p className="text-lg font-bold text-slate-900 tabular-nums mt-0.5">
              {roster.length}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <p className="text-[11px] text-slate-500">On Duty</p>
            <p className="text-lg font-bold text-emerald-700 tabular-nums mt-0.5">
              {onDutyCount}
            </p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5">
            <p className="text-[11px] text-slate-500">On Leave</p>
            <p className="text-lg font-bold text-amber-700 tabular-nums mt-0.5">
              {onLeaveCount}
            </p>
          </div>
        </div>

        {activeCities.length > 0 && (
          <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1e40af]">
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span>Exact Cities Tracked</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {activeCities.map(([city, count], idx) => (
                <React.Fragment key={city}>
                  {idx > 0 && <span className="mx-1.5 text-slate-400" aria-hidden="true">·</span>}
                  <span>
                    {city}{' '}
                    <strong className="font-semibold text-slate-900 tabular-nums">
                      ({count})
                    </strong>
                  </span>
                </React.Fragment>
              ))}
            </p>
          </div>
        )}

        {/* Live Interactive Workforce Map */}
        {mapMarkers.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">Live Traced Field Map</span>
              <span className="text-[11px] text-slate-500">Tap any pin for exact details</span>
            </div>
            <LocationTraceMap markers={mapMarkers} heightClass="h-56" />
          </div>
        )}

        <button
          type="button"
          disabled={(roster.length === 0 && data.attendance.length === 0) || exporting}
          onClick={handleExportCsv}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1e40af] hover:bg-[#2563eb] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          <span>{exporting ? 'Preparing CSV...' : 'Export Attendance Report (CSV)'}</span>
        </button>

        {exportResult && (
          <div
            className={`p-3 rounded-xl border text-xs space-y-2 ${
              exportResult.ok
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <p className="font-medium leading-snug">{exportResult.message}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopyCsv}
                className="inline-flex items-center gap-1.5 font-semibold text-slate-800 hover:text-[#1e40af] underline"
              >
                {copiedCsv ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCsv ? 'CSV Copied' : 'Copy CSV Text'}</span>
              </button>
              {exportResult.serverDownloadUrl && (
                <a
                  href={exportResult.serverDownloadUrl}
                  download={exportResult.fileName}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-[#1e40af] underline"
                >
                  <span>Direct Server Download</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Admin View Mode + Filter */}
      <section className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-2.5">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setViewMode('roster')}
            className={`min-h-[40px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              viewMode === 'roster'
                ? 'bg-white text-[#1e40af] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Employee Roster ({roster.length})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('punches')}
            className={`min-h-[40px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              viewMode === 'punches'
                ? 'bg-white text-[#1e40af] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Punch Logs ({data.attendance.length})
          </button>
        </div>

        {viewMode === 'roster' && roster.length > 0 && (
          <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'On Duty', label: 'On Duty' },
                { id: 'Checked Out', label: 'Out' },
                { id: 'On Leave', label: 'Leave' },
              ] as { id: StatusFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`min-h-[38px] px-1.5 py-1 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap ${
                  statusFilter === tab.id
                    ? 'bg-white text-[#1e40af] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={geoQuery}
            onChange={(e) => setGeoQuery(e.target.value)}
            placeholder="Search by employee, ID, city, shop/home, or address..."
            className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
          />
        </div>
      </section>

      {/* Roster vs All Punch Logs Content */}
      {viewMode === 'roster' ? (
        filteredRoster.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-800">
              {roster.length === 0 ? 'No Registered Employees' : 'No Matching Employees'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {roster.length === 0
                ? 'Employees who onboard with @vantrexchemicals.com emails appear here automatically.'
                : 'Adjust your status tab or geographic search filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRoster.map(
              ({
                emp,
                empLogs,
                status,
                workMode,
                uniqueDaysWorked,
                leavesTaken,
                latestShift,
                latestLocation,
                latestLocationLabel,
                latestTimestamp,
              }) => {
                const isExpanded = expandedEmpId === emp.id;

                return (
                  <article
                    key={emp.id}
                    className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {emp.fullName}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          <span className="font-mono-tabular font-medium text-slate-700">
                            {emp.employeeId}
                          </span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{emp.department}</span>
                          {workMode && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>{workMode}</span>
                            </>
                          )}
                        </p>
                      </div>

                      <div
                        className={`flex items-center gap-1 text-xs font-semibold shrink-0 ${
                          status === 'On Duty'
                            ? 'text-emerald-700'
                            : status === 'On Leave'
                            ? 'text-amber-700'
                            : 'text-slate-600'
                        }`}
                      >
                        {status === 'On Duty' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : status === 'On Leave' ? (
                          <CalendarOff className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span>{status}</span>
                      </div>
                    </div>

                    {/* Contact Row: Corporate Email & Mobile Number */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-600">
                      <a
                        href={`mailto:${emp.email}`}
                        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-[#1e40af] truncate max-w-full"
                      >
                        <Mail className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{emp.email}</span>
                      </a>
                      {emp.mobileNumber && (
                        <a
                          href={`tel:${emp.mobileNumber.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1.5 font-mono-tabular text-slate-700 hover:text-[#1e40af]"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span>{emp.mobileNumber}</span>
                        </a>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
                      <span>
                        Days Worked:{' '}
                        <strong className="font-bold text-slate-900 tabular-nums">
                          {uniqueDaysWorked}
                        </strong>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        Leaves Taken:{' '}
                        <strong className="font-bold text-slate-900 tabular-nums">
                          {leavesTaken}
                        </strong>
                      </span>
                    </div>

                    {latestLocation ? (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">
                            {renderPlaceIcon(latestLocation.placeCategory)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-[#1e40af]">
                              {[
                                latestLocation.placeCategory || 'Field Location',
                                latestLocation.city,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                              {latestLocationLabel}
                              {latestTimestamp
                                ? ` · ${new Date(latestTimestamp).toLocaleString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`
                                : ''}
                            </p>
                            <p className="text-xs font-medium text-slate-800 leading-snug mt-0.5">
                              {latestLocation.address}
                            </p>
                            <p className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                              {latestLocation.lat.toFixed(5)}, {latestLocation.lng.toFixed(5)}
                              {latestLocation.accuracy !== null && ` · ±${latestLocation.accuracy}m`}
                              {latestLocation.simulated ? ' · Demo GPS' : ' · Verified GPS'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-slate-200/70">
                          {latestShift && (
                            <button
                              type="button"
                              onClick={() =>
                                setTracedShift({ name: emp.fullName, log: latestShift })
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-[#1e40af] py-1"
                            >
                              <MapIcon className="w-3.5 h-3.5" />
                              <span>Trace on Map</span>
                            </button>
                          )}
                          <a
                            href={buildGoogleMapsUrl(latestLocation.lat, latestLocation.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e40af] hover:underline py-1"
                          >
                            <span>View on Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">
                        No GPS check-in recorded yet.
                      </p>
                    )}

                    {empLogs.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setExpandedEmpId(isExpanded ? null : emp.id)}
                          className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs font-semibold text-slate-700 hover:text-[#1e40af] flex items-center justify-between transition-colors"
                        >
                          <span>Punch History ({empLogs.length})</span>
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
                            {empLogs.map((log) => {
                              const inDt = new Date(log.punchInAt);
                              const outDt = log.punchOutAt ? new Date(log.punchOutAt) : null;
                              return (
                                <div
                                  key={log.id}
                                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1"
                                >
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-slate-900">
                                      {inDt.toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                      })}{' '}
                                      · {log.workMode}
                                    </span>
                                    <span className="font-mono-tabular font-bold text-[#1e40af]">
                                      {formatHours(log.totalMinutes)}
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-mono-tabular text-slate-600">
                                    In:{' '}
                                    {inDt.toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}{' '}
                                    → Out:{' '}
                                    {outDt
                                      ? outDt.toLocaleTimeString([], {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })
                                      : 'Active'}
                                  </p>
                                  <p className="text-[11px] text-slate-700">
                                    {[log.punchInLocation.placeCategory, log.punchInLocation.city]
                                      .filter(Boolean)
                                      .join(' · ')}{' '}
                                    — {log.punchInLocation.address}
                                  </p>
                                  <div className="flex items-center gap-3 pt-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setTracedShift({ name: emp.fullName, log })
                                      }
                                      className="text-[11px] font-semibold text-slate-800 hover:text-[#1e40af] inline-flex items-center gap-1"
                                    >
                                      <MapIcon className="w-3 h-3" />
                                      <span>Trace Map</span>
                                    </button>
                                    <a
                                      href={buildGoogleMapsUrl(
                                        log.punchInLocation.lat,
                                        log.punchInLocation.lng
                                      )}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[11px] font-semibold text-[#1e40af] hover:underline inline-flex items-center gap-1"
                                    >
                                      <span>Google Maps</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              }
            )}
          </div>
        )
      ) : filteredAllPunches.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No Punch Logs Found</p>
          <p className="text-xs text-slate-500 mt-1">
            Employee Punch In and Punch Out sessions will appear here in real time.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAllPunches.map((log) => {
            const emp = empByEmail.get(log.employeeEmail.toLowerCase());
            const inDt = new Date(log.punchInAt);
            const outDt = log.punchOutAt ? new Date(log.punchOutAt) : null;

            return (
              <article
                key={log.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-slate-900 truncate">
                      {emp?.fullName || log.employeeEmail}
                    </h4>
                    <p className="text-xs text-slate-500 truncate">
                      <span className="font-mono-tabular font-medium text-slate-700">
                        {emp?.employeeId || 'ID'}
                      </span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{log.workMode}</span>
                    </p>
                  </div>
                  <span className="text-xs font-bold font-mono-tabular text-[#1e40af] shrink-0">
                    {formatHours(log.totalMinutes)}
                  </span>
                </div>

                <div className="text-xs font-mono-tabular text-slate-600">
                  {inDt.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}{' '}
                  ·{' '}
                  {inDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {' → '}
                  {outDt
                    ? outDt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'Active'}
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {renderPlaceIcon(log.punchInLocation.placeCategory)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-[#1e40af]">
                        {[log.punchInLocation.placeCategory, log.punchInLocation.city]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      <p className="text-xs text-slate-800 leading-snug">
                        In: {log.punchInLocation.address}
                      </p>
                      {log.punchOutLocation && (
                        <p className="text-xs text-slate-600 leading-snug mt-0.5">
                          Out: {log.punchOutLocation.address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 pt-1 border-t border-slate-200/70">
                    <button
                      type="button"
                      onClick={() =>
                        setTracedShift({
                          name: emp?.fullName || log.employeeEmail,
                          log,
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 hover:text-[#1e40af] py-1"
                    >
                      <MapIcon className="w-3.5 h-3.5" />
                      <span>Trace on Map</span>
                    </button>
                    <a
                      href={buildGoogleMapsUrl(
                        log.punchInLocation.lat,
                        log.punchInLocation.lng
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1e40af] hover:underline py-1"
                    >
                      <span>View on Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <LocationMapModal
        isOpen={Boolean(tracedShift)}
        title={tracedShift ? `${tracedShift.name} — Location Trace` : 'Location Trace'}
        entryLocation={tracedShift?.log.punchInLocation || null}
        exitLocation={tracedShift?.log.punchOutLocation || null}
        onClose={() => setTracedShift(null)}
      />
    </div>
  );
}
