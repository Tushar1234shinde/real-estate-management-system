import React from "react"
import { ArrowRight } from "lucide-react"

export function StatCard({ icon: Icon, label, value, tone = "blue", onClick }) {
  return (
    <button className="stat-card" onClick={onClick} disabled={!onClick}>
      <div className={`stat-icon ${tone}`}>
        <Icon />
      </div>
      <div className="stat-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      {onClick && <ArrowRight className="card-arrow" />}
    </button>
  )
}