import { useLocation } from '../contexts/LocationContext';

export default function LocationPromptModal() {
    const { isPromptModalOpen, handleModalAllow, handleModalDeny } = useLocation();

    if (!isPromptModalOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full shadow-2xl transform transition-all">
                <div className="w-12 h-12 rounded-full bg-[var(--color-purdue-gold)]/20 flex items-center justify-center mb-4 text-[var(--color-purdue-gold)]">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </div>
                <h2 className="text-xl font-bold mb-2 text-white">Enable Location</h2>
                <p className="text-sm text-[var(--color-text-secondary)] mb-6 leading-relaxed">
                    We use your location to show nearby study spots and provide accurate walking directions across campus. We never permanently store your location data.
                </p>
                <div className="flex flex-col gap-3">
                    <button
                        onClick={handleModalAllow}
                        className="w-full py-3 px-4 bg-gradient-to-r from-[var(--color-purdue-gold)] to-[var(--color-purdue-rush)] text-black font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
                    >
                        Allow Location Access
                    </button>
                    <button
                        onClick={handleModalDeny}
                        className="w-full py-3 px-4 bg-transparent border border-white/10 text-white font-medium rounded-xl hover:bg-white/5 transition-all"
                    >
                        Not Now
                    </button>
                </div>
            </div>
        </div>
    );
}
