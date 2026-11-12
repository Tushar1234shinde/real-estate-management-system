
export default function PageHeading({
  title,
  description,
  action,
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      {action && (
        <div className="page-heading-action">
          {action}
        </div>
      )}
    </div>
  )
}
