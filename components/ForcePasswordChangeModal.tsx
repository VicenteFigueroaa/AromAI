'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'

export default function ForcePasswordChangeModal({ userId }: { userId: string }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden')
      return
    }

    setLoading(true)

    // 1. Update Auth Password
    const { error: authError } = await supabase.auth.updateUser({
      password: password
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    // 2. Update Profile Flag
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ requires_password_change: false })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile flag:', profileError)
      setError('Error al guardar en el perfil. Intenta de nuevo.')
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => {
      window.location.reload()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/50 p-8 sm:p-12 rounded-3xl w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Decorativo */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white">Seguridad de la Cuenta</h2>
          <p className="text-slate-400 mt-2 text-sm">
            Para continuar usando tu cuenta premium, debes establecer tu contraseña definitiva.
          </p>
        </div>

        {success ? (
          <div className="text-center animate-fade-in relative z-10">
            <div className="text-emerald-400 text-5xl mb-4">✨</div>
            <h3 className="text-xl font-bold text-white mb-2">¡Contraseña Actualizada!</h3>
            <p className="text-slate-400 text-sm">Redirigiendo a la aplicación...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg text-center">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Nueva Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirmar Contraseña</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition-all mt-4 disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar y Continuar'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
