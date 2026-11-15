import React from "react"

export function StatusBadge({ status }) {
  const tone =
    /complete|active|interested/i.test(status) && !/not/i.test(status)
      ? "success"
      : /scheduled|reached|contacted/i.test(status)
        ? "warning"
        : /not interested|inactive/i.test(status)
          ? "danger"
          : "neutral"

  return (
    <span className={`status ${tone}`}>
      <i />
      {status}
    </span>
  )
}