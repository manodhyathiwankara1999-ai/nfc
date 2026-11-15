import Link from 'next/link';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const FEATURES = [
  {
    title: 'RFID / NFC tap',
    desc: 'Each physical card encodes a unique, unguessable URL. One tap opens your live profile — no app required.',
  },
  {
    title: 'Customizable profile',
    desc: 'A consistent profile layout with one theme color that automatically styles your buttons, links and accents.',
  },
  {
    title: 'Everything in one place',
    desc: 'Contact details, social links, a save-contact QR code, quick links and a photo gallery.',
  },
  {
    title: 'vCard built in',
    desc: 'Every profile offers one-tap "Save contact", so new connections never lose your details.',
  },
  {
    title: 'Tap analytics',
    desc: 'See taps over time, device and geo breakdowns — scoped to exactly what your role should see.',
  },
  {
    title: 'Personal & Commercial',
    desc: 'A free personal card, or a commercial tier with multiple companies on a single card.',
  },
];

export async function MarketingHome() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error && (!error.status || error.status >= 500)) {
    throw new Error('Could not verify the Supabase session.');
  }

  return (
    <div className="bg-white text-app-text">
      <header className="mx-auto flex max-w-6xl items-center justify-between border-b border-app-border px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3 text-base font-semibold tracking-tight">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary text-sm font-bold text-white">
            N
          </span>
          nfc-ecard
        </Link>
        <nav className="flex items-center gap-2 text-sm">
          <a
            href="#features"
            className="hidden rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 sm:block"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hidden rounded-lg px-3 py-2 text-slate-600 hover:text-slate-900 sm:block"
          >
            Pricing
          </a>
          {user ? (
            <Link href="/dashboard" className="app-button-primary">
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg px-4 py-2 font-medium text-slate-700 hover:bg-slate-100"
              >
                Log in
              </Link>
              <Link href="/register" className="app-button-primary">
                Get your card
              </Link>
            </>
          )}
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
          <span className="rounded-full border border-app-primary-border bg-app-light px-3 py-1 text-xs font-semibold tracking-wide text-app-hover">
            RFID · NFC · QR
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight text-app-text sm:text-6xl">
            Your business card, <span className="text-app-primary">one tap</span> away.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
            nfc-ecard turns a physical RFID/NFC card into a living digital profile you can restyle
            anytime — and know exactly who tapped it.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            {user ? (
              <Link href="/dashboard" className="app-button-primary px-6 py-3">
                Open dashboard
              </Link>
            ) : (
              <>
                <Link href="/register" className="app-button-primary px-6 py-3">
                  Create your free card
                </Link>
                <a href="#features" className="app-button-secondary px-6 py-3">
                  See how it works
                </a>
              </>
            )}
          </div>

          {/* Card mockup */}
          <div className="app-card mx-auto mt-16 max-w-xs p-1 shadow-xl">
            <div className="rounded-[15px] bg-white p-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-4 border-app-primary-border bg-app-light text-2xl font-bold text-app-primary">
                A
              </div>
              <p className="mt-5 text-lg font-bold text-slate-900">Alex Rivera</p>
              <p className="text-sm text-slate-500">Product Designer</p>
              <div className="mt-6 rounded-xl bg-app-primary py-2.5 text-sm font-semibold text-white">
                Save contact (.vcf)
              </div>
              <p className="mt-4 text-xs text-slate-400">Tap card or scan QR → this page</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-app-background py-20">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">
              Everything lives on the card
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-center text-slate-600">
              The physical card is just the key — the profile behind it is a full mini-site.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="app-card p-6">
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-center text-3xl font-bold tracking-tight">Simple pricing</h2>
            <p className="mt-3 text-center text-slate-600">
              Start free. Upgrade when one card needs to wear many hats.
            </p>
            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <div className="app-card p-6 sm:p-8">
                <h3 className="font-semibold">Personal</h3>
                <p className="mt-2 text-4xl font-bold">Free</p>
                <ul className="mt-6 space-y-2 text-sm text-slate-600">
                  <li>✓ One profile, one identity</li>
                  <li>✓ One-color theme customization</li>
                  <li>✓ Contact, social links, QR code and gallery</li>
                  <li>✓ Your card&apos;s tap analytics</li>
                </ul>
                <Link href="/register" className="app-button-secondary mt-8 block text-center">
                  Start free
                </Link>
              </div>
              <div className="app-card app-card-featured relative p-6 sm:p-8">
                <span className="absolute -top-3 left-6 rounded-full bg-app-primary px-3 py-1 text-xs font-semibold text-white">
                  COMMERCIAL
                </span>
                <h3 className="font-semibold">Commercial</h3>
                <p className="mt-2 text-4xl font-bold">
                  Paid<span className="text-base font-normal text-slate-500"> /mo</span>
                </p>
                <ul className="mt-6 space-y-2 text-sm text-slate-600">
                  <li>✓ Everything in Personal</li>
                  <li>✓ Multiple companies on one card</li>
                  <li>✓ Company switcher on your public page</li>
                  <li>✓ Priority support</li>
                </ul>
                <Link href="/register" className="app-button-primary mt-8 block text-center">
                  Create your card
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-app-border bg-app-background py-10 text-center text-sm text-app-secondary">
        © 2026 nfc-ecard — tap. connect. grow.
      </footer>
    </div>
  );
}
