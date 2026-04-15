export interface Learner {
  user_id: string
  first_name: string
  surname: string
}

export interface Instructor {
  user_id: string
  first_name: string
  surname: string
}

export interface ProgressRecord {
  progress_id: string
  learner_id: string
  instructor_id: string
  booking_id: string
  progress: number
  steering_rating: number
  parking_rating: number
  reversing_rating: number
  road_awareness_rating: number
  comments: string
  recorded_at: string

  learner?: {
    first_name: string
    surname: string
    email: string
  }

  instructor?: {
    first_name: string
    surname: string
  }

  booking?: {
    lesson_slots?: {
      slot_date: string
      slot_time: string
    }
  }
}
