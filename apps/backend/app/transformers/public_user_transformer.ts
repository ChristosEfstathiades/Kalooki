import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

/**
 * The public shape of a user, safe to show to other players: no email
 * or other private fields.
 */
export default class PublicUserTransformer extends BaseTransformer<User> {
  toObject() {
    return this.pick(this.resource, ['id', 'username', 'avatarUrl', 'initials'])
  }
}
