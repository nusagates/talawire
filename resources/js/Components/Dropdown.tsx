import React, { useState, useEffect, useRef, PropsWithChildren, ReactNode } from 'react';

interface DropdownProps {
    align?: 'left' | 'right' | 'top';
    width?: '48' | '64' | string;
    contentClasses?: string;
    renderTrigger: (props: { open: boolean; setOpen: React.Dispatch<React.SetStateAction<boolean>> }) => ReactNode;
}

export default function Dropdown({
    align = 'right',
    width = '48',
    contentClasses = 'py-1 bg-white',
    renderTrigger,
    children,
}: PropsWithChildren<DropdownProps>) {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (open && e.key === 'Escape') {
                setOpen(false);
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener('keydown', handleKeyDown);
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    const alignmentClasses = {
        left: 'origin-top-left start-0',
        right: 'origin-top-right end-0',
        top: 'origin-top',
    }[align];

    const widthClasses = width === '48' ? 'w-48' : width === '64' ? 'w-64' : width;

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <div onClick={() => setOpen((prev) => !prev)}>
                {renderTrigger({ open, setOpen })}
            </div>

            {open && (
                <div
                    className={`absolute z-50 mt-2 rounded-xl shadow-lg border border-gray-100 ${widthClasses} ${alignmentClasses}`}
                    onClick={() => setOpen(false)}
                >
                    <div className={`rounded-xl overflow-hidden ${contentClasses}`}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}
