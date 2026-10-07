import React, { FormEventHandler } from 'react';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import AuthenticationCard from '@/Components/AuthenticationCard';
import AuthenticationCardLogo from '@/Components/AuthenticationCardLogo';
import Checkbox from '@/Components/Checkbox';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { PageProps } from '@/types';

export default function Register() {
    const { jetstream } = usePage<PageProps>().props;

    const { data, setData, post, processing, errors, reset } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        terms: false,
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post(route('register'), {
            onFinish: () => reset('password', 'password_confirmation'),
        });
    };

    return (
        <AuthenticationCard logo={<AuthenticationCardLogo />}>
            <Head title="Register" />

            <form onSubmit={submit} className="space-y-4">
                <div>
                    <InputLabel htmlFor="name" value="Name" />
                    <TextInput
                        id="name"
                        type="text"
                        value={data.name}
                        onChange={(e) => setData('name', e.target.value)}
                        className="mt-1 block w-full"
                        required
                        autoFocus
                        autoComplete="name"
                    />
                    <InputError message={errors.name} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="email" value="Email" />
                    <TextInput
                        id="email"
                        type="email"
                        value={data.email}
                        onChange={(e) => setData('email', e.target.value)}
                        className="mt-1 block w-full"
                        required
                        autoComplete="username"
                    />
                    <InputError message={errors.email} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="password" value="Password" />
                    <TextInput
                        id="password"
                        type="password"
                        value={data.password}
                        onChange={(e) => setData('password', e.target.value)}
                        className="mt-1 block w-full"
                        required
                        autoComplete="new-password"
                    />
                    <InputError message={errors.password} className="mt-2" />
                </div>

                <div>
                    <InputLabel htmlFor="password_confirmation" value="Confirm Password" />
                    <TextInput
                        id="password_confirmation"
                        type="password"
                        value={data.password_confirmation}
                        onChange={(e) => setData('password_confirmation', e.target.value)}
                        className="mt-1 block w-full"
                        required
                        autoComplete="new-password"
                    />
                    <InputError message={errors.password_confirmation} className="mt-2" />
                </div>

                {jetstream?.hasTermsAndPrivacyPolicyFeature && (
                    <div className="mt-4">
                        <label className="flex items-center cursor-pointer">
                            <Checkbox
                                name="terms"
                                checked={data.terms}
                                onChange={(e) => setData('terms', e.target.checked)}
                                required
                            />
                            <div className="ms-2 text-xs text-gray-600">
                                I agree to the{' '}
                                <Link
                                    target="_blank"
                                    href={route('terms.show')}
                                    className="underline text-blue-600 hover:text-blue-800"
                                >
                                    Terms of Service
                                </Link>{' '}
                                and{' '}
                                <Link
                                    target="_blank"
                                    href={route('policy.show')}
                                    className="underline text-blue-600 hover:text-blue-800"
                                >
                                    Privacy Policy
                                </Link>
                            </div>
                        </label>
                        <InputError message={errors.terms} className="mt-2" />
                    </div>
                )}

                <div className="pt-2">
                    <PrimaryButton className="w-full py-2.5" disabled={processing}>
                        Register
                    </PrimaryButton>
                </div>

                <div className="text-center text-xs text-gray-500 mt-4">
                    Already registered?{' '}
                    <Link href={route('login')} className="text-blue-600 hover:underline font-medium">
                        Log in
                    </Link>
                </div>
            </form>
        </AuthenticationCard>
    );
}
