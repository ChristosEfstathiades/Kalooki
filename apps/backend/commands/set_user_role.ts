import { BaseCommand, args } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Grants or revokes moderator/admin rights from the command line. This
 * is how the first admin is created: the admin site can only promote
 * users once an admin already exists to sign in with.
 *
 *   node ace user:role chris admin
 */
export default class SetUserRole extends BaseCommand {
  static commandName = 'user:role'
  static description = "Set a user's authorization level (player, moderator or admin)"

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Username or email address of the account' })
  declare identifier: string

  @args.string({ description: 'New role: player, moderator or admin' })
  declare role: string

  async run() {
    const { default: User } = await import('#models/user')
    const { USER_ROLES } = await import('#services/role_service')

    if (!(USER_ROLES as readonly string[]).includes(this.role)) {
      this.logger.error(`Unknown role "${this.role}". Expected one of: ${USER_ROLES.join(', ')}`)
      this.exitCode = 1
      return
    }

    const user = await User.query()
      .whereRaw('lower(email) = ?', [this.identifier.toLowerCase()])
      .orWhere('username', this.identifier)
      .first()

    if (!user) {
      this.logger.error(`No account found for "${this.identifier}"`)
      this.exitCode = 1
      return
    }

    const previousRole = user.role
    user.role = this.role as (typeof USER_ROLES)[number]
    await user.save()

    this.logger.success(`${user.username}: ${previousRole} -> ${user.role}`)
  }
}
