import { updateProfileValidator } from '#validators/user'
import { removeAvatar, storeAvatar } from '#services/avatar_storage'
import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    return serialize(UserTransformer.transform(auth.getUserOrFail()))
  }

  /**
   * Updates the signed-in user's username and/or profile photo. A
   * replaced avatar is deleted from disk once the new one is stored.
   */
  async update({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { username, avatar } = await request.validateUsing(updateProfileValidator, {
      meta: { userId: user.id },
    })

    if (username !== undefined) {
      user.username = username
    }

    if (avatar) {
      const previousAvatar = user.avatarPath
      user.avatarPath = await storeAvatar(avatar)
      if (previousAvatar) {
        await removeAvatar(previousAvatar)
      }
    }

    await user.save()
    return serialize(UserTransformer.transform(user))
  }
}
