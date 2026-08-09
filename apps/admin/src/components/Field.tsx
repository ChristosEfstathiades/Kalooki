import { cn } from '#/lib/utils'
import type { ComponentProps, ReactNode } from 'react'

/**
 * The admin app's form primitives. Like Button, these are deliberately
 * minimal — a shared class string and a label wrapper, not a component
 * library — so the dense filter bars across the sections stay
 * consistent without pulling in shadcn/ui.
 */

const CONTROL_CLASSES =
  'w-full rounded-md border border-edge bg-surface px-2 text-sm text-ink outline-none placeholder:text-ink-soft focus-visible:ring-2 focus-visible:ring-accent-hover disabled:opacity-50'

interface FieldProps {
  label: string
  /** Hides the label visually while keeping it for screen readers. */
  hideLabel?: boolean
  hint?: string
  className?: string
  children: ReactNode
}

/**
 * Labels one control and, optionally, explains what it does.
 */
export function Field({
  label,
  hideLabel,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <label className={cn('block', className)}>
      <span
        className={cn(
          'mb-1 block text-xs font-medium tracking-wide text-ink-soft uppercase',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </span>
      {children}
      {hint !== undefined && (
        <span className="mt-1 block text-xs text-ink-soft">{hint}</span>
      )}
    </label>
  )
}

/**
 * Single-line text input.
 */
export function TextInput({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL_CLASSES, 'h-8', className)} {...props} />
}

/**
 * Multi-line input, for message bodies and notes.
 */
export function TextArea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(CONTROL_CLASSES, 'min-h-20 py-1.5', className)}
      {...props}
    />
  )
}

/**
 * Dropdown, used for every filter that has a fixed set of options.
 */
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn(CONTROL_CLASSES, 'h-8', className)} {...props} />
}

interface CheckboxProps extends Omit<ComponentProps<'input'>, 'type'> {
  label: string
}

/**
 * Checkbox with its label beside it, for the boolean filters.
 */
export function Checkbox({ label, className, ...props }: CheckboxProps) {
  return (
    <label
      className={cn('flex items-center gap-2 text-sm text-ink-soft', className)}
    >
      <input
        type="checkbox"
        className="size-3.5 accent-accent-hover"
        {...props}
      />
      {label}
    </label>
  )
}

interface ToggleProps {
  label: string
  description?: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/**
 * A labelled on/off switch for the operational flags, where the label
 * and its consequence both need to be readable at a glance.
 */
export function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-md border border-edge bg-surface px-3 py-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-4 accent-accent-hover"
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description !== undefined && (
          <span className="block text-xs text-ink-soft">{description}</span>
        )}
      </span>
    </label>
  )
}
