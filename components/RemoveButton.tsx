'use client'

import { useState } from 'react'
import { removePerfumeFromShelf } from '@/app/actions/inventory'

export default function RemoveButton({ inventoryId }: { inventoryId: string | number }) {
  const [isRemoving, setIsRemoving] = useState(false)

  const handleRemove = async () => {
    if (!confirm('¿Seguro que quieres quitar este perfume de tu estante?')) return
    
    setIsRemoving(true)
    await removePerfumeFromShelf(inventoryId)
    setIsRemoving(false)
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isRemoving}
      className="bg-red-900/80 hover:bg-red-600 text-white p-2 rounded-full transition-colors disabled:opacity-50 shadow-lg backdrop-blur-sm border border-red-800/50"
      title="Eliminar del estante"
    >
      {isRemoving ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="10" strokeWidth="4" strokeOpacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="4" strokeLinecap="round"></path>
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  )
}
