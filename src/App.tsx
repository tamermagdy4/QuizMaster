import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { Home } from './pages/Home'
import { About } from './pages/About'
import { CreateGame } from './pages/CreateGame'
import { GameBoard } from './pages/GameBoard'

import { QuestionScreen } from './pages/QuestionScreen'
import { Results } from './pages/Results'
import { Settings } from './pages/Settings'
import { AdminGuard } from './components/admin/AdminGuard'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminLayout } from './components/admin/AdminLayout'
import { AdminDashboard } from './pages/admin/AdminDashboard'
import { AdminQuestions } from './pages/admin/AdminQuestions'
import { AdminQuestionDetails } from './pages/admin/AdminQuestionDetails'
import { AdminQuestionForm } from './pages/admin/AdminQuestionForm'
import { AdminCategories } from './pages/admin/AdminCategories'
import { AdminImport } from './pages/admin/AdminImport'
import { AdminExport } from './pages/admin/AdminExport'
import { AdminStatistics } from './pages/admin/AdminStatistics'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'about', element: <About /> },
      { path: 'create', element: <CreateGame /> },
      { path: 'board', element: <GameBoard /> },

      { path: 'question', element: <QuestionScreen /> },
      { path: 'results', element: <Results /> },
      { path: 'settings', element: <Settings /> },

    ],
  },
  {
    path: '/admin/login',
    element: <AdminLogin />,
  },
  {
    path: '/admin',
    element: <AdminGuard><AdminLayout /></AdminGuard>,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'questions', element: <AdminQuestions /> },
      { path: 'questions/add', element: <AdminQuestionForm /> },
      { path: 'questions/new', element: <AdminQuestionForm /> },
      { path: 'questions/:id/edit', element: <AdminQuestionForm /> },
      { path: 'questions/:id', element: <AdminQuestionDetails /> },
      { path: 'categories', element: <AdminCategories /> },
      { path: 'import', element: <AdminImport /> },
      { path: 'export', element: <AdminExport /> },
      { path: 'statistics', element: <AdminStatistics /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
