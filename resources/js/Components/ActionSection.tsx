import React, { PropsWithChildren, ReactNode } from 'react';
import SectionTitle from './SectionTitle';

interface ActionSectionProps {
    title: ReactNode;
    description: ReactNode;
}

export default function ActionSection({
    title,
    description,
    children,
}: PropsWithChildren<ActionSectionProps>) {
    return (
        <div className="md:grid md:grid-cols-3 md:gap-6">
            <SectionTitle title={title} description={description} />

            <div className="mt-5 md:mt-0 md:col-span-2">
                <div className="px-4 py-5 sm:p-6 bg-white shadow-sm border border-gray-200 sm:rounded-xl">
                    {children}
                </div>
            </div>
        </div>
    );
}
