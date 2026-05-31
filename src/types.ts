export interface User {
  username: string;
  role?: string;
  fullName?: string;
}

export interface AdminUserRecord {
  id: number;
  username: string;
  role: string;
  fullName?: string;
}

export interface AdminReportRecord extends AttendanceRecord {
  username: string;
  fullName?: string;
}

export interface AttendanceRecord {
  _id: string;
  userId: string;
  type: 'checkin' | 'checkout';
  latitude: number;
  longitude: number;
  timestamp: string;
}

export interface Config {
  OFFICE_LATITUDE: number;
  OFFICE_LONGITUDE: number;
  MAX_DISTANCE_METERS: number;
}
