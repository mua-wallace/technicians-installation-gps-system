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
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-600/10 ring-1 ring-sky-600/25">
        <svg className="h-5 w-5 text-sky-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
          />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-900">malambi</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
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
    <div className="relative min-h-screen overflow-hidden bg-slate-100 text-slate-900">
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
            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-slate-900">{t('login.heroTitle')}</h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-600">{t('login.heroBody')}</p>

            <div className="mt-8 grid max-w-md gap-3 rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-500" />
                <p className="text-sm text-slate-700">{t('login.bullet401')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-sky-500" />
                <p className="text-sm text-slate-700">{t('login.bulletRoutes')}</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-violet-500" />
                <p className="text-sm text-slate-700">{t('login.bulletState')}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <BrandMark subtitle={t('login.brandSubtitle')} />
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                  {t('login.secureBadge')}
                </span>
              </div>

              <h2 className="mt-6 text-xl font-semibold text-slate-900">{t('login.welcome')}</h2>
              <p className="mt-1 text-sm text-slate-600">{t('login.instructions')}</p>
              <p className="mt-2 text-xs text-slate-500">{t('login.credentialsHint')}</p>

              {error ? (
                <div className="mt-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('login.username')}</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loginMutation.isPending}
                    placeholder="e.g. technician01"
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/20 focus:border-sky-600 focus:ring-4 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">{t('login.password')}</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loginMutation.isPending}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-14 text-sm text-slate-900 placeholder:text-slate-400 outline-none ring-sky-500/20 focus:border-sky-600 focus:ring-4 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-60"
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
                    'w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition',
                    loginMutation.isPending || !isFormValid
                      ? 'cursor-not-allowed bg-slate-300 text-slate-600'
                      : 'bg-sky-600 hover:bg-sky-700',
                  )}
                >
                  {loginMutation.isPending ? t('login.submitting') : t('login.submit')}
                </button>

                <p className="text-center text-xs text-slate-500">
                  {t('login.apiLabel')} <span className="font-medium text-slate-700">{apiDisplayUrl}</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
