import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../api/auth'
import { usersApi } from '../api/users'
import { useAuthStore } from '../store/auth.store'

function classNames(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(' ')
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 ring-1 ring-emerald-500/35">
        <svg className="h-5 w-5 text-emerald-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
          />
        </svg>
      </div>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-slate-50">malambi</p>
        <p className="text-xs text-slate-400">Technician Installation App</p>
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setProfile = useAuthStore((s) => s.setProfile)

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

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
        setError('Cannot reach the server. Check API URL, HTTPS/mixed-content, and CORS.')
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(to_right,rgba(148,163,184,0.12)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.10)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute -top-56 left-1/2 h-[760px] w-[760px] -translate-x-1/2 rounded-full bg-emerald-500/16 blur-3xl" />
        <div className="absolute -bottom-56 right-[-180px] h-[760px] w-[760px] rounded-full bg-sky-500/14 blur-3xl" />
        <div className="absolute bottom-[-220px] left-[-220px] h-[680px] w-[680px] rounded-full bg-violet-500/12 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/10 via-slate-950/40 to-slate-950" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
        <div className="grid w-full grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            <BrandMark />
            <h1 className="mt-8 text-4xl font-semibold tracking-tight text-slate-50">
              Log in to start your next installation
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-slate-300">
              Fast access to your technician dashboard, intervention history, and forms—secured with token refresh.
            </p>

            <div className="mt-8 grid max-w-md gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-sm text-slate-300">
                  Automatic token refresh on <span className="font-medium text-slate-100">401</span>
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-sky-400" />
                <p className="text-sm text-slate-300">Protected routes for the technician workspace</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-2 w-2 rounded-full bg-violet-400" />
                <p className="text-sm text-slate-300">Lightweight state with Zustand</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center lg:justify-end">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between gap-4">
                <BrandMark />
                <span className="rounded-full border border-slate-800 bg-slate-900/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
                  Secure login
                </span>
              </div>

              <h2 className="mt-6 text-xl font-semibold text-slate-50">Welcome back</h2>
              <p className="mt-1 text-sm text-slate-400">Enter your username and password to continue.</p>
              <p className="mt-2 text-xs text-slate-500">
                Use your <span className="font-medium text-slate-300">Malambi</span> credentials to sign in.
              </p>

              {error ? (
                <div className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {error}
                </div>
              ) : null}

              <form className="mt-6 space-y-4" onSubmit={onSubmit}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Username</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loginMutation.isPending}
                    placeholder="e.g. technician01"
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-emerald-500/30 focus:border-emerald-500/60 focus:ring-4 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loginMutation.isPending}
                      placeholder="••••••••"
                      autoComplete="current-password"
                      className="w-full rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 pr-14 text-sm text-slate-100 placeholder:text-slate-500 outline-none ring-emerald-500/30 focus:border-emerald-500/60 focus:ring-4 disabled:opacity-60"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-slate-100 disabled:pointer-events-none disabled:opacity-60"
                      onClick={() => setShowPassword((s) => !s)}
                      disabled={loginMutation.isPending}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loginMutation.isPending || !isFormValid}
                  className={classNames(
                    'w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-950 shadow-sm transition',
                    loginMutation.isPending || !isFormValid
                      ? 'cursor-not-allowed bg-slate-700 text-slate-300'
                      : 'bg-emerald-400 hover:bg-emerald-300',
                  )}
                >
                  {loginMutation.isPending ? 'Logging in…' : 'Login'}
                </button>

                <p className="text-center text-xs text-slate-500">
                  API: <span className="font-medium text-slate-300">http://localhost:5001/api/v1</span>
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

