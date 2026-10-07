import React, { PropsWithChildren } from 'react';

interface ActionMessageProps {
    on?: boolean;
    className?: string;
}

export default function ActionMessage({
    on = false,
    className = '',
    children,
}: PropsWithChildren<ActionMessageProps>) {
    if (!on) return null;

    return (
        <div className={`text-sm text-gray-600 transition-opacity duration-300 ${className}`}>
            {children}
        </div>
    );
}
