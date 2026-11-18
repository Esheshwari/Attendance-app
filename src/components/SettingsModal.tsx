import React, { useState } from 'react';
import { AlertTriangle, LogOut, Trash2, UserCheck, X } from 'lucide-react';
import type { Employee } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  employee: Employee;
  onClose: () => void;
  onSignOut: () => void;
  onResetAll: () => Promise<void>;
}

export function SettingsModal({
  isOpen,
  employee,
  onClose,
  onSignOut,
  onResetAll,
}: SettingsModalProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  if (!isOpen) return null;

  const handleConfirmReset = async () => {
    setResetting(true);
    try {
      await onResetAll();
    } finally {
      setResetting(false);
      setConfirmingReset(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-[440px] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-5 pb-safe">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#1e40af]" />
            <h3 id="settings-modal-title" className="text-base font-bold text-slate-900">
              Employee Profile & Settings
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Full Name</span>
            <span className="text-xs font-semibold text-slate-900">{employee.fullName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Employee ID</span>
            <span className="text-xs font-mono-tabular font-semibold text-slate-900">
              {employee.employeeId}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Corporate Email</span>
            <span className="text-xs font-medium text-slate-700 truncate max-w-[210px]">
              {employee.email}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Mobile Number</span>
            <span className="text-xs font-mono-tabular font-medium text-slate-800">
              {employee.mobileNumber || 'Not provided'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Department</span>
            <span className="text-xs font-medium text-slate-800">{employee.department}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Role</span>
            <span className="text-xs font-semibold text-[#1e40af]">{employee.role}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="w-full min-h-[46px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center justify-center gap-2 mb-4"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>

        <div className="pt-3 border-t border-slate-100">
          {!confirmingReset ? (
            <button
              type="button"
              onClick={() => setConfirmingReset(true)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-red-700 hover:bg-red-50 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset All System Data</span>
            </button>
          ) : (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 space-y-3">
              <div className="flex items-start gap-2 text-red-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                <p className="text-xs leading-relaxed">
                  This permanently erases all registered employees, GPS attendance logs, and leave
                  records on this portal.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="flex-1 min-h-[42px] px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={resetting}
                  onClick={handleConfirmReset}
                  className="flex-1 min-h-[42px] px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold disabled:opacity-60"
                >
                  {resetting ? 'Wiping...' : 'Confirm Wipe'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
