export default function Footer() {
    return (
        <footer className="bg-slate-50 border-t border-slate-200 py-6 px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">

                {/* Copyright Text */}
                <p className="text-slate-500 text-sm text-center md:text-left">
                    &copy; {new Date().getFullYear()} <span className="font-semibold text-slate-700">SBP App V3</span>.
                    All rights reserved.
                </p>

                {/* Quick Links (Optional) */}
                <div className="flex items-center gap-6 text-sm text-slate-500">
                    <a href="#" className="hover:text-blue-600 transition-colors">Support</a>
                    <a href="#" className="hover:text-blue-600 transition-colors">Dokumentasi</a>
                    <div className="flex items-center gap-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md border border-green-200">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        System Normal
                    </div>
                </div>
            </div>
        </footer>
    );
}