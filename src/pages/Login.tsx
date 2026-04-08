import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { usersApi } from '../api/users'
import { LanguageSwitch } from '../components/ui/LanguageSwitch'
import { useI18n } from '../i18n/I18nContext'
import { useAuthStore } from '../store/auth.store'

function classNames(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

function BrandMark({ subtitle }: { subtitle: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-700 shadow-sm">
        <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900">malambi</p>
        <p className="text-[11px] text-slate-500">{subtitle}</p>
      </div>
    </div>
  )
}

/** Faint illustration: technician installing a GPS tracker on a vehicle with a dashcam visible. */
function HeroIllustration() {
  return (
    <svg
      viewBox="0 0 520 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
      aria-hidden
    >
      {/* ── Road / ground ── */}
      <rect x="0" y="320" width="520" height="80" rx="0" fill="#e2e8f0" opacity="0.35" />
      <line x1="40" y1="355" x2="120" y2="355" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="12 8" opacity="0.5" />
      <line x1="160" y1="355" x2="240" y2="355" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="12 8" opacity="0.5" />
      <line x1="280" y1="355" x2="360" y2="355" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="12 8" opacity="0.5" />
      <line x1="400" y1="355" x2="480" y2="355" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" strokeDasharray="12 8" opacity="0.5" />

      {/* ── Vehicle body (van/SUV side view) ── */}
      <g opacity="0.55">
        {/* Main body */}
        <path
          d="M100 280 L100 230 Q100 220 110 220 L250 220 L280 185 Q285 180 295 180 L380 180 Q390 180 390 190 L390 280 Q390 290 380 290 L110 290 Q100 290 100 280 Z"
          fill="#94a3b8"
          stroke="#64748b"
          strokeWidth="1.5"
        />
        {/* Windshield */}
        <path
          d="M255 222 L278 188 Q280 185 285 185 L350 185 L350 222 Z"
          fill="#bfdbfe"
          stroke="#64748b"
          strokeWidth="1"
          opacity="0.7"
        />
        {/* Side windows */}
        <rect x="140" y="228" width="55" height="30" rx="3" fill="#bfdbfe" stroke="#64748b" strokeWidth="1" opacity="0.6" />
        <rect x="200" y="228" width="50" height="30" rx="3" fill="#bfdbfe" stroke="#64748b" strokeWidth="1" opacity="0.6" />
        {/* Door line */}
        <line x1="195" y1="222" x2="195" y2="285" stroke="#64748b" strokeWidth="1" opacity="0.5" />
        {/* Door handle */}
        <rect x="170" y="262" width="16" height="3" rx="1.5" fill="#64748b" opacity="0.5" />
        {/* Headlight */}
        <rect x="384" y="220" width="8" height="18" rx="3" fill="#fbbf24" stroke="#64748b" strokeWidth="0.8" opacity="0.7" />
        {/* Tail light */}
        <rect x="100" y="235" width="5" height="14" rx="2" fill="#f87171" stroke="#64748b" strokeWidth="0.8" opacity="0.6" />
      </g>

      {/* ── Wheels ── */}
      <circle cx="155" cy="295" r="22" fill="#334155" stroke="#1e293b" strokeWidth="2" opacity="0.6" />
      <circle cx="155" cy="295" r="10" fill="#64748b" opacity="0.4" />
      <circle cx="345" cy="295" r="22" fill="#334155" stroke="#1e293b" strokeWidth="2" opacity="0.6" />
      <circle cx="345" cy="295" r="10" fill="#64748b" opacity="0.4" />

      {/* ── Hood open (propped up) ── */}
      <path
        d="M380 180 L415 145 Q418 142 420 145 L395 180"
        fill="#94a3b8"
        stroke="#64748b"
        strokeWidth="1.2"
        opacity="0.5"
      />

      {/* ── GPS device (being installed under hood) ── */}
      <g opacity="0.7">
        <rect x="395" y="195" width="32" height="22" rx="4" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1.5" />
        <rect x="399" y="199" width="10" height="6" rx="1" fill="#7dd3fc" opacity="0.7" />
        {/* Antenna */}
        <line x1="411" y1="195" x2="411" y2="182" stroke="#0284c7" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="411" cy="180" r="3" fill="#38bdf8" stroke="#0284c7" strokeWidth="1" />
        {/* Signal waves from GPS */}
        <path d="M418 175 Q424 170 418 165" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.6" strokeLinecap="round" />
        <path d="M421 177 Q430 169 421 161" stroke="#38bdf8" strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round" />
        {/* Label */}
        <text x="401" y="213" fill="white" fontSize="6" fontWeight="bold" fontFamily="system-ui">GPS</text>
        {/* Wires coming from device */}
        <path d="M395 205 Q385 205 382 210 Q378 218 375 225" stroke="#ef4444" strokeWidth="1.2" fill="none" opacity="0.5" strokeLinecap="round" />
        <path d="M395 210 Q385 212 380 218 Q376 225 373 232" stroke="#eab308" strokeWidth="1.2" fill="none" opacity="0.5" strokeLinecap="round" />
      </g>

      {/* ── Dashcam on windshield ── */}
      <g opacity="0.65">
        <rect x="295" y="186" width="18" height="13" rx="3" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
        {/* Lens */}
        <circle cx="304" cy="192" r="4" fill="#334155" stroke="#475569" strokeWidth="0.8" />
        <circle cx="304" cy="192" r="2" fill="#0ea5e9" opacity="0.6" />
        {/* Mount arm */}
        <line x1="304" y1="186" x2="304" y2="183" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        {/* Suction cup */}
        <ellipse cx="304" cy="182" rx="5" ry="2" fill="#475569" opacity="0.5" />
        {/* Recording indicator */}
        <circle cx="310" cy="188" r="1.5" fill="#ef4444" opacity="0.8" />
      </g>

      {/* ── Technician figure ── */}
      <g opacity="0.5">
        {/* Head */}
        <circle cx="430" cy="210" r="14" fill="#fbbf24" stroke="#d97706" strokeWidth="1.2" />
        {/* Hard hat / cap */}
        <path d="M418 206 Q418 196 430 196 Q442 196 442 206" fill="#0ea5e9" stroke="#0284c7" strokeWidth="1" />
        <rect x="415" y="205" width="30" height="3" rx="1.5" fill="#0ea5e9" stroke="#0284c7" strokeWidth="0.8" />
        {/* Eyes */}
        <circle cx="425" cy="212" r="1.5" fill="#1e293b" />
        <circle cx="435" cy="212" r="1.5" fill="#1e293b" />
        {/* Body / torso (work vest) */}
        <path
          d="M420 224 L417 270 Q416 275 420 275 L440 275 Q444 275 443 270 L440 224 Q440 222 430 222 Q420 222 420 224 Z"
          fill="#0ea5e9"
          stroke="#0284c7"
          strokeWidth="1"
        />
        {/* Hi-vis stripes */}
        <line x1="418" y1="248" x2="442" y2="248" stroke="#fbbf24" strokeWidth="2.5" opacity="0.7" />
        <line x1="418" y1="254" x2="442" y2="254" stroke="#fbbf24" strokeWidth="2.5" opacity="0.7" />
        {/* Left arm reaching toward engine */}
        <path d="M420 228 Q410 232 403 225 Q398 220 395 210" stroke="#fbbf24" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" />
        <circle cx="394" cy="209" r="4" fill="#fbbf24" stroke="#d97706" strokeWidth="0.8" opacity="0.8" />
        {/* Right arm holding tool */}
        <path d="M440 230 Q450 238 455 250" stroke="#fbbf24" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.8" />
        {/* Screwdriver / tool in right hand */}
        <line x1="455" y1="250" x2="460" y2="270" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
        <rect x="458" y="268" width="6" height="3" rx="1" fill="#475569" opacity="0.6" />
        {/* Legs */}
        <line x1="425" y1="275" x2="422" y2="310" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
        <line x1="435" y1="275" x2="438" y2="310" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
        {/* Boots */}
        <rect x="417" y="308" width="12" height="7" rx="3" fill="#1e293b" opacity="0.6" />
        <rect x="433" y="308" width="12" height="7" rx="3" fill="#1e293b" opacity="0.6" />
      </g>

      {/* ── Toolbox on ground ── */}
      <g opacity="0.4">
        <rect x="460" y="300" width="36" height="18" rx="3" fill="#dc2626" stroke="#b91c1c" strokeWidth="1" />
        <rect x="472" y="298" width="12" height="3" rx="1.5" fill="#b91c1c" />
        <line x1="470" y1="309" x2="486" y2="309" stroke="#fca5a5" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* ── Satellite / signal icon (top right, faint) ── */}
      <g opacity="0.2" transform="translate(440, 40)">
        <circle cx="0" cy="0" r="8" fill="#0ea5e9" />
        {/* Solar panels */}
        <rect x="-28" y="-4" width="18" height="8" rx="1" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="0.8" />
        <rect x="10" y="-4" width="18" height="8" rx="1" fill="#38bdf8" stroke="#0ea5e9" strokeWidth="0.8" />
        {/* Signal arcs */}
        <path d="M-5 12 Q0 20 5 12" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
        <path d="M-10 16 Q0 28 10 16" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
        <path d="M-15 20 Q0 36 15 20" stroke="#0ea5e9" strokeWidth="1.5" fill="none" />
      </g>

      {/* ── Location pin (top left, faint) ── */}
      <g opacity="0.15" transform="translate(60, 60)">
        <path d="M0 -20 C-15 -20 -20 -8 -20 0 C-20 15 0 30 0 30 C0 30 20 15 20 0 C20 -8 15 -20 0 -20 Z" fill="#0ea5e9" />
        <circle cx="0" cy="-2" r="7" fill="white" />
      </g>

      {/* ── Clipboard / checklist (floating, faint) ── */}
      <g opacity="0.15" transform="translate(70, 140)">
        <rect x="-16" y="-22" width="32" height="44" rx="3" fill="#94a3b8" />
        <rect x="-10" y="-26" width="20" height="8" rx="2" fill="#64748b" />
        <line x1="-8" y1="-10" x2="8" y2="-10" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="-8" y1="-2" x2="8" y2="-2" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="-8" y1="6" x2="4" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
        {/* Checkmarks */}
        <path d="M-12 -11 l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M-12 -3 l2 2 4-4" stroke="#22c55e" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function getApiDisplayUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL || '/api/v1/'
  return configured.replace(/\/+$/, '')
}

export default function Login() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  }, [t])
  const setAuth = useAuthStore((s) => s.setAuth)
  const setProfile = useAuthStore((s) => s.setProfile)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const apiDisplayUrl = useMemo(() => getApiDisplayUrl(), [])

  const isFormValid = useMemo(() => username.trim().length > 0 && password.length > 0, [username, password])

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: async (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken)
      try {
        const profile = await usersApi.me()
        setProfile(profile)
      } catch {
        // Profile is optional for navigation; it will be fetched again in the app shell.
      }
      navigate('/app', { replace: true })
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message ?? err?.message ?? 'Login failed'
      if (err?.message === 'Network Error' || err?.code === 'ERR_NETWORK') {
        setError(tRef.current('login.error.network'))
      } else {
        setError(message)
      }
    },
  })

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    loginMutation.mutate({ username: username.trim(), password })
  }

  return (
    <div className="relative min-h-screen overflow-hidden text-slate-900">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.28] [background-image:linear-gradient(to_right,rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.18)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute -top-56 left-1/2 h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-sky-500/12 blur-3xl" />
        <div className="absolute -bottom-56 right-[-180px] h-[760px] w-[760px] rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitch />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            <div className="relative">
              {/* Illustration behind hero text */}
              <div className="pointer-events-none absolute -right-10 -top-8 h-[340px] w-[440px] opacity-40">
                <HeroIllustration />
              </div>

              <div className="relative">
                <BrandMark subtitle={t('login.brandSubtitle')} />
                <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-900">{t('login.heroTitle')}</h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">{t('login.heroBody')}</p>
              </div>
            </div>

            <div className="relative mt-8 grid max-w-md gap-4 rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-sm backdrop-blur">
              <div className="flex items-center gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">{t('login.bullet401')}</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex items-center gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">{t('login.bulletRoutes')}</p>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex items-center gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-slate-700">{t('login.bulletState')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 p-7 shadow-lg shadow-slate-200/50 backdrop-blur">
              <div className="flex items-center justify-between gap-4">
                <BrandMark subtitle={t('login.brandSubtitle')} />
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {t('login.secureBadge')}
                </span>
              </div>

              <h2 className="mt-7 text-xl font-bold text-slate-900">{t('login.welcome')}</h2>
              <p className="mt-1 text-sm text-slate-500">{t('login.instructions')}</p>
              <p className="mt-2 text-xs text-slate-400">{t('login.credentialsHint')}</p>

              {error ? (
                <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-rose-700">{error}</p>
                </div>
              ) : null}

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('login.username')}</label>
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loginMutation.isPending}
                      placeholder="e.g. technician01"
                      autoComplete="username"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t('login.password')}</label>
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loginMutation.isPending}
                      placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-16 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/20 transition focus:border-sky-500 focus:ring-4 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 disabled:pointer-events-none disabled:opacity-60"
                      onClick={() => setShowPassword((s) => !s)}
                      disabled={loginMutation.isPending}
                    >
                      {showPassword ? t('login.hide') : t('login.show')}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginMutation.isPending || !isFormValid}
                  className={classNames(
                    'inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.98]',
                    loginMutation.isPending || !isFormValid
                      ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                      : 'bg-sky-600 shadow-sky-600/20 hover:bg-sky-700',
                  )}
                >
                  {loginMutation.isPending ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                  )}
                  {loginMutation.isPending ? t('login.submitting') : t('login.submit')}
                </button>

                <p className="text-center text-[11px] text-slate-400">
                  {t('login.apiLabel')} <span className="font-medium text-slate-500">{apiDisplayUrl}</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
