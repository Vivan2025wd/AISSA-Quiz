# AISSA Quiz Platform

<div align="center">

![AISSA Logo Badge](https://img.shields.io/badge/AISSA-Quiz%20Engine-2563EB?style=for-the-badge&logo=academic-pages&logoColor=white)
![Next.js 16](https://img.shields.io/badge/Next.js-16.3.5-black?style=for-the-badge&logo=next.js&logoColor=white)
![React 19](https://img.shields.io/badge/React-19.2.8-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)

**All Island School Science Association (AISSA) Online Examination Platform**

*A modern, cloud-native MCQ testing engine engineered for Sri Lankan Advanced Level (G.C.E. A/L) science students (Biological Science & Physical Science / Maths streams) featuring automated server-side timer submissions, real-time leaderboards, centralized Question Banking, and granular admin controls.*

[Features](#-key-features) • [Architecture](#-architecture--data-flow) • [Tech Stack](#-tech-stack) • [Quick Start](#-quick-start--local-development) • [Master Database Schema](#-complete-master-database-schema) • [Role-Based Access Control](#-authentication--security-model) • [Admin Workflows](#-admin-workflows) • [Troubleshooting](#-troubleshooting--common-issues)

</div>

---

## 📖 Table of Contents

- [🌟 Key Features](#-key-features)
- [🏗 Architecture & Data Flow](#-architecture--data-flow)
- [💻 Tech Stack](#-tech-stack)
- [📁 Comprehensive Project Structure](#-comprehensive-project-structure)
- [⚡ Quick Start & Local Development](#-quick-start--local-development)
- [🗄 Complete Master Database Schema](#-complete-master-database-schema)
- [🔐 Authentication & Security Model](#-authentication--security-model)
- [📝 Question Bank & Quiz Mechanics](#-question-bank--quiz-mechanics)
- [📊 Leaderboard & Analytics System](#-leaderboard--analytics-system)
- [🚀 Production Deployment Guide](#-production-deployment-guide)
- [🛠 Troubleshooting & Common Issues](#-troubleshooting--common-issues)

---

## 🌟 Key Features

### 🎓 For Students
- **Streamlined Onboarding**: Registration tailored to Sri Lankan schools, administrative districts, examination index numbers, and AISSA membership identifiers (`ais_id`).
- **Timed Live Examination Engine**:
  - Auto-starts based on duration configured by admins.
  - Interactive Question Palette with live state indicators (Answered, Unanswered, Active Question).
  - Support for question diagram illustrations and LaTeX / mathematical formulas.
  - Automatic force-submit when the countdown timer hits zero.
- **Instantaneous Grading**: Scores are computed and recorded atomically upon submission.
- **Competitive Rankings**:
  - **Live Per-Quiz Ranking**: Instant feedback on top 10 finishers with time-spent tie-breakers.
  - **Island-Wide School Leaderboard**: Aggregates participating schools by average score and participant count.
  - **Island-Wide Individual Leaderboard**: Displays top performers across all schools.
- **Student Performance History**: Personal history portal displaying scores, marks percentages, and time logs.

### 🛡 For Administrators
- **Independent Central Question Bank (`/admin/questions`)**:
  - Centralized repository of MCQs categorized by Subject (*Physics, Chemistry, Biology*) and Stream.
  - Flexible Option Support: Supports both 4-choice and 5-choice MCQs.
  - Inline Question Editor modal (`QuestionEditModal`) allowing quick revisions to questions, image diagrams, and detailed step-by-step explanations.
- **Quiz Scheduler & Question Selector (`/admin/quizzes`)**:
  - Schedule Sunday live quizzes with title, stream, duration, and scheduled time.
  - **Question Bank Selector Modal**: Browse and select up to **20 questions** directly from the bank using filters and live capacity counters (`Selected: X / 20`).
  - Strict database-enforced cap preventing quizzes from exceeding 20 questions.
- **Student Performance Analytics (`/admin/performance`)**:
  - Search and filter all submissions by student name, school, district, or specific quiz.
  - Color-coded percentage indicators for performance distribution.
  - Single-click CSV export with complete student metadata.
- **Multi-Factor Admin Protection**:
  - Bcrypt-hashed admin secret code check.
  - Session-scoped verification (`sessionStorage`) that expires when the browser closes.
  - Next.js server-side Edge Middleware route protection.

---

## 🏗 Architecture & Data Flow

```mermaid
graph TD
    User([Student / Admin]) -->|Browser Request| Middleware[Next.js Middleware (Edge)]
    Middleware -->|Session Valid / Protected Route Check| Pages[Next.js App Router]
    
    subgraph Frontend [Client & SSR Components]
        Pages -->|Student Portal| StdDash[Student Dashboard & Quiz Engine]
        Pages -->|Admin Portal| AdminDash[Admin Control Center & Question Bank]
    end

    subgraph Supabase [Backend as a Service]
        StdDash -->|Auth / Submit Result| SBAuth[Supabase Auth]
        StdDash -->|Realtime Subscription| SBRealtime[Supabase Realtime (WebSocket)]
        AdminDash -->|Manage Quizzes / Bank| SBRest[Supabase PostgREST API]
        
        SBAuth --> Postgres[(PostgreSQL Database)]
        SBRest --> Postgres
        Postgres -->|RLS Policies| Postgres
        Postgres -->|Triggers & Functions| Functions[PL/pgSQL Triggers & Security Definer RPCs]
    end
```

---

## 💻 Tech Stack

| Domain | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router) | `16.3.5` (Turbopack) | Server-side rendering, API routing & Edge Middleware |
| **UI Library** | React | `19.2.8` | Component state, hooks, and lifecycle management |
| **Language** | TypeScript | `^5.0.0` | End-to-end static typing & strict data contracts |
| **Styling** | Tailwind CSS | `^4.0.0` | Modern utility-first responsive styling |
| **Icons** | Lucide React | `^1.45.0` | Minimalist icons for UI navigation |
| **Database** | PostgreSQL | `15+` | Relational storage, triggers, checks, and foreign keys |
| **Auth & Client** | `@supabase/ssr` & `@supabase/supabase-js` | `^0.12.7` / `^2.116.0` | Cookie-based session handling and PostgREST client |
| **Security** | `pgcrypto` (Postgres Extension) | Extension | Server-side bcrypt hashing for admin verification |

---

## 📁 Comprehensive Project Structure

```
AISSA-Quiz/
├── app/
│   ├── layout.tsx                     # Root HTML wrapper, metadata, and font providers
│   ├── globals.css                    # Tailwind CSS imports and base styling rules
│   ├── page.tsx                       # Public landing page with portal routing
│   ├── auth/
│   │   ├── login/page.tsx             # Universal login (2-step validation for admins)
│   │   └── register/page.tsx          # Student account registration with school info
│   ├── student/
│   │   ├── dashboard/page.tsx         # Student dashboard (live quizzes, stats, past scores)
│   │   ├── quiz/[id]/page.tsx         # Active timed MCQ exam engine with auto-submit
│   │   └── leaderboard/page.tsx       # Island-wide leaderboards (school and individual)
│   └── admin/
│       ├── layout.tsx                 # Admin dashboard layout with sidebar navigation
│       ├── AdminGuard.tsx             # Client-side route guard checking DB is_admin & session
│       ├── dashboard/page.tsx         # Overview metrics (quizzes, students, questions)
│       ├── questions/page.tsx         # Central Question Bank manager (add, edit, search)
│       ├── quizzes/page.tsx           # Quiz scheduler, question picker modal, and status toggles
│       ├── quizzes/[id]/questions/    # Per-quiz question manager (pick from bank, unlink)
│       │   └── page.tsx
│       ├── performance/page.tsx       # Student performance table, filters, and CSV exporter
│       └── register/page.tsx          # Admin registration gate requiring the secret code
├── components/
│   ├── QuestionBankSelectorModal.tsx  # Modal to search & pick up to 20 questions from Bank
│   ├── QuestionEditModal.tsx          # Modal to update existing question details & diagram
│   ├── QuestionEntryForm.tsx          # MCQ entry form (supports Standalone Bank & Quiz modes)
│   └── RealtimeLeaderboard.tsx        # Live quiz leaderboard with Supabase Realtime channel
├── lib/
│   ├── supabaseClient.ts              # Browser Supabase client (cookie-based session via ssr)
│   └── supabase/
│       └── server.ts                  # Server-side Supabase client factory for Server Components
├── middleware.ts                      # Edge middleware for route protection & session refresh
├── 011_question_bank_and_limit.sql    # Migration script for question bank separation & limit
├── package.json                       # Project dependencies and npm scripts
├── tsconfig.json                      # TypeScript configuration
└── next.config.ts                     # Next.js configuration
```

---

## ⚡ Quick Start & Local Development

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+ recommended.
- **Package Manager**: `npm` (v9+), `pnpm`, or `yarn`.
- **Supabase Account**: A free Supabase project.

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/YourUsername/AISSA-Quiz.git
cd AISSA-Quiz

npm install
```

### 3. Setup Environment Variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
> [!IMPORTANT]
> Both keys are required. You can find them under **Project Settings → API** in your Supabase dashboard.

### 4. Execute the Database Schema
Open the **SQL Editor** in your Supabase dashboard and run the [Complete Master Database Schema](#-complete-master-database-schema) provided below.

### 5. Configure Your Admin Secret Code
Run this SQL statement once in your Supabase SQL Editor to set your platform's secret admin code:
```sql
insert into public.admin_secrets (id, code_hash)
values (true, crypt('YOUR-SECRET-ADMIN-CODE', gen_salt('bf')))
on conflict (id) do update set code_hash = excluded.code_hash;
```

### 6. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🗄 Complete Master Database Schema

Copy and execute the entire idempotent SQL script below in your **Supabase SQL Editor**:

```sql
-- ============================================================
-- AISSA Quiz Platform — COMPLETE CONSOLIDATED MASTER SCHEMA
-- Fully idempotent: safe on fresh databases and existing setups.
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- 1. PROFILES TABLE (ශිෂ්‍ය විස්තර)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null default 'Student',
  address text,
  district text,
  school text not null default 'Not Specified',
  index_number text,
  stream text not null default 'Bio Science',
  ais_id text,
  is_admin boolean not null default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Backfill columns for older profile schemas
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists district text;
alter table public.profiles add column if not exists index_number text;
alter table public.profiles add column if not exists ais_id text;
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Unique constraint on ais_id
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_ais_id_key'
  ) then
    alter table public.profiles add constraint profiles_ais_id_key unique (ais_id);
  end if;
end $$;

-- Prevent non-admins from self-promoting via client inserts/updates
revoke insert (is_admin) on public.profiles from authenticated, anon;
revoke update (is_admin) on public.profiles from authenticated, anon;

-- Profile Creation Trigger Function (upsert with fallbacks)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    address,
    district,
    school,
    index_number,
    stream,
    ais_id,
    is_admin,
    created_at
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), 'Student'),
    nullif(new.raw_user_meta_data->>'address', ''),
    nullif(new.raw_user_meta_data->>'district', ''),
    coalesce(nullif(new.raw_user_meta_data->>'school', ''), 'Not Specified'),
    nullif(new.raw_user_meta_data->>'index_number', ''),
    coalesce(nullif(new.raw_user_meta_data->>'stream', ''), 'Bio Science'),
    nullif(new.raw_user_meta_data->>'ais_id', ''),
    false,
    now()
  )
  on conflict (id) do update set
    full_name    = excluded.full_name,
    address      = excluded.address,
    district     = excluded.district,
    school       = excluded.school,
    index_number = excluded.index_number,
    stream       = excluded.stream,
    ais_id       = excluded.ais_id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================
-- 2. ADMIN SECRETS TABLE (Singleton)
-- ============================================================
create table if not exists public.admin_secrets (
  id boolean primary key default true,
  code_hash text not null,
  constraint admin_secrets_singleton check (id)
);

alter table public.admin_secrets enable row level security;
-- Intentionally no RLS policies: PostgREST clients can never query this table directly.

-- ============================================================
-- 3. QUIZZES TABLE (Quizzes විස්තර)
-- ============================================================
create table if not exists public.quizzes (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  subject text not null,
  stream text not null,
  scheduled_at timestamp with time zone,
  duration_minutes integer not null,
  total_questions integer not null default 0,
  is_live boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Backfill columns for older quizzes schemas
alter table public.quizzes add column if not exists description text;
alter table public.quizzes add column if not exists scheduled_at timestamp with time zone;
alter table public.quizzes add column if not exists is_live boolean default false;
alter table public.quizzes alter column total_questions set default 0;

-- ============================================================
-- 4. QUESTIONS TABLE (Central Question Bank)
-- Categorized by Subject & Stream; quiz_id is optional
-- ============================================================
create table if not exists public.questions (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid references public.quizzes(id) on delete set null,
  subject text not null default 'Physics',
  stream text not null default 'Bio Science',
  question_text text not null,
  image_url text,
  topic text,
  option_1 text not null,
  option_2 text not null,
  option_3 text not null,
  option_4 text not null,
  option_5 text,
  correct_option integer not null,
  explanation text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Ensure columns exist if migrating an older database
alter table public.questions add column if not exists subject text default 'Physics';
alter table public.questions add column if not exists stream text default 'Bio Science';
alter table public.questions add column if not exists topic text;
alter table public.questions alter column option_5 drop not null;
alter table public.questions alter column quiz_id drop not null;

-- Backfill subject and stream for existing questions from their quiz
update public.questions q
set subject = qz.subject,
    stream = qz.stream
from public.quizzes qz
where q.quiz_id = qz.id
  and (q.subject is null or q.stream is null);

-- Ensure correct_option validation (option_5 is only required if correct_option = 4)
do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'questions_correct_option_check'
  ) then
    alter table public.questions drop constraint questions_correct_option_check;
  end if;
end $$;

alter table public.questions add constraint questions_correct_option_check check (
  correct_option between 0 and 4
  and (correct_option < 4 or option_5 is not null)
);

-- ============================================================
-- 5. QUIZ_QUESTIONS JUNCTION TABLE (Many-to-Many)
-- Links Quizzes with Questions selected from the Bank
-- ============================================================
create table if not exists public.quiz_questions (
  id uuid default gen_random_uuid() primary key,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  question_id uuid references public.questions(id) on delete cascade not null,
  order_index integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint quiz_questions_unique unique (quiz_id, question_id)
);

-- Migrate existing direct questions into quiz_questions
insert into public.quiz_questions (quiz_id, question_id)
select quiz_id, id
from public.questions
where quiz_id is not null
on conflict (quiz_id, question_id) do nothing;

-- ---- Trigger: Enforce 20-Question Limit per Quiz ----
create or replace function public.check_quiz_question_limit()
returns trigger
language plpgsql
as $$
begin
  if (
    select count(*)
    from public.quiz_questions
    where quiz_id = new.quiz_id
  ) >= 20 then
    raise exception 'Quiz question limit exceeded: A quiz cannot have more than 20 questions.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_check_quiz_question_limit on public.quiz_questions;
create trigger trg_check_quiz_question_limit
  before insert on public.quiz_questions
  for each row
  execute function public.check_quiz_question_limit();

-- ---- Trigger: Auto-sync quiz total_questions from quiz_questions ----
create or replace function public.sync_quiz_total_questions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quiz_id uuid;
begin
  if tg_op = 'DELETE' then
    v_quiz_id := old.quiz_id;
  else
    v_quiz_id := new.quiz_id;
  end if;

  update public.quizzes
  set total_questions = (
    select count(*) from public.quiz_questions where quiz_id = v_quiz_id
  )
  where id = v_quiz_id;

  return null;
end;
$$;

drop trigger if exists trg_sync_quiz_total_questions on public.quiz_questions;
create trigger trg_sync_quiz_total_questions
  after insert or update or delete on public.quiz_questions
  for each row
  execute function public.sync_quiz_total_questions();

-- Recount total questions for existing quizzes
update public.quizzes q
set total_questions = (
  select count(*) from public.quiz_questions qq where qq.quiz_id = q.id
);

-- ============================================================
-- 6. QUIZ RESULTS TABLE (ලකුණු සහ කාලය)
-- ============================================================
create table if not exists public.quiz_results (
  id uuid default gen_random_uuid() primary key,
  student_id uuid references public.profiles(id) on delete cascade not null,
  quiz_id uuid references public.quizzes(id) on delete cascade not null,
  score integer not null,
  total_marks integer not null,
  time_spent_seconds integer not null,
  submitted_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Deduplicate older attempts before adding unique constraint
delete from public.quiz_results
where id in (
  select id
  from (
    select id,
           row_number() over (
             partition by student_id, quiz_id
             order by submitted_at desc, id desc
           ) as row_num
    from public.quiz_results
  ) duplicates
  where duplicates.row_num > 1
);

-- Prevent duplicate quiz attempts per student
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'quiz_results_student_quiz_unique'
  ) then
    alter table public.quiz_results
      add constraint quiz_results_student_quiz_unique unique (student_id, quiz_id);
  end if;
end $$;

-- Enable Realtime for quiz_results
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'quiz_results'
  ) then
    alter publication supabase_realtime add table quiz_results;
  end if;
end $$;

-- ============================================================
-- 7. SECURITY & ADMIN FUNCTIONS
-- ============================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

-- Claim admin via secret code
create or replace function public.claim_admin(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return false;
  end if;

  select code_hash into v_hash from public.admin_secrets limit 1;

  if v_hash is null or crypt(p_code, v_hash) <> v_hash then
    return false;
  end if;

  update public.profiles set is_admin = true where id = v_uid;
  return true;
end;
$$;

-- Verify admin code on login
create or replace function public.verify_admin_code(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_hash text;
  v_uid uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_uid is null then
    return false;
  end if;

  select is_admin into v_is_admin from public.profiles where id = v_uid;

  if coalesce(v_is_admin, false) = false then
    return false;
  end if;

  select code_hash into v_hash from public.admin_secrets limit 1;

  if v_hash is null then
    return false;
  end if;

  return crypt(p_code, v_hash) = v_hash;
end;
$$;

-- Student stats RPC (secured to caller auth.uid())
create or replace function public.get_student_stats(p_student_id uuid)
returns table (
  quizzes_completed integer,
  average_score numeric,
  island_rank integer
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if p_student_id is distinct from auth.uid() then
    raise exception 'Unauthorized stats access';
  end if;

  return query
  with per_student as (
    select
      qr.student_id,
      count(*)::integer as cnt,
      avg(qr.score::numeric / nullif(qr.total_marks, 0) * 100) as avg_pct
    from public.quiz_results qr
    group by qr.student_id
  ),
  ranked as (
    select
      ps.student_id,
      ps.cnt,
      ps.avg_pct,
      rank() over (order by ps.avg_pct desc nulls last)::integer as rnk
    from per_student ps
  )
  select
    coalesce(r.cnt, 0),
    round(r.avg_pct, 1),
    r.rnk
  from ranked r
  where r.student_id = p_student_id

  union all

  select 0, null, null
  where not exists (
    select 1 from ranked where student_id = p_student_id
  )
  limit 1;
end;
$$;

-- Individual island-wide leaderboard
create or replace function public.get_individual_leaderboard(p_limit integer default 50)
returns table (
  rank integer,
  student_id uuid,
  full_name text,
  school text,
  quizzes_completed integer,
  average_score numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with per_student as (
    select
      qr.student_id,
      count(*)::integer as cnt,
      avg(qr.score::numeric / nullif(qr.total_marks, 0) * 100) as avg_pct
    from public.quiz_results qr
    group by qr.student_id
  )
  select
    rank() over (order by ps.avg_pct desc nulls last, ps.cnt desc)::integer as rank,
    ps.student_id,
    p.full_name,
    p.school,
    ps.cnt,
    round(ps.avg_pct, 1)
  from per_student ps
  join public.profiles p on p.id = ps.student_id
  order by ps.avg_pct desc nulls last, ps.cnt desc
  limit p_limit;
$$;

-- School-level leaderboard
create or replace function public.get_school_leaderboard(p_limit integer default 50)
returns table (
  rank integer,
  school text,
  students_count integer,
  total_quizzes integer,
  avg_score numeric
)
language sql
security definer
set search_path = public
stable
as $$
  with per_result as (
    select
      qr.student_id,
      qr.score,
      qr.total_marks,
      p.school
    from public.quiz_results qr
    join public.profiles p on p.id = qr.student_id
  ),
  per_school as (
    select
      school,
      count(distinct student_id)::integer as students_count,
      count(*)::integer as total_quizzes,
      avg(score::numeric / nullif(total_marks, 0) * 100) as avg_pct
    from per_result
    group by school
  )
  select
    rank() over (order by avg_pct desc nulls last)::integer as rank,
    school,
    students_count,
    total_quizzes,
    round(avg_pct, 1)
  from per_school
  order by avg_pct desc nulls last
  limit p_limit;
$$;

-- Permissions
grant execute on function public.claim_admin(text) to authenticated;
grant execute on function public.verify_admin_code(text) to authenticated;
grant execute on function public.get_student_stats(uuid) to authenticated;
grant execute on function public.get_individual_leaderboard(integer) to authenticated;
grant execute on function public.get_school_leaderboard(integer) to authenticated;

-- ============================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================
alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_results enable row level security;

-- ---- profiles ----
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on public.profiles;
create policy "Admins can view all profiles" on public.profiles
  for select using (public.is_admin());

-- ---- quizzes ----
drop policy if exists "Authenticated users can view quizzes" on public.quizzes;
create policy "Authenticated users can view quizzes" on public.quizzes
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can manage quizzes" on public.quizzes;
create policy "Admins can manage quizzes" on public.quizzes
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- questions (Question Bank) ----
drop policy if exists "Authenticated users can view questions" on public.questions;
create policy "Authenticated users can view questions" on public.questions
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can manage questions" on public.questions;
create policy "Admins can manage questions" on public.questions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- quiz_questions (Junction Links) ----
drop policy if exists "Authenticated users can view quiz_questions" on public.quiz_questions;
create policy "Authenticated users can view quiz_questions" on public.quiz_questions
  for select using (auth.role() = 'authenticated');

drop policy if exists "Admins can manage quiz_questions" on public.quiz_questions;
create policy "Admins can manage quiz_questions" on public.quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- ---- quiz_results ----
drop policy if exists "Users can view own results" on public.quiz_results;
create policy "Users can view own results" on public.quiz_results
  for select using (auth.uid() = student_id);

drop policy if exists "Users can insert own results" on public.quiz_results;
create policy "Users can insert own results" on public.quiz_results
  for insert with check (auth.uid() = student_id);

drop policy if exists "Admins can view all results" on public.quiz_results;
create policy "Admins can view all results" on public.quiz_results
  for select using (public.is_admin());

-- ============================================================
-- 9. Reload Schema Cache
-- ============================================================
notify pgrst, 'reload schema';
```

---

## 🔐 Authentication & Security Model

The platform enforces a layered defense architecture:

### 1. Registration Flow
- **Students (`/auth/register`)**:
  - Submits metadata via `supabase.auth.signUp(email, password, { data: { ... } })`.
  - The PostgreSQL `handle_new_user` trigger automatically and atomically creates the user's `profiles` record in the database.
  - The client **never** inserts into `profiles` directly, preventing race conditions.
- **Admins (`/admin/register`)**:
  - Requires the secret Admin Access Code.
  - Upon successful signup, calls `supabase.rpc("claim_admin", { p_code })`.
  - The server checks the input against the bcrypt hash in `public.admin_secrets`. Only a match promotes the account to `is_admin = true`.

### 2. Login Flow (`/auth/login`)
- **Step 1**: Standard email + password validation via `supabase.auth.signInWithPassword()`.
- **Step 2 (Admins Only)**: If `profiles.is_admin === true`, a second verification prompt requests the Admin Access Code.
  - Validated server-side via `verify_admin_code(p_code)`.
  - Upon match, sets `sessionStorage.setItem("aissa_admin_verified", "true")`.
  - Since `sessionStorage` clears on tab/browser close, admins must re-authenticate on every new session.

### 3. Route Protection
- **Edge Middleware (`middleware.ts`)**:
  - Intercepts requests matching `/admin/:path*`.
  - Reads session cookies using `@supabase/ssr`.
  - If unauthenticated, redirects to `/auth/login`.
  - If authenticated but not admin, redirects to `/student/dashboard`.
- **AdminGuard Component (`app/admin/AdminGuard.tsx`)**:
  - Double checks both database `is_admin === true` and `sessionStorage.getItem("aissa_admin_verified") === "true"`.

---

## 📝 Question Bank & Quiz Mechanics

### Central Question Bank (`/admin/questions`)
1. **Separation of Concerns**: Questions are authored independently of quizzes. They are tagged with `subject` (*Physics, Chemistry, Biology*), `stream`, and an optional `topic` (*e.g., Thermal Physics*).
2. **4 or 5 Options Support**:
   - Options 1 through 4 are mandatory.
   - Option 5 is optional. If left blank, the system stores `null`, and the check constraint ensures option 5 cannot be chosen as the answer key.
3. **Diagrams & Solutions**: Supports direct image URLs for circuit diagrams, chemical structures, and physics graphs, along with comprehensive solution explanations.

### Quiz Creation & Limit Enforcement (`/admin/quizzes`)
1. **Scheduling**: Set title, stream, duration in minutes, and scheduled UTC timestamp.
2. **Selecting from the Bank**:
   - The **Question Bank Selector Modal** lets admins filter questions by Subject, Stream, and Topic.
   - Shows live counts (`Selected: X / 20`).
   - Disables further selection once 20 questions are selected.
3. **Database-Level Guard**: The `check_quiz_question_limit` trigger acts as a hard stop, preventing any quiz from ever exceeding 20 questions.

### Active Quiz Taking (`/student/quiz/[id]`)
1. **Junction Table Hydration**: The quiz loads questions through `quiz_questions`, falling back to legacy `quiz_id` mapping if necessary.
2. **Anti-Cheat Timer**:
   - Client countdown timer runs continuously.
   - Automatically invokes `finishQuiz()` and forces submission when time reaches zero.
3. **Upsert Submissions**: Results are sent via `.upsert([...], { onConflict: "student_id,quiz_id" })` to cleanly update attempts without crashing on unique key violations.

---

## 📊 Leaderboard & Analytics System

### 1. Real-time Quiz Leaderboard (`RealtimeLeaderboard.tsx`)
Subscribes to PostgreSQL changes via WebSockets:
```typescript
supabase
  .channel("realtime-quiz-results")
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "quiz_results",
    filter: `quiz_id=eq.${quizId}`,
  }, () => {
    // Automatically re-fetches top 10 rankings on new submission
  });
```

### 2. Island-Wide Rankings (`/student/leaderboard`)
Powered by optimized `SECURITY DEFINER` SQL functions:
- **`get_individual_leaderboard(p_limit)`**: Computes student average score percentages across all taken quizzes with quiz count tie-breakers.
- **`get_school_leaderboard(p_limit)`**: Aggregates distinct student participants, total exams taken, and school-wide average percentages.

### 3. Admin Student Performance Analytics (`/admin/performance`)
- Displays all historical attempts joined with student profiles and quiz titles.
- Multi-field search (Name, Index Number, School, District).
- Client-side CSV download formatted with RFC 4180 compliant escaping.

---

## 🚀 Production Deployment Guide

### Vercel Deployment

1. Push your repository to GitHub:
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```
2. In the [Vercel Dashboard](https://vercel.com/), click **Add New → Project** and import `AISSA-Quiz`.
3. Configure the Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Click **Deploy**.

### Production Supabase Checklist
- [x] Run the **Consolidated Master Schema** SQL script.
- [x] Set your secret admin code using `insert into public.admin_secrets ...`.
- [x] Verify that Realtime is turned on for `public.quiz_results` under **Database → Publications → supabase_realtime**.
- [x] Configure your SMTP provider in **Authentication → Email Settings** (or disable email confirmation during staging testing).

---

## 🛠 Troubleshooting & Common Issues

| Error / Symptom | Root Cause | Solution |
|---|---|---|
| `syntax error at or near " "` (42601) | Non-breaking spaces (`\u00A0`) copied into SQL editor | Re-run the clean Master Schema above. It uses standard ASCII spaces. |
| `Key (student_id, quiz_id) is duplicated` (23505) | Existing duplicate test submissions before applying unique index | The schema script automatically deduplicates older attempts (keeping the latest). |
| `violates foreign key constraint "quiz_results_student_id_fkey"` (23503) | The logged-in user has an `auth.users` row but no `profiles` row | Ensure the `on_auth_user_created` trigger is enabled, or manually insert a missing profile row. |
| `Quiz question limit exceeded` | Attempted to link more than 20 questions to a single quiz | Expected behavior. A quiz is capped at 20 questions. Unlink existing questions first. |
| Admin session lost on tab close | `sessionStorage` behavior | Expected behavior. Enter the admin code once per browser session. |
| `error TS5103: Invalid value for '--ignoreDeprecations'` | Outdated TypeScript flag in `tsconfig.json` | Set `"ignoreDeprecations": "5.0"` in `tsconfig.json`. |

---

## 📄 License & Attribution

Developed for the **All Island School Science Association (AISSA)**.  
All rights reserved © 2026. Empowering A/L Science students across Sri Lanka 🇱🇰.