import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Config, AttendanceRecord } from './types';
import { getDistanceFromLatLonInM } from './lib/geo';
import { LogOut, MapPin, CheckCircle, AlertTriangle, Clock, Map, TrendingUp } from 'lucide-react';

interface DashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

export default function Dashboard({ token, username, onLogout, hideNav = false }: DashboardProps & { hideNav?: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setConfig(data);
    } catch (e) {
      console.error('Failed to load configuration');
    }
  };

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
      }
    } catch (e) {
      console.error('Failed to fetch records');
    }
  }, [token]);

  useEffect(() => {
    fetchConfig();
    fetchRecords();
  }, [fetchRecords]);

  const { regularMs, overtimeMs } = useMemo(() => {
    let reg = 0;
    let ot = 0;
    const sortedDesc = [...records].reverse();
    let pendingCheckIn: Date | null = null;
    
    sortedDesc.forEach(record => {
      if (record.type === 'checkin') {
        pendingCheckIn = new Date(record.timestamp);
      } else if (record.type === 'checkout' && pendingCheckIn) {
        const checkOut = new Date(record.timestamp);
        const day = pendingCheckIn.getDay(); 
        const checkInTime = pendingCheckIn.getTime();
        const checkOutTime = checkOut.getTime();
        
        if (day === 5 || day === 6) { 
          // Friday or Saturday -> All overtime
          ot += (checkOutTime - checkInTime);
        } else { 
          // Sun-Thu
          const shiftStart = new Date(pendingCheckIn);
          shiftStart.setHours(9, 0, 0, 0);
          const shiftEnd = new Date(pendingCheckIn);
          shiftEnd.setHours(17, 0, 0, 0);
          
          const overlapStart = Math.max(checkInTime, shiftStart.getTime());
          const overlapEnd = Math.min(checkOutTime, shiftEnd.getTime());
          
          let regular = 0;
          if (overlapStart < overlapEnd) {
            regular = overlapEnd - overlapStart;
          }
          const total = checkOutTime - checkInTime;
          reg += regular;
          ot += (total - regular);
        }
        pendingCheckIn = null;
      }
    });
    
    return { regularMs: reg, overtimeMs: ot };
  }, [records]);

  const formatDuration = (ms: number) => {
    if (ms <= 0) return '0h 0m';
    const hrs = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m`;
  };

  const handleAttendance = (type: 'checkin' | 'checkout') => {
    if (!config) return;
    setLoading(true);
    setStatusMsg({ text: 'Locating...', type: 'info' });

    if (!navigator.geolocation) {
      setStatusMsg({ text: 'Geolocation is not supported by your browser', type: 'error' });
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const distance = getDistanceFromLatLonInM(
          config.OFFICE_LATITUDE,
          config.OFFICE_LONGITUDE,
          latitude,
          longitude
        );

        if (distance > config.MAX_DISTANCE_METERS) {
          setStatusMsg({ 
            text: `Validation failed: You are ${Math.round(distance)}m away. Must be within ${config.MAX_DISTANCE_METERS}m of the office.`, 
            type: 'error' 
          });
          setLoading(false);
          return;
        }

        try {
          const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ type, latitude, longitude })
          });

          const data = await res.json();
          if (res.ok) {
            setStatusMsg({ text: data.message, type: 'success' });
            fetchRecords();
          } else {
            setStatusMsg({ text: data.error || 'Failed to record attendance', type: 'error' });
          }
        } catch (e: any) {
          setStatusMsg({ text: 'Network error occurred', type: 'error' });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        if (error.code === error.PERMISSION_DENIED) {
          setStatusMsg({ text: 'Location permission denied. Please allow location access.', type: 'error' });
        } else {
          setStatusMsg({ text: 'Unable to retrieve location.', type: 'error' });
        }
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  return (
    <div className={hideNav ? "" : "min-h-screen bg-gray-50 font-sans"}>
      {!hideNav && (
        <nav className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <MapPin className="text-blue-600 w-6 h-6 mr-2" />
                <h1 className="text-xl font-bold text-gray-900">Geo-Attendance</h1>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-500">Welcome, <strong>{username}</strong></span>
                <button
                  onClick={onLogout}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-gray-600 bg-gray-100 hover:bg-gray-200"
                >
                  <LogOut className="w-4 h-4 mr-1" /> Logout
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}

      <main className={hideNav ? "py-8" : "max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8"}>
        {!hideNav && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Welcome, {username}!</h2>
            <p className="text-gray-600 mt-1">Here is your attendance dashboard.</p>
          </div>
        )}

        {/* Working Hours Summary Panel */}
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Regular Hours</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatDuration(regularMs)}</h3>
              </div>
              <div className="bg-blue-50 p-3 rounded-full">
                <Clock className="w-6 h-6 text-blue-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">(9:00 AM - 5:00 PM, Sun-Thu)</p>
          </div>
          
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Overtime</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">{formatDuration(overtimeMs)}</h3>
              </div>
              <div className="bg-green-50 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">(Outside regular hours & Weekends)</p>
          </div>

          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 sm:col-span-2 lg:col-span-1">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Hours</p>
                <h3 className="text-2xl font-bold text-blue-700 mt-1">{formatDuration(regularMs + overtimeMs)}</h3>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-4">Total duration worked</p>
          </div>
        </div>

        {statusMsg.text && (
          <div className={`mb-6 p-4 rounded-md flex items-center shadow-sm border ${
            statusMsg.type === 'error' ? 'bg-red-50 text-red-800 border-red-200' : 
            statusMsg.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 
            'bg-blue-50 text-blue-800 border-blue-200'
          }`}>
            {statusMsg.type === 'error' && <AlertTriangle className="w-5 h-5 mr-3 flex-shrink-0" />}
            {statusMsg.type === 'success' && <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />}
            {statusMsg.type === 'info' && <Map className="w-5 h-5 mr-3 flex-shrink-0 animate-pulse" />}
            <p className="font-medium">{statusMsg.text}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Action Panel */}
          <div className="bg-white overflow-hidden shadow sm:rounded-lg border border-gray-200 text-center p-8">
            <MapPin className="w-12 h-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Record Attendance</h2>
            <p className="text-gray-500 text-sm mb-8">
              Ensure you are physically present at the office (within {config?.MAX_DISTANCE_METERS || 50}m). Location access must be enabled.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => handleAttendance('checkin')}
                disabled={loading}
                className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
              >
                Check In
              </button>
              <button
                onClick={() => handleAttendance('checkout')}
                disabled={loading}
                className="inline-flex justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 disabled:opacity-50"
              >
                Check Out
              </button>
            </div>
          </div>

          {/* History Panel */}
          <div className="bg-white overflow-hidden shadow sm:rounded-lg border border-gray-200 flex flex-col">
            <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-gray-500" /> Recent Activity
              </h3>
              <button 
                onClick={fetchRecords} 
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Refresh
              </button>
            </div>
            <div className="flex-1 overflow-y-auto max-h-96">
              {records.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                  No attendance records found.
                </div>
              ) : (
                <ul className="divide-y divide-gray-200">
                  {records.map((record) => (
                    <li key={record._id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className={`w-2 h-2 rounded-full mr-3 ${record.type === 'checkin' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <p className="text-sm font-medium text-gray-900 capitalize">{record.type.replace('-', ' ')}</p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(record.timestamp).toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-gray-400 pl-5">
                        Coords: {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
