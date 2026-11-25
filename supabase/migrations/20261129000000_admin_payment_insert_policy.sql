DROP POLICY IF EXISTS payments_admin_insert ON public.payments;

CREATE POLICY payments_admin_insert
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users AS admin_profile
    WHERE admin_profile.user_id = (SELECT auth.uid())
      AND admin_profile.role::text = 'admin'
  )
  AND EXISTS (
    SELECT 1
    FROM public.users AS learner_profile
    WHERE learner_profile.user_id = learner_id
      AND learner_profile.role::text = 'learner'
  )
);
