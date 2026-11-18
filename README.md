# Vantrex Chemicals — Corporate Attendance Portal

Mobile-first corporate employee attendance, real-time GPS verification, shift timer, leave tracker, and HR management portal built with React, Tailwind CSS, Vercel Serverless API, Neon PostgreSQL, and Capacitor for Android.

## 1. Deploy to Vercel with Neon PostgreSQL

1. Create a PostgreSQL database in [Neon](https://neon.tech) and copy your connection string (`postgresql://...`).
2. Push this repository to GitHub and import it into [Vercel](https://vercel.com).
3. In Vercel Project Settings → **Environment Variables**, add:
   - `DATABASE_URL` = your Neon PostgreSQL connection string (`?sslmode=require`)
4. Deploy. All `/api/*` serverless routes automatically connect to Neon PostgreSQL and initialize the schema (`employees`, `attendance_logs`, `leave_requests`) on the first request. You can also run `src/db/schema.sql` directly in the Neon SQL Editor.

## 2. Build & Download Android APK (Capacitor)

The project includes `@capacitor/core`, `@capacitor/cli`, `@capacitor/android`, and `@capacitor/geolocation`.

### Option A: Automatic APK Download via GitHub Actions
1. Push this repository to GitHub (`main` branch).
2. Optional: In GitHub Repository Settings → **Variables**, add `VITE_API_BASE_URL` pointing to your deployed Vercel URL (e.g. `https://your-app.vercel.app`) so the Android app syncs directly with Neon PostgreSQL.
3. Open the **Actions** tab → **Build Android APK** → download the `vantrex-attendance-debug-apk` artifact (`app-debug.apk`) directly to your Android phone.

### Option B: Build Locally
```bash
npm install
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```
The installable APK is generated at:
`android/app/build/outputs/apk/debug/app-debug.apk`
