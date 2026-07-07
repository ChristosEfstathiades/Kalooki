import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Attaches the Socket.IO server to the AdonisJS HTTP server once it is
 * ready, and runs the chat retention sweep while the app is up
 * (messages are deleted after 30 days — docs/features.md).
 */
export default class SocketProvider {
  #retentionSweep: NodeJS.Timeout | null = null

  constructor(protected app: ApplicationService) {}

  async ready() {
    if (this.app.getEnvironment() !== 'web') {
      return
    }

    const { default: server } = await import('@adonisjs/core/services/server')
    const nodeServer = server.getNodeServer()
    if (!nodeServer) {
      return
    }

    const { bootSocketServer } = await import('#services/socket_service')
    bootSocketServer(nodeServer)

    // Record finished games for match history
    const { onMatchFinished } = await import('#services/game/match_service')
    const { recordMatch } = await import('#services/match_history_service')
    const { default: logger } = await import('@adonisjs/core/services/logger')
    onMatchFinished((match) => {
      recordMatch(match).catch((error: unknown) => {
        logger.error({ err: error }, 'Failed to record finished match')
      })
    })

    const { deleteExpiredChatMessages } = await import('#services/chat_service')
    await deleteExpiredChatMessages()
    this.#retentionSweep = setInterval(
      () => {
        void deleteExpiredChatMessages()
      },
      60 * 60 * 1000
    )
  }

  async shutdown() {
    if (this.#retentionSweep) {
      clearInterval(this.#retentionSweep)
      this.#retentionSweep = null
    }
    const { closeSocketServer } = await import('#services/socket_service')
    await closeSocketServer()
  }
}
