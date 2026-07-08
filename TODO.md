# TODO

- [ ] Update `app/instructor/lessons/page.tsx` to record **separate** ratings for Steering, Parking, Reversing, and Road (instead of one shared rating).
- [ ] Ensure ratings persist to `progress_tracking` fields: `steering_rating`, `parking_rating`, `reversing_rating`, `road_awareness_rating`.
- [ ] Ensure the instructor “Complete” flow updates `lesson_bookings.status` to `completed`, then shows performance sheet, then after saving progress reloads bookings and switches UI to `History`.
- [ ] Run `npm run lint` and `npm run build` to confirm TypeScript/ESLint passes.

