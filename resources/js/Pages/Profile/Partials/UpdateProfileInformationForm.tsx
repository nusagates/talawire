import React, { useState, useRef, FormEventHandler } from 'react';
import { Link, router, useForm, usePage } from '@inertiajs/react';
import ActionMessage from '@/Components/ActionMessage';
import FormSection from '@/Components/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { PageProps, User } from '@/types';

interface UpdateProfileInformationFormProps {
    user: User;
}

export default function UpdateProfileInformationForm({ user }: UpdateProfileInformationFormProps) {
    const { jetstream } = usePage<PageProps>().props;

    const form = useForm({
        _method: 'PUT',
        name: user.name,
        email: user.email,
        photo: null as File | null,
    });

    const [verificationLinkSent, setVerificationLinkSent] = useState(false);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const photoInput = useRef<HTMLInputElement>(null);

    const updateProfileInformation: FormEventHandler = (e) => {
        e.preventDefault();

        if (photoInput.current?.files?.[0]) {
            form.setData('photo', photoInput.current.files[0]);
        }

        form.post(route('user-profile-information.update'), {
            errorBag: 'updateProfileInformation',
            preserveScroll: true,
            onSuccess: () => clearPhotoFileInput(),
        });
    };

    const updatePhotoPreview = () => {
        const photo = photoInput.current?.files?.[0];
        if (!photo) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            setPhotoPreview(e.target?.result as string);
        };
        reader.readAsDataURL(photo);
    };

    const deletePhoto = () => {
        router.delete(route('current-user-photo.destroy'), {
            preserveScroll: true,
            onSuccess: () => {
                setPhotoPreview(null);
                clearPhotoFileInput();
            },
        });
    };

    const clearPhotoFileInput = () => {
        if (photoInput.current) {
            photoInput.current.value = '';
        }
    };

    return (
        <FormSection
            onSubmit={updateProfileInformation}
            title="Profile Information"
            description="Update your account's profile information and email address."
            actions={
                <>
                    <ActionMessage on={form.recentlySuccessful} className="me-3">
                        Saved.
                    </ActionMessage>

                    <PrimaryButton disabled={form.processing}>
                        Save
                    </PrimaryButton>
                </>
            }
        >
            {/* Profile Photo */}
            {jetstream?.managesProfilePhotos && (
                <div className="col-span-6 sm:col-span-4">
                    <input
                        id="photo"
                        ref={photoInput}
                        type="file"
                        className="hidden"
                        onChange={updatePhotoPreview}
                    />

                    <InputLabel htmlFor="photo" value="Photo" />

                    <div className="mt-2">
                        {photoPreview ? (
                            <span
                                className="block rounded-full w-20 h-20 bg-cover bg-no-repeat bg-center border border-gray-200"
                                style={{ backgroundImage: `url('${photoPreview}')` }}
                            />
                        ) : user.profile_photo_url ? (
                            <img
                                src={user.profile_photo_url}
                                alt={user.name}
                                className="rounded-full w-20 h-20 object-cover border border-gray-200"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-2xl">
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                        <SecondaryButton type="button" onClick={() => photoInput.current?.click()}>
                            Select A New Photo
                        </SecondaryButton>

                        {user.profile_photo_path && (
                            <SecondaryButton type="button" onClick={deletePhoto}>
                                Remove Photo
                            </SecondaryButton>
                        )}
                    </div>

                    <InputError message={form.errors.photo} className="mt-2" />
                </div>
            )}

            {/* Name */}
            <div className="col-span-6 sm:col-span-4">
                <InputLabel htmlFor="name" value="Name" />
                <TextInput
                    id="name"
                    type="text"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    className="mt-1 block w-full"
                    required
                    autoComplete="name"
                />
                <InputError message={form.errors.name} className="mt-2" />
            </div>

            {/* Email */}
            <div className="col-span-6 sm:col-span-4">
                <InputLabel htmlFor="email" value="Email" />
                <TextInput
                    id="email"
                    type="email"
                    value={form.data.email}
                    onChange={(e) => form.setData('email', e.target.value)}
                    className="mt-1 block w-full"
                    required
                    autoComplete="username"
                />
                <InputError message={form.errors.email} className="mt-2" />

                {jetstream?.hasEmailVerification && user.email_verified_at === null && (
                    <div className="mt-2 text-sm text-gray-600">
                        <p>
                            Your email address is unverified.{' '}
                            <Link
                                href={route('verification.send')}
                                method="post"
                                as="button"
                                className="underline text-blue-600 hover:text-blue-800"
                                onClick={() => setVerificationLinkSent(true)}
                            >
                                Click here to re-send the verification email.
                            </Link>
                        </p>

                        {verificationLinkSent && (
                            <div className="mt-2 font-medium text-sm text-green-600">
                                A new verification link has been sent to your email address.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </FormSection>
    );
}
