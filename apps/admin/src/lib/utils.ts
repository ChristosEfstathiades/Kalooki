import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ClassValue } from 'clsx'

/**
 * Merges conditional class names, letting later Tailwind utilities win
 * over earlier ones.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

/**
 * Formats an ISO timestamp for the dense tables, or a dash when absent.
 */
export function formatDateTime(iso: string | null): string {
  if (iso === null) {
    return '—'
  }
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
