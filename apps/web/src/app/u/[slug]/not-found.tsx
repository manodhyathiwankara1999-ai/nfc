import Link from 'next/link';

export default function ProfileNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-center">
      <div className="max-w-md">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Profile not found</h1>
        <p className="mt-3 text-slate-600">
          This profile may have been removed or the address may be incorrect.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
