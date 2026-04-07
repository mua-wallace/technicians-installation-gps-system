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
            <BrandMark subtitle={t('login.brandSubtitle')} />
            <h1 className="mt-8 text-4xl font-bold tracking-tight text-slate-900">{t('login.heroTitle')}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-500">{t('login.heroBody')}</p>

            <div className="mt-8 grid max-w-md gap-4 rounded-2xl border border-slate-200/80 bg-white/80 p-6 backdrop-blur">
              <div className="flex items-start gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t('login.bullet401')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t('login.bulletRoutes')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
                  <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{t('login.bulletState')}</p>
                </div>
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
