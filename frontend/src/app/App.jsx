import { RouterProvider } from "react-router"
import { AuthProvider } from "../auth/AuthContext.jsx"
import { router } from "./routes.jsx"

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
