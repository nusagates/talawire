import React, { forwardRef, InputHTMLAttributes } from 'react';

export default forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
    { type = 'text', className = '', ...props },
    ref
) {
    return (
        <input
            {...props}
            type={type}
            className={
                `border-gray-300 focus:border-blue-500 focus:ring-blue-500 rounded-lg shadow-sm text-sm text-gray-900 bg-white placeholder-gray-400 ${className}`
            }
            ref={ref}
        />
    );
});
