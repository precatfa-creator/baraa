# Authentication

## 1. Provider

Use Supabase Auth.

MVP method:

- Email/password login.

Later:

- User invitations.
- Magic links.
- Phone OTP if needed.
- SSO for enterprise customers if needed.

## 2. User identity

Supabase Auth user id maps to `profiles.id`.

`profiles` stores app-specific data:

- company_id
- pharmacy_id
- full_name
- role
- phone
- is_active

## 3. Login flow

1. User opens `/login`.
2. User enters email/password.
3. Supabase Auth creates session.
4. App loads matching `profiles` row.
5. If profile is inactive or missing, show access error.
6. Redirect user to role-specific dashboard.

## 4. Protected routes

All dashboard routes require:

- active Supabase session
- active profile
- valid role

Recommended protected route groups:

```text
/app/(auth)/login
/app/(dashboard)/dashboard
/app/(dashboard)/items
/app/(dashboard)/requests
/app/(dashboard)/users
/app/(dashboard)/settings
```

## 5. Session handling

- Use Supabase server client for server components/actions.
- Use middleware only for simple route protection.
- Do final permission checks in server actions/database policies.

## 6. Signup policy

MVP recommendation:

- No public signup.
- Admin creates users manually in Supabase or via admin screen.

A tenant-bound profile is created by an admin server action using the service role key. A trigger on `auth.users` cannot create the profile alone because it does not know the target `company_id`/`pharmacy_id`/`role`; the admin action supplies those and inserts the `profiles` row in the same flow that creates the auth user. After creation, the user's `company_id` and `role` are written to JWT claims so RLS can read them (see `docs/DECISIONS/004-rls-strategy.md`).

Future:

- Company admin invites users.
- Invitation token creates auth user and profile.

## 7. Deactivation

Do not delete users by default.

Set:

- `profiles.is_active = false`

This preserves audit history.
