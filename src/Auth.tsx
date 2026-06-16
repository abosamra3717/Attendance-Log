import React, { useState } from 'react';
import { User } from './types';
import { LogIn, UserPlus, AlertCircle, KeyRound, Mail, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from './components/LanguageSwitcher';

interface AuthProps {
  onLogin: (token: string, username: string, role: string) => void;
}

export default function Auth({ onLogin }: AuthProps) {
  const { t } = useTranslation();
  const [isLogin, setIsLogin] = useState(true);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
  const [resetContact, setResetContact] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/auth/reset-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: resetContact }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');
      
      setSuccessMsg(data.message || 'OTP sent successfully!');
      setResetStep('verify');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/reset-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: resetContact, otp, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      
      alert('Password reset successfully! Please login with your new password.');
      setIsResetMode(false);
      setResetStep('request');
      setResetContact('');
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    if (!isLogin) {
      if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        setError('Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.');
        setLoading(false);
        return;
      }
    }

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const payload = isLogin 
        ? { username, password }
        : { username, password, fullName, email, phone };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      let data;
      const text = await res.text();
      try {
        data = JSON.parse(text);
      } catch (err) {
        throw new Error(`Server returned non-JSON response: ${text.substring(0, 100)}...`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (isLogin) {
        onLogin(data.token, data.username, data.role);
      } else {
        setIsLogin(true); // Switch to login after successful register
        setUsername('');
        setPassword('');
        setFullName('');
        setEmail('');
        setPhone('');
        alert('Registration successful! Please login.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col py-12 sm:px-6 lg:px-8 font-sans">
      <div className="absolute top-4 ltr:right-4 rtl:left-4">
        <LanguageSwitcher />
      </div>
      <div className="sm:mx-auto sm:w-full sm:max-w-md mt-10">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          {isLogin ? t('Login', { defaultValue: 'Sign in to your attendance log' }) : t('Register a new account', { defaultValue: 'Register a new account' })}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          {isResetMode ? (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex ltr:pl-3 rtl:pr-3 text-sm">
                  <AlertCircle className="w-5 h-5 ltr:mr-2 rtl:ml-2 flex-shrink-0" />
                  {error}
                </div>
              )}
              {successMsg && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md flex ltr:pl-3 rtl:pr-3 text-sm">
                  {successMsg}
                </div>
              )}

              {resetStep === 'request' ? (
                <form onSubmit={handleResetRequest} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Email Address')}</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={resetContact}
                        onChange={(e) => setResetContact(e.target.value)}
                        placeholder="e.g. user@example.com or +123456789"
                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? t('Processing...') : t('Send OTP', { defaultValue: 'Send OTP' })}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetVerify} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('Enter OTP', { defaultValue: 'Enter OTP' })}</label>
                    <div className="mt-1">
                      <input
                        type="text"
                        required
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="123456"
                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">{t('New Password')}</label>
                    <div className="mt-1">
                      <input
                        type="password"
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex w-full justify-center rounded-md border border-transparent bg-green-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                      {loading ? t('Processing...') : t('Change Password')}
                    </button>
                  </div>
                </form>
              )}

              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsResetMode(false);
                    setError('');
                    setSuccessMsg('');
                  }}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  {t('Back to Login', { defaultValue: 'Back to Login' })}
                </button>
              </div>
            </div>
          ) : (
            <>
              <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex ltr:pl-3 rtl:pr-3 text-sm">
                <AlertCircle className="w-5 h-5 ltr:mr-2 flex-shrink-0 rtl:ml-2" />
                {error}
              </div>
            )}
            
            {!isLogin && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('Full Name')}</label>
                  <div className="mt-1">
                    <input
                      type="text"
                      required={!isLogin}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('Email Address', { defaultValue: 'Email Address'})}</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      type="email"
                      required={!isLogin}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">{t('Phone Number', { defaultValue: 'Phone Number' })}</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <span className="inline-flex items-center rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-3 text-gray-500 sm:text-sm">
                      <Phone className="h-4 w-4" />
                    </span>
                    <input
                      type="tel"
                      required={!isLogin}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full min-w-0 flex-1 rounded-none rounded-r-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('Username')}</label>
              <div className="mt-1">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">{t('Password')}</label>
              <div className="mt-1">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? t('Processing...', { defaultValue: 'Processing...'}) : isLogin ? (
                  <span className="flex items-center"><LogIn className="w-4 h-4 ltr:mr-2 rtl:ml-2" /> {t('Sign In')}</span>
                ) : (
                  <span className="flex items-center"><UserPlus className="w-4 h-4 ltr:mr-2 rtl:ml-2" /> {t('Add New User', { defaultValue: 'Register' })}</span>
                )}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-white px-2 text-gray-500">Or</span>
              </div>
            </div>

            <div className="mt-6 text-center flex flex-col gap-2">
              {isLogin && (
                <button
                  type="button"
                  onClick={() => setIsResetMode(true)}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  {t('Forgot your password?', { defaultValue: 'Forgot your password?' })}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError('');
                }}
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                {isLogin ? t('Create a new account', { defaultValue: 'Create a new account' }) : t('Sign in to existing account', { defaultValue: 'Sign in to existing account' })}
              </button>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
}
