"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { addPerfumeToShelf } from "@/app/actions/inventory";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [addingCredits, setAddingCredits] = useState(false);
  const [addingToShelf, setAddingToShelf] = useState(false);
  const [shelfMessage, setShelfMessage] = useState<{ text: string; type: 'success' | 'error' | 'pro' } | null>(null);

  // Estados para búsqueda por foto
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);

  // Mensajes con duración independiente
  const loadingMessages = [
    { text: "Consultando a la IA...", duration: 5500 },
    { text: "Analizando notas olfativas...", duration: 6000 },
    { text: "Buscando en la base de datos...", duration: 3000 },
    { text: "Evaluando alternativas similares...", duration: 4000 },
    { text: "Afinando los últimos detalles...", duration: 9500 },
  ];

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [isChangingVariant, setIsChangingVariant] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (loading || isChangingVariant) {
      setLoadingMessageIndex(0);

      const changeMessage = (index: number) => {
        timeout = setTimeout(() => {
          const nextIndex = (index + 1) % loadingMessages.length;

          setLoadingMessageIndex(nextIndex);

          changeMessage(nextIndex); // programa el siguiente cambio
        }, loadingMessages[index].duration);
      };

      changeMessage(0);
    }

    return () => clearTimeout(timeout);
  }, [loading, isChangingVariant]);

  // Estados para variantes (EDT/EDP/Parfum)
  const [variants, setVariants] = useState<string[]>([]);
  const [activeConcentration, setActiveConcentration] = useState<string>('');

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('search_credits, ads_watched_today, is_pro')
          .eq('id', user.id)
          .single();

        if (profile) {
          setIsPro(profile.is_pro || false);
          setCredits(profile.search_credits);
          if (profile.ads_watched_today >= 2) {
            setErrorCode('DAILY_LIMIT_REACHED');
          }
        }
      }
    };
    fetchUser();
  }, []);

  const handleAddToShelf = async () => {
    if (!result?.data?.id) return;

    setAddingToShelf(true);
    setShelfMessage(null);

    const res = await addPerfumeToShelf(result.data.id);

    if (res.success) {
      setShelfMessage({ text: '¡Añadido a tu estante!', type: 'success' });
    } else {
      if (res.error === 'LIMIT_REACHED') {
        setShelfMessage({ text: 'Has alcanzado el límite de 3 perfumes gratis. ¡Hazte Pro para añadir más!', type: 'pro' });
      } else if (res.error === 'ALREADY_EXISTS') {
        setShelfMessage({ text: 'Ya tienes este perfume en tu estante.', type: 'error' });
      } else {
        setShelfMessage({ text: 'Error al añadir. Inténtalo de nuevo.', type: 'error' });
      }
    }
    setAddingToShelf(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Comprimir a JPEG con 70% de calidad para evitar errores de Payload Too Large en Vercel
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setSelectedImage(dataUrl.split(',')[1]);
        setImageMimeType('image/jpeg');
        setSearchQuery("");
      };
    };
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImageMimeType(null);
  };

  const executeSearch = async (queryOverride?: string) => {
    const finalQuery = queryOverride !== undefined ? queryOverride : searchQuery;
    if (!finalQuery.trim() && !selectedImage) return;

    if (queryOverride !== undefined) {
      setSearchQuery(queryOverride);
      setSelectedImage(null);
      setImageMimeType(null);
    }

    setLoading(true);
    setError("");
    setResult(null);
    setVariants([]);
    setActiveConcentration('');
    setShelfMessage(null);

    try {
      const body: any = { perfumeName: finalQuery };
      if (!queryOverride && selectedImage && imageMimeType) {
        body.imageBase64 = selectedImage;
        body.imageMimeType = imageMimeType;
      }

      const res = await fetch("/api/search-perfume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const contentType = res.headers.get("content-type");
      let data;

      if (contentType && contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const textError = await res.text();
        if (res.status === 413) {
          throw new Error("La imagen sigue siendo demasiado grande (Error 413).");
        }
        console.error("Non-JSON Error:", textError);
        throw new Error("Error en el servidor al procesar la solicitud.");
      }

      if (!res.ok) {
        setErrorCode(data?.error || 'ERROR');
        throw new Error(data?.message || data?.error || "Hubo un error al buscar el perfume");
      }

      setResult(data);
      setVariants(data.variants || []);
      setActiveConcentration(data.data.concentration || '');

      // Descontamos 1 crédito visualmente por la búsqueda (solo si no es premium)
      if (!isPro && credits !== null) {
        setCredits(prev => (prev ? prev - 1 : 0));
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWatchAd = async () => {
    setAddingCredits(true);
    try {
      const res = await fetch('/api/add-credits', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setCredits(data.credits);
        setError('');
        setErrorCode(null);
      } else {
        setErrorCode(data.error || 'ERROR');
        setError(data.message || 'Error al ver el anuncio.');
      }
    } catch (err) {
      console.error(err);
      setError('Hubo un problema de conexión.');
    } finally {
      setAddingCredits(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch();
  };

  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 flex flex-col items-center p-6 sm:p-12 font-sans">

      {/* Header / Branding */}
      <div className="w-full max-w-md flex justify-between items-center mt-4 mb-4">
        {user ? (
          <div className="bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
            <span className="text-xl">{isPro ? '👑' : '⚡'}</span>
            <span className="text-sm font-bold text-slate-200">
              {isPro ? '∞' : (credits !== null ? credits : '...')} <span className="text-slate-500 font-normal">{isPro ? 'Premium' : 'Créditos'}</span>
            </span>
            {!isPro && credits === 0 && (
              <button onClick={handleWatchAd} disabled={addingCredits || errorCode === 'DAILY_LIMIT_REACHED'} className="ml-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs px-2 py-0.5 rounded-full transition-colors">
                {addingCredits ? '...' : errorCode === 'DAILY_LIMIT_REACHED' ? 'Límite' : '+1'}
              </button>
            )}
          </div>
        ) : (
          <a href="/login" className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">Iniciar Sesión</a>
        )}
      </div>

      <div className="w-full max-w-md text-center mb-8">
        <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400 mb-2">
          AromAI
        </h1>
        <p className="text-slate-400">Tu sommelier de fragancias personal</p>
      </div>

      {/* Caja de Búsqueda */}
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-xl p-6 border border-slate-700">
        <form onSubmit={handleSearch} className="flex flex-col gap-4">
          <label htmlFor="perfume" className="text-sm text-slate-300 font-medium">
            Investigar o agregar un perfume
          </label>
          <div className="relative flex items-center bg-slate-900 border border-slate-600 rounded-xl transition-colors focus-within:border-blue-500 overflow-hidden">
            <input
              id="perfume"
              type="text"
              placeholder={selectedImage ? "Imagen adjunta (opcional añadir texto)" : "Ej: Sauvage Dior o Eros Versace"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent px-4 py-3 text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            <label className="cursor-pointer p-3 text-slate-400 hover:text-emerald-400 transition-colors flex items-center justify-center border-l border-slate-700 bg-slate-800 hover:bg-slate-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" /><circle cx="12" cy="13" r="3" /></svg>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
            </label>
          </div>

          {/* Vista previa de la imagen */}
          {selectedImage && imageMimeType && (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-slate-600 group">
              <img src={`data:${imageMimeType};base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-1 right-1 bg-slate-900/80 hover:bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs"
              >
                ✕
              </button>
            </div>
          )}
          <button
            type="submit"
            disabled={loading || (!searchQuery.trim() && !selectedImage)}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
          >
            {loading ? (
              <span className="animate-pulse">{loadingMessages[loadingMessageIndex].text}</span>
            ) : (
              "Analizar Fragancia"
            )}
          </button>
        </form>

        {/* Mensaje de Error y Botones de Acción */}
        {error && (
          <div className="mt-6 p-5 bg-slate-800 border border-red-500/50 rounded-2xl text-center shadow-lg animate-in fade-in slide-in-from-top-2">
            <p className="text-red-300 text-sm mb-4 font-medium leading-relaxed">{error}</p>

            {errorCode === 'AUTH_REQUIRED' && (
              <a href="/login" className="inline-block w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl transition-colors">
                🔐 Iniciar Sesión Gratis
              </a>
            )}

            {errorCode === 'NO_CREDITS' && (
              <button
                onClick={handleWatchAd}
                disabled={addingCredits}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white font-semibold py-3 rounded-xl transition-colors flex justify-center items-center gap-2 shadow-lg shadow-emerald-900/20"
              >
                {addingCredits ? (
                  <span className="animate-pulse">Cargando anuncio...</span>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    Ver Anuncio (+1 Búsqueda IA)
                  </>
                )}
              </button>
            )}

            {errorCode === 'DAILY_LIMIT_REACHED' && (
              <div className="w-full bg-slate-700 text-slate-400 font-semibold py-3 rounded-xl flex justify-center items-center gap-2 mt-4 cursor-not-allowed">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Límite diario alcanzado. Vuelve mañana.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tarjeta de Resultados */}
      {result && result.data && (
        <div className="w-full max-w-md mt-6 bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">

          {/* Overlay de Carga para Variantes */}
          {isChangingVariant && (
            <div className="absolute inset-0 z-20 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-blue-300 font-medium text-sm animate-pulse text-center px-4">{loadingMessages[loadingMessageIndex].text}</p>
            </div>
          )}

          {/* Cabecera Premium Minimalista */}
          <div className={`w-full h-48 relative overflow-hidden flex flex-col items-center justify-center transition-all duration-300 ${isChangingVariant ? 'opacity-50 grayscale' : ''}`}>
            {/* Fondo Base Oscuro */}
            <div className="absolute inset-0 bg-slate-900"></div>

            {/* Gradiente Radial Sutil */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/40 via-emerald-900/20 to-transparent"></div>

            {/* Marca de Agua: Inicial de la marca gigante */}
            <div className="absolute -right-6 -bottom-16 text-[200px] font-black text-white/[0.03] select-none tracking-tighter leading-none">
              {result.data.brand.charAt(0).toUpperCase()}
            </div>

            {/* Contenido Central: Ícono del Perfume */}
            <div className="relative z-10 text-center">
              <div className="w-16 h-16 mx-auto bg-slate-800/80 backdrop-blur-md border border-slate-700/80 rounded-2xl flex items-center justify-center shadow-2xl mb-2">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
            </div>

            {/* Indicador de Origen (Solo si es IA) */}
            {(result.source !== 'cache' && result.source !== 'canonical_cache') && (
              <div className="absolute top-4 right-4 z-10 group">
                <div className="relative cursor-help">
                  <span className="text-sm p-1.5 rounded-full bg-purple-900/40 text-purple-300 border border-purple-500/30 backdrop-blur-md shadow-lg transition-all hover:bg-purple-800/60 flex items-center justify-center">
                    🧠
                  </span>
                  {/* Tooltip Premium */}
                  <div className="absolute right-0 top-full mt-2 w-max px-3 py-1.5 bg-slate-900/95 text-[10px] text-purple-200 rounded-lg border border-purple-500/30 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-20 shadow-2xl translate-y-1 group-hover:translate-y-0">
                    <span className="font-bold tracking-wider">ENTRENANDO IA</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-white mb-1">{result.data.name}</h2>
            <div className="flex items-center gap-2 mb-4">
              <p className="text-sm tracking-wide text-blue-400 uppercase font-semibold">{result.data.brand}</p>
              {activeConcentration && (
                <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold tracking-wider">
                  {activeConcentration}
                </span>
              )}
            </div>

            {/* Selector de Variantes */}
            {variants.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-xs text-slate-400 self-center mr-1">Versión:</span>
                {variants.map((v) => (
                  <button
                    key={v}
                    onClick={async () => {
                      if (v === activeConcentration) return;
                      // Buscar la variante seleccionada
                      setIsChangingVariant(true);
                      setError('');
                      try {
                        const baseName = result.data.name
                          .replace(/\s*(EDT|EDP|Parfum|Elixir|Intense|Cologne|Cologne|Attitude|Splendid)\s*(\(.*\))?\s*$/i, '')
                          .trim();
                        const res = await fetch('/api/search-perfume', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ perfumeName: `${result.data.brand} ${baseName} ${v}` }),
                        });
                        const data = await res.json();

                        if (!res.ok) {
                          setErrorCode(data.error || 'ERROR');
                          throw new Error(data.message || data.error || 'Error al cambiar variante');
                        }

                        if (data.data) {
                          setResult(data);
                          setActiveConcentration(v);

                          if (!isPro && credits !== null) {
                            setCredits(prev => (prev ? prev - 1 : 0));
                          }
                        }
                      } catch (err: any) {
                        setError(err.message);
                      } finally {
                        setIsChangingVariant(false);
                      }
                    }}
                    className={`text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${v === activeConcentration
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white'
                      }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}

            <p className="text-slate-300 text-sm leading-relaxed mb-6 bg-slate-900/50 p-4 rounded-xl border-l-4 border-emerald-500">
              {result.data.description}
            </p>

            {/* Notas Olfativas */}
            <div className="space-y-3 mb-6">
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Notas de Salida</span>
                <div className="flex flex-wrap gap-2">
                  {result.data.top_notes?.map((nota: string, i: number) => (
                    <span key={i} className="bg-slate-700 px-3 py-1 rounded-full text-xs text-slate-200">{nota}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Notas de Corazón</span>
                <div className="flex flex-wrap gap-2">
                  {result.data.heart_notes?.map((nota: string, i: number) => (
                    <span key={i} className="bg-slate-700 px-3 py-1 rounded-full text-xs text-slate-200">{nota}</span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-1">Notas de Fondo</span>
                <div className="flex flex-wrap gap-2">
                  {result.data.base_notes?.map((nota: string, i: number) => (
                    <span key={i} className="bg-slate-700 px-3 py-1 rounded-full text-xs text-slate-200">{nota}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Metadatos (Clima, Momento, etc.) */}
            <div className="grid grid-cols-2 gap-3 mt-6 pt-6 border-t border-slate-700">
              <div className="bg-slate-900 p-3 rounded-lg text-center">
                <span className="block text-[10px] text-slate-500 uppercase mb-1">Clima Ideal</span>
                <span className="text-sm font-medium capitalize text-slate-200">
                  {result.data.ai_metadata?.clima_ideal?.join(" / ") || "Variado"}
                </span>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg text-center">
                <span className="block text-[10px] text-slate-500 uppercase mb-1">Momento</span>
                <span className="text-sm font-medium capitalize text-slate-200">
                  {result.data.ai_metadata?.momento_del_dia?.join(" / ") || "Cualquiera"}
                </span>
              </div>
            </div>

            {/* Botón de Añadir al Estante / Mensajes */}
            <div className="mt-6 pt-6 border-t border-slate-700">
              {user ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleAddToShelf}
                    disabled={addingToShelf}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl transition-colors flex justify-center items-center gap-2"
                  >
                    {addingToShelf ? (
                      <span className="animate-pulse">Añadiendo...</span>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                        Añadir a Mi Estante
                      </>
                    )}
                  </button>
                  {shelfMessage && (
                    <div className={`p-3 rounded-lg text-sm text-center border ${shelfMessage.type === 'success' ? 'bg-emerald-900/50 border-emerald-500/50 text-emerald-200' :
                      shelfMessage.type === 'pro' ? 'bg-amber-900/50 border-amber-500/50 text-amber-200' :
                        'bg-red-900/50 border-red-500/50 text-red-200'
                      }`}>
                      {shelfMessage.text}
                      {shelfMessage.type === 'pro' && (
                        <button className="mt-2 w-full bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold py-2 rounded-lg transition-colors">
                          ⭐ Descubrir AromAI Pro
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-slate-900 rounded-xl text-center border border-slate-700">
                  <p className="text-sm text-slate-400 mb-3">Inicia sesión para guardar este perfume en tu colección personal.</p>
                  <a href="/login" className="inline-block bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                    Iniciar Sesión
                  </a>
                </div>
              )}
            </div>

            {/* Alternativas sugeridas */}
            {result.data.ai_metadata?.alternatives && (
              <div className="mt-6 pt-6 border-t border-slate-700">
                <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  Alternativas Sugeridas
                </h3>
                <div className="flex flex-col gap-3">
                  {[
                    { type: 'economy', label: '💸 Opción Económica / Clon', data: result.data.ai_metadata.alternatives.economy },
                    { type: 'peer', label: '🤝 Opción Similar', data: result.data.ai_metadata.alternatives.peer },
                    { type: 'upgrade', label: '💎 Opción Premium / Nicho', data: result.data.ai_metadata.alternatives.upgrade }
                  ].map((alt) => alt.data && (
                    <div key={alt.type} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 hover:border-emerald-500/50 transition-colors group">
                      <div className="flex justify-between items-start gap-2 mb-2">
                        <div>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${alt.type === 'economy' ? 'text-green-400' :
                            alt.type === 'peer' ? 'text-blue-400' : 'text-purple-400'
                            }`}>{alt.label}</p>
                          <h4 className="text-sm font-bold text-white leading-tight">{alt.data.brand} - {alt.data.name}</h4>
                        </div>
                        <button
                          onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            executeSearch(`${alt.data.brand} ${alt.data.name}`);
                          }}
                          className="bg-slate-800 hover:bg-emerald-600 border border-slate-600 hover:border-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 opacity-80 group-hover:opacity-100"
                        >
                          Analizar
                        </button>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{alt.data.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </main>
  );
}