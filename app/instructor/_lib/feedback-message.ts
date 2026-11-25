type Evaluation = {
  lessonDate?: string | null
  steering: number
  parking: number
  reversing: number
  roadAwareness: number
  comments?: string | null
}

// The notification a learner receives when their instructor records an
// evaluation, so the feedback itself reaches them, not just a pointer to it.
export function feedbackMessage(evaluation: Evaluation): string {
  const lesson = evaluation.lessonDate ? `your lesson on ${evaluation.lessonDate}` : 'your lesson'
  const ratings = `Steering ${evaluation.steering}/5, Parking ${evaluation.parking}/5, Reversing ${evaluation.reversing}/5, Road awareness ${evaluation.roadAwareness}/5.`
  const comments = evaluation.comments?.trim() ? ` Instructor comments: "${evaluation.comments.trim()}"` : ''
  return `Feedback for ${lesson}: ${ratings}${comments} See the full record on your Progress page.`
}
