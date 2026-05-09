export default function LoadingShelf() {
  return (
    <main className="min-h-screen bg-slate-900 text-slate-50 p-6 sm:p-12 font-sans">
      <div className="max-w-5xl mx-auto">
        {/* Header Skeleton */}
        <header className="flex justify-between items-end mb-10 border-b border-slate-800 pb-6">
          <div className="space-y-3">
            <div className="h-10 w-48 bg-slate-800 rounded-lg animate-pulse"></div>
            <div className="h-4 w-64 bg-slate-800/50 rounded animate-pulse"></div>
          </div>
          <div className="h-10 w-32 bg-slate-800 rounded-lg animate-pulse"></div>
        </header>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 h-80 animate-pulse">
              <div className="w-full h-40 bg-slate-700/50 rounded-xl mb-4"></div>
              <div className="h-6 w-3/4 bg-slate-700/50 rounded mb-2"></div>
              <div className="h-4 w-1/2 bg-slate-700/30 rounded mb-6"></div>
              <div className="flex justify-between items-center">
                <div className="h-8 w-24 bg-slate-700/50 rounded-lg"></div>
                <div className="h-8 w-8 bg-slate-700/50 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
