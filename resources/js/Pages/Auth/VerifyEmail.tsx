import React, { FormEventHandler } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import AuthenticationCard from '@/Components/AuthenticationCard';
import AuthenticationCardLogo from '@/Components/AuthenticationCardLogo';
import PrimaryButton from '@/Components/PrimaryButton';

interface VerifyEmailProps {
    status?: string;
}

export default function VerifyEmail({ status }: VerifyEmailProps) {
    const { post, processing } = useForm({});

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('verification.send'));
    };

    const verificationLinkSent = status === 'verification-link-sent';

    return (
        <AuthenticationCard logo={<AuthenticationCardLogo />}>
            <Head title="Email Verification" />

            <div className="mb-4 text-sm text-gray-600">
                Before continuing, could you verify your email address by clicking on the link we just emailed to you? If you didn't receive the email, we will gladly send you another.
            </div>

            {verificationLinkSent && (
                <div className="mb-4 font-medium text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                    A new verification link has been sent to the email address you provided in your profile settings.
                </div>
            )}

            <form onSubmit={submit}>
                <div className="mt-4 flex items-center justify-between">
                    <PrimaryButton disabled={processing}>
                        Resend Verification Email
                    </PrimaryButton>

                    <div className="flex items-center space-x-3 text-xs">
                        <Link
                            href={route('profile.show')}
                            className="underline text-gray-600 hover:text-gray-900"
                        >
                            Edit Profile
                        </Link>

                        <Link
                            href={route('logout')}
                            method="post"
                            as="button"
                            className="underline text-gray-600 hover:text-gray-900 cursor-pointer"
                        >
                            Log Out
                        </Link>
                    </div>
                </div>
            </form>
        </AuthenticationCard>
    );
}
