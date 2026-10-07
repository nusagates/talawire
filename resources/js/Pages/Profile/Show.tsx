import React from 'react';
import { usePage } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import SectionBorder from '@/Components/SectionBorder';
import UpdateProfileInformationForm from '@/Pages/Profile/Partials/UpdateProfileInformationForm';
import UpdatePasswordForm from '@/Pages/Profile/Partials/UpdatePasswordForm';
import TwoFactorAuthenticationForm from '@/Pages/Profile/Partials/TwoFactorAuthenticationForm';
import LogoutOtherBrowserSessionsForm from '@/Pages/Profile/Partials/LogoutOtherBrowserSessionsForm';
import DeleteUserForm from '@/Pages/Profile/Partials/DeleteUserForm';
import { PageProps } from '@/types';

interface ShowProps {
    confirmsTwoFactorAuthentication?: boolean;
    sessions?: any[];
}

export default function Show({
    confirmsTwoFactorAuthentication = false,
    sessions = [],
}: ShowProps) {
    const { auth, jetstream } = usePage<PageProps>().props;

    return (
        <AppLayout
            title="Profile"
            renderHeader={() => (
                <h2 className="font-semibold text-xl text-gray-900 leading-tight">
                    Profile
                </h2>
            )}
        >
            <div>
                <div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8 space-y-10">
                    {jetstream?.canUpdateProfileInformation && (
                        <div>
                            <UpdateProfileInformationForm user={auth.user} />
                            <SectionBorder />
                        </div>
                    )}

                    {jetstream?.canUpdatePassword && (
                        <div>
                            <UpdatePasswordForm />
                            <SectionBorder />
                        </div>
                    )}

                    {jetstream?.canManageTwoFactorAuthentication && (
                        <div>
                            <TwoFactorAuthenticationForm
                                requiresConfirmation={confirmsTwoFactorAuthentication}
                            />
                            <SectionBorder />
                        </div>
                    )}

                    <div>
                        <LogoutOtherBrowserSessionsForm sessions={sessions} />
                    </div>

                    {jetstream?.hasAccountDeletionFeatures && (
                        <div>
                            <SectionBorder />
                            <DeleteUserForm />
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
