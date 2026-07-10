import type { Card, VoteSession } from '@/hooks/useBoard'

interface Props {
  voteSession: VoteSession
  cards: Card[] // pré-filtrées par l'appelant (type votable + fenêtre de virtualisation)
  isReadonly?: boolean
  voteCanVote?: boolean
  currentUserId?: string
  onCastVote?: (cardId: string) => void
  onUncastVote?: (cardId: string) => void
}

// Badges de vote superposés aux cartes (nombre de votes + bouton voter/retirer).
export function VoteBadgesOverlay({ voteSession, cards, isReadonly, voteCanVote = true, currentUserId, onCastVote, onUncastVote }: Props) {
  return (
    <>
      {cards.map((card) => {
        const cardVotes = voteSession.votes.filter((v) => v.cardId === card.id)
        const myVotesOnCard = cardVotes.filter((v) => v.userId === currentUserId).length
        const totalVotes = cardVotes.length
        const isEligible = currentUserId ? voteSession.voterIds.includes(currentUserId) : false
        const myTotalVotes = voteSession.votes.filter((v) => v.userId === currentUserId).length
        const canVoteMore = myTotalVotes < voteSession.votesPerPerson
        const isActive = voteSession.status === 'ACTIVE'

        if (totalVotes === 0 && !isEligible) return null

        return (
          <div
            key={`vote-${card.id}`}
            className="absolute pointer-events-none"
            style={{ left: card.posX, top: card.posY, width: card.width, height: card.height, zIndex: 50 }}
          >
            <div
              className={`absolute ${isReadonly ? 'top-1.5' : 'top-7'} right-1.5 flex items-center gap-1 pointer-events-auto`}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {totalVotes > 0 && (
                <div className="flex items-center gap-0.5 bg-secondary-500 text-white rounded-full px-2 py-0.5 shadow-md">
                  <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
                  </svg>
                  <span className="text-[10px] font-bold tabular-nums">{totalVotes}</span>
                </div>
              )}
              {isEligible && isActive && (
                voteCanVote ? (
                  myVotesOnCard > 0 ? (
                    <button
                      onClick={() => onUncastVote?.(card.id)}
                      className="flex items-center gap-0.5 bg-secondary-100 hover:bg-secondary-200 text-secondary-700 rounded-full px-1.5 py-0.5 shadow-sm transition-colors"
                      title="Retirer un vote"
                    >
                      <span className="text-[10px] font-bold">−{myVotesOnCard}</span>
                    </button>
                  ) : canVoteMore ? (
                    <button
                      onClick={() => onCastVote?.(card.id)}
                      className="flex items-center gap-0.5 bg-white hover:bg-secondary-50 text-secondary-500 border border-secondary-200 rounded-full px-1.5 py-0.5 shadow-sm transition-colors"
                      title="Voter pour ce post-it"
                    >
                      <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ) : null
                ) : (
                  <div
                    className="flex items-center gap-0.5 bg-gray-100 text-gray-400 rounded-full px-1.5 py-0.5 shadow-sm cursor-not-allowed"
                    title="Le temps de vote est écoulé"
                  >
                    <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V7" />
                    </svg>
                  </div>
                )
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}
