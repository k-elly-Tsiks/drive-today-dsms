import { createClient } from '@/lib/supabase/client'
import { DRIVING_CLASS_OPTIONS } from '@/lib/driving-classes'

const supabase = createClient()

const MIGRATION_MESSAGE =
  'Lesson booking is not set up in Supabase yet. Apply supabase/migrations/20261126000000_approval_assignment_and_fees.sql in the Supabase SQL Editor, then try again.'

export type BookLessonSlotsResult =
  | { ok: true; booked: number; instructorName: string; lessonFee: number | null; totalFee: number | null }
  | { ok: false; slotTaken: boolean; message: string }

export type SaveDrivingClassResult =
  | { ok: true; drivingClass: string }
  | { ok: false; message: string }

export async function saveLearnerDrivingClass(userId: string, drivingClass: string): Promise<SaveDrivingClassResult> {
  const selectedClass = drivingClass.trim()
  if (!DRIVING_CLASS_OPTIONS.includes(selectedClass)) {
    return { ok: false, message: 'Please select a valid driving class.' }
  }

  const { data, error } = await supabase
    .from('users')
    .update({ driving_class: selectedClass })
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle()

  if (error) return { ok: false, message: `Could not save your driving class: ${error.message}` }
  if (!data) return { ok: false, message: 'Your driving class was not saved. Please try again.' }

  return { ok: true, drivingClass: selectedClass }
}

// The database function checks approval and the lesson allowance, assigns the
// approved instructor for the learner's class with the lowest workload,
// records each lesson's fee and notifies both the learner and the instructor.
export async function bookLessonSlots(slotIds: string[]): Promise<BookLessonSlotsResult> {
  const { data, error } = await supabase.rpc('book_lesson_slots', { p_slot_ids: slotIds })

  if (error) {
    if (error.code === 'PGRST202') return { ok: false, slotTaken: false, message: MIGRATION_MESSAGE }
    const slotTaken = error.message.includes('This lesson slot is no longer available.')
    return {
      ok: false,
      slotTaken,
      message: slotTaken
        ? 'One or more selected slots were just booked by another learner. Please choose different slots.'
        : error.message,
    }
  }

  const result = data as { booked: number; instructor_name: string; lesson_fee: number | null; total_fee: number | null }
  return {
    ok: true,
    booked: result.booked,
    instructorName: result.instructor_name,
    lessonFee: result.lesson_fee === null ? null : Number(result.lesson_fee),
    totalFee: result.total_fee === null ? null : Number(result.total_fee),
  }
}

// Price of one lesson for the signed-in learner's class, or null when the
// administrator has not set one yet.
export async function getMyLessonPrice(): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_my_lesson_price')
  if (error || data === null || data === undefined) return null
  return Number(data)
}

export function describeBooking(result: Extract<BookLessonSlotsResult, { ok: true }>): string {
  const fees = result.totalFee === null
    ? 'The administrator will confirm the fee.'
    : `Amount due for these lessons: ${formatMoney(result.totalFee)} (${result.booked} x ${formatMoney(result.lessonFee ?? 0)}).`
  return `${result.booked} lesson(s) booked with ${result.instructorName}. ${fees}`
}

export function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`
}
