import React, { useState, PropsWithChildren, ReactNode } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import ApplicationMark from '@/Components/ApplicationMark';
import Banner from '@/Components/Banner';
import Dropdown from '@/Components/Dropdown';
import DropdownLink from '@/Components/DropdownLink';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import { PageProps, Team } from '@/types';
import { ChevronDown, Check, Menu, X } from 'lucide-react';

interface AppLayoutProps {
    title?: string;
    renderHeader?: () => ReactNode;
}

export default function AppLayout({
    title,
    renderHeader,
    children,
}: PropsWithChildren<AppLayoutProps>) {
    const { auth, jetstream } = usePage<PageProps>().props;
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);

    const user = auth?.user;

    const switchToTeam = (team: Team) => {
        router.put(route('current-team.update'), {
            team_id: team.id,
        }, {
            preserveState: false,
        });
    };

    const logout = () => {
        router.post(route('logout'));
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <Head title={title} />
            <Banner />

            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            {/* Logo */}
                            <div className="shrink-0 flex items-center">
                                <Link href={route('dashboard')}>
                                    <ApplicationMark />
                                </Link>
                            </div>

                            {/* Navigation Links */}
                            <div className="hidden space-x-8 sm:-my-px sm:ms-10 sm:flex">
                                <NavLink
                                    href={route('dashboard')}
                                    active={route().current('dashboard')}
                                >
                                    Dashboard
                                </NavLink>
                            </div>
                        </div>

                        {user && (
                            <div className="hidden sm:flex sm:items-center sm:ms-6 space-x-3">
                                {/* Teams Dropdown */}
                                {jetstream?.hasTeamFeatures && user.current_team && (
                                    <Dropdown
                                        align="right"
                                        width="64"
                                        renderTrigger={({ open }) => (
                                            <button
                                                type="button"
                                                className="inline-flex items-center px-3 py-1.5 border border-gray-200 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition shadow-2xs"
                                            >
                                                <span className="truncate max-w-[140px]">{user.current_team?.name}</span>
                                                <ChevronDown className="ms-2 w-4 h-4 text-gray-500" />
                                            </button>
                                        )}
                                    >
                                        <div className="w-64">
                                            <div className="block px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Manage Team
                                            </div>

                                            <DropdownLink href={route('teams.show', user.current_team.id)}>
                                                Team Settings
                                            </DropdownLink>

                                            {jetstream?.canCreateTeams && (
                                                <DropdownLink href={route('teams.create')}>
                                                    Create New Team
                                                </DropdownLink>
                                            )}

                                            {user.all_teams && user.all_teams.length > 1 && (
                                                <>
                                                    <div className="border-t border-gray-100 my-1" />
                                                    <div className="block px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                        Switch Teams
                                                    </div>

                                                    {user.all_teams.map((team) => (
                                                        <DropdownLink
                                                            key={team.id}
                                                            as="button"
                                                            onClick={() => switchToTeam(team)}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className="truncate">{team.name}</span>
                                                                {team.id === user.current_team_id && (
                                                                    <Check className="w-4 h-4 text-blue-600" />
                                                                )}
                                                            </div>
                                                        </DropdownLink>
                                                    ))}
                                                </>
                                            )}
                                        </div>
                                    </Dropdown>
                                )}

                                {/* User Dropdown */}
                                <Dropdown
                                    align="right"
                                    width="48"
                                    renderTrigger={() => (
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-2 px-2 py-1.5 border border-transparent text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-100 focus:outline-none transition"
                                        >
                                            {jetstream?.managesProfilePhotos && user.profile_photo_url ? (
                                                <img
                                                    className="w-8 h-8 rounded-full object-cover border border-gray-200"
                                                    src={user.profile_photo_url}
                                                    alt={user.name}
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-xs">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <span className="font-medium text-gray-800">{user.name}</span>
                                            <ChevronDown className="w-4 h-4 text-gray-500" />
                                        </button>
                                    )}
                                >
                                    <div className="block px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                        Manage Account
                                    </div>

                                    <DropdownLink href={route('profile.show')}>
                                        Profile
                                    </DropdownLink>

                                    {jetstream?.hasApiFeatures && (
                                        <DropdownLink href={route('api-tokens.index')}>
                                            API Tokens
                                        </DropdownLink>
                                    )}

                                    <div className="border-t border-gray-100 my-1" />

                                    <DropdownLink as="button" onClick={logout}>
                                        Log Out
                                    </DropdownLink>
                                </Dropdown>
                            </div>
                        )}

                        {/* Mobile Hamburger */}
                        <div className="-me-2 flex items-center sm:hidden">
                            <button
                                onClick={() => setShowingNavigationDropdown((val) => !val)}
                                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none transition"
                            >
                                {showingNavigationDropdown ? (
                                    <X className="w-6 h-6" />
                                ) : (
                                    <Menu className="w-6 h-6" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile Navigation Drawer */}
                {showingNavigationDropdown && (
                    <div className="sm:hidden border-t border-gray-200 bg-white">
                        <div className="pt-2 pb-3 space-y-1">
                            <ResponsiveNavLink
                                href={route('dashboard')}
                                active={route().current('dashboard')}
                            >
                                Dashboard
                            </ResponsiveNavLink>
                        </div>

                        {user && (
                            <div className="pt-4 pb-3 border-t border-gray-200">
                                <div className="flex items-center px-4">
                                    {jetstream?.managesProfilePhotos && user.profile_photo_url ? (
                                        <img
                                            className="w-10 h-10 rounded-full object-cover border border-gray-200"
                                            src={user.profile_photo_url}
                                            alt={user.name}
                                        />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-semibold flex items-center justify-center text-sm">
                                            {user.name.charAt(0).toUpperCase()}
                                        </div>
                                    )}

                                    <div className="ms-3">
                                        <div className="font-medium text-base text-gray-900">{user.name}</div>
                                        <div className="font-medium text-sm text-gray-500">{user.email}</div>
                                    </div>
                                </div>

                                <div className="mt-3 space-y-1">
                                    <ResponsiveNavLink
                                        href={route('profile.show')}
                                        active={route().current('profile.show')}
                                    >
                                        Profile
                                    </ResponsiveNavLink>

                                    {jetstream?.hasApiFeatures && (
                                        <ResponsiveNavLink
                                            href={route('api-tokens.index')}
                                            active={route().current('api-tokens.index')}
                                        >
                                            API Tokens
                                        </ResponsiveNavLink>
                                    )}

                                    <ResponsiveNavLink as="button" onClick={logout}>
                                        Log Out
                                    </ResponsiveNavLink>

                                    {jetstream?.hasTeamFeatures && user.current_team && (
                                        <>
                                            <div className="border-t border-gray-200 my-2" />
                                            <div className="block px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                                Manage Team
                                            </div>
                                            <ResponsiveNavLink
                                                href={route('teams.show', user.current_team.id)}
                                                active={route().current('teams.show')}
                                            >
                                                Team Settings
                                            </ResponsiveNavLink>
                                            {jetstream?.canCreateTeams && (
                                                <ResponsiveNavLink
                                                    href={route('teams.create')}
                                                    active={route().current('teams.create')}
                                                >
                                                    Create New Team
                                                </ResponsiveNavLink>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </nav>

            {/* Page Header */}
            {renderHeader && (
                <header className="bg-white border-b border-gray-200">
                    <div className="max-w-7xl mx-auto py-5 px-4 sm:px-6 lg:px-8">
                        {renderHeader()}
                    </div>
                </header>
            )}

            {/* Main Content */}
            <main className="flex-1">{children}</main>
        </div>
    );
}
