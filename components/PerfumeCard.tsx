'use client'

import { useState, useRef } from 'react'
import RemoveButton from './RemoveButton'
import { updatePerfumeImage, togglePerfumeStatus } from '@/app/actions/inventory'

export default function PerfumeCard({ perfume, inventoryId, customImageUrl, isActive = true, viewMode = 'detailed' }: { perfume: any, inventoryId?: string | number, customImageUrl?: string, isActive?: boolean, viewMode?: 'detailed' | 'compact' | 'list' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [isPerfumeActive, setIsPerfumeActive] = useState(isActive)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    fileInputRef.current?.click()
  }

  const handleToggleStatus = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!inventoryId) return
    const newStatus = !isPerfumeActive
    setIsPerfumeActive(newStatus) // Optimistic update
    const result = await togglePerfumeStatus(inventoryId, newStatus)
    if (!result.success) {
      setIsPerfumeActive(!newStatus) // Revert on error
      alert('Error al cambiar el estado del perfume')
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !inventoryId) return

    setUploading(true)

    try {
      // Compresión de imagen usando Canvas en el cliente
      const img = new Image();
      const reader = new FileReader();

      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        reader.onload = (event) => {
          img.src = event.target?.result as string;
        };
        reader.onerror = error => reject(error);

        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 800; // Reducimos a 800px para ahorrar muchísimo espacio

          if (width > height && width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          } else if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob failed'));
          }, 'image/jpeg', 0.7); // 70% de calidad JPEG es un balance perfecto
        };

        reader.readAsDataURL(file);
      });

      const formData = new FormData()
      formData.append('image', compressedBlob, 'perfume.jpg')

      const result = await updatePerfumeImage(inventoryId, formData)
      if (!result.success) {
        alert('Error al subir la imagen')
      }
    } catch (error) {
      console.error('Error comprimiendo/subiendo imagen:', error)
      alert('Ocurrió un error al procesar la imagen.')
    } finally {
      setUploading(false)
    }
  }

  const displayImage = customImageUrl || perfume.image_url

  return (
    <>
      {/* Card Body */}
      <div
        onClick={() => setIsOpen(true)}
        className={`group relative bg-slate-800 rounded-2xl overflow-hidden border transition-all hover:shadow-lg flex cursor-pointer ${
          viewMode === 'list' ? 'flex-row items-center h-28' : 'flex-col'
        } ${
          isPerfumeActive 
            ? 'border-slate-700 hover:border-emerald-500/50 hover:shadow-emerald-900/20' 
            : 'border-slate-800 opacity-60 grayscale'
        }`}
      >
        {/* Botones de acción (solo si estamos en el estante) */}
        {inventoryId && (
          <div className={`absolute z-20 flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
            viewMode === 'list' ? 'right-4' : 'top-3 right-3'
          }`} onClick={(e) => e.stopPropagation()}>
            {/* Botón de Cámara */}
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="p-2 bg-slate-800/80 hover:bg-emerald-600 rounded-full text-white backdrop-blur-sm border border-slate-700 transition-colors shadow-lg"
              title="Cambiar foto"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.2"></circle><path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round"></path></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
            </button>
            
            {/* Botón de Agotado/Activo */}
            <button
              onClick={handleToggleStatus}
              className={`p-2 rounded-full text-white backdrop-blur-sm border border-slate-700 transition-colors shadow-lg flex items-center justify-center ${isPerfumeActive ? 'bg-slate-800/80 hover:bg-orange-500' : 'bg-orange-600 hover:bg-orange-500'}`}
              title={isPerfumeActive ? "Marcar como agotado" : "Marcar como activo"}
            >
              {isPerfumeActive ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />

            <RemoveButton inventoryId={inventoryId} />
          </div>
        )}

        {/* Indicador visual de agotado */}
        {!isPerfumeActive && (
          <div className="absolute top-3 left-3 z-10 bg-slate-900/90 text-orange-400 text-[10px] font-bold px-2 py-1 rounded border border-orange-900/50 uppercase tracking-wider backdrop-blur-md">
            Agotado
          </div>
        )}

        {/* Imagen del Perfume */}
        {displayImage && (
          <div className={`bg-slate-900 relative overflow-hidden flex-shrink-0 ${
            viewMode === 'compact' ? 'w-full aspect-square' : viewMode === 'list' ? 'w-24 h-full' : 'w-full h-48'
          }`}>
            <img
              src={displayImage}
              alt={perfume.name}
              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-105"
            />
            {viewMode !== 'list' && (
              <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/20 to-transparent"></div>
            )}
          </div>
        )}

        {/* Header / Brand & Details */}
        {viewMode !== 'compact' && (
          <div className={`p-5 ${viewMode === 'list' ? 'flex-1 py-3 pr-32' : 'pb-3'}`}>
            <p className="text-xs tracking-wide text-emerald-400 uppercase font-semibold mb-1">{perfume.brand}</p>
            <h3 className="text-xl font-bold text-white line-clamp-1" title={perfume.name}>{perfume.name}</h3>
            {viewMode === 'list' && (
              <p className="text-xs text-slate-400 line-clamp-1 mt-1">{perfume.description}</p>
            )}
          </div>
        )}

        {viewMode === 'compact' && (
          <div className="p-3 text-center">
            <p className="text-[10px] tracking-wide text-emerald-400 uppercase font-semibold mb-0.5 truncate">{perfume.brand}</p>
            <h3 className="text-sm font-bold text-white truncate" title={perfume.name}>{perfume.name}</h3>
          </div>
        )}

        {/* Short Description & Notes (solo detailed) */}
        {viewMode === 'detailed' && (
          <div className="px-5 pb-4 flex-grow">
            <p className="text-sm text-slate-400 line-clamp-2 mb-3">
              {perfume.description}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {perfume.top_notes?.slice(0, 3).map((nota: string, i: number) => (
                <span key={i} className="bg-slate-700/50 px-2 py-0.5 rounded text-[10px] text-slate-300 uppercase tracking-wider">{nota}</span>
              ))}
              {perfume.top_notes?.length > 3 && (
                <span className="bg-slate-700/50 px-2 py-0.5 rounded text-[10px] text-slate-500">+{perfume.top_notes.length - 3}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail View */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-slate-800 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-700 overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative p-8 pb-0">
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-6 right-6 text-slate-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              <p className="text-sm tracking-widest text-emerald-400 uppercase font-bold mb-1">{perfume.brand}</p>
              <h2 className="text-3xl font-black text-white leading-tight">{perfume.name}</h2>
            </div>

            {/* Modal Body */}
            <div className="p-8 pt-6 max-h-[70vh] overflow-y-auto">
              <p className="text-slate-300 leading-relaxed mb-8 bg-slate-900/50 p-4 rounded-2xl border-l-4 border-emerald-500">
                {perfume.description}
              </p>

              {/* Olfactory Pyramid */}
              <div className="space-y-6 mb-8">
                <div>
                  <h4 className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span> Notas de Salida
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {perfume.top_notes?.map((nota: string, i: number) => (
                      <span key={i} className="bg-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 border border-slate-600/50">{nota}</span>
                    ))}
                  </div>
                </div>

                {perfume.heart_notes && perfume.heart_notes.length > 0 && (
                  <div>
                    <h4 className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-400 rounded-full"></span> Notas de Corazón
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {perfume.heart_notes.map((nota: string, i: number) => (
                        <span key={i} className="bg-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 border border-slate-600/50">{nota}</span>
                      ))}
                    </div>
                  </div>
                )}

                {perfume.base_notes && perfume.base_notes.length > 0 && (
                  <div>
                    <h4 className="text-xs text-slate-500 uppercase tracking-widest font-bold mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-400 rounded-full"></span> Notas de Fondo
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {perfume.base_notes.map((nota: string, i: number) => (
                        <span key={i} className="bg-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-200 border border-slate-600/50">{nota}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* AI Metadata Grid */}
              {perfume.ai_metadata && (
                <div className="grid grid-cols-2 gap-3 pt-6 border-t border-slate-700">
                  <div className="bg-slate-900/80 p-4 rounded-2xl text-center">
                    <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-tighter">Clima Ideal</span>
                    <span className="text-sm font-semibold capitalize text-emerald-200">
                      {perfume.ai_metadata.clima_ideal?.join(" / ") || "Variado"}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-4 rounded-2xl text-center">
                    <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-tighter">Momento</span>
                    <span className="text-sm font-semibold capitalize text-emerald-200">
                      {perfume.ai_metadata.momento_del_dia?.join(" / ") || "Cualquiera"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
