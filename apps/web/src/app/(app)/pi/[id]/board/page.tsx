'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { usePiBoard, type PiTicket, type PiTicketInput } from '@/hooks/usePi'
import { useFlagGuard } from '@/hooks/useFlagGuard'
import { ProgramBoard, type BoardCell } from '@/components/pi/program-board'
import { TicketModal } from '@/components/pi/ticket-modal'

export default function PiProgramBoardPage() {
  useFlagGuard('module.pi')
  const { id } = useParams<{ id: string }>()
  const { board, isLoading, notFound, createTicket, updateTicket, deleteTicket, createDependency, updateDependency, deleteDependency } = usePiBoard(id)

  // Modale : ticket → édition ; cell seule → création pré-remplie sur la cellule.
  const [modal, setModal] = useState<{ ticket: PiTicket | null; cell: BoardCell } | null>(null)

  if (isLoading) {
    return <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" /></div>
  }
  if (notFound || !board) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <p className="text-gray-500 dark:text-gray-400 mb-4">PI introuvable.</p>
        <Link href="/pi" className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700"><ChevronLeft size={16} />Retour à PI Planning</Link>
      </div>
    )
  }

  const canEdit = board.role === 'OWNER' || board.role === 'EDITOR'

  async function handleSave(input: PiTicketInput) {
    if (modal?.ticket) await updateTicket(modal.ticket.id, input)
    else await createTicket(input)
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      <div>
        <Link href={`/pi/${id}`} className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"><ChevronLeft size={16} />{board.name}</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight mt-1">Program board</h1>
      </div>

      {board.teams.length === 0 ? (
        <div className="flex-1 flex items-center justify-center rounded-2xl border border-dashed border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-400 text-center px-6">
            Ajoutez d&apos;abord les équipes du Train sur la <Link href={`/pi/${id}`} className="text-sky-500 hover:underline">page du PI</Link> — elles formeront les lignes du board.
          </p>
        </div>
      ) : (
        <ProgramBoard
          board={board}
          canEdit={canEdit}
          onMoveTicket={(ticketId, patch) => updateTicket(ticketId, patch)}
          onEditTicket={(ticket) => setModal({ ticket, cell: { teamId: ticket.teamId, iterationId: ticket.iterationId } })}
          onAddTicket={(cell) => setModal({ ticket: null, cell })}
          onCreateDependency={createDependency}
          onUpdateDependency={updateDependency}
          onDeleteDependency={deleteDependency}
        />
      )}

      {modal && (
        <TicketModal
          ticket={modal.ticket}
          initialCell={modal.cell}
          teams={board.teams}
          iterations={board.iterations}
          canEdit={canEdit}
          onSave={handleSave}
          onDelete={modal.ticket ? () => deleteTicket(modal.ticket!.id) : null}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
