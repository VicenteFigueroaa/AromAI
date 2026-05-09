export default function LoadingProfile() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-6 sm:p-12 font-sans relative overflow-hidden">
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* User Card Skeleton */}
        <section className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 mb-8 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-slate-800"></div>
            <div className="flex-1 space-y-3">
              <div className="h-8 w-48 bg-slate-800 rounded-lg"></div>
              <div className="h-4 w-32 bg-slate-800/50 rounded"></div>
              <div className="h-6 w-24 bg-slate-800/30 rounded-full mt-2"></div>
            </div>
            <div className="hidden sm:block h-10 w-32 bg-slate-800 rounded-xl"></div>
          </div>
        </section>

        {/* Credits Panel Skeleton */}
        <section className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 mb-8 animate-pulse">
          <div className="h-6 w-40 bg-slate-800 rounded mb-6"></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="bg-slate-800/60 rounded-2xl p-6 h-32"></div>
            <div className="bg-slate-800/60 rounded-2xl p-6 h-32"></div>
          </div>
        </section>

        {/* Stats Grid Skeleton */}
        <section className="mb-8 animate-pulse">
          <div className="h-6 w-40 bg-slate-800 rounded mb-6"></div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 h-28"></div>
            ))}
          </div>
        </section>

        {/* DNA Chart Skeleton */}
        <section className="bg-slate-900/80 backdrop-blur border border-slate-800 rounded-3xl p-8 animate-pulse">
          <div className="h-6 w-40 bg-slate-800 rounded mb-2"></div>
          <div className="h-4 w-64 bg-slate-800/50 rounded mb-8"></div>
          <div className="space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between">
                  <div className="h-4 w-24 bg-slate-800 rounded"></div>
                  <div className="h-4 w-8 bg-slate-800 rounded"></div>
                </div>
                <div className="w-full h-3 bg-slate-800 rounded-full"></div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
