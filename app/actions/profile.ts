'use server'

import { createClient } from '@/utils/supabase/server'

// Mapa de notas a familias olfativas
const NOTE_FAMILIES: Record<string, string> = {
  // 🌲 Amaderado
  'sándalo': 'Amaderado', 'sandalo': 'Amaderado', 'sandalwood': 'Amaderado',
  'cedro': 'Amaderado', 'cedar': 'Amaderado', 'cedarwood': 'Amaderado',
  'vetiver': 'Amaderado', 'oud': 'Amaderado', 'madera': 'Amaderado', 'wood': 'Amaderado',
  'palisandro': 'Amaderado', 'caoba': 'Amaderado', 'pino': 'Amaderado', 'pine': 'Amaderado',
  'abedul': 'Amaderado', 'birch': 'Amaderado', 'guayaco': 'Amaderado', 'guaiac': 'Amaderado',
  'ciprés': 'Amaderado', 'cypress': 'Amaderado', 'roble': 'Amaderado', 'oak': 'Amaderado',
  'teca': 'Amaderado', 'patchouli': 'Amaderado', 'pachulí': 'Amaderado',
  'musgo': 'Amaderado', 'moss': 'Amaderado', 'oakmoss': 'Amaderado',

  // 🍋 Cítrico
  'bergamota': 'Cítrico', 'bergamot': 'Cítrico',
  'limón': 'Cítrico', 'lemon': 'Cítrico', 'lima': 'Cítrico', 'lime': 'Cítrico',
  'naranja': 'Cítrico', 'orange': 'Cítrico', 'mandarina': 'Cítrico', 'mandarin': 'Cítrico',
  'pomelo': 'Cítrico', 'grapefruit': 'Cítrico', 'toronja': 'Cítrico',
  'yuzu': 'Cítrico', 'cidra': 'Cítrico', 'citron': 'Cítrico', 'cítrico': 'Cítrico',
  'neroli': 'Cítrico', 'petitgrain': 'Cítrico', 'verbena': 'Cítrico',

  // 🌸 Floral
  'rosa': 'Floral', 'rose': 'Floral', 'jazmín': 'Floral', 'jasmine': 'Floral',
  'lirio': 'Floral', 'lily': 'Floral', 'lavanda': 'Floral', 'lavender': 'Floral',
  'violeta': 'Floral', 'violet': 'Floral', 'iris': 'Floral', 'orris': 'Floral',
  'gardenia': 'Floral', 'magnolia': 'Floral', 'peonía': 'Floral', 'peony': 'Floral',
  'azahar': 'Floral', 'flor de naranjo': 'Floral', 'orange blossom': 'Floral',
  'ylang': 'Floral', 'ylang-ylang': 'Floral', 'tuberosa': 'Floral', 'tuberose': 'Floral',
  'geranio': 'Floral', 'geranium': 'Floral', 'heliotropo': 'Floral',
  'loto': 'Floral', 'lotus': 'Floral', 'nardo': 'Floral', 'floral': 'Floral',

  // 🌶️ Especiado
  'pimienta': 'Especiado', 'pepper': 'Especiado', 'black pepper': 'Especiado',
  'canela': 'Especiado', 'cinnamon': 'Especiado', 'clavo': 'Especiado', 'clove': 'Especiado',
  'cardamomo': 'Especiado', 'cardamom': 'Especiado', 'jengibre': 'Especiado', 'ginger': 'Especiado',
  'nuez moscada': 'Especiado', 'nutmeg': 'Especiado', 'comino': 'Especiado', 'cumin': 'Especiado',
  'azafrán': 'Especiado', 'saffron': 'Especiado', 'especiado': 'Especiado', 'spicy': 'Especiado',
  'pimienta rosa': 'Especiado', 'pink pepper': 'Especiado',

  // 🍬 Dulce / Gourmand
  'vainilla': 'Dulce', 'vanilla': 'Dulce', 'caramelo': 'Dulce', 'caramel': 'Dulce',
  'cacao': 'Dulce', 'chocolate': 'Dulce', 'café': 'Dulce', 'coffee': 'Dulce',
  'miel': 'Dulce', 'honey': 'Dulce', 'almendra': 'Dulce', 'almond': 'Dulce',
  'coco': 'Dulce', 'coconut': 'Dulce', 'toffee': 'Dulce', 'praliné': 'Dulce',
  'tonka': 'Dulce', 'haba tonka': 'Dulce', 'benzoin': 'Dulce', 'benzoina': 'Dulce',
  'dulce': 'Dulce', 'gourmand': 'Dulce',

  // 🌊 Fresco / Acuático
  'marino': 'Fresco', 'acuático': 'Fresco', 'aquatic': 'Fresco', 'oceánico': 'Fresco',
  'agua': 'Fresco', 'water': 'Fresco', 'ozono': 'Fresco', 'ozone': 'Fresco',
  'menta': 'Fresco', 'mint': 'Fresco', 'eucalipto': 'Fresco', 'eucalyptus': 'Fresco',
  'alcanfor': 'Fresco', 'camphor': 'Fresco', 'fresco': 'Fresco', 'fresh': 'Fresco',
  'algas': 'Fresco', 'sal': 'Fresco', 'brisa': 'Fresco',

  // 🧴 Almizclado / Ambarino
  'almizcle': 'Almizclado', 'musk': 'Almizclado', 'ámbar': 'Almizclado', 'amber': 'Almizclado',
  'ambroxan': 'Almizclado', 'cashmeran': 'Almizclado', 'incienso': 'Almizclado',
  'frankincense': 'Almizclado', 'mirra': 'Almizclado', 'myrrh': 'Almizclado',
  'resina': 'Almizclado', 'resin': 'Almizclado', 'labdanum': 'Almizclado',
  'bálsamo': 'Almizclado', 'balsam': 'Almizclado', 'copal': 'Almizclado',

  // 🍎 Frutal
  'manzana': 'Frutal', 'apple': 'Frutal', 'durazno': 'Frutal', 'peach': 'Frutal',
  'pera': 'Frutal', 'pear': 'Frutal', 'ciruela': 'Frutal', 'plum': 'Frutal',
  'frambuesa': 'Frutal', 'raspberry': 'Frutal', 'fresa': 'Frutal', 'strawberry': 'Frutal',
  'cereza': 'Frutal', 'cherry': 'Frutal', 'grosella': 'Frutal', 'blackcurrant': 'Frutal',
  'higo': 'Frutal', 'fig': 'Frutal', 'piña': 'Frutal', 'pineapple': 'Frutal',
  'mango': 'Frutal', 'maracuyá': 'Frutal', 'passion fruit': 'Frutal',
  'frutal': 'Frutal', 'fruity': 'Frutal', 'lichi': 'Frutal', 'lychee': 'Frutal',

  // 🌿 Herbáceo / Aromático
  'romero': 'Aromático', 'rosemary': 'Aromático', 'salvia': 'Aromático', 'sage': 'Aromático',
  'tomillo': 'Aromático', 'thyme': 'Aromático', 'albahaca': 'Aromático', 'basil': 'Aromático',
  'artemisa': 'Aromático', 'absenta': 'Aromático', 'absinthe': 'Aromático',
  'hierba': 'Aromático', 'herbal': 'Aromático', 'aromático': 'Aromático',
  'té': 'Aromático', 'tea': 'Aromático', 'mate': 'Aromático',

  // 🧸 Empolvado / Cuero
  'cuero': 'Cuero', 'leather': 'Cuero', 'gamuza': 'Cuero', 'suede': 'Cuero',
  'tabaco': 'Cuero', 'tobacco': 'Cuero', 'ahumado': 'Cuero', 'smoky': 'Cuero',
}

