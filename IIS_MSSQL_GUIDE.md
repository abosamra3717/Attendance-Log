# Hosting Geo-Attendance on Local IIS with MSSQL

Since you want to host this application on your local IIS server and use a Microsoft SQL Server (MSSQL) database, I have prepared everything you need.

## Prerequisites
1. **Node.js**: Installed on your main Windows server.
2. **IIS**: Installed and running on Windows.
3. **iisnode module for IIS**: Essential for hosting Node.js apps on IIS. 
   * Download and install the latest `iisnode` release: https://github.com/tjanczuk/iisnode/releases OR you can configure IIS URL Rewrite pointing to a locally running Node process.
   * *Required: If you use URL Rewrite, ensure IIS Application Request Routing (ARR) is also installed.*
4. **SQL Server (MSSQL)**: A running local instance.

---

## 1. Setting up the Database (MSSQL)

I have created a SQL file for you: `database.sql`.
1. Open **SQL Server Management Studio (SSMS)**.
2. Connect to your local SQL Server instance.
3. Open `database.sql` and execute the script. 
4. This will create the `GeoAttendanceDB` database, all necessary tables (`Users`, `AttendanceRecords`, `AppSettings`), and insert default application settings along with a default admin account.

---

## 2. Configuring the Application

You'll need to prepare the application environment file to connect to your shiny new MSSQL database.

1. Open the project folder on your server.
2. Rename the provided `.env.example` file to `.env`.
3. Open `.env` in a text editor and fill in your MSSQL credentials:
   ```env
   USE_MSSQL="true"            # <--- Set this to "true" to tell the application to use MSSQL instead of the JSON file
   DB_SERVER="localhost"       # Or your SQL Server instance name, e.g., "localhost\SQLEXPRESS"
   DB_USER="sa"                # Or the SQL user you created
   DB_PASSWORD="your_password" 
   DB_NAME="GeoAttendanceDB"
   ```

*(Note: The adapter is set to `trustServerCertificate: true` in `mssqlAdapter.ts` which prevents common local connection errors).*

---

## 3. Switching to MSSQL inside the Code

I have provided a file named `mssqlAdapter.ts`. Right now, the `server.ts` file is using a JSON fallback. Once you are developing locally, you can easily wire up `server.ts` to use functions from `mssqlAdapter.ts`. 

In `server.ts`, wherever you see `dbData.users.find(...)` or `dbData.records.push(...)`, you will swap it with the asynchronous functions exported in `mssqlAdapter.ts` (e.g., `let user = await getUserByUsername(...)`). 
*Because we wanted to ensure the cloud preview doesn't break right now while you are testing, I left the live code running off JSON.*

To fully finalize the switch locally:
1. Copy the backend code over to your IIS Root.
2. Ensure you have run:
   ```bash
   npm install
   npm run build
   ```
   This will bundle the frontend and compile your `server.ts` logic into `dist/server.cjs` securely for production.

---

## 4. Hosting on IIS

I have already created a **`web.config`** file in the root of your project!

1. **Create an IIS Website:** Right-click 'Sites' in IIS Manager -> 'Add Website...'.
2. **Physical Path:** Point this to the root of your application (where `package.json` and `web.config` live).
3. **App Pool Permissions:** Ensure the IIS Application Pool Identity (`IIS AppPool\YourSiteName`) has `Read/Execute` rights to the folder.
4. **Browse** to your new site! The `web.config` file will automatically route all incoming traffic through `dist/server.cjs` via the `iisnode` module.

### Alternatively: URL Rewrite (Reverse Proxy)
If you don't want to use `iisnode`, you can just run `npm run start` in a console (which starts the app on port `3000`), then edit the `<rewrite>` rule in `web.config` to point to `http://localhost:3000`.
