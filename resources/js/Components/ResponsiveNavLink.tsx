import React, { PropsWithChildren, ButtonHTMLAttributes } from 'react';
import { Link, InertiaLinkProps } from '@inertiajs/react';

type ResponsiveNavLinkProps = PropsWithChildren<{
    active?: boolean;
    as?: 'button' | 'a';
    href?: string;
    onClick?: () => void;
    className?: string;
} & Partial<InertiaLinkProps> & ButtonHTMLAttributes<HTMLButtonElement>>;

export default function ResponsiveNavLink({
    active = false,
    as = 'a',
    href,
    className = '',
    children,
    onClick,
    ...props
}: ResponsiveNavLinkProps) {
    const classes = active
        ? 'block w-full ps-3 pe-4 py-2 border-l-4 border-blue-600 text-start text-base font-medium text-blue-700 bg-blue-50/50 focus:outline-none focus:text-blue-800 focus:bg-blue-100 focus:border-blue-700 transition duration-150 ease-in-out'
        : 'block w-full ps-3 pe-4 py-2 border-l-4 border-transparent text-start text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus:text-gray-800 focus:bg-gray-50 focus:border-gray-300 transition duration-150 ease-in-out';

    if (as === 'button') {
        return (
            <button
                type="button"
                className={`${classes} ${className}`}
                onClick={onClick}
                {...(props as ButtonHTMLAttributes<HTMLButtonElement>)}
            >
                {children}
            </button>
        );
    }

    return (
        <Link
            href={href || '#'}
            className={`${classes} ${className}`}
            onClick={onClick}
            {...(props as InertiaLinkProps)}
        >
            {children}
        </Link>
    );
}
