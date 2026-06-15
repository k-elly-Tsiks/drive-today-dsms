# TODO

## Goal
Make **/instructor** and **/learner** workspaces visually match **/admin** (same UI shell + shared UI styles) while keeping business logic intact.

## Plan (tracked)
- [ ] Step 1: Update shared layout shell: make `app/instructor/layout.tsx` match the admin shell (sidebar hover-expand, sticky topbar, canvas padding/margins, theme toggle, date display, notifications icon behavior). Preserve instructor auth/logout logic.
- [ ] Step 2: Update shared layout shell: make `app/learner/layout.tsx` match the admin shell. Preserve learner auth logic and unread notification count usage.
- [ ] Step 3: Refactor key pages to use consistent styles:
  - [ ] 3a: `app/instructor/dashboard/page.tsx`
  - [ ] 3b: `app/instructor/lessons/page.tsx`
  - [ ] 3c: `app/learner/dashboard/page.tsx`
  - [ ] 3d: `app/learner/lessons/page.tsx`
- [ ] Step 4: Ensure tabs, empty states, and status badges look consistent with admin UI.
- [ ] Step 5: Lint/build and manual visual verification.

