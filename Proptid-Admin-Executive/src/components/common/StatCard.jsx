
import { ArrowDownRight, ArrowUpRight } from "lucide-react"

export default function StatCard({
  title,
  value,
  change,
  icon: Icon,
  color = "blue",
}) {
  const isPositive = change >= 0

  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span>{title}</span>

        {Icon && (
          <div className={`stat-icon ${color}`}>
            <Icon size={20} />
          </div>
        )}
      </div>

      <h2>{value}</h2>

      {change !== undefined && (
        <p className={isPositive ? "stat-positive" : "stat-negative"}>
          {isPositive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
          {Math.abs(change)}% from last month
        </p>
      )}
    </div>
  )
}
