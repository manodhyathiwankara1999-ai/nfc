'use client';

export default function ProfileError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      role="alert"
      className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-center"
    >
      <div className="max-w-md">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          This profile could not be loaded
        </h1>
        <p className="mt-3 text-slate-600">Please check your connection and try again.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
