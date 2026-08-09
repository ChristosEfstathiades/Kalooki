import { configApp } from '@adonisjs/eslint-config'

export default [
  {
    /**
     * `database/schema.ts` is generated from the migrations on every
     * `node ace migration:run` and carries a DO NOT EDIT banner. Its
     * generator emits `$columns` arrays on one line, which trips
     * prettier/prettier for every table with more than a few columns.
     *
     * Formatting it by hand is churn the next regeneration undoes, so
     * it is excluded here rather than fixed. It is also in
     * `.prettierignore` so `npm run format` leaves it alone for the
     * same reason.
     */
    ignores: ['database/schema.ts'],
  },
  ...configApp(),
]
