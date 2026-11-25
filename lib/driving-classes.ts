export const DRIVING_CLASS_OPTIONS = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Provisional']

// Instructor classes are stored in several shapes: a real array from signup,
// a single value from the admin edit form, and older rows saved as JSON text
// ('["Class 1","Class 2"]'), Postgres array text ('{"Class 1"}') or a
// comma-separated list. This reads all of them into a plain list of names.
export function parseDrivingClasses(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(item => parseDrivingClasses(item))
  }
  if (typeof value !== 'string') return []

  const text = value.trim()
  if (text.startsWith('[')) {
    try {
      return parseDrivingClasses(JSON.parse(text))
    } catch {
      // Not valid JSON; fall through to the plain list handling below.
    }
  }

  return text
    .replace(/^\{|\}$/g, '')
    .split(',')
    .map(item => item.trim().replace(/^"|"$/g, '').trim())
    .filter(Boolean)
}

// "Class 1", "class1", "CLASS 1" and "1" all name the same class.
export function normalizeDrivingClass(value: string): string {
  return value.toLowerCase().replace(/class/g, '').replace(/[\s_-]+/g, '')
}

export function teachesDrivingClass(instructorClasses: unknown, learnerClass: string | null | undefined): boolean {
  if (!learnerClass?.trim()) return false
  const wanted = normalizeDrivingClass(learnerClass)
  return parseDrivingClasses(instructorClasses).some(cls => normalizeDrivingClass(cls) === wanted)
}
