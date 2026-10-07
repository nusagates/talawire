import React, { useState, useRef } from 'react';
import { useForm } from '@inertiajs/react';
import ActionSection from '@/Components/ActionSection';
import DangerButton from '@/Components/DangerButton';
import DialogModal from '@/Components/DialogModal';
import InputError from '@/Components/InputError';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

export default function DeleteUserForm({ className = '' }: { className?: string }) {
    const [confirmingUserDeletion, setConfirmingUserDeletion] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const form = useForm({
        password: '',
    });

    const confirmUserDeletion = () => {
        setConfirmingUserDeletion(true);
        setTimeout(() => passwordInput.current?.focus(), 250);
    };

    const deleteUser = () => {
        form.delete(route('current-user.destroy'), {
            preserveScroll: true,
            onSuccess: () => closeModal(),
            onError: () => passwordInput.current?.focus(),
            onFinish: () => form.reset(),
        });
    };

    const closeModal = () => {
        setConfirmingUserDeletion(false);
        form.reset();
    };

    return (
        <ActionSection
            title="Delete Account"
            description="Permanently delete your account."
        >
            <div className="max-w-xl text-sm text-gray-600">
                Once your account is deleted, all of its resources and data will be permanently deleted. Before deleting your account, please download any data or information that you wish to retain.
            </div>

            <div className="mt-5">
                <DangerButton onClick={confirmUserDeletion}>
                    Delete Account
                </DangerButton>
            </div>

            <DialogModal
                show={confirmingUserDeletion}
                onClose={closeModal}
                title="Delete Account"
                content={
                    <div>
                        <p>Are you sure you want to delete your account? Once your account is deleted, all of its resources and data will be permanently deleted. Please enter your password to confirm you would like to permanently delete your account.</p>
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
                                    if (e.key === 'Enter') deleteUser();
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
                        <DangerButton
                            disabled={form.processing}
                            onClick={deleteUser}
                        >
                            Delete Account
                        </DangerButton>
                    </>
                }
            />
        </ActionSection>
    );
}
