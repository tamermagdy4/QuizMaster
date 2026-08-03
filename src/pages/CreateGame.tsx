import { useNavigate } from 'react-router-dom'
import { CategoryGrid } from '../components/create-game/CategoryGrid'
import { GameSetupForm } from '../components/create-game/GameSetupForm'
import { useGameBoardStore } from '../store/gameBoardStore'
import { useGameSetupStore } from '../store/gameSetupStore'

export function CreateGame() {
  const navigate = useNavigate()

  const {
    gameName,
    team1Name,
    team2Name,
    team1Players,
    team2Players,
    team1CategoryIds,
    team2CategoryIds,
    activeTeam,
    setGameName,
    setTeam1Name,
    setTeam2Name,
    adjustTeam1Players,
    adjustTeam2Players,
    toggleCategory,
    getCategoryOwner,
    canStartGame,
  } = useGameSetupStore()

  const initializeBoard = useGameBoardStore((state) => state.initializeBoard)

  const handleStartGame = () => {
    if (!canStartGame()) return
    initializeBoard()
    navigate('/board')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/5 px-5 py-4 backdrop-blur-sm">
        <h1 className="text-2xl font-black text-white">إنشاء لعبة جديدة</h1>
        <p className="text-sm text-white/60">
          اختر الفئات من الأقسام المخصصة لكل فريق، ثم ابدأ الجولة مع التفاعل نفسه الموجود الآن.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <CategoryGrid
          className="order-2 lg:order-1"
          activeTeam={activeTeam}
          team1Count={team1CategoryIds.length}
          team2Count={team2CategoryIds.length}
          getCategoryOwner={getCategoryOwner}
          onToggleCategory={toggleCategory}
        />

        <GameSetupForm
          className="order-1 lg:order-2"
          gameName={gameName}
          team1Name={team1Name}
          team2Name={team2Name}
          team1Players={team1Players}
          team2Players={team2Players}
          team1Count={team1CategoryIds.length}
          team2Count={team2CategoryIds.length}
          activeTeam={activeTeam}
          canStart={canStartGame()}
          onGameNameChange={setGameName}
          onTeam1NameChange={setTeam1Name}
          onTeam2NameChange={setTeam2Name}
          onTeam1PlayersDecrease={() => adjustTeam1Players(-1)}
          onTeam1PlayersIncrease={() => adjustTeam1Players(1)}
          onTeam2PlayersDecrease={() => adjustTeam2Players(-1)}
          onTeam2PlayersIncrease={() => adjustTeam2Players(1)}
          onStartGame={handleStartGame}
        />
      </div>
    </div>
  )
}
