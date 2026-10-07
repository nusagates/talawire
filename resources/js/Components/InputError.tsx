import React, { HTMLAttributes } from 'react';

export default function InputError({
    message,
    className = '',
    ...props
}: HTMLAttributes<HTMLParagraphElement> & { message?: string }) {
    if (!message) return null;

    return (
        <p {...props} className={`text-xs text-red-600 mt-1 font-medium ${className}`}>
            {message}
        </p>
    );
}
