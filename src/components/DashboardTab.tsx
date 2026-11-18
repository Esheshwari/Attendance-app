import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarPlus,
  CheckCircle2,
  Clock,
  ExternalLink,
  Factory,
  Home,
  Loader2,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Navigation,
  Store,
} from 'lucide-react';
import type {
  AttendanceLog,
  Employee,
  GpsLocation,
  LeaveRequest,
  PlaceCategory,
  WorkMode,
} from '../types';
import { buildGoogleMapsUrl, captureLiveGps, captureSimulatedGps } from '../utils/gps';
import { LocationMapModal } from './LocationMapModal';

interface DashboardTabProps {
  employee: Employee;
  attendance: AttendanceLog[];
  leaves: LeaveRequest[];
  onPunchIn: (workMode: WorkMode, location: GpsLocation) => Promise<void>;
  onPunchOut: (logId: string, punchInAt: string, location: GpsLocation) => Promise<void>;
  onOpenLeaveModal: () => void;
}

const WORK_MODES: WorkMode[] = ['On-Site / Plant', 'Client Visit / Field', 'Remote'];

function formatDurationHms(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return [hrs, mins, secs].map((n) => String(n).padStart(2, '0')).join(':');
}

export function renderPlaceIcon(category?: PlaceCategory) {
  switch (category) {
    case 'Shop / Commercial':
      return <Store className="w-3.5 h-3.5 text-[#1e40af] shrink-0" />;
    case 'Home / Residential':
      return <Home className="w-3.5 h-3.5 text-[#1e40af] shrink-0" />;
    case 'Plant / Industrial':
      return <Factory className="w-3.5 h-3.5 text-[#1e40af] shrink-0" />;
    case 'Office / Corporate':
      return <Building2 className="w-3.5 h-3.5 text-[#1e40af] shrink-0" />;
    default:
      return <MapPin className="w-3.5 h-3.5 text-[#1e40af] shrink-0" />;
  }
}

