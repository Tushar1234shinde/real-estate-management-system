import { createBrowserRouter, Navigate } from "react-router"
import LoginPage from "../pages/LoginPage.jsx"
import Dashboard from "../pages/Dashboard.jsx"

export const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  { path: "/app/:role/:section", Component: Dashboard },
  { path: "/app/:role", element: <Navigate to="overview" replace /> },
  { path: "*", element: <Navigate to="/" replace /> },
])
