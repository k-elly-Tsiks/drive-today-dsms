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