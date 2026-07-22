import type { DateTime } from 'luxon'
import { Exception } from '@adonisjs/core/exceptions'
import NewsItem from '#models/news_item'
import { recordAction } from '#services/moderation_service'
import type User from '#models/user'
import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'

type NewsQuery = ModelQueryBuilderContract<typeof NewsItem, NewsItem>

/**
 * The news panel on the play page. Players see published items only;
 * the admin app sees drafts too and can create, edit, pin and delete
 * them. Every change is written to the moderation audit trail so the
 * site's public copy has the same accountability as its moderation.
 */

/** Items returned to players. Enough for the panel, not the archive. */
const PUBLIC_NEWS_LIMIT = 10

export interface NewsInput {
  body: string
  publishedAt: DateTime
  isPublished: boolean
  isPinned: boolean
}

/**
 * Ordering shared by the public panel and the admin list: pinned items
 * first, then newest by publication date.
 */
function orderNews(query: NewsQuery): NewsQuery {
  return query.orderBy('isPinned', 'desc').orderBy('publishedAt', 'desc').orderBy('id', 'desc')
}

/**
 * Published news for the play page, pinned first then newest.
 */
export async function listPublishedNews(): Promise<NewsItem[]> {
  return orderNews(NewsItem.query().where('isPublished', true)).limit(PUBLIC_NEWS_LIMIT)
}

/**
 * Every news item including drafts, for the admin app.
 */
export async function listAllNews(): Promise<NewsItem[]> {
  return orderNews(NewsItem.query().preload('author'))
}

/**
 * Loads one item.
 *
 * @throws Exception (404) when no such item exists.
 */
export async function findNewsItem(id: number): Promise<NewsItem> {
  const item = await NewsItem.find(id)
  if (!item) {
    throw new Exception('News item not found', { status: 404, code: 'E_NEWS_NOT_FOUND' })
  }
  return item
}

/**
 * Publishes a new item, attributed to the admin who wrote it.
 */
export async function createNewsItem(actor: User, input: NewsInput): Promise<NewsItem> {
  const item = await NewsItem.create({ ...input, authorUserId: actor.id })
  // So the response carries the byline the admin list shows
  await item.load('author')

  await recordAction({
    action: 'news.create',
    actor,
    details: { newsId: item.id, isPublished: input.isPublished },
  })
  return item
}

/**
 * Edits an existing item. The original author is kept, so the audit
 * trail rather than the byline records who changed it.
 */
export async function updateNewsItem(
  actor: User,
  id: number,
  input: Partial<NewsInput>
): Promise<NewsItem> {
  const item = await findNewsItem(id)
  item.merge(input)
  await item.save()
  await item.load('author')

  await recordAction({
    action: 'news.update',
    actor,
    details: { newsId: item.id, changed: Object.keys(input) },
  })
  return item
}

/**
 * Removes an item outright. News is short-lived site copy, so there is
 * no soft delete; the audit entry keeps the body for the record.
 */
export async function deleteNewsItem(actor: User, id: number): Promise<void> {
  const item = await findNewsItem(id)
  const body = item.body
  await item.delete()

  await recordAction({ action: 'news.delete', actor, details: { newsId: id, body } })
}

/**
 * Shape of one news item as the player site consumes it. The date is
 * pre-formatted because the panel shows it verbatim.
 */
export function publicNewsShape(item: NewsItem) {
  return {
    id: item.id,
    body: item.body,
    date: item.publishedAt.toFormat('d LLL yyyy'),
    publishedAt: item.publishedAt.toISO(),
    isPinned: Boolean(item.isPinned),
  }
}

/**
 * Shape of one news item for the admin app, which also needs the draft
 * state and the byline.
 */
export function adminNewsShape(item: NewsItem) {
  // Lucid types a belongsTo as always present, but an item with no
  // author (the one seeded with the table) has none at runtime.
  const author = item.author as User | undefined

  return {
    ...publicNewsShape(item),
    isPublished: Boolean(item.isPublished),
    authorUsername: author?.username ?? null,
    createdAt: item.createdAt.toISO(),
    updatedAt: item.updatedAt?.toISO() ?? null,
  }
}
