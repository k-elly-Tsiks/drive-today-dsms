This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

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

## Password recovery

Password resets are admin-approved and do not send an email. To configure this feature:

1. Apply `supabase/migrations/20261101000000_password_reset_permissions.sql` to the Supabase project.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in the server environment (never expose it with a `NEXT_PUBLIC_` prefix). Keep the existing public Supabase URL and anon key as configured.
3. In **Settings → Account Password Reset**, an administrator selects a learner or instructor and chooses **Allow Password Reset**. This grants one reset for 24 hours; the admin can revoke the grant before it is used.
4. The user selects **Forgot password?** on Login, enters the approved email, chooses **Next**, then enters and confirms a new password. After the password is changed, the user can sign in with the new password. The reset flow does not replace the current browser session; this keeps an administrator signed in when helping multiple users from the same browser.

Because this flow intentionally does not verify ownership of the email address, administrators should confirm the person's identity before granting permission. Reset permissions are held server-side and can only be changed by an authenticated admin.

## Lesson slot booking and cleanup

Apply `supabase/migrations/20261119000000_exclusive_lesson_slots_and_expiry.sql` to the Supabase project. It reserves a slot for one scheduled learner at the database level, makes it available again if that booking is cancelled, and schedules a daily cleanup of past slots that have no booking history. The migration enables the `pg_cron` extension for the scheduled cleanup.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```
drive-today-dsms
├─ AGENTS.md
├─ app
│  ├─ admin
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ expenses
│  │  │  └─ page.tsx
│  │  ├─ instructor
│  │  │  └─ page.tsx
│  │  ├─ layout.tsx
│  │  ├─ learner
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ materials
│  │  │  └─ page.tsx
│  │  ├─ notification
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ payments
│  │  │  └─ page.tsx
│  │  ├─ progress
│  │  │  ├─ page.tsx
│  │  │  └─ types.ts
│  │  ├─ questions
│  │  │  └─ page.tsx
│  │  ├─ reports
│  │  │  └─ page.tsx
│  │  └─ settings
│  │     └─ page.tsx
│  ├─ favicon.ico
│  ├─ globals.css
│  ├─ instructor
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ notifications
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  └─ progress
│  │     └─ page.tsx
│  ├─ layout.tsx
│  ├─ learner
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ materials
│  │  │  └─ page.tsx
│  │  ├─ notification
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ payments
│  │  │  └─ page.tsx
│  │  ├─ practice
│  │  │  └─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  └─ progress
│  │     └─ page.tsx
│  ├─ login
│  │  └─ page.tsx
│  ├─ page.tsx
│  └─ signup
│     └─ page.tsx
├─ CLAUDE.md
├─ eslint.config.mjs
├─ lib
│  └─ supabase
│     ├─ client.ts
│     └─ server.ts
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ pnpm-lock.yaml
├─ postcss.config.mjs
├─ public
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ images
│  │  └─ drivetodaylogo.PNG
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ README.md
└─ tsconfig.json

```
```
drive-today-dsms
├─ AGENTS.md
├─ app
│  ├─ admin
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ expenses
│  │  │  └─ page.tsx
│  │  ├─ instructor
│  │  │  └─ page.tsx
│  │  ├─ layout.tsx
│  │  ├─ learner
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ materials
│  │  │  └─ page.tsx
│  │  ├─ notification
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ payments
│  │  │  └─ page.tsx
│  │  ├─ progress
│  │  │  ├─ page.tsx
│  │  │  └─ types.ts
│  │  ├─ questions
│  │  │  └─ page.tsx
│  │  ├─ reports
│  │  │  └─ page.tsx
│  │  └─ settings
│  │     └─ page.tsx
│  ├─ favicon.ico
│  ├─ globals.css
│  ├─ instructor
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ notifications
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  └─ progress
│  │     └─ page.tsx
│  ├─ layout.tsx
│  ├─ learner
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ materials
│  │  │  └─ page.tsx
│  │  ├─ notification
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ payments
│  │  │  └─ page.tsx
│  │  ├─ practice
│  │  │  └─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  └─ progress
│  │     └─ page.tsx
│  ├─ login
│  │  └─ page.tsx
│  ├─ page.tsx
│  └─ signup
│     └─ page.tsx
├─ CLAUDE.md
├─ eslint.config.mjs
├─ lib
│  └─ supabase
│     ├─ client.ts
│     └─ server.ts
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ pnpm-lock.yaml
├─ postcss.config.mjs
├─ public
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ images
│  │  └─ drivetodaylogo.PNG
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ README.md
└─ tsconfig.json

```
```
drive-today-dsms
├─ AGENTS.md
├─ app
│  ├─ admin
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ expenses
│  │  │  └─ page.tsx
│  │  ├─ instructor
│  │  │  └─ page.tsx
│  │  ├─ layout.tsx
│  │  ├─ learner
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ materials
│  │  │  └─ page.tsx
│  │  ├─ notification
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ payments
│  │  │  └─ page.tsx
│  │  ├─ progress
│  │  │  ├─ page.tsx
│  │  │  └─ types.ts
│  │  ├─ questions
│  │  │  └─ page.tsx
│  │  ├─ reports
│  │  │  └─ page.tsx
│  │  └─ settings
│  │     └─ page.tsx
│  ├─ favicon.ico
│  ├─ globals.css
│  ├─ instructor
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ notifications
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  └─ progress
│  │     └─ page.tsx
│  ├─ layout.tsx
│  ├─ learner
│  │  ├─ dashboard
│  │  │  └─ page.tsx
│  │  ├─ lessons
│  │  │  └─ page.tsx
│  │  ├─ materials
│  │  │  └─ page.tsx
│  │  ├─ notification
│  │  │  └─ page.tsx
│  │  ├─ page.tsx
│  │  ├─ payments
│  │  │  └─ page.tsx
│  │  ├─ practice
│  │  │  └─ page.tsx
│  │  ├─ profile
│  │  │  └─ page.tsx
│  │  └─ progress
│  │     └─ page.tsx
│  ├─ login
│  │  └─ page.tsx
│  ├─ page.tsx
│  └─ signup
│     └─ page.tsx
├─ CLAUDE.md
├─ eslint.config.mjs
├─ lib
│  └─ supabase
│     ├─ client.ts
│     └─ server.ts
├─ next.config.ts
├─ package-lock.json
├─ package.json
├─ pnpm-lock.yaml
├─ postcss.config.mjs
├─ public
│  ├─ file.svg
│  ├─ globe.svg
│  ├─ images
│  │  └─ drivetodaylogo.PNG
│  ├─ next.svg
│  ├─ vercel.svg
│  └─ window.svg
├─ README.md
└─ tsconfig.json

```