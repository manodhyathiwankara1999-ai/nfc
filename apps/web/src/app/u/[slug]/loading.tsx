export default function LoadingProfile() {
  return (
    <main
      role="status"
      className="mx-auto min-h-screen w-full max-w-6xl animate-pulse bg-slate-50 px-4 py-8 sm:px-8"
    >
      <span className="sr-only">Loading profile…</span>
      <div className="h-40 rounded-2xl bg-slate-200 sm:h-52" />
      <div className="mt-6 h-9 max-w-sm rounded bg-slate-200" />
      <div className="mt-3 h-5 max-w-xs rounded bg-slate-200" />
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="h-56 rounded-2xl bg-slate-200" />
        <div className="h-56 rounded-2xl bg-slate-200" />
      </div>
    </main>
  );
}
