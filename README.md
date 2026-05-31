# Employee Geo-Attendance System

A full-stack, secure employee attendance system built with modern best practices.

## Features
- Secure user registration and authentication (JWT).
- Secure password hashing (Bcrypt).
- Geolocation tracking for check-in and check-out.
- Distance validation (must be within 50m of office).
- Full historical attendance reporting.

## Frameworks and Architecture
- **Backend**: Node.js & Express
- **Database**: SQLite (Local embedded database)
- **Frontend**: React, fully styled with Tailwind CSS
- **Geolocation**: Browser `navigator.geolocation` API
- **Distance Calc**: Haversine Formula

## Setup Instructions
1. Navigate to the **Secrets** panel in AI Studio.
2. Add a `JWT_SECRET` string for signing tokens (any string is fine).
3. The system will start automatically, and the database is managed automatically via SQLite.

## How it works
On the Dashboard, you press "Check In" or "Check Out". The app uses the Geolocation API to find your coordinates, ensures you are closely inside a 50m bounds, and creates a protected database record of the attendance event.
