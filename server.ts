import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// CONSTANTS
const PORT = 3000;
const OFFICE_LATITUDE = parseFloat(process.env.OFFICE_LATITUDE || '30.115638');
const OFFICE_LONGITUDE = parseFloat(process.env.OFFICE_LONGITUDE || '31.340295');
const MAX_DISTANCE_METERS = parseInt(process.env.MAX_DISTANCE_METERS || '50', 10);

// HELPERS
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; 
  return d * 1000; 
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// SETUP JSON DB LAYER instead of sqlite
const DB_FILE = path.join(process.cwd(), 'database.json');
let dbData: any = { users: [], records: [], settings: null };

function setupDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      dbData = JSON.parse(data);
    }
    // Auto-migrate to ensure roles exist
    dbData.users = (dbData.users || []).map((u: any) => ({
      ...u,
      role: u.role || (u.username.toLowerCase() === 'admin' ? 'admin' : 'employee')
    }));
    if (!dbData.settings) {
      dbData.settings = {
        officeLatitude: parseFloat(process.env.OFFICE_LATITUDE || '30.115638'),
        officeLongitude: parseFloat(process.env.OFFICE_LONGITUDE || '31.340295'),
        maxDistanceMeters: parseInt(process.env.MAX_DISTANCE_METERS || '50', 10)
      };
      saveDatabase();
    }
  } catch (error) {
    dbData.settings = {
      officeLatitude: parseFloat(process.env.OFFICE_LATITUDE || '30.115638'),
      officeLongitude: parseFloat(process.env.OFFICE_LONGITUDE || '31.340295'),
      maxDistanceMeters: parseInt(process.env.MAX_DISTANCE_METERS || '50', 10)
    };
    saveDatabase();
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  } catch (error) {
    console.warn("Failed to write database file (this is expected on read-only environments like Vercel):", error);
  }
}

function generateId(collection: any[]) {
  return collection.length > 0 ? Math.max(...collection.map((i:any) => i.id)) + 1 : 1;
}

// JWT Middleware
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied, token missing' });

  jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret', (err: any, user: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const app = express();
app.use(cors());
app.use(express.json());

