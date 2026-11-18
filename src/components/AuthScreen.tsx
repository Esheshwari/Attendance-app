import React, { useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  Phone,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import type { Employee, EmployeeRole } from '../types';
import {
  getDomainError,
  getMobileNumberError,
  loginWithEmail,
  registerEmployee,
} from '../utils/storage';
import { CorporateLogo } from './CorporateLogo';

interface AuthScreenProps {
  onAuthenticated: (employee: Employee) => void;
}

const DEPARTMENTS = [
  'Lab Operations',
  'Sales',
  'Logistics',
  'Manufacturing',
  'Quality Assurance',
  'Admin',
];

export function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [department, setDepartment] = useState('Lab Operations');
  const [role, setRole] = useState<EmployeeRole>('Employee');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const domainErr = getDomainError(email);
    if (domainErr) {
      setError(domainErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginWithEmail(email);
      if (result.status === 'found') {
        onAuthenticated(result.employee);
      } else {
        setMode('register');
      }
    } catch (err: any) {
      setError(err?.message || 'Unable to verify corporate email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const domainErr = getDomainError(email);
    if (domainErr) {
      setError(domainErr);
      return;
    }

    if (!fullName.trim() || !employeeId.trim() || !department.trim()) {
      setError('Please complete your Full Name, Employee ID, and Department.');
      return;
    }

    const phoneErr = getMobileNumberError(mobileNumber);
    if (phoneErr) {
      setError(phoneErr);
      return;
    }

    setIsSubmitting(true);
    try {
      const employee = await registerEmployee({
        email,
        fullName,
        employeeId,
        mobileNumber,
        department,
        role,
      });
      onAuthenticated(employee);
    } catch (err: any) {
      setError(err?.message || 'Unable to complete employee onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-between p-5 sm:p-6">
      <div className="pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <CorporateLogo size={44} />
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">
              Vantrex Chemicals
            </h1>
            <p className="text-xs font-medium text-slate-500">
              Corporate Attendance Portal
            </p>
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-slate-900 mb-1.5 text-balance">
          {mode === 'login' ? 'Employee Sign In' : 'New Employee Setup'}
        </h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          {mode === 'login'
            ? 'Authenticate with your official Vantrex Chemicals email to record verified GPS attendance.'
            : 'Complete your corporate profile once to enable shift tracking, GPS monitoring, and leave requests.'}
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        {error && (
          <div
            role="alert"
            className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-800"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
            <p className="text-xs font-medium leading-relaxed">{error}</p>
          </div>
        )}

        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Official Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@vantrexchemicals.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full min-h-[46px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 transition-colors"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Restricted strictly to @vantrexchemicals.com accounts.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1e40af] hover:bg-[#1d4ed8] active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Verifying Email...' : 'Continue to Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">First time on this portal?</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('register');
                }}
                className="min-h-[44px] px-2 text-xs font-semibold text-[#1e40af] hover:text-[#1d4ed8] flex items-center gap-1.5"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>New Employee Setup</span>
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label
                htmlFor="reg-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Official Corporate Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@vantrexchemicals.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="reg-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="reg-name"
                  type="text"
                  placeholder="e.g. Rohan Deshmukh"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>

              <div>
                <label
                  htmlFor="reg-id"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Employee ID
                </label>
                <input
                  id="reg-id"
                  type="text"
                  placeholder="e.g. VC-101"
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono-tabular uppercase bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-phone"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Mobile Number
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  value={mobileNumber}
                  onChange={(e) => {
                    setMobileNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm font-mono-tabular bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reg-dept"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Department / Designation
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reg-dept"
                  type="text"
                  list="vantrex-departments"
                  placeholder="e.g. Lab Operations"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
                />
                <datalist id="vantrex-departments">
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                Access Role
              </span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                {(['Employee', 'Manager / Admin'] as EmployeeRole[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRole(option)}
                    className={`min-h-[42px] px-3 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
                      role === option
                        ? 'bg-white text-[#1e40af] shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-[#1e40af] hover:bg-[#1d4ed8] active:scale-[0.99] text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all disabled:opacity-60"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving Profile...' : 'Complete Setup & Sign In'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('login');
              }}
              className="w-full min-h-[44px] text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Employee Sign In</span>
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-500 pt-6 pb-2">
        Vantrex Chemicals Workforce Mobility · Encrypted Session
      </p>
    </div>
  );
}
