'use server'

import { createClient } from '@/utils/supabase/server'

export async function getRecommendationHistory() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'NOT_AUTHENTICATED' }
  }

  const { data: history, error } = await supabase
    .from('recommendation_logs')
    .select(`
      id,
      weather_context,
      reasoning,
      created_at,
      user_feedback,
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
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) {
    console.error('Error fetching recommendation history:', error)
    return { success: false, error: 'DATABASE_ERROR' }
  }

  // Mapeamos para asegurarnos de que la respuesta tenga el formato esperado por el frontend
  const formattedHistory = history.map((log: any) => ({
    log_id: log.id,
    created_at: log.created_at,
    winner: Array.isArray(log.perfumes) ? log.perfumes[0] : log.perfumes,
    justification: log.reasoning,
    context: log.weather_context,
    feedback: log.user_feedback
  }))

  return { success: true, history: formattedHistory }
}
