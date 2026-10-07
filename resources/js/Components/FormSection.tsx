import React, { PropsWithChildren, ReactNode, FormEventHandler } from 'react';
import SectionTitle from './SectionTitle';

interface FormSectionProps {
    title: ReactNode;
    description: ReactNode;
    actions?: ReactNode;
    onSubmit: FormEventHandler;
}

export default function FormSection({
    title,
    description,
    actions,
    onSubmit,
    children,
}: PropsWithChildren<FormSectionProps>) {
    return (
        <div className="md:grid md:grid-cols-3 md:gap-6">
            <SectionTitle title={title} description={description} />

            <div className="mt-5 md:mt-0 md:col-span-2">
                <form onSubmit={onSubmit}>
                    <div
                        className={`px-4 py-5 bg-white sm:p-6 shadow-sm border border-gray-200 ${
                            actions ? 'sm:rounded-tl-xl sm:rounded-tr-xl' : 'sm:rounded-xl'
                        }`}
                    >
                        <div className="grid grid-cols-6 gap-6">
                            {children}
                        </div>
                    </div>

                    {actions && (
                        <div className="flex items-center justify-end px-4 py-3 bg-gray-50 text-end sm:px-6 shadow-sm border-x border-b border-gray-200 sm:rounded-bl-xl sm:rounded-br-xl space-x-3">
                            {actions}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
}
