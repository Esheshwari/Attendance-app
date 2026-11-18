import React, { useMemo, useState } from 'react';
import { Calendar, Clock, ExternalLink, Map, Search } from 'lucide-react';
import type { AttendanceLog, LeaveRequest } from '../types';
import { buildGoogleMapsUrl } from '../utils/gps';
import { renderPlaceIcon } from './DashboardTab';
import { LocationMapModal } from './LocationMapModal';

interface LogsTabProps {
  attendance: AttendanceLog[];
  leaves: LeaveRequest[];
}

type LogFilter = 'all' | 'attendance' | 'leaves';

function formatHours(minutes: number | null): string {
  if (minutes === null) return 'In Progress';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${String(mins).padStart(2, '0')}m`;
}

export function LogsTab({ attendance, leaves }: LogsTabProps) {
  const [filter, setFilter] = useState<LogFilter>('all');
  const [query, setQuery] = useState('');
  const [tracedLog, setTracedLog] = useState<AttendanceLog | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredAttendance = useMemo(() => {
    if (filter === 'leaves') return [];
    if (!normalizedQuery) return attendance;
    return attendance.filter((log) => {
      const haystack = [
        log.workMode,
        log.punchInLocation.address,
        log.punchInLocation.city || '',
        log.punchInLocation.placeCategory || '',
        log.punchOutLocation?.address || '',
        log.punchOutLocation?.city || '',
        log.punchOutLocation?.placeCategory || '',
        new Date(log.punchInAt).toLocaleDateString(),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [attendance, filter, normalizedQuery]);

  const filteredLeaves = useMemo(() => {
    if (filter === 'attendance') return [];
    if (!normalizedQuery) return leaves;
    return leaves.filter((lv) => {
      const haystack = [lv.leaveType, lv.startDate, lv.endDate, lv.reason]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [leaves, filter, normalizedQuery]);

  const totalShown = filteredAttendance.length + filteredLeaves.length;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
          {(
            [
              { id: 'all', label: 'All Logs' },
              { id: 'attendance', label: 'Attendance' },
              { id: 'leaves', label: 'Leaves' },
            ] as { id: LogFilter; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[40px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-[#1e40af] shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by city, shop/home, address, or date..."
            className="w-full min-h-[42px] pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600"
          />
        </div>
      </div>

      {totalShown === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm">
          <Clock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-800">No Records Found</p>
          <p className="text-xs text-slate-500 mt-1">
            {attendance.length === 0 && leaves.length === 0
              ? 'Punch in from the Dashboard or apply a leave to create your first corporate log.'
              : 'Try clearing or adjusting your filter criteria.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAttendance.map((log) => {
            const inTime = new Date(log.punchInAt);
            const outTime = log.punchOutAt ? new Date(log.punchOutAt) : null;

            return (
              <article
                key={log.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {inTime.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      <span>{log.workMode}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span className="font-mono-tabular">
                        {inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' → '}
                        {outTime
                          ? outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Active'}
                      </span>
                    </p>
                  </div>

                  <span className="text-xs font-bold font-mono-tabular text-[#1e40af] shrink-0">
                    {formatHours(log.totalMinutes)}
                  </span>
                </div>

                <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="mt-0.5">
                        {renderPlaceIcon(log.punchInLocation.placeCategory)}
                      </div>
                      <div className="min-w-0">
                        {(log.punchInLocation.placeCategory || log.punchInLocation.city) && (
                          <p className="text-[11px] font-bold text-[#1e40af]">
                            {[log.punchInLocation.placeCategory, log.punchInLocation.city]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        <p className="text-xs font-medium text-slate-800 leading-snug">
                          In: {log.punchInLocation.address}
                        </p>
                        <p className="text-[11px] font-mono-tabular text-slate-400">
                          {log.punchInLocation.lat.toFixed(5)}, {log.punchInLocation.lng.toFixed(5)}
                          {log.punchInLocation.accuracy !== null &&
                            ` · ±${log.punchInLocation.accuracy}m`}
                          {log.punchInLocation.simulated ? ' · Demo' : ''}
                        </p>
                      </div>
                    </div>
                    <a
                      href={buildGoogleMapsUrl(
                        log.punchInLocation.lat,
                        log.punchInLocation.lng
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-[#1e40af] hover:underline flex items-center gap-1 shrink-0 py-1"
                    >
                      <span>Google Maps</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {log.punchOutLocation && (
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="mt-0.5">
                          {renderPlaceIcon(log.punchOutLocation.placeCategory)}
                        </div>
                        <div className="min-w-0">
                          {(log.punchOutLocation.placeCategory || log.punchOutLocation.city) && (
                            <p className="text-[11px] font-bold text-slate-700">
                              {[log.punchOutLocation.placeCategory, log.punchOutLocation.city]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          )}
                          <p className="text-xs font-medium text-slate-700 leading-snug">
                            Out: {log.punchOutLocation.address}
                          </p>
                          <p className="text-[11px] font-mono-tabular text-slate-400">
                            {log.punchOutLocation.lat.toFixed(5)},{' '}
                            {log.punchOutLocation.lng.toFixed(5)}
                            {log.punchOutLocation.accuracy !== null &&
                              ` · ±${log.punchOutLocation.accuracy}m`}
                            {log.punchOutLocation.simulated ? ' · Demo' : ''}
                          </p>
                        </div>
                      </div>
                      <a
                        href={buildGoogleMapsUrl(
                          log.punchOutLocation.lat,
                          log.punchOutLocation.lng
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-[#1e40af] hover:underline flex items-center gap-1 shrink-0 py-1"
                      >
                        <span>Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setTracedLog(log)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-200 text-xs font-semibold text-slate-800 hover:text-[#1e40af] flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Map className="w-3.5 h-3.5" />
                    <span>
                      {log.punchOutLocation
                        ? 'Trace Punch-In & Punch-Out on Map'
                        : 'Trace Exact Location on Map'}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}

          {filteredLeaves.map((lv) => (
            <article
              key={lv.id}
              className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#1e40af] shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">{lv.leaveType}</h4>
                    <p className="text-xs font-mono-tabular text-slate-500">
                      {lv.startDate}
                      {lv.endDate !== lv.startDate ? ` → ${lv.endDate}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-800 tabular-nums shrink-0">
                  {lv.daysCount} {lv.daysCount === 1 ? 'Day' : 'Days'}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pt-1 border-t border-slate-100">
                {lv.reason}
              </p>
            </article>
          ))}
        </div>
      )}

      <LocationMapModal
        isOpen={Boolean(tracedLog)}
        title="Shift Location Trace"
        entryLocation={tracedLog?.punchInLocation || null}
        exitLocation={tracedLog?.punchOutLocation || null}
        onClose={() => setTracedLog(null)}
      />
    </div>
  );
}
