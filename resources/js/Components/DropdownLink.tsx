import React, { PropsWithChildren, ButtonHTMLAttributes } from 'react';
import { Link, InertiaLinkProps } from '@inertiajs/react';

type DropdownLinkProps = PropsWithChildren<{
    as?: 'button' | 'a';
    href?: string;
    onClick?: () => void;
    className?: string;
} & Partial<InertiaLinkProps> & ButtonHTMLAttributes<HTMLButtonElement>>;

export default function DropdownLink({
    as = 'a',
    href,
    className = '',
    children,
    onClick,
    ...props
}: DropdownLinkProps) {
    const baseClasses = `block w-full px-4 py-2 text-start text-sm leading-5 text-gray-700 hover:bg-gray-50 focus:outline-none focus:bg-gray-50 transition duration-150 ease-in-out cursor-pointer ${className}`;

    if (as === 'button') {
        return (
            <button
                type="button"
                className={baseClasses}
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
            className={baseClasses}
            onClick={onClick}
            {...(props as InertiaLinkProps)}
        >
            {children}
        </Link>
    );
}
