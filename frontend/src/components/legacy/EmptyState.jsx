import React from "react"
import { Search } from "lucide-react"

export function EmptyState({
  title = "No matching records",
  text = "Try changing your search or filters.",
}) {
  return (
    <div className="empty-state">
      <Search />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  )
}