setupDatabase();
console.log('Connected to local JSON database: database.json');

  // --- API ROUTES ---

  // In-memory OTP storage for reset password
  const resetOtps = new Map<string, { otp: string, timestamp: number }>();

  // Auth: Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, fullName, email, phone } = req.body;
      if (!username || !password || !fullName || !email || !phone) return res.status(400).json({ error: 'Missing credentials' });
      
      if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.' });
      }

      const normalizedUsername = username.trim().toLowerCase();
      const existingUser = dbData.users.find((u: any) => u.username?.trim().toLowerCase() === normalizedUsername || u.email === email || u.phone === phone);
      if (existingUser) return res.status(400).json({ error: 'Username, email, or phone already exists' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const role = normalizedUsername === 'admin' ? 'admin' : 'employee';
      dbData.users.push({ 
        id: generateId(dbData.users), 
        username: username.trim(), 
        password: hashedPassword, 
        role, 
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim()
      });
      await saveDatabase();

      res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Server error during registration' });
    }
  });

  // Auth: Reset Password - Request OTP
  app.post('/api/auth/reset-password/request', async (req, res) => {
    try {
      const { contact } = req.body;
      if (!contact) return res.status(400).json({ error: 'Please provide email or phone number' });

      // Find user by email or phone
      const user = dbData.users.find((u: any) => u.email === contact || u.phone === contact);
      if (!user) return res.status(404).json({ error: 'No user found with that email or phone' });

      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      resetOtps.set(contact, { otp, timestamp: Date.now() });

      // In a real application, you would send the OTP via Twilio (WhatsApp/SMS) or Nodemailer (Email)
      console.log(`[SIMULATION] Sending OTP ${otp} to ${contact}`);

      res.json({ message: 'OTP sent successfully. Check your email or message.' });
    } catch (error) {
      res.status(500).json({ error: 'Server error generating OTP' });
    }
  });

  // Auth: Reset Password - Verify and Update
  app.post('/api/auth/reset-password/verify', async (req, res) => {
    try {
      const { contact, otp, newPassword } = req.body;
      if (!contact || !otp || !newPassword) return res.status(400).json({ error: 'Missing parameters' });

      const storedOtpInfo = resetOtps.get(contact);
      if (!storedOtpInfo) return res.status(400).json({ error: 'Invalid or expired OTP' });
      
      // Expire after 10 minutes
      if (Date.now() - storedOtpInfo.timestamp > 10 * 60 * 1000) {
        resetOtps.delete(contact);
        return res.status(400).json({ error: 'OTP has expired' });
      }

      if (storedOtpInfo.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });

      const userIndex = dbData.users.findIndex((u: any) => u.email === contact || u.phone === contact);
      if (userIndex === -1) return res.status(404).json({ error: 'User not found' });

      if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
        return res.status(400).json({ error: 'Password does not meet requirements' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      dbData.users[userIndex].password = hashedPassword;
      await saveDatabase();

      // Clean up OTP
      resetOtps.delete(contact);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Server error resetting password' });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(401).json({ error: 'Invalid username or password' });

      const normalizedUsername = username.trim().toLowerCase();
      const user = dbData.users.find((u: any) => u.username?.trim().toLowerCase() === normalizedUsername);
      if (!user) return res.status(401).json({ error: 'Invalid username or password' });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(401).json({ error: 'Invalid username or password' });

      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );
      res.json({ token, username: user.username, role: user.role, fullName: user.fullName || user.username });
    } catch (error) {
      res.status(500).json({ error: 'Server error during login' });
    }
  });

  // Attendance: Check-in/Check-out
  app.post('/api/attendance', authenticateToken, async (req: any, res: any) => {
    try {
      const { type, latitude, longitude } = req.body;
      if (!type || !latitude || !longitude) {
        return res.status(400).json({ error: 'Missing attendance data' });
      }

      if (type !== 'checkin' && type !== 'checkout' && type !== 'checkin_overtime' && type !== 'checkout_overtime' && type !== 'wfh-checkin' && type !== 'wfh-checkout') {
        return res.status(400).json({ error: 'Invalid record type' });
      }

      const settings = dbData.settings;
      const distance = getDistanceFromLatLonInM(settings.officeLatitude, settings.officeLongitude, latitude, longitude);
      const isOvertimeType = type === 'checkin_overtime' || type === 'checkout_overtime';
      const isWfhType = type === 'wfh-checkin' || type === 'wfh-checkout';

      if (!isOvertimeType && !isWfhType && distance > settings.maxDistanceMeters) {
        return res.status(403).json({ 
          error: `You are too far from the office. Distance is ${Math.round(distance)}m. Must be within ${settings.maxDistanceMeters}m.` 
        });
      }

      // Enforce checkin/checkout sequence
      const userRecords = dbData.records
        .filter((r: any) => r.userId === req.user.id)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      const lastRecord = userRecords[0];

      const isCheckinClass = type === 'checkin' || type === 'checkin_overtime' || type === 'wfh-checkin';
      const isCheckoutClass = type === 'checkout' || type === 'checkout_overtime' || type === 'wfh-checkout';

      if (isCheckinClass) {
        if (lastRecord && (lastRecord.type === 'checkin' || lastRecord.type === 'checkin_overtime' || lastRecord.type === 'wfh-checkin')) {
          return res.status(400).json({ error: 'You are already checked in. Please check out first.' });
        }
      } else if (isCheckoutClass) {
        if (!lastRecord || (lastRecord.type === 'checkout' || lastRecord.type === 'checkout_overtime' || lastRecord.type === 'wfh-checkout')) {
          return res.status(400).json({ error: 'You are not checked in. Please check in first.' });
        }
      }

      dbData.records.push({
        id: generateId(dbData.records),
        userId: req.user.id,
        type,
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
      await saveDatabase();

      res.status(201).json({ message: `Successfully checked ${isCheckinClass ? 'in' : 'out'}` });
    } catch (error) {
      res.status(500).json({ error: 'Server error recording attendance' });
    }
  });

  // Attendance: Get report
  app.get('/api/attendance', authenticateToken, async (req: any, res: any) => {
    try {
      const userRecords = dbData.records
        .filter((r: any) => r.userId === req.user.id)
        .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 50);
      
      const mappedRecords = userRecords.map((r: any) => ({
        ...r,
        _id: r.id.toString(),
      }));
      res.json(mappedRecords);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error fetching records' });
    }
  });
  
  // Admin: Get all attendance reports
  app.get('/api/admin/attendance', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { from, to } = req.query;
      let filteredRecords = dbData.records;

      if (from) {
        const fromDate = new Date(from);
        filteredRecords = filteredRecords.filter((r: any) => new Date(r.timestamp) >= fromDate);
      }
      
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filteredRecords = filteredRecords.filter((r: any) => new Date(r.timestamp) <= toDate);
      }

      const report = filteredRecords.map((r: any) => {
        const user = dbData.users.find((u: any) => u.id === r.userId);
        return {
          ...r,
          _id: r.id.toString(),
          username: user ? user.username : 'Unknown',
          fullName: user ? user.fullName || user.username : 'Unknown',
          salary: user ? user.salary : undefined
        };
      }).sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Server error fetching admin records' });
    }
  });

  // Admin: Get all users
  app.get('/api/admin/users', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      const users = dbData.users.map((u: any) => ({ id: u.id, username: u.username, role: u.role || 'employee', fullName: u.fullName, salary: u.salary }));
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: 'Server error fetching users' });
    }
  });

  // Admin: Update user
  app.put('/api/admin/users/:id', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      const id = parseInt(req.params.id, 10);
      const { username, role, fullName, salary } = req.body;
      const userIndex = dbData.users.findIndex((u: any) => u.id === id);
      if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
      
      if (username) dbData.users[userIndex].username = username;
      if (role) dbData.users[userIndex].role = role;
      if (fullName !== undefined) dbData.users[userIndex].fullName = fullName;
      if (salary !== undefined) dbData.users[userIndex].salary = salary === null ? undefined : salary;
      
      await saveDatabase();
      res.json({ message: 'User updated successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Server error updating user' });
    }
  });

  // Admin: Reset user password
  app.put('/api/admin/users/:id/password', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      const id = parseInt(req.params.id, 10);
      const { password } = req.body;
      if (!password) return res.status(400).json({ error: 'Password required' });
      
      if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long, and contain at least one uppercase letter, one lowercase letter, and one number.' });
      }

      const userIndex = dbData.users.findIndex((u: any) => u.id === id);
      if (userIndex === -1) return res.status(404).json({ error: 'User not found' });
      
      const hashedPassword = await bcrypt.hash(password, 10);
      dbData.users[userIndex].password = hashedPassword;
      
      await saveDatabase();
      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Server error resetting password' });
    }
  });

  // Admin: Get settings
  app.get('/api/admin/settings', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      res.json(dbData.settings);
    } catch (error) {
      res.status(500).json({ error: 'Server error fetching settings' });
    }
  });

  // Admin: Update settings
  app.put('/api/admin/settings', authenticateToken, async (req: any, res: any) => {
    try {
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      const { officeLatitude, officeLongitude, maxDistanceMeters } = req.body;
      
      if (officeLatitude !== undefined) dbData.settings.officeLatitude = parseFloat(officeLatitude);
      if (officeLongitude !== undefined) dbData.settings.officeLongitude = parseFloat(officeLongitude);
      if (maxDistanceMeters !== undefined) dbData.settings.maxDistanceMeters = parseInt(maxDistanceMeters, 10);
      
      await saveDatabase();
      res.json({ message: 'Settings updated successfully', settings: dbData.settings });
    } catch (error) {
      res.status(500).json({ error: 'Server error updating settings' });
    }
  });

  // Public config
  app.get('/api/config', (req, res) => {
    res.json({
      OFFICE_LATITUDE: dbData.settings.officeLatitude,
      OFFICE_LONGITUDE: dbData.settings.officeLongitude,
      MAX_DISTANCE_METERS: dbData.settings.maxDistanceMeters
    });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    let viteInstance: any;
    const vitePromise = createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    }).then(instance => {
      viteInstance = instance;
    });

    app.use(async (req, res, next) => {
      if (!viteInstance) {
        await vitePromise;
      }
      viteInstance.middlewares(req, res, next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist', 'client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }

  export default app;
