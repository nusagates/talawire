import React from 'react';
import AppLayout from '@/Layouts/AppLayout';
import UpdateTeamNameForm from '@/Pages/Teams/Partials/UpdateTeamNameForm';
import TeamMemberManager from '@/Pages/Teams/Partials/TeamMemberManager';
import DeleteTeamForm from '@/Pages/Teams/Partials/DeleteTeamForm';
import SectionBorder from '@/Components/SectionBorder';
import { Team } from '@/types';

interface ShowProps {
    team: Team;
    availableRoles: any[];
    permissions: {
        canAddTeamMembers?: boolean;
        canDeleteTeam?: boolean;
        canRemoveTeamMembers?: boolean;
        canUpdateTeam?: boolean;
        canUpdateTeamMembers?: boolean;
    };
}

export default function Show({
    team,
    availableRoles,
    permissions,
}: ShowProps) {
    return (
        <AppLayout
            title="Team Settings"
            renderHeader={() => (
                <h2 className="font-semibold text-xl text-gray-900 leading-tight">
                    Team Settings
                </h2>
            )}
        >
            <div>
                <div className="max-w-7xl mx-auto py-10 sm:px-6 lg:px-8 space-y-10">
                    <UpdateTeamNameForm team={team} permissions={permissions} />

                    <TeamMemberManager
                        team={team}
                        availableRoles={availableRoles}
                        userPermissions={permissions}
                    />

                    {permissions.canDeleteTeam && !team.personal_team && (
                        <div>
                            <SectionBorder />
                            <DeleteTeamForm team={team} />
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
