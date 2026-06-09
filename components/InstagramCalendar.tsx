'use client'

import { useState, useMemo } from 'react'

type HistoryItem = {
  log_id: string;
  created_at: string;
  winner: any;
  justification: string;
  context: any;
  feedback?: boolean | null;
}

export default function InstagramCalendar({ history }: { history: HistoryItem[] }) {
  const [selectedDayRecs, setSelectedDayRecs] = useState<HistoryItem[] | null>(null)

  // Función para agrupar el historial por meses
  const monthsData = useMemo(() => {
    if (!history || history.length === 0) return []

    // 1. Agrupar por mes y año (Ej. "2026-05")
    const groups: { [key: string]: HistoryItem[] } = {}
    history.forEach(item => {
      const date = new Date(item.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) groups[key] = []
      groups[key].push(item)
    })

    // 2. Ordenar los meses del más reciente al más antiguo
    const sortedKeys = Object.keys(groups).sort().reverse()

    return sortedKeys.map(key => {
      const [yearStr, monthStr] = key.split('-')
      const year = parseInt(yearStr)
      const month = parseInt(monthStr) - 1 // 0-indexado
      
      const monthName = new Date(year, month, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
      
      // 3. Crear el array de días para el grid del calendario
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const firstDayOfWeek = new Date(year, month, 1).getDay()
      // Ajustar para que la semana empiece en lunes (1 = Lunes, 0 = Domingo -> 7)
      const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

      // Agrupar recomendaciones por día exacto
      const dayGroups: { [day: number]: HistoryItem[] } = {}
      groups[key].forEach(item => {
        const day = new Date(item.created_at).getDate()
        if (!dayGroups[day]) dayGroups[day] = []
        dayGroups[day].push(item)
      })

      // Ordenar recomendaciones dentro del día (de más antigua a más reciente, simulando el paso de las horas)
      Object.keys(dayGroups).forEach(day => {
        dayGroups[parseInt(day)].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      })

      return {
        key,
        monthName,
        startOffset,
        daysInMonth,
        dayGroups
      }
    })
  }, [history])

  const weekdays = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

  return (
    <div className="w-full text-white bg-[#121212] min-h-[500px] rounded-3xl p-6 sm:p-10 font-sans shadow-2xl border border-slate-800">
      
      {monthsData.length === 0 ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          No hay recomendaciones en tu archivo todavía.
        </div>
      ) : (
        <div className="space-y-16">
          {monthsData.map((monthData) => (
            <div key={monthData.key} className="w-full max-w-sm mx-auto">
              <h3 className="text-center font-bold text-lg mb-6 capitalize tracking-wide">{monthData.monthName}</h3>
              
              <div className="grid grid-cols-7 gap-y-6 gap-x-2 text-center text-xs font-medium text-slate-400 mb-6">
                {weekdays.map(d => <div key={d}>{d}</div>)}
              </div>

              <div className="grid grid-cols-7 gap-y-6 gap-x-2">
                {/* Espacios vacíos antes del día 1 */}
                {Array.from({ length: monthData.startOffset }).map((_, i) => (
                  <div key={`empty-${i}`} />
                ))}

                {/* Días del mes */}
                {Array.from({ length: monthData.daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const recs = monthData.dayGroups[day]
                  
                  if (recs && recs.length > 0) {
                    // Tomamos la última recomendación del día para mostrar su foto
                    const lastRec = recs[recs.length - 1]
                    const imgUrl = lastRec.winner?.image_url

                    return (
                      <div 
                        key={day} 
                        className="relative flex justify-center items-center cursor-pointer group"
                        onClick={() => setSelectedDayRecs(recs)}
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden ring-2 ring-[#121212] group-hover:ring-emerald-500 transition-all shadow-lg relative">
                          {imgUrl ? (
                            <img src={imgUrl} alt="Recomendación" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-emerald-900/50 flex items-center justify-center text-emerald-400">✨</div>
                          )}
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center font-bold text-white text-sm">
                            {day}
                          </div>
                        </div>
                        {/* Indicador de múltiples recomendaciones */}
                        {recs.length > 1 && (
                          <div className="absolute -top-1 -right-1 bg-blue-500 w-3.5 h-3.5 rounded-full border-2 border-[#121212]"></div>
                        )}
                      </div>
                    )
                  }

                  // Día sin recomendaciones
                  return (
                    <div key={day} className="flex justify-center items-center text-slate-300 font-medium h-10">
                      {day}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal / Menú Inferior de Detalle del Día */}
      {selectedDayRecs && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 pb-0 sm:pb-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setSelectedDayRecs(null)}>
          <div 
            className="bg-slate-900 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 pb-24 sm:pb-6 border-t border-x sm:border-b border-slate-700 shadow-2xl relative animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 max-h-[85vh] overflow-y-auto overscroll-contain"
            onClick={e => e.stopPropagation()}
          >
            <button 
              onClick={() => setSelectedDayRecs(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 rounded-full p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <h3 className="text-xl font-bold mb-6 text-emerald-400">
              {new Date(selectedDayRecs[0].created_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h3>

            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-700 before:to-transparent">
              {selectedDayRecs.map((rec, index) => {
                const date = new Date(rec.created_at)
                const timeString = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
                
                return (
                  <div key={rec.log_id || index} className="relative flex items-center justify-between group is-active">
                    {/* Timeline dot */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-800 text-slate-400 shrink-0 shadow z-10 text-xs font-medium">
                      {timeString}
                    </div>
                    
                    {/* Card */}
                    <div className="w-[calc(100%-3.5rem)] bg-slate-800/80 p-4 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors">
                      <div className="flex gap-4 items-center mb-3">
                        <img src={rec.winner?.image_url} alt={rec.winner?.name} className="w-12 h-12 rounded-lg object-cover bg-slate-900 border border-slate-700" />
                        <div>
                          <p className="font-bold text-white text-sm leading-tight">{rec.winner?.name}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{rec.winner?.brand}</p>
                        </div>
                      </div>
                      
                      <div className="bg-slate-900/50 rounded-xl p-3 text-xs text-slate-300 italic border-l-2 border-emerald-500/50">
                        "{rec.justification}"
                      </div>
                      
                      {rec.feedback !== undefined && rec.feedback !== null && (
                        <div className="mt-3 flex justify-end">
                          <span className={`text-[10px] px-2 py-1 rounded-full border ${rec.feedback ? 'bg-emerald-900/30 text-emerald-400 border-emerald-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'}`}>
                            {rec.feedback ? '👍 Te gustó' : '👎 No te gustó'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
