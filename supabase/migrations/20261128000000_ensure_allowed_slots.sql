-- Restore the learner slot allowance column used by approval and booking flows.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS allowed_slots integer NOT NULL DEFAULT 0;

-- Backfill older learner records so allowance and allocation remain consistent.
UPDATE public.users
SET allowed_slots = greatest(
  coalesce(slots_allocated, 0),
  coalesce(allowed_slots, 0)
)
WHERE role::text = 'learner';
