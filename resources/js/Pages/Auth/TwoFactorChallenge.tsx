import React, { useState, useRef, FormEventHandler } from 'react';
import { Head, useForm } from '@inertiajs/react';
import AuthenticationCard from '@/Components/AuthenticationCard';
import AuthenticationCardLogo from '@/Components/AuthenticationCardLogo';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';

export default function TwoFactorChallenge() {
    const [recovery, setRecovery] = useState(false);
    const codeInput = useRef<HTMLInputElement>(null);
    const recoveryCodeInput = useRef<HTMLInputElement>(null);

    const { data, setData, post, processing, errors } = useForm({
        code: '',
        recovery_code: '',
    });

    const toggleRecovery = () => {
        setRecovery((prev) => {
            const next = !prev;
            setTimeout(() => {
                if (next) {
                    recoveryCodeInput.current?.focus();
                    setData('code', '');
                } else {
                    codeInput.current?.focus();
                    setData('recovery_code', '');
                }
            }, 50);
            return next;
        });
    };

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('two-factor.login'));
    };

    return (
        <AuthenticationCard logo={<AuthenticationCardLogo />}>
            <Head title="Two-factor Confirmation" />

            <div className="mb-4 text-sm text-gray-600">
                {!recovery
                    ? 'Please confirm access to your account by entering the authentication code provided by your authenticator application.'
                    : 'Please confirm access to your account by entering one of your emergency recovery codes.'}
            </div>

            <form onSubmit={submit} className="space-y-4">
                {!recovery ? (
                    <div>
                        <InputLabel htmlFor="code" value="Code" />
                        <TextInput
                            id="code"
                            ref={codeInput}
                            type="text"
                            inputMode="numeric"
                            value={data.code}
                            onChange={(e) => setData('code', e.target.value)}
                            className="mt-1 block w-full"
                            autoFocus
                            autoComplete="one-time-code"
                        />
                        <InputError message={errors.code} className="mt-2" />
                    </div>
                ) : (
                    <div>
                        <InputLabel htmlFor="recovery_code" value="Recovery Code" />
                        <TextInput
                            id="recovery_code"
                            ref={recoveryCodeInput}
                            type="text"
                            value={data.recovery_code}
                            onChange={(e) => setData('recovery_code', e.target.value)}
                            className="mt-1 block w-full"
                            autoComplete="one-time-code"
                        />
                        <InputError message={errors.recovery_code} className="mt-2" />
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <button
                        type="button"
                        onClick={toggleRecovery}
                        className="text-xs text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                        {!recovery ? 'Use a recovery code' : 'Use an authentication code'}
                    </button>

                    <PrimaryButton disabled={processing}>
                        Log in
                    </PrimaryButton>
                </div>
            </form>
        </AuthenticationCard>
    );
}
