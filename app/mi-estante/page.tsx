import { createClient } from '@/utils/supabase/server'
import ShelfGallery from '@/components/ShelfGallery'
import Link from 'next/link'

export default async function MiEstante() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return null // O redirigir, aunque el middleware ya lo hace
  }

    // Obtener el inventario con un JOIN a la caché de perfumes
    const { data: inventoryItems, error } = await supabase
    .from('inventory')
    .select(`
      id,
      added_at,
      custom_image_url,
      is_active,
      perfumes:global_perfume_cache (
        id,
        name,
        brand,
        image_url,
        description,
        top_notes,
        heart_notes,
        base_notes,
        ai_metadata
      )
    `)
    .eq('user_id', user.id)
    .order('added_at', { ascending: false })

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 p-6 sm:p-12 font-sans">
      
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-end mb-10 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400 mb-2">
              Mi Estante
            </h1>
            <p className="text-slate-400">Tu colección personal de fragancias</p>
          </div>
          <Link href="/" className="text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-4 rounded-lg transition-colors border border-slate-700">
            + Buscar Perfumes
          </Link>
        </header>

        {error && (
          <div className="p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 mb-8">
            Hubo un error al cargar tu estante. Por favor, intenta de nuevo más tarde.
          </div>
        )}

        {!inventoryItems || inventoryItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-800/50 rounded-2xl border border-slate-700/50 border-dashed">
            <svg className="w-20 h-20 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            <h2 className="text-xl font-medium text-slate-300 mb-2">Tu estante está vacío</h2>
            <p className="text-slate-500 text-center max-w-md mb-6">Aún no has añadido ninguna fragancia a tu colección personal. Explora y añade tus favoritas.</p>
            <Link href="/" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
              Explorar Fragancias
            </Link>
          </div>
        ) : (
          <ShelfGallery inventoryItems={inventoryItems} />
        )}
      </div>
    </main>
  )
}
