// What a learner owes: the fee recorded on every lesson they booked (cancelled
// lessons excluded) plus any invoices the administrator issued, minus what
// they have paid. Quotations are estimates only and are never owed.

type FeeBooking = { status: string; lesson_fee?: number | string | null }
type BillingDocument = { document_type?: string | null; total_amount: number | string }
type PaymentRecord = { amount: number | string }

export function lessonFeesTotal(bookings: FeeBooking[]): number {
  return bookings
    .filter(booking => booking.status !== 'cancelled')
    .reduce((sum, booking) => sum + (Number(booking.lesson_fee) || 0), 0)
}

export function invoicedTotal(documents: BillingDocument[]): number {
  return documents
    .filter(document => document.document_type === 'invoice')
    .reduce((sum, document) => sum + (Number(document.total_amount) || 0), 0)
}

export function paidTotal(payments: PaymentRecord[]): number {
  return payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
}

export function amountDue(lessonFees: number, invoiced: number, paid: number): number {
  return Math.max(0, lessonFees + invoiced - paid)
}
