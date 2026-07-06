import { useStore } from '@tanstack/react-form'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import type { AnyFieldApi } from '@tanstack/react-form'

interface TextFieldProps {
  field: AnyFieldApi
  label: string
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  hint?: string
}

/**
 * Reads the display message from a TanStack Form field error, which is
 * a plain string or a standard-schema issue object.
 */
function errorMessage(error: unknown): string | null {
  if (typeof error === 'string') {
    return error
  }
  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message
  }
  return null
}

/**
 * Labelled text input bound to a TanStack Form field, with an optional
 * hint line and the field's first validation error underneath.
 */
export default function TextField({
  field,
  label,
  type = 'text',
  autoComplete,
  hint,
}: TextFieldProps) {
  const errors = useStore(field.store, (state) => state.meta.errors)
  const isTouched = useStore(field.store, (state) => state.meta.isTouched)
  const firstError = isTouched
    ? (errors.map(errorMessage).find((m) => m !== null) ?? null)
    : null

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        value={field.state.value}
        aria-invalid={firstError !== null}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
      />
      {hint && firstError === null && (
        <p className="m-0 text-xs text-muted-foreground">{hint}</p>
      )}
      {firstError !== null && (
        <p className="m-0 text-xs text-destructive-foreground">{firstError}</p>
      )}
    </div>
  )
}
