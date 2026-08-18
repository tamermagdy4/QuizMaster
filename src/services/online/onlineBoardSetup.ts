import { gameCategories } from '../../data/categories'
import { defaultLifelines } from '../../data/lifelines'
import { useAppStore } from '../../store/appStore'
import { useGameBoardStore } from '../../store/gameBoardStore'
import { useGameSetupStore } from '../../store/gameSetupStore'
import { useOnlineStore } from '../../store/onlineStore'
import type { LifelineId } from '../../types/board'
import type { OnlineBoardSnapshot, OnlinePlayer } from '../../types/online'
import {
  broadcastOnlineGameSync,
  requestOnlineGameSync,
  startOnlineGameSync,
} from './onlineGameSync'

/**
 * Draws `count` distinct random items from `items` (no duplicates).
 */
function pickRandom<T>(items: readonly T[], count: number): T[] {
  const pool = [...items]
  const picked: T[] = []
  while (picked.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(index, 1)[0])
  }
  return picked
}

const TOTAL_CATEGORIES = 6
const LIFELINES_PER_PLAYER = 3

/**
 * Builds the board configuration shared by ALL online clients.
 *
 * - 2 players: keeps the classic team1/team2 split (host = team 1).
 * - 3+ players: free-for-all — every player gets their own score, used cells
 *   and lifelines, but they all share the SAME 6 categories (the board shape
 *   never changes with the player count).
 */
export function buildOnlineBoardSnapshot(
  players: OnlinePlayer[],
  gameName?: string,
  questionDuration: OnlineBoardSnapshot['questionDuration'] = 30,
  /** The 6 categories the HOST chose in the lobby (shared by everyone). */
  categoryIds?: string[],
  /** The 3 lifelines the HOST chose for Team 1 (authoritative). */
  team1LifelineIds?: LifelineId[],
  /** The 3 lifelines the HOST chose for Team 2 (authoritative). */
  team2LifelineIds?: LifelineId[],
): OnlineBoardSnapshot {
  const enabledLifelines = useAppStore.getState().enabledLifelines
  const lifelinePool = defaultLifelines()
    .map((lifeline) => lifeline.id)
    .filter((id) => enabledLifelines.includes(id))

  // The host-chosen categories are authoritative. If they're missing or
  // incomplete (defensive fallback), draw a fresh random set — a previous
  // match's categories can never leak into a new game.
  const validPicked =
    Array.isArray(categoryIds) &&
    categoryIds.length === TOTAL_CATEGORIES &&
    categoryIds.every((id) => typeof id === 'string' && id.length > 0)
      ? categoryIds.slice(0, TOTAL_CATEGORIES)
      : null

  const categoryPool = gameCategories.map((category) => category.id)
  const pickedCategories = validPicked ?? pickRandom(categoryPool, TOTAL_CATEGORIES)

  // The host-chosen lifelines are authoritative (exactly 3 per team). Only
  // fall back to a random draw if they're missing/invalid — which can never
  // happen in the normal flow because the lobby blocks Start until 3+3.
  const validTeam1 =
    Array.isArray(team1LifelineIds) &&
    team1LifelineIds.length === LIFELINES_PER_PLAYER &&
    team1LifelineIds.every((id) => lifelinePool.includes(id))
      ? team1LifelineIds.slice(0, LIFELINES_PER_PLAYER)
      : null
  const validTeam2 =
    Array.isArray(team2LifelineIds) &&
    team2LifelineIds.length === LIFELINES_PER_PLAYER &&
    team2LifelineIds.every((id) => lifelinePool.includes(id))
      ? team2LifelineIds.slice(0, LIFELINES_PER_PLAYER)
      : null

  const chosenTeam1 = validTeam1 ?? (pickRandom(lifelinePool, LIFELINES_PER_PLAYER) as LifelineId[])
  const chosenTeam2 = validTeam2 ?? (pickRandom(lifelinePool, LIFELINES_PER_PLAYER) as LifelineId[])

  const orderedPlayers = players.length > 0 ? players : []
  const first = orderedPlayers[0]
  const second = orderedPlayers[1]
  const isFfa = orderedPlayers.length >= 3

  return {
    gameName: gameName?.trim() || 'مسابقة أونلاين',
    team1Name: (isFfa ? first?.name : first?.name)?.trim() || 'الفريق الأول',
    team2Name: (isFfa ? second?.name : second?.name)?.trim() || 'الفريق الثاني',
    // 2-player: 3 categories per team (classic split of the host's 6).
    // Free-for-all: all 6 categories belong to the shared board.
    team1CategoryIds: isFfa ? pickedCategories : pickedCategories.slice(0, 3),
    team2CategoryIds: isFfa ? [] : pickedCategories.slice(3, 6),
    team1LifelineIds: chosenTeam1,
    team2LifelineIds: chosenTeam2,
    questionDuration,
    players: orderedPlayers.map((player, index) => ({
      id: player.id,
      name: player.name,
      // Free-for-all: each player gets their OWN 3 lifelines (per-player,
      // never global), cycling the host's two team sets so every player has
      // exactly 3 lifelines drawn from the host's configuration.
      lifelineIds: isFfa
        ? (index % 2 === 0 ? chosenTeam1 : chosenTeam2)
        : undefined,
    })),
  }
}

/**
 * Applies a shared snapshot to the local board through the existing stores,
 * so every online client ends up with an identical GameBoard.
 */
export async function applyOnlineBoardSnapshot(snapshot: OnlineBoardSnapshot): Promise<void> {
  useGameSetupStore.setState({
    gameName: snapshot.gameName,
    team1Name: snapshot.team1Name,
    team2Name: snapshot.team2Name,
    team1Players: 1,
    team2Players: 1,
    team1CategoryIds: snapshot.team1CategoryIds,
    team2CategoryIds: snapshot.team2CategoryIds,
    team1LifelineIds: snapshot.team1LifelineIds,
    team2LifelineIds: snapshot.team2LifelineIds,
  })

  // Free-for-all (3+ players): pass the full player list so the board store
  // builds the per-player layer. 2-player games pass nothing and keep the
  // exact same team-based flow as before.
  const ffaConfig =
    snapshot.players && snapshot.players.length >= 3
      ? snapshot.players.map((player) => ({
          id: player.id,
          name: player.name,
          lifelineIds: player.lifelineIds,
        }))
      : undefined

  await useGameBoardStore.getState().initializeBoard('online', ffaConfig)

  // The HOST's chosen question duration drives the countdown on BOTH clients;
  // the joiner has no way to override it (host is the authority).
  useAppStore.setState({ questionDuration: snapshot.questionDuration })

  // Activate the online gameplay sync (idempotent) so both clients apply
  // each other's game events on the shared GameBoard.
  startOnlineGameSync()

  // Converge immediately: the host pushes the authoritative board snapshot
  // and the joiner asks for one, so any gameplay event that raced the
  // GAME_STARTED handshake can never leave a client stuck on stale state.
  const online = useOnlineStore.getState()
  if (online.self && online.room) {
    if (online.self.id === online.room.hostId) {
      void broadcastOnlineGameSync().catch((error) => {
        console.warn('[online] entry sync failed', error)
      })
    } else {
      void requestOnlineGameSync().catch((error) => {
        console.warn('[online] entry sync request failed', error)
      })
    }
  }

  // Leave the local setup form clean for the next Local game.
  useGameSetupStore.getState().resetCategories()
}
