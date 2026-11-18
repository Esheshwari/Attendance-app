export type EmployeeRole = 'Employee' | 'Manager / Admin';

export type WorkMode = 'On-Site / Plant' | 'Client Visit / Field' | 'Remote';

export type LeaveType = 'Sick Leave' | 'Casual Leave' | 'Official Duty';

export type PlaceCategory =
  | 'Shop / Commercial'
  | 'Home / Residential'
  | 'Plant / Industrial'
  | 'Office / Corporate'
  | 'Field / Transit';

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  employeeId: string;
  mobileNumber: string;
  department: string;
  role: EmployeeRole;
  createdAt: string;
}

export interface GpsLocation {
  lat: number;
  lng: number;
  accuracy: number | null;
  address: string;
  city?: string;
  state?: string;
  postcode?: string;
  placeName?: string;
  placeCategory?: PlaceCategory;
  simulated?: boolean;
}

export interface AttendanceLog {
  id: string;
  employeeEmail: string;
  workMode: WorkMode;
  punchInAt: string;
  punchInLocation: GpsLocation;
  punchOutAt: string | null;
  punchOutLocation: GpsLocation | null;
  totalMinutes: number | null;
}

export interface LeaveRequest {
  id: string;
  employeeEmail: string;
  leaveType: LeaveType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  daysCount: number;
  reason: string;
  createdAt: string;
}

export type LiveEmployeeStatus = 'On Duty' | 'Checked Out' | 'On Leave';

export interface TeamOverviewData {
  employees: Employee[];
  attendance: AttendanceLog[];
  leaves: LeaveRequest[];
}
