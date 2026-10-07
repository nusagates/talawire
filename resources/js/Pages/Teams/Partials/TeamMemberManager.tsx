import React, { useState, FormEventHandler } from 'react';
import { router, useForm, usePage } from '@inertiajs/react';
import ActionMessage from '@/Components/ActionMessage';
import ActionSection from '@/Components/ActionSection';
import ConfirmationModal from '@/Components/ConfirmationModal';
import DangerButton from '@/Components/DangerButton';
import DialogModal from '@/Components/DialogModal';
import FormSection from '@/Components/FormSection';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import SectionBorder from '@/Components/SectionBorder';
import TextInput from '@/Components/TextInput';
import { PageProps, Team, User } from '@/types';
import { Check } from 'lucide-react';

interface Role {
    key: string;
    name: string;
    description: string;
}

interface TeamMemberManagerProps {
    team: Team;
    availableRoles: Role[];
    userPermissions: {
        canAddTeamMembers?: boolean;
        canDeleteTeam?: boolean;
        canRemoveTeamMembers?: boolean;
        canUpdateTeam?: boolean;
        canUpdateTeamMembers?: boolean;
    };
    className?: string;
}

export default function TeamMemberManager({
    team,
    availableRoles,
    userPermissions,
    className = '',
}: TeamMemberManagerProps) {
    const { auth } = usePage<PageProps>().props;

    const addTeamMemberForm = useForm({
        email: '',
        role: availableRoles[0]?.key || '',
    });

    const updateRoleForm = useForm({
        role: '',
    });

    const leaveTeamForm = useForm({});
    const removeTeamMemberForm = useForm({});

    const [currentlyManagingRole, setCurrentlyManagingRole] = useState(false);
    const [managingRoleFor, setManagingRoleFor] = useState<any>(null);
    const [confirmingLeavingTeam, setConfirmingLeavingTeam] = useState(false);
    const [teamMemberBeingRemoved, setTeamMemberBeingRemoved] = useState<any>(null);

    const addTeamMember: FormEventHandler = (e) => {
        e.preventDefault();
        addTeamMemberForm.post(route('team-members.store', team.id), {
            errorBag: 'addTeamMember',
            preserveScroll: true,
            onSuccess: () => addTeamMemberForm.reset(),
        });
    };

    const cancelTeamInvitation = (invitation: any) => {
        router.delete(route('team-invitations.destroy', invitation.id), {
            preserveScroll: true,
        });
    };

    const manageRole = (teamMember: any) => {
        setManagingRoleFor(teamMember);
        updateRoleForm.setData('role', teamMember.membership.role);
        setCurrentlyManagingRole(true);
    };

    const updateRole = () => {
        if (!managingRoleFor) return;
        updateRoleForm.put(route('team-members.update', [team.id, managingRoleFor.id]), {
            preserveScroll: true,
            onSuccess: () => setCurrentlyManagingRole(false),
        });
    };

    const leaveTeam = () => {
        leaveTeamForm.delete(route('team-members.destroy', [team.id, auth.user.id]));
    };

    const removeTeamMember = () => {
        if (!teamMemberBeingRemoved) return;
        removeTeamMemberForm.delete(route('team-members.destroy', [team.id, teamMemberBeingRemoved.id]), {
            errorBag: 'removeTeamMember',
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => setTeamMemberBeingRemoved(null),
        });
    };

    const displayableRole = (roleKey: string) => {
        return availableRoles.find((r) => r.key === roleKey)?.name || roleKey;
    };

    return (
        <div className={className}>
            {userPermissions.canAddTeamMembers && (
                <div>
                    <SectionBorder />

                    {/* Add Team Member */}
                    <FormSection
                        onSubmit={addTeamMember}
                        title="Add Team Member"
                        description="Add a new team member to your team, allowing them to collaborate with you."
                        actions={
                            <>
                                <ActionMessage on={addTeamMemberForm.recentlySuccessful} className="me-3">
                                    Added.
                                </ActionMessage>

                                <PrimaryButton disabled={addTeamMemberForm.processing}>
                                    Add
                                </PrimaryButton>
                            </>
                        }
                    >
                        <div className="col-span-6">
                            <div className="max-w-xl text-sm text-gray-600">
                                Please provide the email address of the person you would like to add to this team.
                            </div>
                        </div>

                        {/* Member Email */}
                        <div className="col-span-6 sm:col-span-4">
                            <InputLabel htmlFor="email" value="Email" />
                            <TextInput
                                id="email"
                                type="email"
                                value={addTeamMemberForm.data.email}
                                onChange={(e) => addTeamMemberForm.setData('email', e.target.value)}
                                className="mt-1 block w-full"
                            />
                            <InputError message={addTeamMemberForm.errors.email} className="mt-2" />
                        </div>

                        {/* Role */}
                        {availableRoles.length > 0 && (
                            <div className="col-span-6 lg:col-span-4">
                                <InputLabel htmlFor="roles" value="Role" />
                                <InputError message={addTeamMemberForm.errors.role} className="mt-2" />

                                <div className="relative z-0 mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200">
                                    {availableRoles.map((role) => (
                                        <button
                                            key={role.key}
                                            type="button"
                                            className={`relative px-4 py-3 inline-flex w-full text-left focus:outline-none transition-colors ${
                                                addTeamMemberForm.data.role === role.key ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'
                                            }`}
                                            onClick={() => addTeamMemberForm.setData('role', role.key)}
                                        >
                                            <div className="w-full">
                                                <div className="flex items-center justify-between">
                                                    <div className={`text-sm ${addTeamMemberForm.data.role === role.key ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>
                                                        {role.name}
                                                    </div>

                                                    {addTeamMemberForm.data.role === role.key && (
                                                        <Check className="w-4 h-4 text-blue-600" />
                                                    )}
                                                </div>

                                                <div className="mt-1 text-xs text-gray-500">
                                                    {role.description}
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </FormSection>
                </div>
            )}

            {/* Team Member Invitations */}
            {team.team_invitations && team.team_invitations.length > 0 && (
                <div>
                    <SectionBorder />

                    <ActionSection
                        title="Pending Team Invitations"
                        description="These people have been invited to your team and have been sent an invitation email. They may join the team by accepting the email invitation."
                    >
                        <div className="space-y-4">
                            {team.team_invitations.map((invitation: any) => (
                                <div key={invitation.id} className="flex items-center justify-between">
                                    <div className="text-sm text-gray-600">{invitation.email}</div>

                                    <div className="flex items-center">
                                        {userPermissions.canRemoveTeamMembers && (
                                            <button
                                                className="cursor-pointer ms-6 text-sm text-red-600 hover:text-red-800"
                                                onClick={() => cancelTeamInvitation(invitation)}
                                            >
                                                Cancel
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ActionSection>
                </div>
            )}

            {/* Team Members List */}
            {team.users && team.users.length > 0 && (
                <div>
                    <SectionBorder />

                    <ActionSection
                        title="Team Members"
                        description="All of the people that are part of this team."
                    >
                        <div className="space-y-4">
                            {team.users.map((user: any) => (
                                <div key={user.id} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        {user.profile_photo_url ? (
                                            <img
                                                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                                src={user.profile_photo_url}
                                                alt={user.name}
                                            />
                                        ) : (
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                                                {user.name.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div className="ms-4 text-sm font-medium text-gray-900">{user.name}</div>
                                    </div>

                                    <div className="flex items-center space-x-3 text-xs">
                                        {userPermissions.canUpdateTeamMembers && availableRoles.length > 1 ? (
                                            <button
                                                className="underline text-gray-500 hover:text-gray-700"
                                                onClick={() => manageRole(user)}
                                            >
                                                {displayableRole(user.membership.role)}
                                            </button>
                                        ) : (
                                            availableRoles.length > 0 && (
                                                <span className="text-gray-400">
                                                    {displayableRole(user.membership.role)}
                                                </span>
                                            )
                                        )}

                                        {auth.user.id === user.id ? (
                                            <button
                                                className="text-red-600 hover:text-red-800 underline"
                                                onClick={() => setConfirmingLeavingTeam(true)}
                                            >
                                                Leave
                                            </button>
                                        ) : (
                                            userPermissions.canRemoveTeamMembers && (
                                                <button
                                                    className="text-red-600 hover:text-red-800 underline"
                                                    onClick={() => setTeamMemberBeingRemoved(user)}
                                                >
                                                    Remove
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ActionSection>
                </div>
            )}

            {/* Role Management Modal */}
            <DialogModal
                show={currentlyManagingRole}
                onClose={() => setCurrentlyManagingRole(false)}
                title="Manage Role"
                content={
                    managingRoleFor && (
                        <div className="relative z-0 mt-1 border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200">
                            {availableRoles.map((role) => (
                                <button
                                    key={role.key}
                                    type="button"
                                    className={`relative px-4 py-3 inline-flex w-full text-left focus:outline-none transition-colors ${
                                        updateRoleForm.data.role === role.key ? 'bg-blue-50/50' : 'bg-white hover:bg-gray-50'
                                    }`}
                                    onClick={() => updateRoleForm.setData('role', role.key)}
                                >
                                    <div className="w-full">
                                        <div className="flex items-center justify-between">
                                            <div className={`text-sm ${updateRoleForm.data.role === role.key ? 'font-semibold text-blue-900' : 'text-gray-700'}`}>
                                                {role.name}
                                            </div>

                                            {updateRoleForm.data.role === role.key && (
                                                <Check className="w-4 h-4 text-blue-600" />
                                            )}
                                        </div>

                                        <div className="mt-1 text-xs text-gray-500">
                                            {role.description}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )
                }
                footer={
                    <>
                        <SecondaryButton onClick={() => setCurrentlyManagingRole(false)}>
                            Cancel
                        </SecondaryButton>

                        <PrimaryButton
                            disabled={updateRoleForm.processing}
                            onClick={updateRole}
                        >
                            Save
                        </PrimaryButton>
                    </>
                }
            />

            {/* Leave Team Confirmation Modal */}
            <ConfirmationModal
                show={confirmingLeavingTeam}
                onClose={() => setConfirmingLeavingTeam(false)}
                title="Leave Team"
                content="Are you sure you want to leave this team?"
                footer={
                    <>
                        <SecondaryButton onClick={() => setConfirmingLeavingTeam(false)}>
                            Cancel
                        </SecondaryButton>

                        <DangerButton
                            disabled={leaveTeamForm.processing}
                            onClick={leaveTeam}
                        >
                            Leave
                        </DangerButton>
                    </>
                }
            />

            {/* Remove Team Member Confirmation Modal */}
            <ConfirmationModal
                show={teamMemberBeingRemoved !== null}
                onClose={() => setTeamMemberBeingRemoved(null)}
                title="Remove Team Member"
                content="Are you sure you would like to remove this person from the team?"
                footer={
                    <>
                        <SecondaryButton onClick={() => setTeamMemberBeingRemoved(null)}>
                            Cancel
                        </SecondaryButton>

                        <DangerButton
                            disabled={removeTeamMemberForm.processing}
                            onClick={removeTeamMember}
                        >
                            Remove
                        </DangerButton>
                    </>
                }
            />
        </div>
    );
}
