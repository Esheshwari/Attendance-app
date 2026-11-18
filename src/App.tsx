import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, LayoutDashboard, Settings, Users } from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import { CorporateLogo } from './components/CorporateLogo';
import { DashboardTab } from './components/DashboardTab';
import { LeaveModal } from './components/LeaveModal';
import { LogsTab } from './components/LogsTab';
import { SettingsModal } from './components/SettingsModal';
import { TeamHrTab } from './components/TeamHrTab';
import type {
  AttendanceLog,
  Employee,
  GpsLocation,
  LeaveRequest,
  LeaveType,
  TeamOverviewData,
  WorkMode,
} from './types';
import {
  fetchEmployeeData,
  fetchTeamOverview,
  getSavedSessionEmail,
  loginWithEmail,
  punchInEmployee,
  punchOutEmployee,
  resetAllSystemData,
  setSavedSessionEmail,
  submitLeaveRequest,
} from './utils/storage';

type ActiveTab = 'dashboard' | 'logs' | 'team';

export default function App() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [teamData, setTeamData] = useState<TeamOverviewData>({
    employees: [],
    attendance: [],
    leaves: [],
  });
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const loadWorkspaceData = useCallback(async (emp: Employee) => {
    const personal = await fetchEmployeeData(emp.email);
    setAttendance(personal.attendance);
    setLeaves(personal.leaves);

    if (emp.role === 'Manager / Admin') {
      const overview = await fetchTeamOverview();
      setTeamData(overview);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const savedEmail = getSavedSessionEmail();
        if (savedEmail) {
          const res = await loginWithEmail(savedEmail);
          if (mounted && res.status === 'found') {
            setEmployee(res.employee);
            await loadWorkspaceData(res.employee);
          } else {
            setSavedSessionEmail(null);
          }
        }
      } catch {
        setSavedSessionEmail(null);
      } finally {
        if (mounted) setBooting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [loadWorkspaceData]);

  const handleAuthenticated = async (emp: Employee) => {
    setEmployee(emp);
    setActiveTab('dashboard');
    await loadWorkspaceData(emp);
  };

  const handlePunchIn = async (workMode: WorkMode, location: GpsLocation) => {
    if (!employee) return;
    await punchInEmployee({
      employeeEmail: employee.email,
      workMode,
      location,
    });
    await loadWorkspaceData(employee);
  };

  const handlePunchOut = async (logId: string, punchInAt: string, location: GpsLocation) => {
    if (!employee) return;
    await punchOutEmployee({ logId, punchInAt, location });
    await loadWorkspaceData(employee);
  };

  const handleLeaveSubmit = async (payload: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
  }) => {
    if (!employee) return;
    await submitLeaveRequest({
      employeeEmail: employee.email,
      ...payload,
    });
    await loadWorkspaceData(employee);
  };

  const handleSignOut = () => {
    setSavedSessionEmail(null);
    setEmployee(null);
    setAttendance([]);
    setLeaves([]);
    setTeamData({ employees: [], attendance: [], leaves: [] });
    setIsSettingsOpen(false);
  };

  const handleResetAll = async () => {
    await resetAllSystemData();
    handleSignOut();
  };

  const isManager = employee?.role === 'Manager / Admin';

  return (
    <div className="min-h-screen w-full flex justify-center sm:py-6 sm:px-4">
      <div className="w-full max-w-[440px] min-h-screen sm:min-h-[820px] sm:max-h-[920px] flex flex-col bg-gradient-to-br from-[#e0f2fe] via-white to-[#dbeafe] sm:rounded-[28px] sm:border sm:border-slate-200/90 sm:shadow-xl overflow-hidden relative">
        {booting ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
            <CorporateLogo size={48} />
            <p className="text-sm font-semibold text-slate-700">
              Loading Vantrex Chemicals Portal...
            </p>
          </div>
        ) : !employee ? (
          <AuthScreen onAuthenticated={handleAuthenticated} />
        ) : (
          <>
            {/* Compact Mobile Top App Bar */}
            <header className="sticky top-0 z-30 pt-safe bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 h-14 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <CorporateLogo size={32} />
                <div className="min-w-0">
                  <h1 className="text-sm font-bold text-slate-900 truncate leading-tight">
                    Vantrex Chemicals
                  </h1>
                  <p className="text-[11px] font-medium text-slate-500 truncate leading-tight">
                    Corporate Attendance Portal
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                aria-label="Profile and settings"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors shrink-0"
              >
                <Settings className="w-5 h-5" />
              </button>
            </header>

            {/* Scrollable Main Content */}
            <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">
              {activeTab === 'dashboard' && (
                <DashboardTab
                  employee={employee}
                  attendance={attendance}
                  leaves={leaves}
                  onPunchIn={handlePunchIn}
                  onPunchOut={handlePunchOut}
                  onOpenLeaveModal={() => setIsLeaveModalOpen(true)}
                />
              )}

              {activeTab === 'logs' && (
                <LogsTab attendance={attendance} leaves={leaves} />
              )}

              {activeTab === 'team' && isManager && (
                <TeamHrTab data={teamData} />
              )}
            </main>

            {/* Compact Fixed Bottom Tab Bar */}
            <nav
              aria-label="Primary navigation"
              className="sticky bottom-0 z-30 pb-safe bg-white/95 backdrop-blur-md border-t border-slate-200 shrink-0"
            >
              <div
                className={`grid h-16 items-center ${
                  isManager ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                    activeTab === 'dashboard'
                      ? 'text-[#1e40af]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                    Dashboard
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                    activeTab === 'logs'
                      ? 'text-[#1e40af]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <ClipboardList className="w-5 h-5" />
                  <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                    Logs
                  </span>
                </button>

                {isManager && (
                  <button
                    type="button"
                    onClick={async () => {
                      setActiveTab('team');
                      const overview = await fetchTeamOverview();
                      setTeamData(overview);
                    }}
                    className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                      activeTab === 'team'
                        ? 'text-[#1e40af]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                    <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                      Team & HR
                    </span>
                  </button>
                )}
              </div>
            </nav>

            <LeaveModal
              isOpen={isLeaveModalOpen}
              onClose={() => setIsLeaveModalOpen(false)}
              onSubmit={handleLeaveSubmit}
            />

            <SettingsModal
              isOpen={isSettingsOpen}
              employee={employee}
              onClose={() => setIsSettingsOpen(false)}
              onSignOut={handleSignOut}
              onResetAll={handleResetAll}
            />
          </>
        )}
      </div>
    </div>
  );
}
