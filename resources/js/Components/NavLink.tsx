import React, { PropsWithChildren } from 'react';
import { Link, InertiaLinkProps } from '@inertiajs/react';

interface NavLinkProps extends InertiaLinkProps {
    active?: boolean;
}

export default function NavLink({
    active = false,
    className = '',
    children,
    ...props
}: PropsWithChildren<NavLinkProps>) {
    const classes = active
        ? 'inline-flex items-center px-1 pt-1 border-b-2 border-blue-600 text-sm font-medium leading-5 text-gray-900 focus:outline-none focus:border-blue-700 transition duration-150 ease-in-out'
        : 'inline-flex items-center px-1 pt-1 border-b-2 border-transparent text-sm font-medium leading-5 text-gray-500 hover:text-gray-700 hover:border-gray-300 focus:outline-none focus:text-gray-700 focus:border-gray-300 transition duration-150 ease-in-out';

    return (
        <Link {...props} className={`${classes} ${className}`}>
            {children}
        </Link>
    );
}
