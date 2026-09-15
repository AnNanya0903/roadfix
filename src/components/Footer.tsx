import { Route, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 py-10 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center">
              <Route className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white">
              RoadFix<span className="text-teal-400">.in</span>
            </span>
          </div>
          <p className="text-sm text-slate-400 text-center">
            Empowering citizens to fix their roads, one complaint at a time.
          </p>
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            Made with <Heart className="w-3.5 h-3.5 text-rose-500" /> for India
          </p>
        </div>
      </div>
    </footer>
  );
}
