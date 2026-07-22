import { DateTime } from 'luxon'
import {
  adminNewsShape,
  createNewsItem,
  deleteNewsItem,
  findNewsItem,
  listAllNews,
  updateNewsItem,
} from '#services/news_service'
import { createNewsValidator, parseIsoBound, updateNewsValidator } from '#validators/admin'
import type { HttpContext } from '@adonisjs/core/http'
import type { NewsInput } from '#services/news_service'

/**
 * Editing the news panel shown on the play page. Behind
 * `middleware.role('admin')`; players read the published items through
 * the public site endpoint instead.
 */
export default class AdminNewsController {
  /**
   * Every item including unpublished drafts, pinned first then newest.
   */
  async index({ serialize }: HttpContext) {
    const items = await listAllNews()
    return serialize({ news: items.map(adminNewsShape) })
  }

  /**
   * Publishes a new item. Without an explicit publishedAt it is dated
   * now, which is what "post an update" almost always means.
   */
  async store({ auth, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(createNewsValidator)

    const item = await createNewsItem(auth.getUserOrFail(), {
      body: payload.body,
      publishedAt: parseIsoBound(payload.publishedAt, 'publishedAt') ?? DateTime.now(),
      isPublished: payload.isPublished ?? true,
      isPinned: payload.isPinned ?? false,
    })

    return serialize({ item: adminNewsShape(item) })
  }

  /**
   * Edits an item. Only the supplied fields change, so the admin app
   * can toggle "pinned" without resending the body.
   */
  async update({ auth, params, request, serialize }: HttpContext) {
    const payload = await request.validateUsing(updateNewsValidator)

    const changes: Partial<NewsInput> = {}
    if (payload.body !== undefined) {
      changes.body = payload.body
    }
    const publishedAt = parseIsoBound(payload.publishedAt, 'publishedAt')
    if (publishedAt !== null) {
      changes.publishedAt = publishedAt
    }
    if (payload.isPublished !== undefined) {
      changes.isPublished = payload.isPublished
    }
    if (payload.isPinned !== undefined) {
      changes.isPinned = payload.isPinned
    }

    const item = await updateNewsItem(auth.getUserOrFail(), Number(params.id), changes)
    return serialize({ item: adminNewsShape(item) })
  }

  /**
   * Removes an item. The audit entry keeps its body for the record.
   */
  async destroy({ auth, params, serialize }: HttpContext) {
    const id = Number(params.id)
    await findNewsItem(id)
    await deleteNewsItem(auth.getUserOrFail(), id)

    return serialize({ id, message: 'News item deleted' })
  }
}
