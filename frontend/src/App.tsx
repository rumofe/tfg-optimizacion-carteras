import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OptimizerPage from './pages/OptimizerPage';
import XRayPage from './pages/XRayPage';
import BacktestPage from './pages/BacktestPage';
import ComparePage from './pages/ComparePage';
import PlannerPage from './pages/PlannerPage';
import ProjectionPage from './pages/ProjectionPage';
import FiscalidadPage from './pages/FiscalidadPage';
import ProfilePage from './pages/ProfilePage';

const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  {
    path: '/dashboard',
    element: <DashboardPage />,
    children: [
      { index: true, element: <Navigate to="planner" replace /> },
      { path: 'planner',   element: <PlannerPage /> },
      { path: 'optimizer', element: <OptimizerPage /> },
      { path: 'xray',      element: <XRayPage /> },
      { path: 'backtest',  element: <BacktestPage /> },
      { path: 'compare',   element: <ComparePage /> },
      { path: 'projection', element: <ProjectionPage /> },
      { path: 'fiscalidad', element: <FiscalidadPage /> },
      { path: 'profile',   element: <ProfilePage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
