import { randomUUID } from 'node:crypto'
import app from '@adonisjs/core/services/app'
import type { MultipartFile } from '@adonisjs/core/bodyparser'

/**
 * Stores avatar images on local disk. All access goes through this
 * service so the backend can later move to an object store (e.g. S3)
 * without changing the API contract (see docs/Architecture.md).
 */

/**
 * Absolute path of the directory avatar files are written to.
 */
export function avatarDirectory(): string {
  return app.makePath('storage', 'avatars')
}

/**
 * Moves a validated uploaded avatar into storage under a generated
 * collision-free name and returns the stored filename.
 */
export async function storeAvatar(file: MultipartFile): Promise<string> {
  // Hyphens are stripped so the name stays strictly alphanumeric,
  // matching the pattern the avatars controller serves.
  const fileName = `${randomUUID().replaceAll('-', '')}.${file.extname}`
  await file.move(avatarDirectory(), { name: fileName })
  return fileName
}
