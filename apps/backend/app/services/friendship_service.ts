import Friendship from '#models/friendship'
import User from '#models/user'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

/**
 * Orders a pair of user ids so the lower id is first. Friendships are
 * stored once per pair with userAId < userBId.
 */
export function orderPair(userIdA: number, userIdB: number): [number, number] {
  return userIdA < userIdB ? [userIdA, userIdB] : [userIdB, userIdA]
}

/**
 * Checks whether two users are friends.
 */
export async function areFriends(userIdA: number, userIdB: number): Promise<boolean> {
  const [a, b] = orderPair(userIdA, userIdB)
  const friendship = await Friendship.query().where('userAId', a).where('userBId', b).first()
  return friendship !== null
}

/**
 * Creates the friendship connecting two users. Pass the surrounding
 * transaction client when called inside one — writing on a separate
 * connection while a transaction holds the lock deadlocks SQLite.
 */
export async function createFriendship(
  userIdA: number,
  userIdB: number,
  options: { client?: TransactionClientContract } = {}
): Promise<Friendship> {
  const [a, b] = orderPair(userIdA, userIdB)
  return Friendship.create({ userAId: a, userBId: b }, { client: options.client })
}

/**
 * Deletes the friendship between two users if one exists. Removal is
 * silent and mutual: the other user is not notified (docs/features.md).
 */
export async function removeFriendship(userIdA: number, userIdB: number): Promise<void> {
  const [a, b] = orderPair(userIdA, userIdB)
  await Friendship.query().where('userAId', a).where('userBId', b).delete()
}

/**
 * Lists the ids of a user's friends. Used where only the identities are
 * needed (e.g. telling friends a player came online) so the rows never
 * have to be loaded.
 */
export async function friendIdsOf(userId: number): Promise<number[]> {
  const friendships = await Friendship.query().where('userAId', userId).orWhere('userBId', userId)

  return friendships.map((friendship) =>
    friendship.userAId === userId ? friendship.userBId : friendship.userAId
  )
}

/**
 * Lists a user's friends ordered by username.
 */
export async function friendsOf(userId: number): Promise<User[]> {
  const friendIds = await friendIdsOf(userId)

  if (friendIds.length === 0) {
    return []
  }
  return User.query().whereIn('id', friendIds).orderBy('username')
}
