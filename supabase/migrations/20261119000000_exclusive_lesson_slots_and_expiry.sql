CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.reserve_lesson_slot_for_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  current_slot_status text;
  has_existing_booking boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'scheduled' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND OLD.status = 'scheduled'
    AND NEW.slot_id IS NOT DISTINCT FROM OLD.slot_id THEN
    RETURN NEW;
  END IF;

  SELECT slot.status
  INTO current_slot_status
  FROM public.lesson_slots AS slot
  WHERE slot.slot_id = NEW.slot_id
  FOR UPDATE;

  IF NOT FOUND OR current_slot_status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'This lesson slot is no longer available.'
      USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.lesson_bookings AS booking
      WHERE booking.slot_id = NEW.slot_id
        AND booking.status = 'scheduled'
    )
    INTO has_existing_booking;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.lesson_bookings AS booking
      WHERE booking.slot_id = NEW.slot_id
        AND booking.status = 'scheduled'
        AND booking.booking_id <> OLD.booking_id
    )
    INTO has_existing_booking;
  END IF;

  IF has_existing_booking THEN
    RAISE EXCEPTION 'This lesson slot is no longer available.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.lesson_slots
  SET status = 'booked'
  WHERE slot_id = NEW.slot_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reserve_lesson_slot_before_booking
  ON public.lesson_bookings;

CREATE TRIGGER reserve_lesson_slot_before_booking
BEFORE INSERT OR UPDATE OF status, slot_id
ON public.lesson_bookings
FOR EACH ROW
EXECUTE FUNCTION public.reserve_lesson_slot_for_booking();

CREATE OR REPLACE FUNCTION public.release_lesson_slot_after_cancellation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.status = 'scheduled'
    AND (NEW.status = 'cancelled' OR NEW.slot_id IS DISTINCT FROM OLD.slot_id) THEN
    UPDATE public.lesson_slots AS slot
    SET status = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.lesson_bookings AS booking
        WHERE booking.slot_id = OLD.slot_id
          AND booking.status = 'scheduled'
      ) THEN 'booked'
      ELSE 'available'
    END
    WHERE slot.slot_id = OLD.slot_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS release_lesson_slot_after_booking_change
  ON public.lesson_bookings;

CREATE TRIGGER release_lesson_slot_after_booking_change
AFTER UPDATE OF status, slot_id
ON public.lesson_bookings
FOR EACH ROW
EXECUTE FUNCTION public.release_lesson_slot_after_cancellation();

UPDATE public.lesson_slots AS slot
SET status = 'booked'
WHERE EXISTS (
  SELECT 1
  FROM public.lesson_bookings AS booking
  WHERE booking.slot_id = slot.slot_id
    AND booking.status = 'scheduled'
);

SELECT cron.schedule(
  'delete-expired-unbooked-lesson-slots',
  '0 3 * * *',
  $job$
    DELETE FROM public.lesson_slots AS slot
    WHERE slot.slot_date::date < CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1
        FROM public.lesson_bookings AS booking
        WHERE booking.slot_id = slot.slot_id
      );
  $job$
);
