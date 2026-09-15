# AISSA Quiz Platform — README

**All Island School Science Association (AISSA) Online Quiz Engine**

A full-stack Next.js + Supabase platform for A/L science students (Bio Science & Maths streams) to take live online MCQs with real-time scoring, school-level leaderboards, and a centralized Question Bank managed by admins.

---

## Table of Contents

1. [Features Overview](#features-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Environment Setup](#environment-setup)
5. [Database Schema](#database-schema)
6. [Authentication Flow](#authentication-flow)
7. [User Roles & Access Control](#user-roles--access-control)
8. [Key Features Deep Dive](#key-features-deep-dive)
9. [API & RPC Functions](#api--rpc-functions)
10. [Running the Project](#running-the-project)
11. [Deployment](#deployment)
12. [Troubleshooting](#troubleshooting)

---

## Features Overview

### Student Features
- **Registration & Login** — Sri Lankan school selection, AISSA Member ID, stream selection
- **Live Quizzes** — Timed MCQ exams with auto-submit on timeout
- **Question Navigation Palette** — Jump to any question, visual indicator for answered/unanswered
- **Instant Scoring** — Automatic score calculation on submission
- **Real-time Leaderboard** — Per-quiz live ranking (top 10)
- **Island-wide Rankings** — School-level and individual-level leaderboards
- **Past Performance History** — Table view of all completed quizzes with scores and time spent

### Admin Features
- **Central Question Bank** — Create, edit, delete MCQs with support for 4 or 5 options
- **Question Selection Modal** — Pick up to 20 questions from the bank when building a quiz
- **Quiz Scheduler** — Schedule live quizzes with duration, subject, stream, and date
- **Performance Analytics** — View all student attempts, filter by quiz/search, export to CSV
- **Admin Control Center** — Dashboard with stats (total questions, students, schools, upcoming quizzes)
- **Question Inline Editor** — Full question editing with image URL preview and explanation

### Security Features
- **Admin Access Code** — Server-side bcrypt-verified code required at registration/login
- **Session-Based Admin Verification** — `sessionStorage` flag cleared on tab close, re-checked by `AdminGuard`
- **Row-Level Security (RLS)** — Supabase policies enforce per-user data access
- **Auto Profile Creation** — `handle_new_user` trigger creates profile rows server-side (no client race conditions)
- **Cookie-Based Session** — `@supabase/ssr` allows server-side session checks via middleware

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, React 19) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Icons | Lucide React |
| Backend | Supabase (Postgres + Auth + Realtime + RLS) |
| Auth | Supabase Auth (`@supabase/ssr`) |
| Fonts | Geist Sans + Geist Mono |

---

## Project Structure

```
aissa-quiz-platform/
├── app/
│   ├── layout.tsx                          # Root layout (fonts, metadata)
│   ├── globals.css                         # Tailwind + global styles
│   ├── page.tsx                            # Home page (public landing)
│   ├── auth/
│   │   ├── login/page.tsx                  # Student/Admin login (2-step admin code)
│   │   └── register/page.tsx               # Student registration
│   ├── student/
│   │   ├── dashboard/page.tsx              # Student dashboard (live quizzes, stats, history)
│   │   ├── quiz/[id]/page.tsx              # Quiz taking interface
│   │   └── leaderboard/page.tsx            # Island-wide leaderboards (school + individual)
│   └── admin/
│       ├── layout.tsx                      # Admin sidebar layout
│       ├── dashboard/page.tsx              # Admin control center (stats overview)
│       ├── questions/page.tsx              # Central Question Bank management
│       ├── quizzes/page.tsx                # Quiz scheduler / list
│       ├── register/page.tsx               # Admin registration (requires access code)
│       ├── performance/page.tsx            # Student performance analytics + CSV export
│       └── quizzes/[id]/questions/page.tsx # Manage questions in a specific quiz
├── components/
│   ├── QuestionEntryForm.tsx               # Reusable MCQ entry form (bank/locked modes)
│   ├── QuestionEditModal.tsx               # Modal for editing existing questions
│   ├── QuestionBankSelectorModal.tsx       # Modal to pick questions from bank (max 20)
│   ├── RealtimeLeaderboard.tsx             # Live per-quiz leaderboard (Supabase Realtime)
│   └── AdminGuard.tsx                      # Wrapper that enforces admin access
├── lib/
│   ├── supabaseClient.ts                   # Browser Supabase client (createBrowserClient)
│   └── supabase/
│       └── server.ts                       # Server-side Supabase factory (cookies)
├── middleware.ts                           # Refreshes Supabase session on every request
├── .env.local                              # Environment variables (not committed)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Environment Setup

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

> ⚠️ Never commit `.env.local` to version control. The anon key is safe to expose to the browser (RLS enforces security), but never expose the `service_role` key.

---

## Database Schema

### Core Tables

#### `profiles`
Extended user data, auto-created via `handle_new_user` trigger.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | References `auth.users(id)` |
| `full_name` | text | |
| `address` | text | |
| `district` | text | Sri Lankan district |
| `school` | text | |
| `stream` | text | Bio Science / Physical Science / etc. |
| `index_number` | text | School index number |
| `ais_id` | text | AISSA Member ID |
| `is_admin` | boolean | Default `false` |

#### `quizzes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `title` | text | |
| `subject` | text | Physics / Chemistry / Biology |
| `stream` | text | |
| `duration_minutes` | int | Default 30 |
| `total_questions` | int | Synced when questions change |
| `is_live` | boolean | |
| `scheduled_at` | timestamptz | |
| `created_at` | timestamptz | |

#### `questions`
Central Question Bank. Questions can be linked to quizzes via `quiz_questions` (many-to-many) or directly via `quiz_id` (legacy).

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `quiz_id` | uuid | Legacy direct link (nullable) |
| `subject` | text | |
| `stream` | text | |
| `topic` | text | Optional |
| `question_text` | text | |
| `image_url` | text | Optional diagram |
| `option_1` ... `option_5` | text | `option_5` nullable |
| `correct_option` | int | 0–4 |
| `explanation` | text | Optional |
| `created_at` | timestamptz | |

#### `quiz_questions` (junction table)
| Column | Type | Notes |
|--------|------|-------|
| `quiz_id` | uuid (FK) | |
| `question_id` | uuid (FK) | |
| `order_index` | int | Display order |

#### `quiz_results`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid (PK) | |
| `student_id` | uuid (FK) | References `profiles(id)` |
| `quiz_id` | uuid (FK) | |
| `score` | int | |
| `total_marks` | int | |
| `time_spent_seconds` | int | |
| `submitted_at` | timestamptz | |

### Triggers & Functions
- `handle_new_user()` — Trigger on `auth.users` insert, creates `profiles` row from user metadata
- `verify_admin_code(p_code text)` — RPC, checks code against bcrypt hash
- `claim_admin(p_code text)` — RPC, sets `is_admin = true` if code is valid
- `get_student_stats(p_student_id uuid)` — RPC, returns quizzes_completed / average_score / island_rank
- `get_school_leaderboard(p_limit int)` — RPC, school-level rankings
- `get_individual_leaderboard(p_limit int)` — RPC, individual rankings

---

## Authentication Flow

### Student Registration (`/auth/register`)
1. User fills form (name, email, address, district, school, stream, index, AIS ID, password)
2. `supabase.auth.signUp()` is called with all profile data as `options.data`
3. The `handle_new_user` trigger fires server-side and inserts the `profiles` row
4. If email confirmation is enabled, user sees a "check your email" message
5. Otherwise, redirected to `/student/dashboard`

> **Important:** The client deliberately does **not** call `.from("profiles").insert()` — doing so would race the trigger and risk duplicate-key errors.

### Student/Admin Login (`/auth/login`)
1. `signInWithPassword()` authenticates
2. Profile lookup via `.maybeSingle()` (returns `null` instead of throwing if missing)
3. If no profile row → sign out + error (handles orphaned auth users)
4. If `is_admin = true` → step 2: prompt for Admin Access Code
5. Code verified server-side via `verify_admin_code` RPC
6. On success, `sessionStorage.setItem("aissa_admin_verified", "true")` and redirect to `/admin/quizzes`

### Admin Registration (`/admin/register`)
1. Same signup flow as student, but with a required Admin Access Code field
2. After signup (and session exists), `claim_admin(p_code)` RPC is called
3. If code valid → `is_admin = true`, session marked verified, redirect to admin
4. If code invalid → account exists but stays non-admin

---

## User Roles & Access Control

| Role | Detection | Access |
|------|-----------|--------|
| **Anonymous** | No session | Home, login, register, public leaderboard |
| **Student** | Session + `is_admin = false` | Student dashboard, quizzes, own history |
| **Admin** | Session + `is_admin = true` + `sessionStorage` verified | All admin pages + student pages |

### AdminGuard (`components/AdminGuard.tsx`)
Wraps admin pages and enforces **two** checks:
1. `profiles.is_admin === true` (DB check)
2. `sessionStorage.getItem("aissa_admin_verified") === "true"` (session check)

Since `sessionStorage` clears on tab/browser close, the admin code is required again on each new session — not just the first time.

### Row-Level Security (RLS)
- `profiles`: users can view/update their own row only
- `quiz_results`: users can insert/view their own results
- `questions`, `quizzes`, `quiz_questions`: admins can do anything; students can only read
- Leaderboard RPCs (`get_school_leaderboard`, `get_individual_leaderboard`) are accessible to everyone

---

## Key Features Deep Dive

### 1. Question Bank Selector (`QuestionBankSelectorModal.tsx`)
- Filters: search text, subject, stream, topic
- Server-side query filtered by subject/stream; client-side search on text/topic
- Hard cap of **20 questions per quiz**
- "Select All Shown" button respects remaining capacity
- Visual indicator: selected, disabled (limit reached), unselected

### 2. Question Entry Form (`QuestionEntryForm.tsx`)
Supports three modes via discriminated union:
- `"standalone"` / `"bank"` — adds to central bank, no quiz link
- `"locked"` — adds to specific quiz, links via `quiz_questions` junction

**5th option is optional** — if left blank, only 4 options are stored, and it can't be marked correct.

### 3. Quiz Taking (`student/quiz/[id]/page.tsx`)
- Loads questions via `quiz_questions` junction table first, falls back to legacy `quiz_id` direct link
- Timer starts from `duration_minutes`, auto-submits on expiry
- Score computed by comparing `selectedAnswers[idx] === correct_option`
- On submit, inserts into `quiz_results` and redirects to leaderboard
- Handles edge cases: no questions, quiz not found, unauthenticated user

### 4. Real-time Leaderboard (`RealtimeLeaderboard.tsx`)
- Fetches top 10 by score (desc), then time spent (asc)
- Subscribes to `postgres_changes` INSERT on `quiz_results` filtered by `quiz_id`
- Re-fetches rankings on new submission
- Cleans up channel on unmount

### 5. Admin Performance Analytics (`admin/performance/page.tsx`)
- Joins `quiz_results` with `profiles` and `quizzes`
- Search across student name, index, school, district
- Filter by quiz
- Color-coded percentage badges (≥75% green, ≥50% blue, ≥35% amber, else red)
- CSV export with proper quoting

---

## API & RPC Functions

### Supabase RPCs Used

| RPC | Purpose |
|-----|---------|
| `verify_admin_code(p_code text)` | Returns `boolean` — does code match the stored bcrypt hash? |
| `claim_admin(p_code text)` | Returns `boolean` — sets `is_admin = true` if code valid |
| `get_student_stats(p_student_id uuid)` | Returns `{ quizzes_completed, average_score, island_rank }` |
| `get_school_leaderboard(p_limit int)` | Returns ranked school list |
| `get_individual_leaderboard(p_limit int)` | Returns ranked student list |

### Direct Supabase Queries

**Client-side (browser client):**
- `supabase.auth.signInWithPassword()`, `signUp()`, `signOut()`, `getUser()`
- `.from("questions").select(...)`, `.insert()`, `.update()`, `.delete()`
- `.from("quiz_questions").select(...)`, `.insert()`, `.delete()`
- `.from("quiz_results").insert()`, `.select(...)`
- `.from("profiles").select(...)`
- `.from("quizzes").select(...)`

---

## Running the Project

### Prerequisites
- Node.js 18+ (Node 20 recommended)
- npm / pnpm / yarn
- A Supabase project with the schema applied

### Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production Build

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

---

## Deployment

### Vercel (Recommended)

1. Push repo to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

### Supabase Setup Checklist

- [ ] Run all SQL migrations (schema, triggers, RPCs)
- [ ] Enable RLS on all tables
- [ ] Add RLS policies for `profiles`, `quiz_results`, `questions`, `quizzes`, `quiz_questions`
- [ ] Create `handle_new_user` trigger on `auth.users`
- [ ] Create `verify_admin_code` and `claim_admin` RPCs with a bcrypt-hashed code
- [ ] Create `get_student_stats`, `get_school_leaderboard`, `get_individual_leaderboard` RPCs
- [ ] Enable Realtime for `quiz_results` table (for live leaderboard)
- [ ] Configure Auth → Email templates and (optionally) email confirmation

---

## Troubleshooting

### "Profile Lookup Error" on login
The user's `profiles` row is missing. This happens if the `handle_new_user` trigger wasn't installed when they signed up, or if they signed up via a different path. Fix: either delete the orphaned `auth.users` row and re-register, or manually insert the missing `profiles` row.

### "Admin Access Code එක වැරදිය"
- Verify the bcrypt hash in the DB matches the code you're entering
- Ensure `verify_admin_code` / `claim_admin` RPCs exist and are callable by `authenticated` role

### Leaderboard shows "N/A"
- The `get_student_stats` / leaderboard RPCs may not exist, or may be returning null for users with no `quiz_results` rows
- Check RPC signatures match what the client calls

### Realtime leaderboard doesn't update
- Ensure Realtime is enabled on `quiz_results` in Supabase dashboard
- Check that the `quiz_id` filter matches exactly (uuid string comparison)

### "Limit reached (20/20)" in selector
By design — max 20 questions per quiz. Unlink existing questions first, or raise `maxLimit` in the component props (and update the `questions.length >= 20` check in `ManageQuizQuestionsPage`).

### Email confirmation stuck
If Supabase email confirmation is on and the user can't find the email:
- Check spam folder
- Verify SMTP settings in Supabase Auth → Email
- For development, disable email confirmation in Auth → Providers → Email

### Session lost after page refresh (admin)
`sessionStorage` clears on tab close (by design). If it's clearing on refresh, check that no code is calling `sessionStorage.clear()` or navigating in a way that creates a new tab/context.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

© All Island School Science Association (AISSA). All rights reserved.

---

## Contact

For admin access codes or platform issues, contact the AISSA committee.

**AISSA Quiz Platform** — Empowering A/L science students across Sri Lanka 🇱🇰