-- 0. An instructor's capacity is set on the admin Instructors page but the
--    column was never created.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS workload_capacity integer;

-- 1. Registration and approval: only administrators may approve accounts,
--    change roles or change lesson allocations. Everyone else registers as a
--    pending learner or instructor and cannot promote themselves.

CREATE OR REPLACE FUNCTION public.protect_user_account_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  request_role text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  );
BEGIN
  -- The SQL editor, migrations and server-side service-role calls are trusted.
  IF request_role IN ('', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.users AS profile
    WHERE profile.user_id = auth.uid()
      AND profile.role::text = 'admin'
  ) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role::text NOT IN ('learner', 'instructor') THEN
      RAISE EXCEPTION 'Only learner and instructor accounts can be registered.'
        USING ERRCODE = '42501';
    END IF;
    NEW.status := 'pending';
    NEW.slots_allocated := 0;
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.status IS DISTINCT FROM OLD.status
    OR NEW.slots_allocated IS DISTINCT FROM OLD.slots_allocated
    OR NEW.workload_capacity IS DISTINCT FROM OLD.workload_capacity THEN
    RAISE EXCEPTION 'Only an administrator can change account roles, approval status or lesson allocations.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_user_account_fields ON public.users;

CREATE TRIGGER protect_user_account_fields
BEFORE INSERT OR UPDATE
ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_account_fields();


-- Driving classes are stored as arrays, JSON text, Postgres array text or a
-- comma-separated list. "Class 1", "class1" and "1" all name the same class.

