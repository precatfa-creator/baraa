-- Alternate sign-in identifiers on profiles: username and id_code, both globally
-- unique. Login resolves either (plus email) to the user's email server-side.

alter table public.profiles
  add column username text,
  add column id_code text;

-- username: stored lowercased by the app; must contain a letter so an all-digit
-- string is unambiguously an id_code at login. 3–30 chars of [a-z0-9_].
alter table public.profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^(?=.*[a-z])[a-z0-9_]{3,30}$');
create unique index profiles_username_uniq on public.profiles (username) where username is not null;

-- id_code: exactly 6 digits.
alter table public.profiles
  add constraint profiles_id_code_format
  check (id_code is null or id_code ~ '^[0-9]{6}$');
create unique index profiles_id_code_uniq on public.profiles (id_code) where id_code is not null;
