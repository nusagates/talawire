import React, { useState, useRef, PropsWithChildren, ReactNode } from 'react';
import axios from 'axios';
import DialogModal from './DialogModal';
import InputError from './InputError';
import PrimaryButton from './PrimaryButton';
import SecondaryButton from './SecondaryButton';
import TextInput from './TextInput';

interface ConfirmsPasswordProps {
    title?: ReactNode;
    content?: ReactNode;
    button?: string;
    onConfirmed: () => void;
}

export default function ConfirmsPassword({
    title = 'Confirm Password',
    content = 'For your security, please confirm your password to continue.',
    button = 'Confirm',
    onConfirmed,
    children,
}: PropsWithChildren<ConfirmsPasswordProps>) {
    const [confirmingPassword, setConfirmingPassword] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [processing, setProcessing] = useState(false);
    const passwordInput = useRef<HTMLInputElement>(null);

    const startConfirmingPassword = () => {
        axios.get(route('password.confirmation')).then(response => {
            if (response.data.confirmed) {
                onConfirmed();
            } else {
                setConfirmingPassword(true);
                setTimeout(() => passwordInput.current?.focus(), 250);
            }
        });
    };

    const confirmPassword = () => {
        setProcessing(true);
        axios.post(route('password.confirm'), { password })
            .then(() => {
                setProcessing(false);
                closeModal();
                onConfirmed();
            })
            .catch(err => {
                setProcessing(false);
                setError(err.response?.data?.errors?.password?.[0] || 'Password confirmation failed.');
                passwordInput.current?.focus();
            });
    };

    const closeModal = () => {
        setConfirmingPassword(false);
        setPassword('');
        setError('');
    };

    return (
        <>
            <span onClick={startConfirmingPassword} className="cursor-pointer">
                {children}
            </span>

            <DialogModal
                show={confirmingPassword}
                onClose={closeModal}
                title={title}
                content={
                    <div>
                        <p>{content}</p>
                        <div className="mt-4">
                            <TextInput
                                ref={passwordInput}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                type="password"
                                className="mt-1 block w-3/4"
                                placeholder="Password"
                                autoComplete="current-password"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') confirmPassword();
                                }}
                            />
                            <InputError message={error} className="mt-2" />
                        </div>
                    </div>
                }
                footer={
                    <>
                        <SecondaryButton onClick={closeModal}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton
                            disabled={processing}
                            onClick={confirmPassword}
                        >
                            {button}
                        </PrimaryButton>
                    </>
                }
            />
        </>
    );
}