export function DashboardTab({
  employee,
  attendance,
  leaves,
  onPunchIn,
  onPunchOut,
  onOpenLeaveModal,
}: DashboardTabProps) {
  const [now, setNow] = useState(() => new Date());
  const [workMode, setWorkMode] = useState<WorkMode>('On-Site / Plant');
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'acquiring' | 'error'>('idle');
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'in' | 'out' | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [showMapTrace, setShowMapTrace] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeShift = useMemo(
    () => attendance.find((log) => !log.punchOutAt) || null,
    [attendance]
  );

  const liveShiftSeconds = useMemo(() => {
    if (!activeShift) return 0;
    return Math.max(0, Math.floor((now.getTime() - new Date(activeShift.punchInAt).getTime()) / 1000));
  }, [activeShift, now]);

  const monthlyStats = useMemo(() => {
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const monthLogs = attendance.filter((log) => {
      const d = new Date(log.punchInAt);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const uniqueDays = new Set(
      monthLogs.map((log) => {
        const d = new Date(log.punchInAt);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
    );

    const completedMinutes = monthLogs.reduce((sum, log) => sum + (log.totalMinutes || 0), 0);
    const activeMinutes =
      activeShift &&
      new Date(activeShift.punchInAt).getMonth() === currentMonth &&
      new Date(activeShift.punchInAt).getFullYear() === currentYear
        ? Math.floor(liveShiftSeconds / 60)
        : 0;

    const totalHours = ((completedMinutes + activeMinutes) / 60).toFixed(1);
    const leaveDays = leaves.reduce((sum, lv) => sum + lv.daysCount, 0);

    return {
      daysPresent: uniqueDays.size,
      totalHours,
      leaveDays,
    };
  }, [attendance, leaves, now, activeShift, liveShiftSeconds]);

  const executeAttendanceAction = async (type: 'in' | 'out', simulated: boolean) => {
    setActionSuccess(null);
    setGpsError(null);
    setPendingAction(type);
    setGpsStatus('acquiring');

    try {
      const modeForSim = type === 'out' && activeShift ? activeShift.workMode : workMode;
      const location = simulated
        ? await captureSimulatedGps(modeForSim)
        : await captureLiveGps();

      if (type === 'in') {
        await onPunchIn(workMode, location);
        const contextLabel = [location.placeCategory, location.city].filter(Boolean).join(' · ');
        setActionSuccess(
          `Punched in${contextLabel ? ` (${contextLabel})` : ''} at ${location.address}`
        );
      } else if (activeShift) {
        await onPunchOut(activeShift.id, activeShift.punchInAt, location);
        setActionSuccess(`Shift completed & logged at ${location.address}`);
      }

      setGpsStatus('idle');
      setPendingAction(null);
    } catch (err: any) {
      setGpsStatus('error');
      setGpsError(
        err?.message ||
          'GPS permission denied or unavailable. Grant location access or use Demo Mode.'
      );
    }
  };

  const formattedClock = now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Employee Greeting & Live Corporate Clock */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">
              {employee.fullName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              <span className="font-mono-tabular font-medium text-slate-700">
                {employee.employeeId}
              </span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{employee.department}</span>
              <span className="mx-1.5" aria-hidden="true">·</span>
              <span>{employee.role}</span>
            </p>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl font-bold font-mono-tabular text-[#1e40af] leading-none">
              {formattedClock}
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-1">
              {formattedDate}
            </div>
          </div>
        </div>
      </section>

      {/* Summary Metrics Strip */}
      <section className="grid grid-cols-3 gap-2.5" aria-label="Monthly attendance summary">
        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 leading-tight">
            Days Present
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1.5">
            {monthlyStats.daysPresent}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">This month</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 leading-tight">
            Hours Worked
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1.5">
            {monthlyStats.totalHours}h
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">This month</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm">
          <p className="text-[11px] font-medium text-slate-500 leading-tight">
            Leaves Taken
          </p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1.5">
            {monthlyStats.leaveDays}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Total days</p>
        </div>
      </section>

      {/* Punch In / Punch Out Engine */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {activeShift ? 'Active Shift in Progress' : 'Attendance Check-In'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeShift
                ? `${activeShift.workMode} · Started ${new Date(
                    activeShift.punchInAt
                  ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Select work mode and verify live GPS location'}
            </p>
          </div>
          <Clock className="w-5 h-5 text-[#1e40af] shrink-0" />
        </div>

        {activeShift ? (
          <div className="space-y-3.5">
            <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-4 text-center">
              <p className="text-[11px] font-semibold text-blue-800">
                Current Shift Duration
              </p>
              <p className="text-3xl font-bold font-mono-tabular text-[#1e40af] tracking-tight mt-1">
                {formatDurationHms(liveShiftSeconds)}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2">
                <div className="mt-0.5">
                  {renderPlaceIcon(activeShift.punchInLocation.placeCategory)}
                </div>
                <div className="min-w-0 flex-1">
                  {(activeShift.punchInLocation.placeCategory || activeShift.punchInLocation.city) && (
                    <p className="text-[11px] font-bold text-[#1e40af]">
                      {[
                        activeShift.punchInLocation.placeCategory,
                        activeShift.punchInLocation.city,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                  <p className="text-xs font-semibold text-slate-800 leading-snug mt-0.5">
                    {activeShift.punchInLocation.address}
                  </p>
                  <p className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                    {activeShift.punchInLocation.lat.toFixed(5)},{' '}
                    {activeShift.punchInLocation.lng.toFixed(5)}
                    {activeShift.punchInLocation.accuracy !== null &&
                      ` · ±${activeShift.punchInLocation.accuracy}m`}
                    {activeShift.punchInLocation.simulated ? ' · Demo GPS' : ' · Verified GPS'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-1 border-t border-slate-200/70">
                <button
                  type="button"
                  onClick={() => setShowMapTrace(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-[#1e40af] py-1"
                >
                  <Map className="w-3.5 h-3.5" />
                  <span>Trace Exact Map</span>
                </button>
                <a
                  href={buildGoogleMapsUrl(
                    activeShift.punchInLocation.lat,
                    activeShift.punchInLocation.lng
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1e40af] hover:underline py-1"
                >
                  <span>View on Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-2">
              Work Mode
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {WORK_MODES.map((mode) => {
                const shortLabel =
                  mode === 'On-Site / Plant'
                    ? 'On-Site'
                    : mode === 'Client Visit / Field'
                    ? 'Field Visit'
                    : 'Remote';
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setWorkMode(mode)}
                    className={`min-h-[42px] px-2 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                      workMode === mode
                        ? 'bg-white text-[#1e40af] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {gpsStatus === 'acquiring' && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
            <Loader2 className="w-4 h-4 animate-spin text-[#1e40af] shrink-0" />
            <span className="text-xs font-medium">Acquiring GPS coordinates...</span>
          </div>
        )}

        {gpsStatus === 'error' && gpsError && (
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2.5">
            <div className="flex items-start gap-2 text-amber-900">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-xs leading-relaxed font-medium">{gpsError}</p>
            </div>
            <button
              type="button"
              onClick={() =>
                executeAttendanceAction(pendingAction || (activeShift ? 'out' : 'in'), true)
              }
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-950 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Simulate GPS Location (Demo Mode)</span>
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
            <p className="text-xs font-medium leading-snug">{actionSuccess}</p>
          </div>
        )}

        <button
          type="button"
          disabled={gpsStatus === 'acquiring'}
          onClick={() => executeAttendanceAction(activeShift ? 'out' : 'in', false)}
          className={`w-full min-h-[50px] px-4 py-3 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all disabled:opacity-60 ${
            activeShift
              ? 'bg-slate-900 hover:bg-slate-800'
              : 'bg-[#1e40af] hover:bg-[#2563eb]'
          }`}
        >
          {activeShift ? (
            <>
              <LogOut className="w-4 h-4" />
              <span>Punch Out with GPS</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              <span>Punch In with GPS</span>
            </>
          )}
        </button>
      </section>

      {/* Leave / Absence Quick Action */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-slate-900">Leave & Duty Requests</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Log Sick Leave, Casual Leave, or Official Duty
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenLeaveModal}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1e40af] text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
        >
          <CalendarPlus className="w-4 h-4" />
          <span>Apply Leave</span>
        </button>
      </section>

      <LocationMapModal
        isOpen={showMapTrace}
        title="Active Shift GPS Trace"
        entryLocation={activeShift?.punchInLocation || null}
        entryLabel="Punch-In Location"
        onClose={() => setShowMapTrace(false)}
      />
    </div>
  );
}
