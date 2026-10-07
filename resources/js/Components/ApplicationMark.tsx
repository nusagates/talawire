import React from 'react';
import { Zap } from 'lucide-react';

export default function ApplicationMark({ className = '' }: { className?: string }) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm text-white">
                <Zap className="w-4 h-4 fill-current" />
            </div>
            <span className="font-semibold text-lg tracking-tight text-gray-900">Talawire</span>
        </div>
    );
}
