import React, { FormEventHandler } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import FormSection from '@/Components/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { PageProps } from '@/types';

export default function CreateTeamForm() {
    const { auth } = usePage<PageProps>().props;

    const form = useForm({
        name: '',
    });

    const createTeam: FormEventHandler = (e) => {
        e.preventDefault();
        form.post(route('teams.store'), {
            errorBag: 'createTeam',
            preserveScroll: true,
        });
    };

    return (
        <FormSection
            onSubmit={createTeam}
            title="Team Details"
            description="Create a new team to collaborate with others on projects."
            actions={
                <PrimaryButton disabled={form.processing}>
                    Create
                </PrimaryButton>
            }
        >
            <div className="col-span-6">
                <InputLabel value="Team Owner" />

                <div className="flex items-center mt-2">
                    {auth.user.profile_photo_url ? (
                        <img
                            className="object-cover w-12 h-12 rounded-full border border-gray-200"
                            src={auth.user.profile_photo_url}
                            alt={auth.user.name}
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-lg">
                            {auth.user.name.charAt(0).toUpperCase()}
                        </div>
                    )}

                    <div className="ms-4 leading-tight">
                        <div className="font-medium text-gray-900">{auth.user.name}</div>
                        <div className="text-sm text-gray-500">{auth.user.email}</div>
                    </div>
                </div>
            </div>

            <div className="col-span-6 sm:col-span-4">
                <InputLabel htmlFor="name" value="Team Name" />
                <TextInput
                    id="name"
                    type="text"
                    value={form.data.name}
                    onChange={(e) => form.setData('name', e.target.value)}
                    className="block w-full mt-1"
                    autoFocus
                />
                <InputError message={form.errors.name} className="mt-2" />
            </div>
        </FormSection>
    );
}
