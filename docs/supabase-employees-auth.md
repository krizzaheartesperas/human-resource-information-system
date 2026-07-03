# Supabase login + `employees` table

The app signs in with **Supabase Auth** (`signInWithPassword`) and then loads:

- **`public.employees`** (role, department, job data)
- **`public.profiles`** (preferred personal name/phone data)

Linking rules:

- `employees.user_id` = `auth.users.id` (UUID), **or**
- `employees.auth_user_id` = `auth.users.id` (legacy column name)
- `profiles.user_id` = `auth.users.id`

## What you need in Supabase

1. **Environment** (`.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Link each auth user to a row** in `employees`:
   - Create the user under **Authentication → Users** (or sign up).
   - Copy the user’s **UUID**.
   - Set `employees.user_id` to that UUID for that person’s row.

3. **RLS (Row Level Security)**  
   If SELECT on `employees`/`profiles` is denied, the app will not find the row. Add policies so the logged-in user can read their own rows, for example:

```sql
-- Example: allow users to read only their employee row
create policy "employees_select_own"
on public.employees
for select
to authenticated
using (auth.uid() = user_id);
```

Adjust if your column name differs (`auth_user_id`, etc.).

```sql
-- Example: allow users to read only their profile row
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = user_id);
```

4. **Role / routing**  
   The UI resolves app **Role** in this order:
   1. **`position`** / **`job_title`** when they map to a non-employee role (e.g. “Audit Officer” → `AUDITOR`).  
      This avoids a wrong default like `role` = `EMPLOYEE` overriding the real job title.
   2. Otherwise **`employees.role`** if it matches app roles (`HR_ADMIN`, `AUDITOR`, …).  
      Aliases: `AUDIT_OFFICER`, `COMPLIANCE_OFFICER`, etc. → `AUDITOR`.

   Set **`role`** to `AUDITOR` in the database if you want that to be the source of truth without relying on title text.

## Example employee (demo app alignment)

For **Glen Ramos** (employee / Engineering):

- **Auth**: create user with email **`glenramos@gmail.com`** and your chosen password (e.g. for testing only).
- **`employees`**: `email` = `glenramos@gmail.com`, `department_id` = your Engineering department UUID, `position` = `Junior Software Engineer`, `role` = `EMPLOYEE` (or leave empty), `user_id` = that auth user’s UUID.
- **`profiles`**: `user_id` = same auth UUID, `first_name` = `Glen`, `last_name` = `Ramos`, `phone` = your preferred mobile number.

To add **Current Address** in `profiles`, run:

```sql
alter table public.profiles
add column if not exists current_address varchar;
```

Then fill it for each user (example):

```sql
update public.profiles
set current_address = '22 Shaw Blvd, Mandaluyong City 1552'
where lower(first_name) = 'glen' and lower(last_name) = 'ramos';
```

To add **Birthday** in `profiles`, run:

```sql
alter table public.profiles
add column if not exists birthday date;
```

Then fill it for each user (example):

```sql
update public.profiles
set birthday = '1992-04-15'
where lower(first_name) = 'glen' and lower(last_name) = 'ramos';
```

Passwords are **never** stored in this repo—only in **Supabase Authentication**.

5. **Optional columns** used when present: `first_name`, `last_name`, `phone`, `birthday`, `current_address` (from `profiles`) and `email`, `employee_code`, `employee_number`, `position`, `job_title`, `department_id`, `manager_id`, `profile_photo`, etc. (see `EmployeeRow` / `ProfileRow` in `src/lib/supabase/client.ts`).
