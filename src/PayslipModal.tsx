import React, { useRef } from 'react';
import { AdminReportRecord } from './types';
import { Printer, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';

interface PayslipModalProps {
  username: string;
  records: AdminReportRecord[];
  fromDate: string;
  toDate: string;
  onClose: () => void;
  employeeSummary: {
    formattedRegularDuration: string;
    formattedOvertimeDuration: string;
    regularMs: number;
    overtimeMs: number;
    salary?: number;
  };
}

export default function PayslipModal({ username, records, fromDate, toDate, onClose, employeeSummary }: PayslipModalProps) {
  const { t } = useTranslation();
  const componentRef = useRef<HTMLDivElement>(null);
  
  // Filter and sort records for this user only
  const userRecords = records
    .filter(r => (r.fullName || r.username) === username)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Calculate totals by category
  let officeMs = 0;
  let wfhMs = 0;
  let overtimeMs = 0;

  let lastCheckin: any = null;
  userRecords.forEach(record => {
    if (record.type === 'checkin' || record.type === 'checkin_overtime' || record.type === 'wfh-checkin') {
      lastCheckin = {
        time: new Date(record.timestamp),
        isOvertime: record.type === 'checkin_overtime',
        isWfh: record.type === 'wfh-checkin'
      };
    } else if (lastCheckin) {
      let matches = false;
      if (!lastCheckin.isWfh && !lastCheckin.isOvertime && record.type === 'checkout') matches = true;
      if (lastCheckin.isWfh && record.type === 'wfh-checkout') matches = true;
      if (lastCheckin.isOvertime && record.type === 'checkout_overtime') matches = true;

      if (matches) {
        const checkOutTime = new Date(record.timestamp).getTime();
        const checkInTime = lastCheckin.time.getTime();
        const total = checkOutTime - checkInTime;
        const day = lastCheckin.time.getDay();

        if (lastCheckin.isWfh) {
          wfhMs += total;
        } else if (lastCheckin.isOvertime) {
          overtimeMs += total;
        } else if (day === 5 || day === 6) {
          overtimeMs += total;
        } else {
          const shiftStart = new Date(lastCheckin.time);
          shiftStart.setHours(9, 0, 0, 0);
          const shiftEnd = new Date(lastCheckin.time);
          shiftEnd.setHours(17, 0, 0, 0);
          
          const overlapStart = Math.max(checkInTime, shiftStart.getTime());
          const overlapEnd = Math.min(checkOutTime, shiftEnd.getTime());
          
          let regular = 0;
          if (overlapStart < overlapEnd) {
            regular = overlapEnd - overlapStart;
          }
          officeMs += regular;
          overtimeMs += (total - regular);
        }
        lastCheckin = null;
      }
    }
  });

  const formatMs = (ms: number) => {
    const hrs = Math.floor(ms / (1000 * 60 * 60));
    const mins = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}${t('h')} ${mins}${t('m')}`;
  };

  const baseSalary = employeeSummary.salary || 0;
  const dailyRate = baseSalary / 30;
  const hourlyRate = dailyRate / 8;

  const uniqueWorkingDays = new Set(
    userRecords
      .filter(r => r.type.includes('checkin'))
      .map(r => new Date(r.timestamp).toISOString().split('T')[0])
  ).size;

  const regularTotalPay = uniqueWorkingDays * dailyRate;
  const overtimeHours = overtimeMs / (1000 * 60 * 60);
  const overtimeTotalPay = overtimeHours * hourlyRate;
  const finalPay = regularTotalPay + overtimeTotalPay;
  const totalRegularMs = officeMs + wfhMs;

  const categoryTotals = [
    { 
      type: t('Regular Working Days', { defaultValue: 'Regular Working Days' }), 
      valueStr: `${uniqueWorkingDays} ${t('Days')} (${formatMs(totalRegularMs)})`, 
      pay: regularTotalPay, 
      color: 'text-green-800 bg-green-100' 
    },
    { 
      type: t('Overtime', { defaultValue: 'Overtime' }), 
      valueStr: `${formatMs(overtimeMs)}`, 
      pay: overtimeTotalPay, 
      color: 'text-purple-800 bg-purple-100' 
    }
  ].filter(c => c.pay > 0 || c.type === t('Regular Working Days', { defaultValue: 'Regular Working Days' }));

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `${username} - Payslip`,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 sm:p-4 print:bg-white print:p-0">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] sm:rounded-lg shadow-xl flex flex-col overflow-hidden print:max-h-none print:shadow-none print:w-full">
        
        {/* Header - Screen Only */}
        <div className="flex justify-between items-center p-4 border-b border-gray-200 bg-gray-50 print:hidden">
          <h2 className="text-lg font-medium text-gray-900">{t('Payslip / Attendance Summary', { defaultValue: 'Payslip / Attendance Summary' })}</h2>
          <div className="flex space-x-2">
            <button 
              onClick={() => handlePrint()}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
            >
              <Printer className="w-4 h-4 ltr:mr-2 rtl:ml-2" /> {t('Print')}
            </button>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Content Area */}
        <div ref={componentRef} className="p-8 overflow-y-auto print:overflow-visible print:p-4 print:w-full" id="payslip-content">
          
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('Employee Attendance & Salary Slip', { defaultValue: 'Employee Attendance & Salary Slip' })}</h1>
            <p className="text-gray-500">
              {t('Period')}: {fromDate || t('Start')} {t('to')} {toDate || t('Present')}
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 gap-4 border-b border-gray-200 pb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase">{t('Employee Profile')}</h3>
              <p className="mt-2 text-lg font-bold text-gray-900">{username}</p>
            </div>
            <div className="ltr:text-right rtl:text-left">
              <h3 className="text-sm font-medium text-gray-500 uppercase">{t('Total Consolidated Hours', { defaultValue: 'Total Consolidated Hours' })}</h3>
              <div className="mt-2 text-sm text-gray-800 space-y-1 block">
                <p><strong>{t('Regular Hours', { defaultValue: 'Regular Hours' })}:</strong> {employeeSummary.formattedRegularDuration}</p>
                <p><strong>{t('Overtime Hours', { defaultValue: 'Overtime Hours' })}:</strong> {employeeSummary.formattedOvertimeDuration}</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2">{t('Hours by Category', { defaultValue: 'Hours by Category' })}</h3>
            <table className="min-w-full divide-y divide-gray-300 border border-gray-300">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 ltr:text-left rtl:text-right text-xs font-medium text-gray-700 uppercase tracking-wider">{t('Work Category', { defaultValue: 'Work Category' })}</th>
                  <th className="px-4 py-3 ltr:text-right rtl:text-left text-xs font-medium text-gray-700 uppercase tracking-wider">{t('Total Duration', { defaultValue: 'Total Duration' })}</th>
                  {employeeSummary.salary && (
                    <th className="px-4 py-3 ltr:text-right rtl:text-left text-xs font-medium text-gray-700 uppercase tracking-wider">{t('Calculated Pay', { defaultValue: 'Calculated Pay' })}</th>
                  )}
                </tr>
              </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                {categoryTotals.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">{t('No working hours found')}</td>
                  </tr>
                ) : (
                  categoryTotals.map((category, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${category.color}`}>
                          {category.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 ltr:text-right rtl:text-left font-bold">
                        {category.valueStr}
                      </td>
                      {employeeSummary.salary && (
                        <td className="px-4 py-3 text-sm text-gray-900 ltr:text-right rtl:text-left font-medium">
                          {`${category.pay.toFixed(2)} ${t('EGP', { defaultValue: 'EGP' })}`}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {employeeSummary.salary && categoryTotals.length > 0 && (
                <tfoot className="bg-blue-50">
                  <tr>
                    <td className="px-4 py-3 text-sm text-blue-900 font-bold" colSpan={2}>
                      {t('Total Calculated Compensation', { defaultValue: 'Total Calculated Compensation' })} ({t('Based on', { defaultValue: 'Based on' })} {employeeSummary.salary.toFixed(2)} {t('EGP / month', { defaultValue: 'EGP / month' })})
                    </td>
                    <td className="px-4 py-3 text-sm text-blue-900 ltr:text-right rtl:text-left font-extrabold text-lg">
                      {finalPay.toFixed(2)} {t('EGP', { defaultValue: 'EGP' })}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          
          <div className="mt-16 flex justify-between text-sm text-gray-500 print:mt-12">
            <div className="text-center w-1/3">
              <div className="border-t border-gray-400 pt-2">{t('Employee Signature', { defaultValue: 'Employee Signature' })}</div>
            </div>
            <div className="text-center w-1/3">
              <div className="border-t border-gray-400 pt-2">{t('Manager / HR Signature', { defaultValue: 'Manager / HR Signature' })}</div>
            </div>
          </div>
          
          <div className="mt-8 text-center text-xs text-gray-400">
            {t('Generated on', { defaultValue: 'Generated on' })} {new Date().toLocaleString()} {t('by System Administrator', { defaultValue: 'by System Administrator.' })}
          </div>
        </div>
      </div>
    </div>
  );
}
