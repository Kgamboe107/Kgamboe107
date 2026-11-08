# Supabase backend (project "Ops Command Desk", ref tatfzakpmpmgaijhwcob)

- `public.profiles`: one row per account. `status` is pending, approved or revoked; `role` is user or admin. New sign-ups are pending. The admin email is set in `handle_new_user()`.
- `approve_user(uuid)` (admin only) returns a 6-digit code. It's stored bcrypt-hashed and expires after 7 days or 5 tries. `redeem_code(text)` approves the caller. `revoke_user(uuid)` removes access.
- `public.records`: per-user synced items, encrypted on the device (AES-256-GCM). Row-level security only lets approved owners in. `updated_at` is set by the server and is used as the sync cursor.
- Storage bucket `vault`: encrypted file contents and large records under `<user id>/…`, with owner-only, approved-only policies.
- Edge function `signup`: creates the login without needing an email link (the account starts as pending).
