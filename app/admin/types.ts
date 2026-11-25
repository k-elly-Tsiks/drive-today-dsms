export type Notification = {
  notification_id: string
  type: string
  message: string
  is_read: boolean
  created_at: string
  recipient_id: string
  recipient?: { first_name: string; surname: string; role: string } | null
}