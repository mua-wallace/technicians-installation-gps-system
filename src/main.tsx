import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Router } from './Router'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.querySelector<HTMLDivElement>('#app')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  </React.StrictMode>,
)

