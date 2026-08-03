import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { Home } from './pages/Home'
import { CreateGame } from './pages/CreateGame'
import { GameBoard } from './pages/GameBoard'
import { QuestionScreen } from './pages/QuestionScreen'
import { Results } from './pages/Results'
import { Settings } from './pages/Settings'
import { Admin } from './pages/Admin'

const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'create', element: <CreateGame /> },
      { path: 'board', element: <GameBoard /> },
      { path: 'question', element: <QuestionScreen /> },
      { path: 'results', element: <Results /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin', element: <Admin /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
