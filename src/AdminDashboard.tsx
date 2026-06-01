import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminReportRecord } from './types';
import { LogOut, MapPin, Calendar, FileText, Search, User, Clock, Users as UsersIcon, Download, CheckCircle, Settings as SettingsIcon } from 'lucide-react';
import AdminUsers from './AdminUsers';
import AdminSettings from './AdminSettings';
import Dashboard from './Dashboard';

interface AdminDashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

export default function AdminDashboard({ token, username, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'reports' | 'users' | 'attendance' | 'settings'>('attendance');
  const [records, setRecords] = useState<AdminReportRecord[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const query = new URLSearchParams();
      if (fromDate) query.append('from', fromDate);
      if (toDate) query.append('to', toDate);

      const res = await fetch(`/api/admin/attendance?${query.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('Failed to fetch reports');
      const data = await res.json();
      setRecords(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, fromDate, toDate]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    }
  }, [fetchReports, activeTab]);

  // Calculate working hours per day per employee -> Total
  const { workingHoursRecords, totalWorkHours } = useMemo(() => {
    // Process records from oldest to newest to match checkins with checkouts
    const sortedDesc = [...records].reverse();
    
    // Structure: user -> date (YYYY-MM-DD) -> [ {checkin: date, checkout: date | null }]
    const grouped: any = {};
    
    sortedDesc.forEach(record => {
      const dateKey = new Date(record.timestamp).toISOString().split('T')[0];
      const user = record.fullName || record.username;
      
      if (!grouped[user]) grouped[user] = {};
      if (!grouped[user][dateKey]) grouped[user][dateKey] = { totalMs: 0, lastCheckin: null };
      
      const dayData = grouped[user][dateKey];
      
      if (record.type === 'checkin' || record.type === 'checkin_overtime') {
        dayData.lastCheckin = new Date(record.timestamp);
      } else if ((record.type === 'checkout' || record.type === 'checkout_overtime') && dayData.lastCheckin) {
        const checkOutTime = new Date(record.timestamp);
        dayData.totalMs += (checkOutTime.getTime() - dayData.lastCheckin.getTime());
        dayData.lastCheckin = null; // reset
      }
    });

    let overallTotalMs = 0;
    const finalReport = [];

    for (const [user, days] of Object.entries(grouped)) {
      for (const [date, data] of Object.entries(days as any)) {
        const ms = (data as any).totalMs;
        overallTotalMs += ms;
        
        let hrs = Math.floor(ms / (1000 * 60 * 60));
        let mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        
        if (ms > 0) {
          finalReport.push({
            username: user,
            date: date,
            formattedDuration: `${hrs}h ${mins}m`,
            durationMs: ms
          });
        }
      }
    }
    
    // Sort final report by Date DESC
    finalReport.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const totHrs = Math.floor(overallTotalMs / (1000 * 60 * 60));
    const totMins = Math.floor((overallTotalMs % (1000 * 60 * 60)) / (1000 * 60));

    return {
      workingHoursRecords: finalReport,
      totalWorkHours: `${totHrs}h ${totMins}m`
    };
  }, [records]);

  // CSV Export logic
  const exportToCSV = (data: any[], filename: string, columns: {header: string, key: string}[]) => {
    if (data.length === 0) return;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    // Header
    csvContent += columns.map(c => c.header).join(",") + "\r\n";
    
    // Rows
    data.forEach(row => {
      let rowArray = columns.map(c => {
        let val = row[c.key] !== undefined && row[c.key] !== null ? String(row[c.key]) : "";
        if (val.includes(",") || val.includes("\"") || val.includes("\n")) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csvContent += rowArray.join(",") + "\r\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHours = () => {
    const columns = [
      { header: 'Employee', key: 'username' },
      { header: 'Date', key: 'date' },
      { header: 'Total Hours Worked', key: 'formattedDuration' }
    ];
    exportToCSV(workingHoursRecords, `working_hours_${fromDate || 'start'}_to_${toDate || 'today'}.csv`, columns);
  };

  const handleExportLogs = () => {
    const formattedRecords = records.map(r => ({
      ...r,
      name: r.fullName || r.username,
      localTime: new Date(r.timestamp).toLocaleString(),
      location: `${r.latitude}, ${r.longitude}`
    }));

    const columns = [
      { header: 'Employee', key: 'name' },
      { header: 'Type', key: 'type' },
      { header: 'Date & Time', key: 'localTime' },
      { header: 'Location', key: 'location' }
    ];
    exportToCSV(formattedRecords, `attendance_log_${fromDate || 'start'}_to_${toDate || 'today'}.csv`, columns);
  };

  // Calculate total summary
  const uniqueEmployees = new Set(records.map(r => r.fullName || r.username)).size;

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <MapPin className="text-red-600 w-6 h-6 mr-2" />
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
            </div>
            <div className="flex items-center space-x-4 flex-wrap">
              <span className="text-sm text-gray-500 hidden sm:inline-block">Admin: <strong>{username}</strong></span>
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
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
         <div className="sm:hidden">
          <label htmlFor="tabs" className="sr-only">Select a tab</label>
          <select
            id="tabs"
            name="tabs"
            className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm border"
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value as any)}
          >
            <option value="reports">Attendance Reports</option>
            <option value="users">User Management</option>
            <option value="attendance">My Attendance</option>
            <option value="settings">Settings</option>
          </select>
        </div>
        <div className="hidden sm:block">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
              <button
                onClick={() => setActiveTab('reports')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'reports' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="w-5 h-5 mr-2" />
                Attendance Reports
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'users' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UsersIcon className="w-5 h-5 mr-2" />
                User Management
              </button>
              <button
                onClick={() => setActiveTab('attendance')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'attendance' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                My Attendance
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === 'settings' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <SettingsIcon className="w-5 h-5 mr-2" />
                Settings
              </button>
            </nav>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'users' ? (
          <AdminUsers token={token} />
        ) : activeTab === 'attendance' ? (
          <Dashboard token={token} username={username} onLogout={onLogout} hideNav={true} />
        ) : activeTab === 'settings' ? (
          <AdminSettings token={token} />
        ) : (
          <>
            <div className="mb-8 bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" /> From Date
                </label>
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 bg-white"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Calendar className="w-4 h-4 mr-1" /> To Date
                </label>
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm border p-2 bg-white"
                />
              </div>
              <button
                onClick={fetchReports}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50 h-[38px]"
              >
                <Search className="w-4 h-4 mr-2" /> Filter
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
                {error}
              </div>
            )}
            
            {/* Hours Summary Section */}
            {!loading && workingHoursRecords.length > 0 && (
              <div className="mb-8 bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-blue-50/50 flex justify-between items-center flex-wrap gap-4">
                  <h3 className="text-lg leading-6 font-medium text-blue-900 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-blue-600" /> Working Hours Summary
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-blue-800 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-sm">
                      Total: {totalWorkHours}
                    </div>
                    <button 
                      onClick={handleExportHours}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                      <Download className="w-4 h-4 mr-2" /> Export CSV
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Hours Worked</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {workingHoursRecords.map((wr, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                            {wr.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {wr.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                            {wr.formattedDuration}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 text-wrap flex-wrap gap-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-gray-500" /> Attendance Log
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500 flex items-center">
                    <User className="w-4 h-4 mr-1 text-gray-400" /> Showing <strong>{records.length}</strong> records from <strong>{uniqueEmployees}</strong> employees
                  </div>
                  {records.length > 0 && (
                    <button 
                      onClick={handleExportLogs}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      <Download className="w-4 h-4 mr-2 text-gray-500" /> Export CSV
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location (Lat, Lng)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                          {record.fullName || record.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                            record.type.startsWith('checkin') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {record.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(record.timestamp).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                          {record.latitude.toFixed(5)}, {record.longitude.toFixed(5)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {records.length === 0 && !loading && (
                  <div className="text-center py-10 text-gray-500">
                    No attendance records found for the selected period.
                  </div>
                )}
                {loading && (
                  <div className="text-center py-10 text-gray-500">
                    Loading records...
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
