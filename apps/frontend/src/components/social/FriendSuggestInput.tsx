import { useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { friendsQueryOptions } from '#/lib/social'
import UserAvatar from '#/components/UserAvatar'
import { Input } from '#/components/ui/input'
import { cn } from '#/lib/utils'

interface FriendSuggestInputProps {
  value: string
  onValueChange: (value: string) => void
  /** Friends to leave out of the suggestions, e.g. existing members. */
  excludedUserIds: number[]
  placeholder: string
  label: string
}

const MAX_SUGGESTIONS = 6

/**
 * Username input that suggests matches while typing — only from the
 * user's own friends list, never from all users (docs/features.md,
 * Private Groups). Suggestions drop down under the input; arrow keys +
 * Enter or a click pick one, Escape dismisses.
 */
export default function FriendSuggestInput({
  value,
  onValueChange,
  excludedUserIds,
  placeholder,
  label,
}: FriendSuggestInputProps) {
  const listId = useId()
  const { data: friends } = useQuery(friendsQueryOptions)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)

  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase()
    if (query === '' || !friends) {
      return []
    }
    return friends
      .filter(
        (friend) =>
          friend.username.toLowerCase().includes(query) &&
          !excludedUserIds.includes(friend.id),
      )
      .sort((a, b) => {
        const aStarts = a.username.toLowerCase().startsWith(query)
        const bStarts = b.username.toLowerCase().startsWith(query)
        if (aStarts !== bStarts) {
          return aStarts ? -1 : 1
        }
        return a.username.localeCompare(b.username)
      })
      .slice(0, MAX_SUGGESTIONS)
  }, [friends, value, excludedUserIds])

  const open = focused && !dismissed && suggestions.length > 0

  const pick = (username: string) => {
    onValueChange(username)
    setDismissed(true)
    setHighlighted(-1)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setHighlighted((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setHighlighted(
        (index) => (index - 1 + suggestions.length) % suggestions.length,
      )
    } else if (event.key === 'Enter' && highlighted >= 0) {
      // Enter with no highlight falls through and submits the form
      event.preventDefault()
      pick(suggestions[highlighted].username)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDismissed(true)
      setHighlighted(-1)
    }
  }

  return (
    <div className="relative flex-1">
      <Input
        value={value}
        onChange={(event) => {
          onValueChange(event.target.value)
          setDismissed(false)
          setHighlighted(-1)
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && highlighted >= 0 ? `${listId}-${highlighted}` : undefined
        }
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Matching friends"
          className="absolute top-full right-0 left-0 z-50 m-0 mt-1 max-h-56 list-none overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {suggestions.map((friend, index) => (
            <li
              key={friend.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlighted}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                index === highlighted && 'bg-accent text-accent-foreground',
              )}
              // preventDefault keeps focus on the input so blur doesn't
              // close the list before the click lands
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(friend.username)}
              onMouseEnter={() => setHighlighted(index)}
            >
              <UserAvatar user={friend} className="size-6" />
              <span className="truncate">{friend.username}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
