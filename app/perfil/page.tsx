import { getProfileData } from '@/app/actions/profile'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'
import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getProfileData()
  if (!data.success) redirect('/login')

  const { user: userData, credits, adsWatchedToday, stats, olfactoryDNA } = data as any

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 sm:p-12 font-sans relative overflow-hidden">
      {/* Fondo decorativo */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-500/5 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">

        {/* ========== SECCIÓN 1: TARJETA DE USUARIO ========== */}
        <section className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 mb-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar */}
            {userData.avatar ? (
              <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-bold overflow-hidden">
                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-emerald-400 flex items-center justify-center text-3xl font-black text-white shadow-lg shadow-blue-500/20">
                {userData.initial}
              </div>
            )}

            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {userData.name}
              </h1>
              <p className="text-slate-400 text-sm">{userData.email}</p>
              <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                <span className={`text-xs px-3 py-1 rounded-full font-bold tracking-wide uppercase ${stats.totalPerfumes >= 11
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : stats.totalPerfumes >= 4
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'bg-slate-700/50 text-slate-400 border border-slate-600/30'
                  }`}>
                  {stats.totalPerfumes >= 11 ? '🏆 Maestro Sommelier' : stats.totalPerfumes >= 4 ? '⭐ Entusiasta' : '🌱 Iniciado'}
                </span>
              </div>
            </div>

            {/* Logout (Desktop) */}
            <LogoutButton />
          </div>
        </section>

        {/* ========== SECCIÓN 2: PANEL FREEMIUM ========== */}
        <section className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 mb-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-emerald-400">🪙</span> Créditos
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Créditos */}
            <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-semibold">Búsquedas Disponibles</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">
                  {credits}
                </span>
                <span className="text-slate-500 text-sm mb-1">/ 3 diarios</span>
              </div>
              {/* Barra de progreso */}
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400 transition-all duration-700"
                  style={{ width: `${Math.min((credits / 3) * 100, 100)}%` }}
                />
              </div>
            </div>

            {/* Anuncios */}
            <div className="bg-slate-800/60 rounded-2xl p-6 border border-slate-700/50">
              <p className="text-xs text-slate-400 uppercase tracking-widest mb-2 font-semibold">Anuncios Vistos Hoy</p>
              <div className="flex items-end gap-2 mb-4">
                <span className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400">
                  {adsWatchedToday}
                </span>
                <span className="text-slate-500 text-sm mb-1">/ 2 máximo</span>
              </div>
              {/* Barra de progreso */}
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all duration-700"
                  style={{ width: `${(adsWatchedToday / 2) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ========== SECCIÓN 3: ESTADÍSTICAS BI ========== */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <span className="text-blue-400"></span> Colección
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard emoji="📦" label="Perfumes" value={stats.totalPerfumes} />
            <StatCard emoji="🏷️" label="Marcas Únicas" value={stats.uniqueBrands} />
            <StatCard emoji="🧠" label="Consultas IA" value={stats.aiRecommendations} />
            <StatCard emoji="⭐" label="Marca Favorita" value={stats.favoriteBrand} isText />
          </div>
        </section>

        {/* ========== SECCIÓN 4: ADN OLFATIVO ========== */}
        <section className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <span className="text-purple-400">🧬</span> Tu ADN Olfativo
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            Análisis de las familias olfativas presentes en tu colección.
          </p>

          {olfactoryDNA && olfactoryDNA.length > 0 ? (
            <div className="space-y-4">
              {olfactoryDNA.map((item: any, index: number) => (
                <div key={item.family} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                      <span className="text-lg">{item.emoji}</span>
                      {item.family}
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      {item.percentage}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${item.percentage}%`,
                        background: BAR_GRADIENTS[index % BAR_GRADIENTS.length],
                        animationDelay: `${index * 100}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg mb-2">🔬 Sin datos suficientes</p>
              <p className="text-slate-600 text-sm">
                Añade perfumes a tu <Link href="/mi-estante" className="text-blue-400 hover:underline">estante</Link> para ver tu ADN olfativo.
              </p>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}

// --- Componentes auxiliares ---

const BAR_GRADIENTS = [
  'linear-gradient(to right, #34d399, #3b82f6)',  // emerald -> blue
  'linear-gradient(to right, #fbbf24, #f97316)',  // amber -> orange
  'linear-gradient(to right, #a78bfa, #ec4899)',  // violet -> pink
  'linear-gradient(to right, #f87171, #fbbf24)',  // red -> amber
  'linear-gradient(to right, #60a5fa, #34d399)',  // blue -> emerald
  'linear-gradient(to right, #e879f9, #a78bfa)',  // fuchsia -> violet
  'linear-gradient(to right, #fb923c, #f87171)',  // orange -> red
  'linear-gradient(to right, #34d399, #a3e635)',  // emerald -> lime
  'linear-gradient(to right, #38bdf8, #818cf8)',  // sky -> indigo
  'linear-gradient(to right, #facc15, #fb923c)',  // yellow -> orange
]

function StatCard({ emoji, label, value, isText }: { emoji: string; label: string; value: string | number; isText?: boolean }) {
  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-2xl p-5 text-center hover:border-slate-700 transition-colors shadow-lg">
      <span className="text-2xl block mb-2">{emoji}</span>
      {isText ? (
        <p className="text-lg font-bold text-white truncate">{value}</p>
      ) : (
        <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
          {value}
        </p>
      )}
      <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-semibold">{label}</p>
    </div>
  )
}


