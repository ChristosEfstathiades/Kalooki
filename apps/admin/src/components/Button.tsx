import { cn } from '#/lib/utils'
import type { ComponentProps } from 'react'

type ButtonVariant = 'primary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md'

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink hover:bg-accent-hover',
  danger: 'bg-danger text-ink hover:bg-danger-hover',
  outline: 'border border-edge text-ink hover:bg-panel-raised',
  ghost: 'text-ink-soft hover:bg-panel-raised hover:text-ink',
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 gap-1 px-2 text-xs',
  md: 'h-9 gap-2 px-4 text-sm',
}

/**
 * The admin app's only button primitive. Deliberately small: this tool
 * does not pull in the player site's shadcn/ui component set.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent-hover focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg:not([class*='size-'])]:size-3.5",
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    />
  )
}
