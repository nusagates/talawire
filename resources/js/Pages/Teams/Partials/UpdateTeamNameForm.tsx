import React, { FormEventHandler } from 'react';
import { useForm } from '@inertiajs/react';
import ActionMessage from '@/Components/ActionMessage';
import FormSection from '@/Components/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Team } from '@/types';

interface UpdateTeamNameFormProps {
    team: Team;
    permissions: {
        canUpdateTeam?: boolean;
    };
    className?: string;
}

export default function UpdateTeamNameForm({
    team,
    permissions,
}: UpdateTeamNameFormProps) {
    const form = useForm({
        name: team.name,
    });

    const updateTeamName: FormEventHandler = (e) => {
        e.preventDefault();
        form.put(route('teams.update', team.id), {
            errorBag: 'updateTeamName',
            preserveScroll: true,
        });
    };

    return (
        <FormSection
            onSubmit={updateTeamName}
            title="Team Name"
            description="The team's name and owner information."
            actions={
                permissions.canUpdateTeam ? (
                    <>
                        <ActionMessage on={form.recentlySuccessful} className="me-3">
                            Saved.
                        </ActionMessage>

                        <PrimaryButton disabled={form.processing}>
                            Save
                        </PrimaryButton>
                    </>
                ) : undefined
            }
        >
            {/* Team Owner Information */}
            <div className="col-span-6">
                <InputLabel value="Team Owner" />

                <div className="flex items-center mt-2">
                    {team.owner?.profile_photo_url ? (
                        <img
                            className="w-12 h-12 rounded-full object-cover border border-gray-200"
                            src={team.owner.profile_photo_url}
                            alt={team.owner.name}
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg">
                            {team.owner?.name?.charAt(0).toUpperCase() || 'O'}
                        </div>
                    )}

                    <div className="ms-4 leading-tight">
                        <div className="font-medium text-gray-900">{team.owner?.name}</div>
                        <div className="text-gray-500 text-sm">{team.owner?.email}</div>
                    </div>
                </div>
            </div>

            {/* Team Name */}
            <div className="col-span-6 sm:col-span-4">
                <InputLabel htmlFor="name" value="Team Name" />

                <TextInput
                    id="name"
                    type="text"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    className="mt-1 block w-full"
                    disabled={!permissions.canUpdateTeam}
                />

                <InputError message={form.errors.name} className="mt-2" />
            </div>
        </FormSection>
    );
}
