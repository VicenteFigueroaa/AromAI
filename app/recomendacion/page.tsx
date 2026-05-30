'use client';

import { useState, useEffect } from 'react';
import PerfumeCard from '@/components/PerfumeCard';
import { getRecommendationHistory } from '@/app/actions/recommendations';

export default function RecomendacionPage() {
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationPermitted, setLocationPermitted] = useState(true);
  const [feedbackGiven, setFeedbackGiven] = useState<'positive' | 'negative' | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  
  // Chat State
  const [isPro, setIsPro] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [preContextMessage, setPreContextMessage] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [chatCount, setChatCount] = useState(0);
  const [recommendationTime, setRecommendationTime] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      const res = await getRecommendationHistory();
      if (res.success && res.history) {
        setHistory(res.history);
        if (res.isPro !== undefined) setIsPro(res.isPro);
      }
    }
    loadHistory();
  }, []);

  const loadFromHistory = (item: any) => {
    setResult({
      source: 'history',
      log_id: item.log_id,
      winner: item.winner,
      justification: item.justification,
      context: item.context
    });
    setFeedbackGiven(item.feedback === true ? 'positive' : item.feedback === false ? 'negative' : null);
    setRecommendationTime(new Date(item.created_at).getTime());
    setChatCount(0);
    setChatMessage('');
  };

  const getRecommendation = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setFeedbackGiven(null);

    try {
      // 1. Intentar obtener ubicación GPS (no bloquea si falla)
      setStatusText('Consultando al satélite tu ubicación...');
      let latitude: number | undefined;
      let longitude: number | undefined;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          if (!navigator.geolocation) reject(new Error('no_support'));

          // Mostrar progreso mientras espera al GPS
          const statusTimer = setTimeout(() => {
            setStatusText('Buscando señal GPS... esto puede tardar unos segundos');
          }, 3000);

          navigator.geolocation.getCurrentPosition(
            (pos) => { clearTimeout(statusTimer); resolve(pos); },
            (err) => { clearTimeout(statusTimer); reject(err); },
            { 
              timeout: 10000,
              enableHighAccuracy: true,
              maximumAge: 120000 // Reusar ubicación de los últimos 2 minutos
            }
          );
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        setLocationPermitted(true);
      } catch (geoErr) {
        // GPS falló, no pasa nada — el servidor usará tu IP
        console.warn('📍 GPS no disponible, usando ubicación aproximada por IP');
        setStatusText('Usando ubicación aproximada...');
        setLocationPermitted(false);
      }

      // 2. Consultar a nuestra API (Ella se encarga de WeatherAPI y Gemini)
      setStatusText('Analizando clima, humedad e inventario...');
      const aiRes = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, preContextMessage })
      });

      const aiData = await aiRes.json();
      console.log('🔍 Respuesta de /api/recommend:', aiData);

      if (!aiRes.ok) {
        throw new Error(aiData.error || 'Error en la recomendación');
      }

      setResult(aiData);
      setRecommendationTime(Date.now());
      setChatCount(0);
      setChatMessage('');

      // Si nos devuelve un log_id (sea nuevo o de caché), lo añadimos al historial visual si no estaba
      if (aiData.log_id) {
        setHistory(prev => {
          // Evitamos duplicados en caso de que sea el mismo de la caché
          if (prev.some(h => h.log_id === aiData.log_id)) return prev;

          return [{
            log_id: aiData.log_id,
            created_at: new Date().toISOString(),
            winner: aiData.winner,
            justification: aiData.justification,
            context: aiData.context,
            feedback: null
          }, ...prev];
        });
      }

    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (isPositive: boolean) => {
    if (!result?.log_id || feedbackGiven) return;

    setFeedbackGiven(isPositive ? 'positive' : 'negative');

    try {
      await fetch('/api/recommend/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_id: result.log_id, is_positive: isPositive })
      });
    } catch (error) {
      console.error('Error enviando feedback:', error);
    }
  };

  const isChatLocked = () => {
    if (!recommendationTime) return true;
    const minutesPassed = (now - recommendationTime) / 1000 / 60;
    if (minutesPassed > 5) return true;
    if (!isPro && chatCount >= 1) return true;
    return false;
  };

  const getChatPlaceholder = () => {
    if (!recommendationTime) return '';
    const minutesPassed = (now - recommendationTime) / 1000 / 60;
    if (minutesPassed > 5) return 'Chat cerrado por inactividad. Pide una nueva recomendación.';
    if (!isPro && chatCount >= 1) return 'Límite gratis alcanzado. Hazte Premium para seguir.';
    return 'Afinar recomendación (Ej. Voy a salir de noche)';
  };

  const handleChat = async () => {
    if (!chatMessage.trim() || isChatLocked() || isChatting || !result) return;
    setIsChatting(true);
    setError(null);
    try {
      const res = await fetch('/api/recommend/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_id: result.log_id,
          message: chatMessage,
          weatherContext: result.context,
          previousWinnerId: result.winner.id,
          previousJustification: result.justification
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al chatear');

      setResult({
        ...result,
        winner: data.winner,
        justification: data.justification,
        source: 'live'
      });
      setChatMessage('');
      setChatCount(prev => prev + 1);
      setRecommendationTime(Date.now()); // Da otros 5 minutos
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsChatting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 flex flex-col items-center p-6 sm:p-12 font-sans relative overflow-hidden">

      {/* Fondo Mágico */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/10 blur-[120px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-2xl text-center mt-10 mb-12 relative z-10">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
          ¿Qué fragancia me <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-400">pongo hoy?</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-lg mx-auto">
          Análisis de humedad y radiación UV para una precisión total.
        </p>
      </div>

      {!result && (
        <div className="flex flex-col items-center gap-4 relative z-10 w-full max-w-md">
          {/* Pre-Context Input */}
          <div className="w-full relative">
            <input
              type="text"
              value={preContextMessage}
              onChange={(e) => setPreContextMessage(e.target.value)}
              maxLength={!isPro ? 150 : undefined}
              placeholder="Petición especial (Opc. ej: Voy al gimnasio)"
              className="w-full bg-slate-800/80 border border-slate-700 text-slate-200 text-sm rounded-2xl px-5 py-4 focus:outline-none focus:border-emerald-500 transition-colors shadow-lg placeholder:text-slate-500 disabled:opacity-50"
              disabled={loading}
            />
            {!isPro && preContextMessage.length > 0 && (
              <p className="text-[10px] text-slate-500 w-full text-right mt-1 absolute -bottom-4 right-2">
                {preContextMessage.length} / 150
              </p>
            )}
          </div>

          {/* Main Button */}
          <button
            onClick={getRecommendation}
            disabled={loading}
            className="w-full relative group overflow-hidden bg-slate-800 hover:bg-slate-700 disabled:opacity-80 border border-slate-700 hover:border-emerald-500/50 shadow-2xl rounded-3xl p-1 transition-all duration-300 transform hover:scale-[1.02] active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity"></div>
            <div className="bg-slate-900 rounded-[22px] px-8 py-6 flex items-center gap-4 relative z-10 w-full">
              {loading ? (
                <svg className="w-8 h-8 animate-spin text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.2"></circle>
                  <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round"></path>
                </svg>
              ) : (
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
              )}

              <div className="text-left">
                <p className="text-white font-bold text-lg leading-tight">
                  {loading ? 'Consultando...' : 'Generar Selección'}
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  {loading ? statusText : 'Analizando clima actual'}
                </p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Sección de Historial */}
      {!result && history.length > 0 && !loading && (
        <div className="w-full max-w-4xl mt-16 animate-in fade-in slide-in-from-bottom-8 duration-700 z-10 relative">
          <div className="flex items-center gap-3 mb-6">
            <h3 className="text-lg font-semibold text-slate-300">Historial Reciente</h3>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-slate-700 to-transparent"></div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-6 snap-x hide-scrollbar">
            {history.map((item, index) => {
              const date = new Date(item.created_at);
              const timeString = date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={item.log_id || index}
                  onClick={() => loadFromHistory(item)}
                  className="min-w-[280px] sm:min-w-[320px] bg-slate-800/60 hover:bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-2xl p-4 cursor-pointer transition-all snap-start flex items-center gap-4 group"
                >
                  <div className="w-16 h-16 rounded-xl bg-slate-900 overflow-hidden flex-shrink-0 border border-slate-700 relative">
                    {item.winner?.image_url && (
                      <img src={item.winner.image_url} alt={item.winner.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    )}
                    {item.feedback === true && (
                      <div className="absolute -top-1 -right-1 bg-emerald-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] border-2 border-slate-900">👍</div>
                    )}
                    {item.feedback === false && (
                      <div className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 flex items-center justify-center text-[10px] border-2 border-slate-900">👎</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">{timeString} • {item.context?.temp}°C</p>
                    <p className="text-sm font-bold text-slate-200 truncate">{item.winner?.name}</p>
                    <p className="text-xs text-slate-400 truncate uppercase tracking-wider">{item.winner?.brand}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-8 p-4 bg-red-900/50 border border-red-500/50 rounded-xl text-red-200 text-center max-w-md w-full animate-in fade-in zoom-in duration-300">
          <p>{error}</p>
          {!locationPermitted && (
            <p className="text-xs mt-2 text-red-300 opacity-80">Habilita el acceso GPS en tu navegador.</p>
          )}
          <button onClick={() => { setError(null); setResult(null); }} className="mt-4 px-4 py-2 bg-red-800 hover:bg-red-700 rounded-lg text-sm transition-colors">Volver a intentar</button>
        </div>
      )}

      {result && (
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-start mt-8 animate-in slide-in-from-bottom-8 duration-700 relative z-10">

          {/* Tarjeta de Contexto Enriquecida */}
          <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-3xl p-8 shadow-2xl flex flex-col h-full relative order-2 md:order-1">

            {/* Indicador de Origen (Cache vs Live AI) */}
            <div className="absolute top-6 right-6">
              <span className={`text-[10px] px-2 py-1 rounded-full font-bold tracking-wide uppercase ${result.source === 'cache' ? 'bg-emerald-900/50 text-emerald-400 border border-emerald-500/30' : 'bg-purple-900/50 text-purple-400 border border-purple-500/30'
                }`}>
                {result.source === 'cache' ? '⚡ Recomendación Activa' : '🧠 Recién Analizado'}
              </span>
            </div>

            <h3 className="text-emerald-400 font-bold uppercase tracking-widest text-xs mb-6 pr-32">Condiciones de tu entorno</h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              <div className="bg-slate-900/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xl mb-1">🌡️</span>
                <span className="text-lg font-black text-white">{result.context.temp}°C</span>
                <span className="text-[10px] text-slate-500 uppercase">Temp</span>
              </div>
              <div className="bg-slate-900/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xl mb-1">💧</span>
                <span className="text-lg font-black text-white">{result.context.humidity}%</span>
                <span className="text-[10px] text-slate-500 uppercase">Humedad</span>
              </div>
              <div className="bg-slate-900/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xl mb-1">☀️</span>
                <span className="text-lg font-black text-white">{result.context.uv}</span>
                <span className="text-[10px] text-slate-500 uppercase">UV Index</span>
              </div>
              <div className="bg-slate-900/80 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                <span className="text-xl mb-1">{result.context.isDay === 'Día' ? '🌤️' : '🌙'}</span>
                <span className="text-[10px] font-semibold text-slate-300 truncate w-full">{result.context.condition}</span>
                <span className="text-[10px] text-slate-500 uppercase">Cielo</span>
              </div>
            </div>

            <div className="mt-auto">
              <h3 className="text-blue-400 font-bold uppercase tracking-widest text-xs mb-3">Consejo del Experto</h3>
              <p className="text-slate-300 leading-relaxed text-lg italic bg-slate-900/40 p-4 rounded-2xl border-l-4 border-blue-500 mb-6">
                "{result.justification}"
              </p>

              {/* Botones de Feedback */}
              {result.log_id && (
                <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800 mb-6">
                  <span className="text-sm text-slate-400 font-medium">
                    {feedbackGiven ? '¡Gracias por tu opinión!' : '¿Te parece una buena recomendación?'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFeedback(true)}
                      disabled={feedbackGiven !== null}
                      className={`p-2 rounded-lg transition-all ${feedbackGiven === 'positive'
                        ? 'bg-emerald-500 text-emerald-950 scale-110'
                        : feedbackGiven === 'negative'
                          ? 'opacity-30 grayscale'
                          : 'bg-slate-800 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400'
                        }`}
                    >
                      👍
                    </button>
                    <button
                      onClick={() => handleFeedback(false)}
                      disabled={feedbackGiven !== null}
                      className={`p-2 rounded-lg transition-all ${feedbackGiven === 'negative'
                        ? 'bg-red-500 text-red-950 scale-110'
                        : feedbackGiven === 'positive'
                          ? 'opacity-30 grayscale'
                          : 'bg-slate-800 text-slate-300 hover:bg-red-500/20 hover:text-red-400'
                        }`}
                    >
                      👎
                    </button>
                  </div>
                </div>
              )}

              {/* Input Chat Sommelier */}
              <div className="flex gap-2 w-full animate-in fade-in duration-500">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleChat(); }}
                  disabled={isChatLocked() || isChatting}
                  maxLength={!isPro ? 150 : undefined}
                  placeholder={getChatPlaceholder()}
                  className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                />
                <button
                  onClick={handleChat}
                  disabled={isChatLocked() || isChatting || !chatMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-3 rounded-xl font-bold transition-colors flex items-center justify-center min-w-[50px]"
                >
                  {isChatting ? (
                    <svg className="w-5 h-5 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <circle cx="12" cy="12" r="10" strokeWidth="3" strokeOpacity="0.2"></circle>
                      <path d="M12 2a10 10 0 0 1 10 10" strokeWidth="3" strokeLinecap="round"></path>
                    </svg>
                  ) : (
                    '➤'
                  )}
                </button>
              </div>
              {!isPro && !isChatLocked() && chatMessage.length > 0 && (
                <p className="text-[10px] text-right mt-1 text-slate-500">
                  {chatMessage.length} / 150
                </p>
              )}
            </div>

            <button
              onClick={() => setResult(null)}
              className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Nueva consulta
            </button>
          </div>

          {/* Tarjeta del Perfume */}
          <div className="w-full max-w-sm mx-auto pointer-events-none order-1 md:order-2">
            <div className="relative">
              <div className="absolute -inset-4 bg-emerald-500/20 blur-xl rounded-full animate-pulse"></div>
              <PerfumeCard perfume={result.winner} />
            </div>
          </div>

        </div>
      )}

    </main>
  );
}
