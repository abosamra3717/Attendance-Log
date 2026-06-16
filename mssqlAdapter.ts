import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

// Configuration for MSSQL
const sqlConfig = {
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'your_password',
  database: process.env.DB_NAME || 'GeoAttendanceDB',
  server: process.env.DB_SERVER || 'localhost',
  port: parseInt(process.env.DB_PORT || '1433', 10),
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: true, // for azure
    trustServerCertificate: true // change to true for local dev / self-signed certs
  }
};

let poolPromise: Promise<sql.ConnectionPool>;

export async function connectToMSSQL() {
  if (!poolPromise) {
    poolPromise = sql.connect(sqlConfig)
      .then(pool => {
        console.log('Connected to MSSQL Database');
        return pool;
      })
      .catch(err => {
        console.log('Database Connection Failed! Bad Config: ', err);
        throw err;
      });
  }
  return poolPromise;
}

// Example Wrapper functions you can use in server.ts
export async function getSettings() {
  const pool = await connectToMSSQL();
  const result = await pool.request().query('SELECT * FROM AppSettings WHERE id = 1');
  if (result.recordset.length > 0) {
    return result.recordset[0];
  }
  return null;
}

export async function updateSettings(lat: number, lng: number, dist: number) {
  const pool = await connectToMSSQL();
  await pool.request()
    .input('lat', sql.Float, lat)
    .input('lng', sql.Float, lng)
    .input('dist', sql.Int, dist)
    .query('UPDATE AppSettings SET officeLatitude = @lat, officeLongitude = @lng, maxDistanceMeters = @dist WHERE id = 1');
}

export async function getUserByUsername(username: string) {
  const pool = await connectToMSSQL();
  const result = await pool.request()
    .input('username', sql.NVarChar, username)
    .query('SELECT * FROM Users WHERE username = @username');
  return result.recordset[0];
}

export async function getUserById(id: number) {
  const pool = await connectToMSSQL();
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM Users WHERE id = @id');
  return result.recordset[0];
}

export async function addUser(username: string, passwordHash: string, role: string, fullName: string, email: string, phone: string) {
  const pool = await connectToMSSQL();
  await pool.request()
    .input('username', sql.NVarChar, username)
    .input('password', sql.NVarChar, passwordHash)
    .input('role', sql.NVarChar, role)
    .input('fullName', sql.NVarChar, fullName)
    .input('email', sql.NVarChar, email)
    .input('phone', sql.NVarChar, phone)
    .query('INSERT INTO Users (username, password, role, fullName, email, phone) VALUES (@username, @password, @role, @fullName, @email, @phone)');
}

export async function addRecord(userId: number, type: string, latitude: number, longitude: number, timestamp: string) {
  const pool = await connectToMSSQL();
  await pool.request()
    .input('userId', sql.Int, userId)
    .input('type', sql.NVarChar, type)
    .input('latitude', sql.Float, latitude)
    .input('longitude', sql.Float, longitude)
    .input('timestamp', sql.DateTime, new Date(timestamp))
    .query('INSERT INTO AttendanceRecords (userId, type, latitude, longitude, timestamp) VALUES (@userId, @type, @latitude, @longitude, @timestamp)');
}

export async function getUserRecords(userId: number, limit: number = 50) {
  const pool = await connectToMSSQL();
  const result = await pool.request()
    .input('userId', sql.Int, userId)
    .query(`SELECT TOP ${limit} * FROM AttendanceRecords WHERE userId = @userId ORDER BY timestamp DESC`);
  return result.recordset;
}
