import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'
import env from '#start/env'

/**
 * The slice of the better-sqlite3 Database interface the pool hook
 * uses (the package ships no type declarations).
 */
interface SqliteConnection {
  pragma(statement: string): unknown
}

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries. SQLite in development
   * and tests; set DB_CONNECTION=pg in production (docs/Architecture.md).
   */
  connection: env.get('DB_CONNECTION', 'sqlite'),

  connections: {
    /**
     * SQLite connection (default).
     */
    sqlite: {
      client: 'better-sqlite3',

      connection: {
        /**
         * Tests run against a separate database file so they never
         * touch development data.
         */
        filename: app.inTest ? app.tmpPath('test.sqlite3') : app.tmpPath('db.sqlite3'),
      },

      /**
       * Required by Knex for SQLite defaults.
       */
      useNullAsDefault: true,

      /**
       * SQLite leaves foreign keys unenforced per connection unless the
       * pragma is set. Without it the ON DELETE cascades declared in the
       * migrations never fire in development/tests, silently diverging
       * from Postgres behaviour in production.
       */
      pool: {
        afterCreate: (connection: SqliteConnection, done: (err: Error | null) => void) => {
          connection.pragma('foreign_keys = ON')
          done(null)
        },
      },

      migrations: {
        /**
         * Sort migration files naturally by filename.
         */
        naturalSort: true,

        /**
         * Paths containing migration files.
         */
        paths: ['database/migrations'],
      },

      schemaGeneration: {
        /**
         * Enable schema generation from Lucid models.
         */
        enabled: true,

        /**
         * Custom schema rules file paths.
         */
        rulesPaths: ['./database/schema_rules.js'],
      },
    },

    /**
     * PostgreSQL connection, used in production.
     */
    pg: {
      client: 'pg',

      connection: {
        host: env.get('PG_HOST'),
        port: env.get('PG_PORT', 5432),
        user: env.get('PG_USER'),
        password: env.get('PG_PASSWORD'),
        database: env.get('PG_DB_NAME'),
      },

      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },

    /**
     * MySQL / MariaDB connection.
     * Install package to switch: npm install mysql2
     */
    // mysql: {
    //   client: 'mysql2',
    //   connection: {
    //     host: process.env.MYSQL_HOST,
    //     port: Number(process.env.MYSQL_PORT || 3306),
    //     user: process.env.MYSQL_USER,
    //     password: process.env.MYSQL_PASSWORD,
    //     database: process.env.MYSQL_DB_NAME,
    //   },
    //   migrations: {
    //     naturalSort: true,
    //     paths: ['database/migrations'],
    //   },
    //   debug: app.inDev,
    // },

    /**
     * Microsoft SQL Server connection.
     * Install package to switch: npm install tedious
     */
    // mssql: {
    //   client: 'mssql',
    //   connection: {
    //     server: process.env.MSSQL_SERVER,
    //     port: Number(process.env.MSSQL_PORT || 1433),
    //     user: process.env.MSSQL_USER,
    //     password: process.env.MSSQL_PASSWORD,
    //     database: process.env.MSSQL_DB_NAME,
    //   },
    //   migrations: {
    //     naturalSort: true,
    //     paths: ['database/migrations'],
    //   },
    //   debug: app.inDev,
    // },

    /**
     * libSQL (Turso) connection.
     * Install package to switch: npm install @libsql/client
     */
    // libsql: {
    //   client: 'libsql',
    //   connection: {
    //     url: process.env.LIBSQL_URL,
    //     authToken: process.env.LIBSQL_AUTH_TOKEN,
    //   },
    //   useNullAsDefault: true,
    //   migrations: {
    //     naturalSort: true,
    //     paths: ['database/migrations'],
    //   },
    //   debug: app.inDev,
    // },
  },
})

export default dbConfig
