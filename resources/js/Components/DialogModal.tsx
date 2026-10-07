import React, { PropsWithChildren, ReactNode } from 'react';
import Modal from './Modal';

interface DialogModalProps {
    show?: boolean;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
    closeable?: boolean;
    onClose?: () => void;
    title?: ReactNode;
    content?: ReactNode;
    footer?: ReactNode;
}

export default function DialogModal({
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
    title,
    content,
    footer,
    children,
}: PropsWithChildren<DialogModalProps>) {
    return (
        <Modal show={show} maxWidth={maxWidth} closeable={closeable} onClose={onClose}>
            <div className="px-6 py-4 border-b border-gray-100">
                <div className="text-lg font-medium text-gray-900">{title}</div>
            </div>

            <div className="px-6 py-4 text-sm text-gray-600">
                {content || children}
            </div>

            {footer && (
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end space-x-3">
                    {footer}
                </div>
            )}
        </Modal>
    );
}
