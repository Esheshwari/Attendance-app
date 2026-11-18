import React, { useMemo, useState } from 'react';
import { Calendar, X } from 'lucide-react';
import type { LeaveType } from '../types';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    leaveType: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
  }) => Promise<void>;
}

const LEAVE_TYPES: LeaveType[] = ['Sick Leave', 'Casual Leave', 'Official Duty'];

export function LeaveModal({ isOpen, onClose, onSubmit }: LeaveModalProps) {
  const today = new Date().toISOString().slice(0, 10);
  const [leaveType, setLeaveType] = useState<LeaveType>('Casual Leave');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const computedDays = useMemo(() => {
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) {
      return 1;
    }
    return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (new Date(endDate) < new Date(startDate)) {
      setError('End date cannot be earlier than start date.');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter a brief reason or duty note.');
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        leaveType,
        startDate,
        endDate,
        daysCount: computedDays,
        reason: reason.trim(),
      });
      setReason('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to log leave entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-modal-title"
    >
      <div className="w-full max-w-[440px] bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-xl p-5 pb-safe">
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-3 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#1e40af]" />
            <h3 id="leave-modal-title" className="text-base font-bold text-slate-900">
              Apply Leave / Mark Absence
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
              {error}
            </p>
          )}

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Leave / Absence Category
            </span>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              {LEAVE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLeaveType(type)}
                  className={`min-h-[42px] px-2 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap ${
                    leaveType === type
                      ? 'bg-white text-[#1e40af] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="leave-start" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Start Date
              </label>
              <input
                id="leave-start"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>

            <div>
              <label htmlFor="leave-end" className="block text-xs font-semibold text-slate-700 mb-1.5">
                End Date
              </label>
              <input
                id="leave-end"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:bg-white focus:border-blue-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <span className="text-slate-600 font-medium">Calculated Duration</span>
            <span className="font-bold text-slate-900 tabular-nums">
              {computedDays} {computedDays === 1 ? 'Day' : 'Days'}
            </span>
          </div>

          <div>
            <label htmlFor="leave-reason" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Reason / Official Duty Note
            </label>
            <textarea
              id="leave-reason"
              rows={3}
              placeholder="Enter reason or client/plant assignment details..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 resize-none"
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[46px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[1.5] min-h-[46px] px-4 py-2.5 rounded-xl bg-[#1e40af] hover:bg-[#1d4ed8] text-white text-sm font-semibold shadow-sm disabled:opacity-60"
            >
              {saving ? 'Submitting...' : 'Confirm Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
