import React, { PropsWithChildren, ReactNode } from 'react';

interface AuthenticationCardProps {
    logo?: ReactNode;
}

export default function AuthenticationCard({
    logo,
    children,
}: PropsWithChildren<AuthenticationCardProps>) {
    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-gray-50">
            <div>
                {logo}
            </div>

            <div className="w-full sm:max-w-md mt-6 px-6 py-6 bg-white shadow-sm border border-gray-200 overflow-hidden sm:rounded-xl">
                {children}
            </div>
        </div>
    );
}
