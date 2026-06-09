'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function addPerfumeToShelf(perfumeId: string | number) {
  const supabase = await createClient()

  // 1. Verificar sesión
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'NOT_AUTHENTICATED' }
  }

  // 2. Obtener perfil para ver si es PRO
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', user.id)
    .single()

  const isPro = profile?.is_pro || false

  // 3. Contar cuántos perfumes tiene en el estante
  const { count, error: countError } = await supabase
    .from('inventory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (countError) {
    console.error('Error counting inventory:', countError)
    return { success: false, error: 'DATABASE_ERROR' }
  }

  // 4. Lógica Freemium
  if (!isPro && count !== null && count >= 3) {
    return { success: false, error: 'LIMIT_REACHED' }
  }

  // 5. Verificar si ya lo tiene (para evitar duplicados)
  const { data: existing } = await supabase
    .from('inventory')
    .select('id')
    .eq('user_id', user.id)
    .eq('perfume_id', perfumeId)
    .single()

  if (existing) {
    return { success: false, error: 'ALREADY_EXISTS' }
  }

  // 6. Insertar en el inventario
  const { error: insertError } = await supabase
    .from('inventory')
    .insert([
      { user_id: user.id, perfume_id: perfumeId }
    ])

  if (insertError) {
    console.error('Error inserting inventory:', insertError)
    return { success: false, error: 'DATABASE_ERROR' }
  }

  revalidatePath('/mi-estante')
  return { success: true }
}

export async function removePerfumeFromShelf(inventoryId: string | number) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'NOT_AUTHENTICATED' }
  }

  const { error } = await supabase
    .from('inventory')
    .delete()
    .eq('id', inventoryId)
    .eq('user_id', user.id) // Seguridad: solo puede borrar si es suyo

  if (error) {
    console.error('Error deleting inventory:', error)
    return { success: false, error: 'DATABASE_ERROR' }
  }

  revalidatePath('/mi-estante')
  return { success: true }
}

export async function updatePerfumeImage(inventoryId: string | number, formData: FormData) {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'NOT_AUTHENTICATED' }

  const file = formData.get('image') as File
  if (!file) return { success: false, error: 'NO_FILE' }

  // 1. Subir al Storage (perfume-images bucket)
  const fileExt = file.name.split('.').pop()
  const fileName = `${user.id}/${inventoryId}-${Math.random()}.${fileExt}`
  const filePath = `${fileName}`

  const { error: uploadError } = await supabase.storage
    .from('perfume-images')
    .upload(filePath, file)

  if (uploadError) {
    console.error('Error uploading image:', uploadError)
    return { success: false, error: 'UPLOAD_FAILED' }
  }

  // 2. Obtener URL pública
  const { data: { publicUrl } } = supabase.storage
    .from('perfume-images')
    .getPublicUrl(filePath)

  // 3. Actualizar la tabla inventory
  const { error: updateError } = await supabase
    .from('inventory')
    .update({ custom_image_url: publicUrl })
    .eq('id', inventoryId)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('Error updating inventory image:', updateError)
    return { success: false, error: 'DATABASE_ERROR' }
  }

  revalidatePath('/mi-estante')
  return { success: true, url: publicUrl }
}

export async function togglePerfumeStatus(inventoryId: string | number, isActive: boolean) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { success: false, error: 'NOT_AUTHENTICATED' }
  }

  const { error } = await supabase
    .from('inventory')
    .update({ is_active: isActive })
    .eq('id', inventoryId)
    .eq('user_id', user.id) // Seguridad: solo puede modificar si es suyo

  if (error) {
    console.error('Error updating perfume status:', error)
    return { success: false, error: 'DATABASE_ERROR' }
  }

  revalidatePath('/mi-estante')
  return { success: true }
}
