interface ContentPageProps {
  title: string
  intro?: string
  children: React.ReactNode
}

/**
 * Shared layout for text-heavy content pages (rules, tips, contact,
 * privacy): a constrained column with a title and optional intro line.
 */
export default function ContentPage({
  title,
  intro,
  children,
}: ContentPageProps) {
  return (
    <article className="page-wrap max-w-3xl py-8 sm:py-12">
      <h1 className="m-0 text-3xl font-bold">{title}</h1>
      {intro && <p className="mt-3 mb-0 text-muted-foreground">{intro}</p>}
      <div className="mt-8 space-y-8">{children}</div>
    </article>
  )
}

interface ContentSectionProps {
  heading: string
  children: React.ReactNode
}

/**
 * Titled section inside a ContentPage.
 */
export function ContentSection({ heading, children }: ContentSectionProps) {
  return (
    <section>
      <h2 className="m-0 text-xl font-semibold">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  )
}
