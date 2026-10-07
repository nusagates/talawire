import React, { useState } from 'react';
import { useForm } from '@inertiajs/react';
import ActionSection from '@/Components/ActionSection';
import ConfirmationModal from '@/Components/ConfirmationModal';
import DangerButton from '@/Components/DangerButton';
import SecondaryButton from '@/Components/SecondaryButton';
import { Team } from '@/types';

interface DeleteTeamFormProps {
    team: Team;
    className?: string;
}

export default function DeleteTeamForm({ team }: DeleteTeamFormProps) {
    const [confirmingTeamDeletion, setConfirmingTeamDeletion] = useState(false);
    const form = useForm({});

    const deleteTeam = () => {
        form.delete(route('teams.destroy', team.id), {
            errorBag: 'deleteTeam',
        });
    };

    return (
        <ActionSection
            title="Delete Team"
            description="Permanently delete this team."
        >
            <div className="max-w-xl text-sm text-gray-600">
                Once a team is deleted, all of its resources and data will be permanently deleted. Before deleting this team, please download any data or information regarding this team that you wish to retain.
            </div>

            <div className="mt-5">
                <DangerButton onClick={() => setConfirmingTeamDeletion(true)}>
                    Delete Team
                </DangerButton>
            </div>

            <ConfirmationModal
                show={confirmingTeamDeletion}
                onClose={() => setConfirmingTeamDeletion(false)}
                title="Delete Team"
                content="Are you sure you want to delete this team? Once a team is deleted, all of its resources and data will be permanently deleted."
                footer={
                    <>
                        <SecondaryButton onClick={() => setConfirmingTeamDeletion(false)}>
                            Cancel
                        </SecondaryButton>

                        <DangerButton
                            disabled={form.processing}
                            onClick={deleteTeam}
                        >
                            Delete Team
                        </DangerButton>
                    </>
                }
            />
        </ActionSection>
    );
}
