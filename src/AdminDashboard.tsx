import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { AdminReportRecord } from './types';
import { LogOut, MapPin, Calendar, FileText, Search, User, Clock, Users as UsersIcon, Download, CheckCircle, Settings as SettingsIcon, TrendingUp, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminUsers from './AdminUsers';
import AdminSettings from './AdminSettings';
import Dashboard from './Dashboard';
import PayslipModal from './PayslipModal';
import LanguageSwitcher from './components/LanguageSwitcher';

interface AdminDashboardProps {
  token: string;
  username: string;
  onLogout: () => void;
}

export default function AdminDashboard({ token, username, onLogout }: AdminDashboardProps) {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'reports' | 'overtime' | 'payslips' | 'users' | 'attendance' | 'settings'>('attendance');
  const [records, setRecords] = useState<AdminReportRecord[]>([]);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [printUsername, setPrintUsername] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);
  const [summaryPage, setSummaryPage] = useState(1);
  const itemsPerPage = 10;

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
    if (activeTab === 'reports' || activeTab === 'overtime' || activeTab === 'payslips') {
      fetchReports();
    }
  }, [fetchReports, activeTab]);

  useEffect(() => {
    setLogPage(1);
    setSummaryPage(1);
  }, [activeTab, fromDate, toDate]);

  // Calculate working hours per day per employee -> Total
  const { workingHoursRecords, employeeSummaryRecords, totalWorkHours } = useMemo(() => {
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
      
      if (record.type === 'checkin' || record.type === 'checkin_overtime' || record.type === 'wfh-checkin') {
        dayData.lastCheckin = { 
          time: new Date(record.timestamp), 
          isOvertime: record.type === 'checkin_overtime',
          isWfh: record.type === 'wfh-checkin'
        };
      } else if (dayData.lastCheckin) {
        let matches = false;
        if (!dayData.lastCheckin.isWfh && !dayData.lastCheckin.isOvertime && record.type === 'checkout') matches = true;
        if (dayData.lastCheckin.isWfh && record.type === 'wfh-checkout') matches = true;
        if (dayData.lastCheckin.isOvertime && record.type === 'checkout_overtime') matches = true;

        if (matches) {
          const checkOutTime = new Date(record.timestamp).getTime();
          const checkInTime = dayData.lastCheckin.time.getTime();
          const day = dayData.lastCheckin.time.getDay();
          const total = checkOutTime - checkInTime;

          if (dayData.lastCheckin.isWfh) {
            dayData.totalRegularMs = (dayData.totalRegularMs || 0) + total;
          } else if (dayData.lastCheckin.isOvertime) {
            dayData.totalOvertimeMs = (dayData.totalOvertimeMs || 0) + total;
          } else if (day === 5 || day === 6) {
            dayData.totalOvertimeMs = (dayData.totalOvertimeMs || 0) + total;
          } else {
            const shiftStart = new Date(dayData.lastCheckin.time);
            shiftStart.setHours(9, 0, 0, 0);
            const shiftEnd = new Date(dayData.lastCheckin.time);
            shiftEnd.setHours(17, 0, 0, 0);
            
            const overlapStart = Math.max(checkInTime, shiftStart.getTime());
            const overlapEnd = Math.min(checkOutTime, shiftEnd.getTime());
            
            let regular = 0;
            if (overlapStart < overlapEnd) {
              regular = overlapEnd - overlapStart;
            }
            dayData.totalRegularMs = (dayData.totalRegularMs || 0) + regular;
            dayData.totalOvertimeMs = (dayData.totalOvertimeMs || 0) + (total - regular);
          }
          
          dayData.lastCheckin = null; // reset
        }
      }
    });

    let overallTotalMs = 0;
    const finalReport = [];

    for (const [user, days] of Object.entries(grouped)) {
      for (const [date, data] of Object.entries(days as any)) {
        const regularMs = (data as any).totalRegularMs || 0;
        const overtimeMs = (data as any).totalOvertimeMs || 0;
        
        let rHrs = Math.floor(regularMs / (1000 * 60 * 60));
        let rMins = Math.floor((regularMs % (1000 * 60 * 60)) / (1000 * 60));
        
        let oHrs = Math.floor(overtimeMs / (1000 * 60 * 60));
        let oMins = Math.floor((overtimeMs % (1000 * 60 * 60)) / (1000 * 60));

        // Use activeTab to figure out which total to push to "workingHoursRecords"
        // Wait, instead of filtering here, I'll store both and let the render function use it
        if (regularMs > 0 || overtimeMs > 0) {
          finalReport.push({
            username: user,
            date: date,
            formattedRegularDuration: `${rHrs}h ${rMins}m`,
            regularMs: regularMs,
            formattedOvertimeDuration: `${oHrs}h ${oMins}m`,
            overtimeMs: overtimeMs
          });
        }
      }
    }
    
    // Sort final report by Date DESC
    finalReport.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    let currentTabTotalMs = 0;
    const employeeTotals: Record<string, { regularMs: number, overtimeMs: number, salary?: number }> = {};

    records.forEach(r => {
      const user = r.fullName || r.username;
      if (!employeeTotals[user]) {
        employeeTotals[user] = { regularMs: 0, overtimeMs: 0, salary: r.salary };
      } else if (r.salary) {
        employeeTotals[user].salary = r.salary;
      }
    });

    finalReport.forEach(r => {
      if (activeTab === 'overtime') currentTabTotalMs += r.overtimeMs;
      else currentTabTotalMs += r.regularMs;
      
      employeeTotals[r.username].regularMs += r.regularMs;
      employeeTotals[r.username].overtimeMs += r.overtimeMs;
    });

    const totHrs = Math.floor(currentTabTotalMs / (1000 * 60 * 60));
    const totMins = Math.floor((currentTabTotalMs % (1000 * 60 * 60)) / (1000 * 60));

    // Filter correctly for the active tab view, so it only shows records with > 0 ms for that tab
    const filteredReport = finalReport.filter(r => {
      if (activeTab === 'overtime') return r.overtimeMs > 0;
      if (activeTab === 'payslips') return r.regularMs > 0 || r.overtimeMs > 0;
      return r.regularMs > 0;
    });
    
    const employeeSummaryRecords = Object.entries(employeeTotals).map(([username, totals]) => {
      const regHrs = Math.floor(totals.regularMs / (1000 * 60 * 60));
      const regMins = Math.floor((totals.regularMs % (1000 * 60 * 60)) / (1000 * 60));
      const otHrs = Math.floor(totals.overtimeMs / (1000 * 60 * 60));
      const otMins = Math.floor((totals.overtimeMs % (1000 * 60 * 60)) / (1000 * 60));
      
      return {
        username,
        formattedRegularDuration: `${regHrs}h ${regMins}m`,
        formattedOvertimeDuration: `${otHrs}h ${otMins}m`,
        regularMs: totals.regularMs,
        overtimeMs: totals.overtimeMs,
        salary: totals.salary
      };
    }).sort((a, b) => a.username.localeCompare(b.username));

    return {
      workingHoursRecords: filteredReport,
      employeeSummaryRecords,
      totalWorkHours: `${totHrs}h ${totMins}m`
    };
  }, [records, activeTab]);

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
    const isOT = activeTab === 'overtime';
    const columns = [
      { header: 'Employee', key: 'username' },
      { header: 'Date', key: 'date' },
      { header: isOT ? 'Total Overtime Hours' : 'Total Regular Hours', key: isOT ? 'formattedOvertimeDuration' : 'formattedRegularDuration' }
    ];
    exportToCSV(workingHoursRecords, `${isOT ? 'overtime' : 'regular'}_hours_${fromDate || 'start'}_to_${toDate || 'today'}.csv`, columns);
  };

  const handleExportLogs = () => {
    const isOT = activeTab === 'overtime';
    const filteredRecords = records.filter(r => isOT ? r.type.includes('overtime') : !r.type.includes('overtime'));
    const formattedRecords = filteredRecords.map(r => ({
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
    exportToCSV(formattedRecords, `${isOT ? 'overtime' : 'attendance'}_log_${fromDate || 'start'}_to_${toDate || 'today'}.csv`, columns);
  };

  // Calculate total summary
  const uniqueEmployees = new Set(records.map(r => r.fullName || r.username)).size;

  const tabs = [
    { id: 'reports', label: t('Attendance Reports'), icon: FileText },
    { id: 'overtime', label: t('Overtime Reports'), icon: TrendingUp },
    { id: 'payslips', label: t('Employee Payslips'), icon: UsersIcon },
    { id: 'users', label: t('User Management'), icon: UsersIcon },
    { id: 'attendance', label: t('My Attendance'), icon: CheckCircle },
    { id: 'settings', label: t('Settings'), icon: SettingsIcon },
  ];

  const activeTabLabel = tabs.find(tObj => tObj.id === activeTab)?.label || t('Dashboard');

  const activeLogs = records.filter(r => activeTab === 'overtime' ? r.type.includes('overtime') : !r.type.includes('overtime'));
  const paginatedLogs = activeLogs.slice((logPage - 1) * itemsPerPage, logPage * itemsPerPage);
  const totalLogPages = Math.max(1, Math.ceil(activeLogs.length / itemsPerPage));

  const paginatedWorkingHours = workingHoursRecords.slice((summaryPage - 1) * itemsPerPage, summaryPage * itemsPerPage);
  const totalSummaryPages = Math.max(1, Math.ceil(workingHoursRecords.length / itemsPerPage));

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col sm:flex-row">
      {/* Mobile Header */}
      <header className="sm:hidden bg-white shadow border-b border-gray-200 flex justify-between items-center px-4 h-16 shrink-0">
        <div className="flex items-center">
          <MapPin className="text-red-600 w-6 h-6 ltr:mr-2 rtl:ml-2" />
          <h1 className="text-lg font-bold text-gray-900">{t('Admin Panel')}</h1>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse">
          <LanguageSwitcher />
          <button onClick={onLogout} className="text-gray-500 hover:text-gray-700 ltr:ml-2 rtl:mr-2">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mobile Navigation (Select) */}
      <div className="sm:hidden p-4 bg-white border-b border-gray-200 shrink-0">
        <label htmlFor="tabs" className="sr-only">Select a tab</label>
        <select
          id="tabs"
          name="tabs"
          className="block w-full rounded-md border-gray-300 py-2 pl-3 pr-10 text-base focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm border"
          value={activeTab}
          onChange={(e) => setActiveTab(e.target.value as any)}
        >
          {tabs.map((tab) => (
            <option key={tab.id} value={tab.id}>{tab.label}</option>
          ))}
        </select>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden sm:flex flex-col w-64 bg-white shadow-lg z-10 shrink-0 h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 shrink-0">
          <MapPin className="text-red-600 w-6 h-6 ltr:mr-2 rtl:ml-2" />
          <h1 className="text-xl font-bold text-gray-900">{t('Admin Panel')}</h1>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 flex-shrink-0 ${
                  activeTab === tab.id ? 'text-blue-700' : 'text-gray-400 hover:text-gray-500'
                }`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 shrink-0 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-bold uppercase border border-blue-200">
                {username.charAt(0)}
              </div>
              <div className="ltr:ml-3 rtl:mr-3 truncate">
                <p className="text-sm font-medium text-gray-900 truncate">{username}</p>
                <p className="text-xs text-gray-500">{t('Admin')}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="ml-2 flex-shrink-0 p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Desktop Top Header */}
        <header className="hidden sm:flex h-16 bg-white shadow-sm border-b border-gray-200 px-8 items-center justify-between shrink-0 z-0">
          <h2 className="text-lg font-medium text-gray-900">
            {activeTabLabel}
          </h2>
          <div className="flex items-center space-x-4 rtl:space-x-reverse text-sm text-gray-500">
            <span>{new Date().toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <LanguageSwitcher />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
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
                  <Calendar className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('From Date', { defaultValue: 'From Date'})}
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
                  <Calendar className="w-4 h-4 ltr:mr-1 rtl:ml-1" /> {t('To Date', { defaultValue: 'To Date'})}
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
                <Search className="w-4 h-4 ltr:mr-2 rtl:ml-2" /> {t('Filter', { defaultValue: 'Filter'})}
              </button>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
                {error}
              </div>
            )}
            
            {/* Employee Consolidated Payslip Summary Section */}
            {activeTab === 'payslips' && !loading && employeeSummaryRecords && employeeSummaryRecords.length > 0 && (
              <div className="mb-8 bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-green-50/50 flex justify-between items-center flex-wrap gap-4">
                  <h3 className="text-lg leading-6 font-medium text-green-900 flex items-center">
                    <UsersIcon className="w-5 h-5 ltr:mr-2 rtl:ml-2 text-green-600" /> {t('Employee Summaries & Payslips', { defaultValue: 'Employee Summaries & Payslips' })}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Employee')}</th>
                        <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Total Regular Hours', { defaultValue: 'Total Regular Hours'})}</th>
                        <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Total Overtime Hours', { defaultValue: 'Total Overtime Hours'})}</th>
                        <th scope="col" className="px-6 py-3 ltr:text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Payslip', { defaultValue: 'Payslip' })}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {employeeSummaryRecords.map((emp, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 capitalize">
                            {emp.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {emp.formattedRegularDuration}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {emp.formattedOvertimeDuration}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm ltr:text-right rtl:text-left">
                            <button
                              onClick={() => setPrintUsername(emp.username)}
                              className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                            >
                              <Printer className="w-4 h-4 ltr:mr-2 rtl:ml-2" /> {t('View Payslip', { defaultValue: 'View Payslip'})}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Hours Summary Section */}
            {activeTab !== 'payslips' && !loading && workingHoursRecords.length > 0 && (
              <div className="mb-8 bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 bg-blue-50/50 flex justify-between items-center flex-wrap gap-4">
                  <h3 className="text-lg leading-6 font-medium text-blue-900 flex items-center">
                    <Clock className="w-5 h-5 ltr:mr-2 rtl:ml-2 text-blue-600" /> {activeTab === 'overtime' ? t('Overtime Hours Summary', { defaultValue: 'Overtime Hours Summary' }) : t('Working Hours Summary', { defaultValue: 'Working Hours Summary' })}
                  </h3>
                  <div className="flex items-center gap-4">
                    <div className="text-sm font-bold text-blue-800 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-sm">
                      {t('Total', { defaultValue: 'Total' })}: {totalWorkHours}
                    </div>
                    <button 
                      onClick={handleExportHours}
                      className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                      <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" /> {t('Export CSV')}
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Employee')}</th>
                        <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Date')}</th>
                        <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Total Hours Worked', { defaultValue: 'Total Hours Worked' })}</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {paginatedWorkingHours.map((wr, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                            {wr.username}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {wr.date}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-700">
                            {activeTab === 'overtime' ? wr.formattedOvertimeDuration : wr.formattedRegularDuration}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalSummaryPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between sm:px-6">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <button
                        onClick={() => setSummaryPage(p => Math.max(1, p - 1))}
                        disabled={summaryPage === 1}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        {t('Previous', { defaultValue: 'Previous' })}
                      </button>
                      <button
                        onClick={() => setSummaryPage(p => Math.min(totalSummaryPages, p + 1))}
                        disabled={summaryPage === totalSummaryPages}
                        className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                      >
                        {t('Next', { defaultValue: 'Next' })}
                      </button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-gray-700">
                          {t('Showing', { defaultValue: 'Showing' })} <span className="font-medium">{(summaryPage - 1) * itemsPerPage + 1}</span> {t('to', { defaultValue: 'to' })} <span className="font-medium">{Math.min(summaryPage * itemsPerPage, workingHoursRecords.length)}</span> {t('of', { defaultValue: 'of' })} <span className="font-medium">{workingHoursRecords.length}</span> {t('results', { defaultValue: 'results' })}
                        </p>
                      </div>
                      <div>
                        <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                          <button
                            onClick={() => setSummaryPage(p => Math.max(1, p - 1))}
                            disabled={summaryPage === 1}
                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <span>{t('Previous', { defaultValue: 'Previous' })}</span>
                          </button>
                          {[...Array(totalSummaryPages)].map((_, i) => (
                            <button
                              key={i + 1}
                              onClick={() => setSummaryPage(i + 1)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${summaryPage === i + 1 ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                            >
                              {i + 1}
                            </button>
                          ))}
                          <button
                            onClick={() => setSummaryPage(p => Math.min(totalSummaryPages, p + 1))}
                            disabled={summaryPage === totalSummaryPages}
                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <span>{t('Next', { defaultValue: 'Next' })}</span>
                          </button>
                        </nav>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab !== 'payslips' && (
              <div className="bg-white shadow sm:rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center bg-gray-50 text-wrap flex-wrap gap-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 flex items-center">
                  <FileText className="w-5 h-5 ltr:mr-2 rtl:ml-2 text-gray-500" /> {activeTab === 'overtime' ? t('Overtime Log', { defaultValue: 'Overtime Log' }) : t('Attendance Log', { defaultValue: 'Attendance Log' })}
                </h3>
                <div className="flex items-center gap-4">
                  <div className="text-sm text-gray-500 flex items-center">
                    <User className="w-4 h-4 ltr:mr-1 rtl:ml-1 text-gray-400" /> {t('Showing', { defaultValue: 'Showing' })} <strong>{activeLogs.length}</strong> {t('records', { defaultValue: 'records' })}
                  </div>
                  {records.length > 0 && (
                    <button 
                      onClick={handleExportLogs}
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                    >
                      <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2 text-gray-500" /> {t('Export CSV')}
                    </button>
                  )}
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Employee')}</th>
                      <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Type')}</th>
                      <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Date & Time', { defaultValue: 'Date & Time' })}</th>
                      <th scope="col" className="px-6 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('Location (Lat, Lng)', { defaultValue: 'Location (Lat, Lng)' })}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedLogs.map((record) => (
                      <tr key={record._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 capitalize">
                          {record.fullName || record.username}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                            (record.type === 'checkin' || record.type === 'checkin_overtime' || record.type === 'wfh-checkin') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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
              {totalLogPages > 1 && (
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setLogPage(p => Math.max(1, p - 1))}
                      disabled={logPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('Previous', { defaultValue: 'Previous' })}
                    </button>
                    <button
                      onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                      disabled={logPage === totalLogPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t('Next', { defaultValue: 'Next' })}
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        {t('Showing', { defaultValue: 'Showing' })} <span className="font-medium">{(logPage - 1) * itemsPerPage + 1}</span> {t('to', { defaultValue: 'to' })} <span className="font-medium">{Math.min(logPage * itemsPerPage, activeLogs.length)}</span> {t('of', { defaultValue: 'of' })} <span className="font-medium">{activeLogs.length}</span> {t('results', { defaultValue: 'results' })}
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <button
                          onClick={() => setLogPage(p => Math.max(1, p - 1))}
                          disabled={logPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span>{t('Previous', { defaultValue: 'Previous' })}</span>
                        </button>
                        {[...Array(totalLogPages)].map((_, i) => (
                          <button
                            key={i + 1}
                            onClick={() => setLogPage(i + 1)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${logPage === i + 1 ? 'z-10 bg-blue-50 border-blue-500 text-blue-600' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
                          >
                            {i + 1}
                          </button>
                        ))}
                        <button
                          onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                          disabled={logPage === totalLogPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <span>{t('Next', { defaultValue: 'Next' })}</span>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </>
        )}
          </div>
        </main>
      </div>

      {/* Render Payslip Modal outside normal document flow */}
      {printUsername && (
        <PayslipModal
          username={printUsername}
          records={records}
          fromDate={fromDate}
          toDate={toDate}
          onClose={() => setPrintUsername(null)}
          employeeSummary={employeeSummaryRecords.find(e => e.username === printUsername)!}
        />
      )}
    </div>
  );
}
