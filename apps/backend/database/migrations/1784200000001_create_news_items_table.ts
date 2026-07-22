import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Site announcements shown in the news panel on the play page. These
 * used to live in a static public/news.json on the frontend; holding
 * them here lets an admin publish and edit them from admin.{domain}
 * without a redeploy.
 */
export default class extends BaseSchema {
  protected tableName = 'news_items'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()
      table.string('body', 1000).notNullable()
      // Drives both the displayed date and the ordering, so an item can
      // be back- or post-dated independently of when it was written
      table.timestamp('published_at').notNullable()
      // Drafts are editable in the admin app but hidden from players
      table.boolean('is_published').notNullable().defaultTo(true)
      // Pinned items sort above everything else regardless of date
      table.boolean('is_pinned').notNullable().defaultTo(false)
      table
        .integer('author_user_id')
        .unsigned()
        .nullable()
        .references('users.id')
        .onDelete('SET NULL')

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      table.index(['is_published', 'published_at'])
    })

    // Carries the single item the old public/news.json shipped with, so
    // the play page's news panel is not empty the moment it switches
    // from the static file to this table.
    //
    // The timestamps are written with CURRENT_TIMESTAMP rather than a
    // JavaScript Date: the driver stores a Date as an integer on
    // SQLite, and Lucid's dateTime column refuses to read that back.
    this.defer(async (db) => {
      await db.rawQuery(
        `insert into ${this.tableName}
           (body, published_at, is_published, is_pinned, author_user_id, created_at, updated_at)
         values (?, CURRENT_TIMESTAMP, ?, ?, null, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          'Welcome to Kalooki Online! Find a public match, or set up a private game with custom rules from your groups.',
          true,
          false,
        ]
      )
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
