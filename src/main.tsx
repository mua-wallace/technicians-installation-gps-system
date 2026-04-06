import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from './i18n/I18nContext'
import { Router } from './Router'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.querySelector<HTMLDivElement>('#app')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <Router />
      </I18nProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)

