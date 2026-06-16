-- Run this script in SQL Server Management Studio (SSMS) to initialize the database

CREATE DATABASE GeoAttendanceDB;
GO

USE GeoAttendanceDB;
GO

-- Create Users table
CREATE TABLE Users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL DEFAULT 'employee',
    fullName NVARCHAR(100),
    email NVARCHAR(150),
    phone NVARCHAR(50)
);
GO

-- Create AttendanceRecords table
CREATE TABLE AttendanceRecords (
    id INT IDENTITY(1,1) PRIMARY KEY,
    userId INT NOT NULL,
    type NVARCHAR(20) NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_AttendanceRecords_Users FOREIGN KEY (userId) REFERENCES Users(id) ON DELETE CASCADE
);
GO

-- Create Settings table
CREATE TABLE AppSettings (
    id INT PRIMARY KEY DEFAULT 1,
    officeLatitude FLOAT NOT NULL,
    officeLongitude FLOAT NOT NULL,
    maxDistanceMeters INT NOT NULL
);
GO

-- Insert default settings
INSERT INTO AppSettings (id, officeLatitude, officeLongitude, maxDistanceMeters)
VALUES (1, 30.115638, 31.340295, 50);
GO

-- Insert default admin user (password uses bcrypt, placeholder here is 'admin123', you should register via the app normally)
-- It's better to register the admin from the app interface, or supply a known hashed password here.
-- Example hash for 'Admin@123': $2a$10$XUfJ88/hG8yN1.22KjVn2un/.WJ7n39dZ33E56tX0I0QxVf55q/Tq
INSERT INTO Users (username, password, role, fullName)
VALUES ('admin', '$2a$10$XUfJ88/hG8yN1.22KjVn2un/.WJ7n39dZ33E56tX0I0QxVf55q/Tq', 'admin', 'System Administrator');
GO
