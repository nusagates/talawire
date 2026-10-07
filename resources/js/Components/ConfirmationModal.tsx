import React, { ReactNode } from 'react';
import Modal from './Modal';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
    show?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    closeable?: boolean;
    onClose?: () => void;
    title: ReactNode;
    content: ReactNode;
    footer: ReactNode;
}

export default function ConfirmationModal({
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
    title,
    content,
    footer,
}: ConfirmationModalProps) {
    return (
        <Modal show={show} maxWidth={maxWidth} closeable={closeable} onClose={onClose}>
            <div className="bg-white px-6 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                    <div className="mx-auto shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10 text-red-600">
                        <AlertTriangle className="w-5 h-5" />
                    </div>

                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg font-medium text-gray-900 leading-6">
                            {title}
                        </h3>

                        <div className="mt-2 text-sm text-gray-600">
                            {content}
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                {footer}
            </div>
        </Modal>
    );
}
