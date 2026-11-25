export default function ResetPasswordPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="mb-3 text-2xl font-bold text-slate-900">Password reset has changed</h1>
        <p className="mb-6 text-sm leading-6 text-slate-600">
          Email reset links are no longer used. Return to login and use the administrator-approved
          password reset option.
        </p>
        <a
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-orange-600 px-6 font-semibold text-white"
        >
          Return to login
        </a>
      </section>
    </main>
  )
}
