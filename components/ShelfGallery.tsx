'use client'

import { useState, useEffect } from 'react'
import PerfumeCard from './PerfumeCard'

export type ViewMode = 'detailed' | 'compact' | 'list'

export default function ShelfGallery({ inventoryItems }: { inventoryItems: any[] }) {
  const [viewMode, setViewMode] = useState<ViewMode>('detailed')

  // Cargar preferencia del usuario
  useEffect(() => {
    const savedMode = localStorage.getItem('shelfViewMode') as ViewMode
    if (savedMode && ['detailed', 'compact', 'list'].includes(savedMode)) {
      setViewMode(savedMode)
    }
  }, [])

  // Guardar preferencia del usuario
  const handleSetViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('shelfViewMode', mode)
  }

  return (
    <div>
      {/* Controles de Vista */}
      <div className="flex justify-end mb-6">
        <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 shadow-md">
          {/* Detailed View Button */}
          <button
            onClick={() => handleSetViewMode('detailed')}
            title="Vista Detallada"
            className={`p-2 rounded-md transition-all ${
              viewMode === 'detailed' ? 'bg-slate-700 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
          </button>
          
          {/* Compact View Button */}
          <button
            onClick={() => handleSetViewMode('compact')}
            title="Vista Compacta"
            className={`p-2 rounded-md transition-all ${
              viewMode === 'compact' ? 'bg-slate-700 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="4" height="4"></rect><rect x="10" y="3" width="4" height="4"></rect><rect x="17" y="3" width="4" height="4"></rect><rect x="3" y="10" width="4" height="4"></rect><rect x="10" y="10" width="4" height="4"></rect><rect x="17" y="10" width="4" height="4"></rect><rect x="3" y="17" width="4" height="4"></rect><rect x="10" y="17" width="4" height="4"></rect><rect x="17" y="17" width="4" height="4"></rect></svg>
          </button>

          {/* List View Button */}
          <button
            onClick={() => handleSetViewMode('list')}
            title="Vista de Lista"
            className={`p-2 rounded-md transition-all ${
              viewMode === 'list' ? 'bg-slate-700 text-emerald-400 shadow' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {/* Grid de Perfumes */}
      <div 
        className={`
          grid gap-6
          ${viewMode === 'detailed' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : ''}
          ${viewMode === 'compact' ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4' : ''}
          ${viewMode === 'list' ? 'grid-cols-1 max-w-4xl mx-auto gap-4' : ''}
        `}
      >
        {inventoryItems.map((item: any) => {
          const perfume = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes
          if (!perfume) return null

          return (
            <PerfumeCard 
              key={item.id} 
              inventoryId={item.id} 
              perfume={perfume}
              customImageUrl={item.custom_image_url} 
              isActive={item.is_active}
              viewMode={viewMode}
            />
          )
        })}
      </div>
    </div>
  )
}
