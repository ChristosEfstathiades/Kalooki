import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

/** Every remembered setting is namespaced, like the theme key. */
const STORAGE_PREFIX = 'kalooki.'

/**
 * Reads a stored preference and hands the raw JSON to the caller's
 * parser. Anything unreadable (storage blocked, corrupt JSON, a shape
 * left behind by an older release) resolves to null so the caller keeps
 * its defaults.
 */
function readPreference<TValue>(
  key: string,
  parse: (stored: unknown) => TValue | null,
): TValue | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    return raw === null ? null : parse(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

/**
 * Writes a preference, ignoring failures: storage being unavailable
 * (private browsing, quota) must never break the form the user is
 * filling in.
 */
function writePreference(key: string, value: unknown): void {
  if (typeof window === 'undefined') {
    return
  }
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // The choice still applies to this page view, it just will not
    // survive a reload.
  }
}

/**
 * `useState` that remembers the value on this device. It starts from
 * the fallback so the server render and the first client render agree,
 * then swaps in the stored value once mounted; every change after that
 * is written back.
 *
 * `parse` must be a stable (module-level) function and is responsible
 * for validating the stored value, since it may have been written by an
 * older version of the app.
 */
export function useStoredState<TValue>(
  key: string,
  fallback: TValue,
  parse: (stored: unknown) => TValue | null,
): [TValue, Dispatch<SetStateAction<TValue>>] {
  const [value, setValue] = useState<TValue>(fallback)
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    const stored = readPreference(key, parse)
    if (stored !== null) {
      setValue(stored)
    }
    setRestored(true)
  }, [key, parse])

  // Persisting only once the stored value is in state stops the first
  // render's fallback from overwriting what was saved
  useEffect(() => {
    if (restored) {
      writePreference(key, value)
    }
  }, [key, restored, value])

  return [value, setValue]
}

/**
 * Narrows a stored value to a whole number inside `min`..`max`,
 * returning the fallback when it is missing or out of range.
 */
export function storedNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : fallback
}

/** Narrows a stored value to one of a fixed set of options. */
export function storedOption<TValue extends string | number>(
  value: unknown,
  options: readonly TValue[],
  fallback: TValue,
): TValue {
  return options.includes(value as TValue) ? (value as TValue) : fallback
}

/** Reads a stored value that should be an object, or null. */
export function storedObject(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null
}
