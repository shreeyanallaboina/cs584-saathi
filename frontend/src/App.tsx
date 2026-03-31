import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import ChatbotPage from './pages/ChatbotPage'
import ForumNew from './pages/ForumNew'
import ForumPage from './pages/ForumPage'
import Home from './pages/Home'
import Landing from './pages/Landing'
import LHWPortal from './pages/LHWPortal'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/lhw" element={<LHWPortal />} />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Home />} />
            <Route path="chat" element={<ChatbotPage />} />
            <Route path="forum" element={<ForumPage />} />
            <Route path="forum/new" element={<ForumNew />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
