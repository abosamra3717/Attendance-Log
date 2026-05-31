import { useState, useEffect } from 'react';
import Auth from './Auth';
import Dashboard from './Dashboard';
import AdminDashboard from './AdminDashboard';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing token in localStorage
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('username');
    const savedRole = localStorage.getItem('role');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUsername(savedUser);
      setRole(savedRole || 'employee');
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (newToken: string, user: string, userRole: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('username', user);
    localStorage.setItem('role', userRole);
    setToken(newToken);
    setUsername(user);
    setRole(userRole);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    setToken(null);
    setUsername(null);
    setRole(null);
  };

  if (isLoading) return null;

  return (
    <>
      {!token ? (
        <Auth onLogin={handleLogin} />
      ) : role === 'admin' ? (
        <AdminDashboard token={token} username={username!} onLogout={handleLogout} />
      ) : (
        <Dashboard token={token} username={username!} onLogout={handleLogout} />
      )}
    </>
  );
}
