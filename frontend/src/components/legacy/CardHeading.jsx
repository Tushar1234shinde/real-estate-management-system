import React from "react"
import { ChevronRight } from "lucide-react"

export function CardHeading({ title, subtitle, action, onAction }) {
  return (
    <div className="card-heading">
      <div>
        <h3>{title}</h3>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={onAction}>
          {action}
          <ChevronRight />
        </button>
      )}
    </div>
  )
}