// Emojis para cada familia
const FAMILY_EMOJIS: Record<string, string> = {
  'Amaderado': '🌲',
  'Cítrico': '🍋',
  'Floral': '🌸',
  'Especiado': '🌶️',
  'Dulce': '🍬',
  'Fresco': '🌊',
  'Almizclado': '🧴',
  'Frutal': '🍎',
  'Aromático': '🌿',
  'Cuero': '🧸',
}

function classifyNote(note: string): string {
  const normalized = note.toLowerCase().trim()
  // Intentar match exacto primero
  if (NOTE_FAMILIES[normalized]) return NOTE_FAMILIES[normalized]
  // Intentar match parcial
  for (const [key, family] of Object.entries(NOTE_FAMILIES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return family
    }
  }
  return 'Otro'
}

export async function getProfileData() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'NOT_AUTHENTICATED' }

  // 1. Perfil (créditos)
  const { data: profile } = await supabase
    .from('profiles')
    .select('search_credits, ads_watched_today, is_pro')
    .eq('id', user.id)
    .single()

  // 2. Inventario completo con datos del perfume
  const { data: inventoryItems } = await supabase
    .from('inventory')
    .select(`
      id,
      perfumes:global_perfume_cache (
        name,
        brand,
        top_notes,
        heart_notes,
        base_notes
      )
    `)
    .eq('user_id', user.id)

  // 3. Conteo de recomendaciones IA
  const { count: aiRecommendations } = await supabase
    .from('recommendation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // --- Procesamiento de estadísticas ---
  const totalPerfumes = inventoryItems?.length || 0
  const brands: string[] = []
  const brandCount: Record<string, number> = {}
  const allNotes: string[] = []

  inventoryItems?.forEach((item: any) => {
    const p = Array.isArray(item.perfumes) ? item.perfumes[0] : item.perfumes
    if (!p) return

    // Marcas
    if (p.brand) {
      brands.push(p.brand)
      brandCount[p.brand] = (brandCount[p.brand] || 0) + 1
    }

    // Notas
    if (p.top_notes) allNotes.push(...p.top_notes)
    if (p.heart_notes) allNotes.push(...p.heart_notes)
    if (p.base_notes) allNotes.push(...p.base_notes)
  })

  const uniqueBrands = new Set(brands).size
  const favoriteBrand = Object.entries(brandCount).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  // --- ADN Olfativo ---
  const familyCounts: Record<string, number> = {}
  allNotes.forEach(note => {
    const family = classifyNote(note)
    if (family !== 'Otro') {
      familyCounts[family] = (familyCounts[family] || 0) + 1
    }
  })

  const totalClassified = Object.values(familyCounts).reduce((a, b) => a + b, 0)
  const olfactoryDNA = Object.entries(familyCounts)
    .map(([family, count]) => ({
      family,
      emoji: FAMILY_EMOJIS[family] || '🔮',
      percentage: totalClassified > 0 ? Math.round((count / totalClassified) * 100) : 0,
      count
    }))
    .sort((a, b) => b.percentage - a.percentage)

  return {
    success: true,
    user: {
      name: user.user_metadata?.full_name || 'Usuario',
      email: user.email || '',
      avatar: user.user_metadata?.avatar_url || null,
      initial: user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase() || '?',
    },
    credits: profile?.search_credits ?? 0,
    adsWatchedToday: profile?.ads_watched_today ?? 0,
    isPro: profile?.is_pro || false,
    stats: {
      totalPerfumes,
      uniqueBrands,
      favoriteBrand,
      aiRecommendations: aiRecommendations || 0,
    },
    olfactoryDNA,
  }
}
