# This is a [Next.js](https://nextjs.org) and Supabase project for Credo's EV Charger Management system.

## Implemented by 2025 summer interns: Hunter Broughton, Kevin Zhang, Farhan Ahmad, and Supragaya Seth at the 2025 Credo Hackathon

Will now be managed and monitored by Credo IT, direct questions and reports to that department.

Project is open source! If you encounter a bug or would like to improve the software in any way, please create
a pull request and notify the IT team to review it.

## What This Application Does (Overview)

A lightweight internal web application to:

- Allow employees to join a centralized queue for limited EV charging stations.
- Automatically assign users to available chargers in order and track active charging sessions.
- Track and display real-time remaining time for each active charging session (countdown) and transition sessions to an overtime state if allowed.
- Send email notifications (start, near-expiry, completion) to keep users informed without needing to check the UI constantly.
- Provide an administrative interface for IT to resolve edge cases quickly (stuck sessions, no-shows, manual overrides).

Core goals: fairness (first-in / first-out queue), transparency (live status of each charger), and gentle enforcement (overtime handling + notifications).

## How Queue & Charger Management Works

1. A user joins the queue (or is placed directly onto a charger by an admin override).
2. The system maintains an ordered queue and a set of charger slots (A–H mapped internally to numeric IDs 1–8).
3. When a charger becomes free, the first eligible queue entry is promoted into a charging session with a start time and duration.
4. A timer service tracks each active session in memory and broadcasts real-time updates via Server-Sent Events (SSE) to all connected clients.
5. When a session's allotted duration expires:
   - If overtime is allowed for that session (normal registered users): the status changes to "overtime" and continues counting past zero (negative time shown as elapsed overtime).
   - If overtime is disallowed (certain admin-created ad‑hoc sessions / synthetic users): the session is auto-completed immediately instead of entering overtime.
6. Completion triggers queue advancement and email notifications (where applicable) and a fresh broadcast of the updated state.

Edge cases (force completion, removal, manual injection of a charging session) are handled through the admin interface to keep automated logic simple and reliable.

## Real-Time Updates (SSE)

- The `/api/events` endpoint provides a unified Server-Sent Events stream.
- Clients subscribe once; they receive initial queue + charger state, followed by incremental events (queue updates, charging start, overtime, completion, etc.).
- This avoids polling and keeps the UI responsive even with multiple simultaneous viewers.

## Admin Route & Access

- An internal admin page exists at `/admin`.
- IT holds the administrative password (stored server-side via `ADMIN_PASSWORD`).
- Admin capabilities include: clearing the queue, removing specific entries, forcing completion of an active/overtime session, and adding a charging session directly to a charger (skipping the queue) with custom duration and optional user identity.
- If a session is added for an unregistered / synthetic user, it will not enter overtime (auto-completes when time ends) to prevent stale occupation.
- Anyone requiring admin access must request the password from Credo IT. Do not hard-code or distribute the password outside approved channels.

## Tech Stack / Documentation:

- **Styling/css**: tailwind
- **Database/auth**: supabase - github login with it-system@credosemi.com
- **Email Notifications**: SES - account info belongs to IT
- **Frontend Framework**: React/Next.js
- **APIs**: REST and SSE

## Important Note for Supabase:

If no calls are made to the Supabase API in a week, the project will be paused and needs to be reset.

Maintainers must log into supabase through the github (credentials belong to IT) and complete this if it were to occurr.

## Future Improvements and Recconmendations:

- The company who supplies the chargers: Chargepoint, may have a private API key for the chargers, which would enhance monitoring accuracy and user experience. If anyone recovers this API key from charge point, and wishes to implement it into the software, please do so.
- Certain edge cases have not been covered and testing for this site is limited. If able, future employees are more than welcome to contribute to this REPO to fix potential pain points while also contibuting testing.
- Persist the current in-memory overtime allow/deny flags to the database for resilience across server restarts.
- Add role-based authentication instead of password-only admin access.
- Introduce automated integration tests for queue advancement, overtime transition, and failure scenarios.

## Development: Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
