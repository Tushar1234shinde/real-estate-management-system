import { createBrowserRouter, Navigate } from "react-router"
import {
  RequireAuth,
  RequireRole,
  UnauthorizedPage,
} from "../auth/RouteGuards.jsx"
import LoginPage from "../pages/LoginPage.jsx"
import Dashboard from "../pages/Dashboard.jsx"

export const router = createBrowserRouter([
  { path: "/", Component: LoginPage },
  {
    element: <RequireAuth />,
    children: [
      { path: "/unauthorized", Component: UnauthorizedPage },
      {
        path: "/app/:role",
        element: <RequireRole />,
        children: [
          { index: true, element: <Navigate to="overview" replace /> },
          { path: ":section", Component: Dashboard },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
])
