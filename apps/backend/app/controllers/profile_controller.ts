import { updateProfileValidator } from '#validators/user'
import UserTransformer from '#transformers/user_transformer'
import type { HttpContext } from '@adonisjs/core/http'

export default class ProfileController {
  async show({ auth, serialize }: HttpContext) {
    return serialize(UserTransformer.transform(auth.getUserOrFail()))
  }

  /**
   * Updates the signed-in user's username and/or chat colour.
   */
  async update({ auth, request, serialize }: HttpContext) {
    const user = auth.getUserOrFail()
    const { username, chatColor } = await request.validateUsing(updateProfileValidator, {
      meta: { userId: user.id },
    })

    if (username !== undefined) {
      user.username = username
    }

    if (chatColor !== undefined) {
      user.chatColor = chatColor
    }

    await user.save()
    return serialize(UserTransformer.transform(user))
  }
}
