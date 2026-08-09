import { ChevronLeft, ChevronRight } from 'lucide-react'
import Button from '#/components/Button'

interface PaginationProps {
  page: number
  lastPage: number
  total: number
  /** What is being counted, e.g. "messages". */
  noun: string
  onChange: (page: number) => void
}

/**
 * Previous/next paging shared by every admin list. Renders nothing when
 * there is only one page, so a short list is not padded with a footer
 * that does nothing.
 */
export default function Pagination({
  page,
  lastPage,
  total,
  noun,
  onChange,
}: PaginationProps) {
  if (lastPage <= 1) {
    return null
  }

  return (
    <footer className="flex items-center justify-end gap-2 border-t border-edge px-4 py-2 text-sm">
      <span className="mr-auto text-ink-soft">
        {total} {noun} · page {page} of {lastPage}
      </span>
      <Button
        size="sm"
        variant="outline"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        <ChevronLeft aria-hidden="true" />
        Previous
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
      >
        Next
        <ChevronRight aria-hidden="true" />
      </Button>
    </footer>
  )
}
