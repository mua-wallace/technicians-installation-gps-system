import { BrowserRouter, Route, Routes } from 'react-router-dom'
import Login from './pages/Login'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { RootRedirect } from './routes/RootRedirect'
import { App } from './App'

export function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <App />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

