import React from 'react';
import AppLayout from '@/Layouts/AppLayout';
import ApiTokenManager from '@/Pages/API/Partials/ApiTokenManager';

interface IndexProps {
    tokens: any[];
    availablePermissions: string[];
    defaultPermissions: string[];
}

export default function Index({
    tokens,
    availablePermissions,
    defaultPermissions,
}: IndexProps) {
    return (
        <AppLayout
            title="API Tokens"
            renderHeader={() => (
                <h2 className="font-semibold text-xl text-gray-900 leading-tight">
                    API Tokens
                </h2>
            )}
        >
            <div>
                <div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8">
                    <ApiTokenManager
                        tokens={tokens}
                        availablePermissions={availablePermissions}
                        defaultPermissions={defaultPermissions}
                    />
                </div>
            </div>
        </AppLayout>
    );
}
