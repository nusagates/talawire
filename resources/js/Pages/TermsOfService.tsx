import React from 'react';
import { Head } from '@inertiajs/react';
import AuthenticationCardLogo from '@/Components/AuthenticationCardLogo';

interface TermsOfServiceProps {
    terms: string;
}

export default function TermsOfService({ terms }: TermsOfServiceProps) {
    return (
        <div className="font-sans text-gray-900 antialiased min-h-screen bg-gray-50 flex flex-col items-center pt-6 sm:pt-12">
            <Head title="Terms of Service" />

            <div>
                <AuthenticationCardLogo />
            </div>

            <div
                className="w-full sm:max-w-2xl mt-6 p-8 bg-white shadow-sm border border-gray-200 overflow-hidden sm:rounded-xl prose prose-blue text-sm"
                dangerouslySetInnerHTML={{ __html: terms }}
            />
        </div>
    );
}
