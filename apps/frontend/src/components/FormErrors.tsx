interface FormErrorsProps {
  errors: string[]
}

/**
 * Server-side error messages for a form, rendered as an alert above
 * the fields. Renders nothing when there are no errors.
 */
export default function FormErrors({ errors }: FormErrorsProps) {
  if (errors.length === 0) {
    return null
  }

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
    >
      {errors.map((message) => (
        <p key={message} className="m-0">
          {message}
        </p>
      ))}
    </div>
  )
}
