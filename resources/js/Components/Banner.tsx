import React, { useState, useEffect } from 'react';
import { usePage } from '@inertiajs/react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { PageProps } from '@/types';

export default function Banner() {
    const { jetstream } = usePage<PageProps>().props;
    const [show, setShow] = useState(true);

    const bannerStyle = jetstream?.flash?.bannerStyle || 'success';
    const message = jetstream?.flash?.banner || '';

    useEffect(() => {
        if (message) {
            setShow(true);
        }
    }, [message]);

    if (!show || !message) {
        return null;
    }

    const isSuccess = bannerStyle === 'success';

    return (
        <div className={isSuccess ? 'bg-blue-600 text-white' : 'bg-red-600 text-white'}>
            <div className="max-w-7xl mx-auto py-2.5 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between flex-wrap">
                    <div className="w-0 flex-1 flex items-center min-w-0">
                        <span className="flex p-1 rounded-lg bg-black/10">
                            {isSuccess ? (
                                <CheckCircle2 className="w-5 h-5 text-white" />
                            ) : (
                                <AlertTriangle className="w-5 h-5 text-white" />
                            )}
                        </span>
                        <p className="ms-3 font-medium text-sm text-white truncate">
                            {message}
                        </p>
                    </div>

                    <div className="shrink-0 sm:ms-3">
                        <button
                            type="button"
                            className="-me-1 flex p-1.5 rounded-lg hover:bg-black/15 focus:outline-none transition"
                            aria-label="Dismiss"
                            onClick={() => setShow(false)}
                        >
                            <X className="w-5 h-5 text-white" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
