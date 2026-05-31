import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, MapPin } from 'lucide-react';

interface AdminSettingsProps {
  token: string;
}

export default function AdminSettings({ token }: AdminSettingsProps) {
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [maxDistance, setMaxDistance] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ text: '', type: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLatitude(data.officeLatitude.toString());
        setLongitude(data.officeLongitude.toString());
        setMaxDistance(data.maxDistanceMeters.toString());
      } else {
        setStatus({ text: 'Failed to load settings', type: 'error' });
      }
    } catch (error) {
      setStatus({ text: 'Error loading settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!latitude || !longitude || !maxDistance) {
      setStatus({ text: 'All fields are required', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          officeLatitude: parseFloat(latitude),
          officeLongitude: parseFloat(longitude),
          maxDistanceMeters: parseInt(maxDistance, 10)
        })
      });

      if (res.ok) {
        setStatus({ text: 'Settings updated successfully', type: 'success' });
        setTimeout(() => setStatus({ text: '', type: '' }), 3000);
      } else {
        const err = await res.json();
        setStatus({ text: err.error || 'Failed to update settings', type: 'error' });
      }
    } catch (error) {
      setStatus({ text: 'Error updating settings', type: 'error' });
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading settings...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
      <div className="flex items-center mb-6">
        <SettingsIcon className="w-5 h-5 text-gray-500 mr-2" />
        <h2 className="text-xl font-bold text-gray-900">System Settings</h2>
      </div>

      {status.text && (
        <div className={`mb-6 p-4 rounded-md ${
          status.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'
        }`}>
          {status.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 max-w-lg">
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <MapPin className="w-4 h-4 mr-2 text-blue-500" />
            Office Location
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Set the central coordinates for checking attendance, and the maximum allowed distance for employees to check in.
          </p>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="latitude" className="block text-sm font-medium text-gray-700">Latitude</label>
              <input
                type="number"
                step="any"
                id="latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                required
              />
            </div>

            <div>
              <label htmlFor="longitude" className="block text-sm font-medium text-gray-700">Longitude</label>
              <input
                type="number"
                step="any"
                id="longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                required
              />
            </div>

            <div>
              <label htmlFor="maxDistance" className="block text-sm font-medium text-gray-700">Max Distance (Meters)</label>
              <input
                type="number"
                id="maxDistance"
                value={maxDistance}
                onChange={(e) => setMaxDistance(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                required
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <button
            type="submit"
            className="inline-flex justify-center flex-start items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </button>
        </div>
      </form>
    </div>
  );
}
