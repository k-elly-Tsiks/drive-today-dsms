CREATE OR REPLACE FUNCTION public.complete_lesson_booking(
  p_booking_id public.lesson_bookings.booking_id%TYPE
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  booking_instructor_id uuid;
  booking_status text;
BEGIN
  SELECT booking.instructor_id, booking.status
  INTO booking_instructor_id, booking_status
  FROM public.lesson_bookings AS booking
  WHERE booking.booking_id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This lesson booking was not found.'
      USING ERRCODE = 'P0002';
  END IF;

  IF booking_instructor_id IS DISTINCT FROM auth.uid()
    AND NOT EXISTS (
      SELECT 1
      FROM public.users AS profile
      WHERE profile.user_id = auth.uid()
        AND profile.role = 'admin'
    ) THEN
    RAISE EXCEPTION 'Only the assigned instructor can complete this lesson.'
      USING ERRCODE = '42501';
  END IF;

  IF booking_status = 'completed' THEN
    RETURN booking_status;
  END IF;

  IF booking_status IS DISTINCT FROM 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled lessons can be marked as completed.'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.lesson_bookings
  SET status = 'completed'
  WHERE booking_id = p_booking_id;

  RETURN 'completed';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_lesson_booking(public.lesson_bookings.booking_id%TYPE)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_lesson_booking(public.lesson_bookings.booking_id%TYPE)
  TO authenticated;
