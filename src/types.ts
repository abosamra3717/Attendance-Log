export interface User {
  username: string;
  role?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  salary?: number;
}

export interface AdminUserRecord {
  id: number;
  username: string;
  role: string;
  fullName?: string;
  email?: string;
  phone?: string;
  salary?: number;
}

export interface AdminReportRecord extends AttendanceRecord {
  username: string;
  fullName?: string;
  salary?: number;
}

export interface AttendanceRecord {
  _id: string;
  userId: string;
  type: 'checkin' | 'checkout' | 'wfh-checkin' | 'wfh-checkout' | 'checkin_overtime' | 'checkout_overtime';
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Config {
  OFFICE_LATITUDE: number;
  OFFICE_LONGITUDE: number;
  MAX_DISTANCE_METERS: number;
}