CREATE OR REPLACE FUNCTION public.normalize_driving_class(class_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(replace(lower(coalesce(class_name, '')), 'class', ''), '[\s_-]+', '', 'g')
$$;

CREATE OR REPLACE FUNCTION public.instructor_teaches_class(instructor_classes text, learner_class text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_driving_class(learner_class) <> ''
    AND EXISTS (
      SELECT 1
      FROM regexp_split_to_table(
        regexp_replace(coalesce(instructor_classes, ''), '[\[\]{}"]', '', 'g'),
        ','
      ) AS taught(class_name)
      WHERE public.normalize_driving_class(taught.class_name) = public.normalize_driving_class(learner_class)
    )
$$;


-- 4. Fees: the price of one lesson for a driving class. A price set for the
--    class wins, then a price whose name mentions the class, then a general
--    lesson price. Registration fees are never used as a lesson price.
--    Columns are read through to_jsonb so optional columns may be absent.

CREATE OR REPLACE FUNCTION public.lesson_price_for_class(learner_class text)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  class_pattern text := '(^|[^0-9a-z])'
    || regexp_replace(lower(btrim(coalesce(learner_class, ''))), '([^a-z0-9 ])', '\\\1', 'g')
    || '([^0-9a-z]|$)';
  price numeric;
BEGIN
  IF public.normalize_driving_class(learner_class) = '' THEN
    RETURN NULL;
  END IF;

  SELECT ranked.amount
  INTO price
  FROM (
    SELECT
      (item ->> 'price_per_lesson')::numeric AS amount,
      item ->> 'updated_at' AS updated_at,
      CASE
        WHEN public.normalize_driving_class(item ->> 'driving_class') = public.normalize_driving_class(learner_class) THEN 0
        WHEN lower(coalesce(item ->> 'training_type', '')) ~ class_pattern THEN 1
        WHEN coalesce(item ->> 'driving_class', '') = '' AND coalesce(item ->> 'training_type', '') ~* 'lesson' THEN 2
        WHEN coalesce(item ->> 'driving_class', '') = '' THEN 3
        ELSE 9
      END AS priority
    FROM (SELECT to_jsonb(price_row) AS item FROM public.price_list AS price_row) AS items
    WHERE coalesce(item ->> 'training_type', '') !~* 'regist'
      AND item ->> 'price_per_lesson' IS NOT NULL
  ) AS ranked
  WHERE ranked.priority < 9
  ORDER BY ranked.priority, ranked.updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN price;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_lesson_price()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT public.lesson_price_for_class(profile.driving_class::text)
  FROM public.users AS profile
  WHERE profile.user_id = auth.uid()
$$;

-- Each booking keeps the fee that applied when it was made, so later price
-- changes never alter what a learner already owes. Cancelled bookings are
-- simply left out when the amount due is added up.
ALTER TABLE public.lesson_bookings
  ADD COLUMN IF NOT EXISTS lesson_fee numeric(10, 2);

CREATE OR REPLACE FUNCTION public.set_lesson_booking_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  SELECT public.lesson_price_for_class(profile.driving_class::text)
  INTO NEW.lesson_fee
  FROM public.users AS profile
  WHERE profile.user_id = NEW.learner_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_lesson_booking_fee ON public.lesson_bookings;

CREATE TRIGGER set_lesson_booking_fee
BEFORE INSERT
ON public.lesson_bookings
FOR EACH ROW
EXECUTE FUNCTION public.set_lesson_booking_fee();


-- 2 and 3. Booking: the learner picks slots; the database checks the
-- approval, the lesson allowance and the slots, then assigns the approved
-- instructor for the learner's class with the fewest scheduled lessons.

CREATE OR REPLACE FUNCTION public.book_lesson_slots(p_slot_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  learner public.users%ROWTYPE;
  learner_class text;
  allocated integer;
  used integer;
  requested integer;
  bookable integer;
  chosen_instructor_id uuid;
  chosen_instructor_name text;
  fee numeric;
  fee_message text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in to book lessons.' USING ERRCODE = '42501';
  END IF;

  -- Locking the learner row stops two tabs from overspending the allowance.
  SELECT * INTO learner
  FROM public.users
  WHERE user_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND OR learner.role::text <> 'learner' THEN
    RAISE EXCEPTION 'Only learner accounts can book lessons.' USING ERRCODE = '42501';
  END IF;
  IF learner.status::text IS DISTINCT FROM 'approved' THEN
    RAISE EXCEPTION 'Your account must be approved by the administrator before you can book lessons.'
      USING ERRCODE = '42501';
  END IF;

  learner_class := btrim(coalesce(learner.driving_class::text, ''));
  IF learner_class = '' THEN
    RAISE EXCEPTION 'Your driving class has not been set yet, so an instructor cannot be matched. Please contact the administrator.'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT count(DISTINCT slot_id) INTO requested
  FROM unnest(p_slot_ids) AS requested_slot(slot_id)
  WHERE slot_id IS NOT NULL;

  IF requested = 0 THEN
    RAISE EXCEPTION 'Please select at least one slot.' USING ERRCODE = 'P0001';
  END IF;

  allocated := coalesce(learner.slots_allocated, 0)::integer;
  SELECT count(*) INTO used
  FROM public.lesson_bookings AS booking
  WHERE booking.learner_id = auth.uid()
    AND booking.status::text <> 'cancelled';
  bookable := greatest(allocated - used, 0);

  IF requested > bookable THEN
    RAISE EXCEPTION 'You can only book % more lesson(s). Ask the administrator for extra lessons.', bookable
      USING ERRCODE = 'P0001';
  END IF;

  IF (
    SELECT count(*)
    FROM public.lesson_slots AS slot
    WHERE slot.slot_id::text = ANY (p_slot_ids)
      AND slot.status::text = 'available'
      AND slot.slot_date::date >= current_date
  ) <> requested THEN
    RAISE EXCEPTION 'This lesson slot is no longer available.' USING ERRCODE = 'P0001';
  END IF;

  SELECT instructor.user_id, instructor.first_name || ' ' || instructor.surname
  INTO chosen_instructor_id, chosen_instructor_name
  FROM public.users AS instructor
  WHERE instructor.role::text = 'instructor'
    AND instructor.status::text = 'approved'
    AND public.instructor_teaches_class(instructor.instructor_driving_classes::text, learner_class)
  ORDER BY (
      SELECT count(*)
      FROM public.lesson_bookings AS booking
      WHERE booking.instructor_id = instructor.user_id
        AND booking.status::text = 'scheduled'
    ),
    instructor.created_at,
    instructor.user_id
  LIMIT 1;

  IF chosen_instructor_id IS NULL THEN
    RAISE EXCEPTION 'No approved instructor teaches % yet. Please contact the administrator.', learner_class
      USING ERRCODE = 'P0001';
  END IF;

  -- reserve_lesson_slot_for_booking re-checks each slot under a row lock and
  -- marks it booked; set_lesson_booking_fee records the fee.
  INSERT INTO public.lesson_bookings (learner_id, instructor_id, slot_id, status)
  SELECT auth.uid(), chosen_instructor_id, slot.slot_id, 'scheduled'
  FROM public.lesson_slots AS slot
  WHERE slot.slot_id::text = ANY (p_slot_ids);

  fee := public.lesson_price_for_class(learner_class);
  fee_message := CASE
    WHEN fee IS NULL THEN ' The administrator will confirm the fee.'
    ELSE format(' Fees: %s x $%s = $%s.', requested, to_char(fee, 'FM999999990.00'), to_char(fee * requested, 'FM999999990.00'))
  END;

  INSERT INTO public.notifications (recipient_id, message, type)
  VALUES
    (
      auth.uid(),
      format('Your %s lesson(s) are booked with %s.', requested, chosen_instructor_name) || fee_message,
      'lesson_reminder'
    ),
    (
      chosen_instructor_id,
      format('You have been assigned %s new %s lesson(s) with %s %s.', requested, learner_class, learner.first_name, learner.surname),
      'lesson_reminder'
    );

  RETURN jsonb_build_object(
    'booked', requested,
    'instructor_name', chosen_instructor_name,
    'lesson_fee', fee,
    'total_fee', fee * requested
  );
END;
$$;

-- Bookings may only be created through book_lesson_slots, so the allowance,
-- class matching, workload balancing and fees cannot be skipped.
REVOKE INSERT ON TABLE public.lesson_bookings FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.book_lesson_slots(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_lesson_slots(text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.get_my_lesson_price() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_lesson_price() TO authenticated;
REVOKE ALL ON FUNCTION public.lesson_price_for_class(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_lesson_booking_fee() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_user_account_fields() FROM PUBLIC, anon, authenticated;

-- Optional: give lessons booked before this migration the current price, so
-- they appear in the amount due. Run only if those lessons were not already
-- billed another way.
-- UPDATE public.lesson_bookings AS booking
-- SET lesson_fee = public.lesson_price_for_class(profile.driving_class::text)
-- FROM public.users AS profile
-- WHERE profile.user_id = booking.learner_id
--   AND booking.lesson_fee IS NULL;

NOTIFY pgrst, 'reload schema';
