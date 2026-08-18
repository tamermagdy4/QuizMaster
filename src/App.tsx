import { lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
} from 'react-router-dom'

import { getSupabaseClient } from './lib/supabaseClient'

import { MainLayout } from './layouts/MainLayout'
import { PageLoader } from './components/ui/PageLoader'

import { AdminGuard } from './components/admin/AdminGuard'

// ---- Lazy route pages: each page is its own chunk, loaded only when its
// route is visited. This keeps the initial bundle small (no GameBoard, no
// Home cinematic scenes, no Admin pages on first paint) and makes navigation
// between routes cheap because every chunk is cached after its first load. ----
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })))
const About = lazy(() => import('./pages/About').then((m) => ({ default: m.About })))
const CreateGame = lazy(() => import('./pages/CreateGame').then((m) => ({ default: m.CreateGame })))
const GameBoard = lazy(() => import('./pages/GameBoard').then((m) => ({ default: m.GameBoard })))
const QuestionScreen = lazy(() => import('./pages/QuestionScreen').then((m) => ({ default: m.QuestionScreen })))
const OnlineHome = lazy(() => import('./pages/OnlineHome').then((m) => ({ default: m.OnlineHome })))
const OnlineRoom = lazy(() => import('./pages/OnlineRoom').then((m) => ({ default: m.OnlineRoom })))
const Results = lazy(() => import('./pages/Results').then((m) => ({ default: m.Results })))
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })))
const PrivacyPolicy = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.PrivacyPolicy })))
const TermsOfService = lazy(() => import('./pages/LegalPages').then((m) => ({ default: m.TermsOfService })))
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword').then((m) => ({ default: m.ForgotPassword })))
const Login = lazy(() => import('./pages/auth/Login').then((m) => ({ default: m.Login })))
const Signup = lazy(() => import('./pages/auth/Signup').then((m) => ({ default: m.Signup })))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin').then((m) => ({ default: m.AdminLogin })))
const AdminLayout = lazy(() => import('./components/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })))
const AdminQuestions = lazy(() => import('./pages/admin/AdminQuestions').then((m) => ({ default: m.AdminQuestions })))
const AdminQuestionDetails = lazy(() => import('./pages/admin/AdminQuestionDetails').then((m) => ({ default: m.AdminQuestionDetails })))
const AdminQuestionForm = lazy(() => import('./pages/admin/AdminQuestionForm').then((m) => ({ default: m.AdminQuestionForm })))
const AdminCategories = lazy(() => import('./pages/admin/AdminCategories').then((m) => ({ default: m.AdminCategories })))
const AdminImport = lazy(() => import('./pages/admin/AdminImport').then((m) => ({ default: m.AdminImport })))
const AdminExport = lazy(() => import('./pages/admin/AdminExport').then((m) => ({ default: m.AdminExport })))
const AdminStatistics = lazy(() => import('./pages/admin/AdminStatistics').then((m) => ({ default: m.AdminStatistics })))
const AdminPacks = lazy(() => import('./pages/admin/AdminPacks').then((m) => ({ default: m.AdminPacks })))
const PacksHome = lazy(() => import('./pages/packs/PacksHome').then((m) => ({ default: m.PacksHome })))
const PackDetails = lazy(() => import('./pages/packs/PackDetails').then((m) => ({ default: m.PackDetails })))
const PackEditor = lazy(() => import('./pages/packs/PackEditor').then((m) => ({ default: m.PackEditor })))
const PackPlay = lazy(() => import('./pages/packs/PackPlay').then((m) => ({ default: m.PackPlay })))
const LiveJoin = lazy(() => import('./pages/packs/LiveJoin').then((m) => ({ default: m.LiveJoin })))
const LiveRoom = lazy(() => import('./pages/packs/LiveRoom').then((m) => ({ default: m.LiveRoom })))

/** Wraps a lazy page in Suspense so chunk loading shows a light skeleton. */
function LazyPage({ page }: { page: ComponentType }) {
  const Page = page
  return (
    <Suspense fallback={<PageLoader />}>
      <Page />
    </Suspense>
  )
}

function ProtectedRoute({
  children,
}: {
  children: ReactNode
}) {
  const location = useLocation()
  const [isChecking, setIsChecking] = useState(true)
  const [isAuthenticated, setIsAuthenticated] =
    useState(false)

  useEffect(() => {
    const supabase = getSupabaseClient()

    supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(!!data.session)
      setIsChecking(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session)
        setIsChecking(false)
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (isChecking) {
    return null
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
        }}
      />
    )
  }

  return children
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <LazyPage page={Home} /> },
      { path: 'about', element: <LazyPage page={About} /> },

      {
        path: 'create',
        element: (
          <ProtectedRoute>
            <LazyPage page={CreateGame} />
          </ProtectedRoute>
        ),
      },

      {
        path: 'board',
        element: <LazyPage page={GameBoard} />,
      },
      {
        path: 'question',
        element: <LazyPage page={QuestionScreen} />,
      },
      { path: 'online', element: <LazyPage page={OnlineHome} /> },
      { path: 'online/room', element: <LazyPage page={OnlineRoom} /> },
      { path: 'results', element: <LazyPage page={Results} /> },
      { path: 'settings', element: <LazyPage page={Settings} /> },
      { path: 'profile', element: <LazyPage page={Profile} /> },
      { path: 'privacy', element: <LazyPage page={PrivacyPolicy} /> },
      { path: 'terms', element: <LazyPage page={TermsOfService} /> },
      { path: 'forgot-password', element: <LazyPage page={ForgotPassword} /> },
      { path: 'packs', element: <LazyPage page={PacksHome} /> },
      { path: 'packs/new', element: <LazyPage page={PackEditor} /> },
      { path: 'packs/:packId', element: <LazyPage page={PackDetails} /> },
      {
        path: 'packs/:packId/edit',
        element: (
          <ProtectedRoute>
            <LazyPage page={PackEditor} />
          </ProtectedRoute>
        ),
      },
      { path: 'packs/:packId/play', element: <LazyPage page={PackPlay} /> },
      {
        path: 'packs/live/join',
        element: (
          <ProtectedRoute>
            <LazyPage page={LiveJoin} />
          </ProtectedRoute>
        ),
      },
      {
        path: 'packs/live/:roomId',
        element: (
          <ProtectedRoute>
            <LazyPage page={LiveRoom} />
          </ProtectedRoute>
        ),
      },
    ],
  },

  {
    path: '/login',
    element: <LazyPage page={Login} />,
  },

  {
    path: '/signup',
    element: <LazyPage page={Signup} />,
  },

  {
    path: '/admin/login',
    element: <LazyPage page={AdminLogin} />,
  },

  {
    path: '/admin',
    element: (
      <AdminGuard>
        <LazyPage page={AdminLayout} />
      </AdminGuard>
    ),
    children: [
      { index: true, element: <LazyPage page={AdminDashboard} /> },
      { path: 'questions', element: <LazyPage page={AdminQuestions} /> },
      { path: 'questions/add', element: <LazyPage page={AdminQuestionForm} /> },
      { path: 'questions/new', element: <LazyPage page={AdminQuestionForm} /> },
      {
        path: 'questions/:id/edit',
        element: <LazyPage page={AdminQuestionForm} />,
      },
      {
        path: 'questions/:id',
        element: <LazyPage page={AdminQuestionDetails} />,
      },
      { path: 'categories', element: <LazyPage page={AdminCategories} /> },
      { path: 'packs', element: <LazyPage page={AdminPacks} /> },
      { path: 'import', element: <LazyPage page={AdminImport} /> },
      { path: 'export', element: <LazyPage page={AdminExport} /> },
      { path: 'statistics', element: <LazyPage page={AdminStatistics} /> },
    ],
  },
])

function App() {
  return (
    // Respect the OS-level "reduce motion" preference for every framer-motion
    // animation in the app (page transitions, cards, modals, confetti, ...).
    <MotionConfig reducedMotion="user">
      <RouterProvider router={router} />
    </MotionConfig>
  )
}

export default App
