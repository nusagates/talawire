import React, { useState, useRef } from 'react';
import { useForm } from '@inertiajs/react';
import ActionMessage from '@/Components/ActionMessage';
import ActionSection from '@/Components/ActionSection';
import DialogModal from '@/Components/DialogModal';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { Monitor, Smartphone } from 'lucide-react';

interface Session {
    agent: {
        is_desktop: boolean;
        platform: string;
        browser: string;
    };
    ip_address: string;
    is_current_device: boolean;
    last_active: string;
}

interface LogoutOtherBrowserSessionsFormProps {
    sessions?: Session[];
    className?: string;
}

export default function LogoutOtherBrowserSessionsForm({
    sessions = [],
}: LogoutOtherBrowserSessionsFormProps) {
    const [confirmingLogout, setConfirmingLogout] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const form = useForm({
        password: '',
    });

    const confirmLogout = () => {
        setConfirmingLogout(true);
        setTimeout(() => passwordInput.current?.focus(), 250);
    };

    const logoutOtherBrowserSessions = () => {
        form.delete(route('other-browser-sessions.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => form.reset(),
        });
    };

    const closeModal = () => {
        setConfirmingLogout(false);
        form.reset();
    };

    return (
        <ActionSection
            title="Browser Sessions"
            description="Manage and log out your active sessions on other browsers and devices."
        >
            <div className="max-w-xl text-sm text-gray-600">
                If necessary, you may log out of all of your other browser sessions across all of your devices. Some of your recent sessions are listed below; however, this list may not be exhaustive. If you feel your account has been compromised, you should also update your password.
            </div>

            {sessions.length > 0 && (
                <div className="mt-5 space-y-4">
                    {sessions.map((session, i) => (
                        <div key={i} className="flex items-center">
                            <div className="p-2 rounded-lg bg-gray-100 text-gray-600">
                                {session.agent.is_desktop ? (
                                    <Monitor className="w-5 h-5" />
                                ) : (
                                    <Smartphone className="w-5 h-5" />
                                )}
                            </div>

                            <div className="ms-3">
                                <div className="text-sm font-medium text-gray-800">
                                    {(session.agent.platform || 'Unknown')} - {(session.agent.browser || 'Unknown')}
                                </div>

                                <div className="text-xs text-gray-500">
                                    {session.ip_address},{' '}
                                    {session.is_current_device ? (
                                        <span className="text-green-600 font-semibold">This device</span>
                                    ) : (
                                        <span>Last active {session.last_active}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="flex items-center mt-5">
                <PrimaryButton onClick={confirmLogout}>
                    Log Out Other Browser Sessions
                </PrimaryButton>

                <ActionMessage on={form.recentlySuccessful} className="ms-3">
                    Done.
                </ActionMessage>
            </div>

            <DialogModal
                show={confirmingLogout}
                onClose={closeModal}
                title="Log Out Other Browser Sessions"
                content={
                    <div>
                        <p>Please enter your password to confirm you would like to log out of your other browser sessions across all of your devices.</p>
                        <div className="mt-4">
                            <TextInput
                                ref={passwordInput}
                                type="password"
                                value={form.data.password}
                                onChange={(e) => form.setData('password', e.target.value)}
                                className="mt-1 block w-3/4"
                                placeholder="Password"
                                autoComplete="current-password"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') logoutOtherBrowserSessions();
                                }}
                            />
                            <InputError message={form.errors.password} className="mt-2" />
                        </div>
                    </div>
                }
                footer={
                    <>
                        <SecondaryButton onClick={closeModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton
                            disabled={form.processing}
                            onClick={logoutOtherBrowserSessions}
                        >
                            Log Out Other Browser Sessions
                        </PrimaryButton>
                    </>
                }
            />
        </ActionSection>
    );
}
