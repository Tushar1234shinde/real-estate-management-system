import React from "react"

export function Notification({ icon: Icon, title, text, time }) {
  return (
    <div className="notification">
      <span>
        <Icon />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
      <small>{time}</small>
    </div>
  )
}