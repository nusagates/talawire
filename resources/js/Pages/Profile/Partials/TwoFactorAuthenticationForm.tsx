import React, { useState } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import axios from 'axios';
import ActionSection from '@/Components/ActionSection';
import ConfirmsPassword from '@/Components/ConfirmsPassword';
import DangerButton from '@/Components/DangerButton';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { PageProps } from '@/types';

interface TwoFactorAuthenticationFormProps {
    requiresConfirmation?: boolean;
    className?: string;
}

export default function TwoFactorAuthenticationForm({
    requiresConfirmation = false,
}: TwoFactorAuthenticationFormProps) {
    const { auth } = usePage<PageProps>().props;
    const [enabling, setEnabling] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [disabling, setDisabling] = useState(false);
    const [qrCode, setQrCode] = useState<string | null>(null);
    const [setupKey, setSetupKey] = useState<string | null>(null);
    const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

    const confirmationForm = useForm({
        code: '',
    });

    const twoFactorEnabled = !enabling && Boolean(auth.user?.two_factor_enabled);

    const showQrCode = () => {
        return axios.get(route('two-factor.qr-code')).then((response) => {
            setQrCode(response.data.svg);
        });
    };

    const showSetupKey = () => {
        return axios.get(route('two-factor.secret-key')).then((response) => {
            setSetupKey(response.data.secretKey);
        });
    };

    const showRecoveryCodes = () => {
        return axios.get(route('two-factor.recovery-codes')).then((response) => {
            setRecoveryCodes(response.data);
        });
    };

    const enableTwoFactorAuthentication = () => {
        setEnabling(true);

        router.post(
            route('two-factor.enable'),
            {},
            {
                preserveScroll: true,
                onSuccess: () =>
                    Promise.all([showQrCode(), showSetupKey(), showRecoveryCodes()]),
                onFinish: () => {
                    setEnabling(false);
                    setConfirming(requiresConfirmation);
                },
            }
        );
    };

    const confirmTwoFactorAuthentication = () => {
        confirmationForm.post(route('two-factor.confirm'), {
            errorBag: 'confirmTwoFactorAuthentication',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setConfirming(false);
                setQrCode(null);
                setSetupKey(null);
            },
        });
    };

    const regenerateRecoveryCodes = () => {
        axios.post(route('two-factor.recovery-codes')).then(() => showRecoveryCodes());
    };

    const disableTwoFactorAuthentication = () => {
        setDisabling(true);

        router.delete(route('two-factor.disable'), {
            preserveScroll: true,
            onSuccess: () => {
                setDisabling(false);
                setConfirming(false);
            },
        });
    };

    return (
        <ActionSection
            title="Two Factor Authentication"
            description="Add additional security to your account using two factor authentication."
        >
            <h3 className="text-base font-semibold text-gray-900">
                {twoFactorEnabled && !confirming
                    ? 'You have enabled two factor authentication.'
                    : twoFactorEnabled && confirming
                    ? 'Finish enabling two factor authentication.'
                    : 'You have not enabled two factor authentication.'}
            </h3>

            <div className="mt-2 max-w-xl text-sm text-gray-600">
                <p>
                    When two factor authentication is enabled, you will be prompted for a secure, random token during authentication. You may retrieve this token from your phone's Google Authenticator application.
                </p>
            </div>

            {twoFactorEnabled && (
                <div>
                    {qrCode && (
                        <div>
                            <div className="mt-4 max-w-xl text-sm text-gray-600">
                                <p className="font-semibold">
                                    {confirming
                                        ? "To finish enabling two factor authentication, scan the following QR code using your phone's authenticator application or enter the setup key and provide the generated OTP code."
                                        : "Two factor authentication is now enabled. Scan the following QR code using your phone's authenticator application or enter the setup key."}
                                </p>
                            </div>

                            <div
                                className="mt-4 p-3 inline-block bg-white border border-gray-200 rounded-xl"
                                dangerouslySetInnerHTML={{ __html: qrCode }}
                            />

                            {setupKey && (
                                <div className="mt-4 max-w-xl text-sm text-gray-600">
                                    <p className="font-semibold">
                                        Setup Key: <span className="font-mono text-gray-900">{setupKey}</span>
                                    </p>
                                </div>
                            )}

                            {confirming && (
                                <div className="mt-4">
                                    <InputLabel htmlFor="code" value="Code" />
                                    <TextInput
                                        id="code"
                                        type="text"
                                        inputMode="numeric"
                                        value={confirmationForm.data.code}
                                        onChange={(e) => confirmationForm.setData('code', e.target.value)}
                                        className="block mt-1 w-1/2"
                                        autoFocus
                                        autoComplete="one-time-code"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') confirmTwoFactorAuthentication();
                                        }}
                                    />
                                    <InputError message={confirmationForm.errors.code} className="mt-2" />
                                </div>
                            )}
                        </div>
                    )}

                    {recoveryCodes.length > 0 && !confirming && (
                        <div>
                            <div className="mt-4 max-w-xl text-sm text-gray-600">
                                <p className="font-semibold">
                                    Store these recovery codes in a secure password manager. They can be used to recover access to your account if your two factor authentication device is lost.
                                </p>
                            </div>

                            <div className="grid gap-1 max-w-xl mt-4 px-4 py-4 font-mono text-xs bg-gray-50 border border-gray-200 rounded-xl">
                                {recoveryCodes.map((code) => (
                                    <div key={code}>{code}</div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="mt-5 flex items-center gap-3">
                {!twoFactorEnabled ? (
                    <ConfirmsPassword onConfirmed={enableTwoFactorAuthentication}>
                        <PrimaryButton type="button" disabled={enabling}>
                            Enable
                        </PrimaryButton>
                    </ConfirmsPassword>
                ) : (
                    <>
                        {confirming && (
                            <ConfirmsPassword onConfirmed={confirmTwoFactorAuthentication}>
                                <PrimaryButton
                                    type="button"
                                    disabled={enabling || confirmationForm.processing}
                                >
                                    Confirm
                                </PrimaryButton>
                            </ConfirmsPassword>
                        )}

                        {recoveryCodes.length > 0 && !confirming && (
                            <ConfirmsPassword onConfirmed={regenerateRecoveryCodes}>
                                <SecondaryButton>
                                    Regenerate Recovery Codes
                                </SecondaryButton>
                            </ConfirmsPassword>
                        )}

                        {recoveryCodes.length === 0 && !confirming && (
                            <ConfirmsPassword onConfirmed={showRecoveryCodes}>
                                <SecondaryButton>
                                    Show Recovery Codes
                                </SecondaryButton>
                            </ConfirmsPassword>
                        )}

                        {confirming && (
                            <ConfirmsPassword onConfirmed={disableTwoFactorAuthentication}>
                                <SecondaryButton disabled={disabling}>
                                    Cancel
                                </SecondaryButton>
                            </ConfirmsPassword>
                        )}

                        {!confirming && (
                            <ConfirmsPassword onConfirmed={disableTwoFactorAuthentication}>
                                <DangerButton disabled={disabling}>
                                    Disable
                                </DangerButton>
                            </ConfirmsPassword>
                        )}
                    </>
                )}
            </div>
        </ActionSection>
    );
}
