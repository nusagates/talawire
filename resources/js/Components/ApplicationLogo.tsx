import React from 'react';
import { Zap } from 'lucide-react';

export default function ApplicationLogo({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm text-white">
                <Zap className="w-6 h-6 fill-current" />
            </div>
            <span className="font-semibold text-2xl tracking-tight text-gray-900">Talawire</span>
        </div>
    );
}
