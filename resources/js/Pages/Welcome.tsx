import React from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import ApplicationMark from '@/Components/ApplicationMark';
import { PageProps } from '@/types';
import { ArrowRight, Sparkles, Network, Users } from 'lucide-react';

interface WelcomeProps {
    canLogin?: boolean;
    canRegister?: boolean;
    laravelVersion: string;
    phpVersion: string;
}

export default function Welcome({
    canLogin = true,
    canRegister = true,
    laravelVersion,
    phpVersion,
}: WelcomeProps) {
    const { auth } = usePage<PageProps>().props;

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900 flex flex-col justify-between">
            <Head title="Welcome" />

            {/* Header */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 max-w-7xl mx-auto w-full">
                <div className="flex items-center gap-2">
                    <ApplicationMark />
                </div>

                <nav className="flex items-center gap-3">
                    <a
                        href="https://chat.kravti.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                    >
                        Chat Kravti
                    </a>
                    <Link
                        href={route('terms.show')}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                    >
                        Terms
                    </Link>
                    <Link
                        href={route('policy.show')}
                        className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg transition-colors"
                    >
                        Privacy
                    </Link>

                    {auth?.user ? (
                        <Link
                            href={route('dashboard')}
                            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                        >
                            Dashboard
                        </Link>
                    ) : (
                        <>
                            <Link
                                href={route('login')}
                                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
                            >
                                Log in
                            </Link>

                            {canRegister && (
                                <Link
                                    href={route('register')}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
                                >
                                    Register
                                </Link>
                            )}
                        </>
                    )}
                </nav>
            </header>

            {/* Hero Section */}
            <main className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-5xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-medium mb-8">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Next-Gen Visual Thinking Workspace</span>
                </div>

                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 max-w-4xl">
                    Organize your thoughts with precision & clarity.
                </h1>

                <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                    Talawire is a clean, modern collaborative workspace for your organization's mindmaps. Built with React Flow for speed, beauty, and frictionless brainstorming.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full sm:w-auto">
                    <Link
                        href={auth?.user ? route('dashboard') : route('register')}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all hover:shadow"
                    >
                        {auth?.user ? 'Open Dashboard' : 'Get Started for Free'}
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                    <a
                        href="#features"
                        className="w-full sm:w-auto px-6 py-3.5 text-base font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    >
                        Learn More
                    </a>
                </div>

                {/* Features Grid */}
                <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 text-left w-full">
                    <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                            <Network className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Modern React Flow Canvas</h3>
                        <p className="text-sm text-gray-500">
                            Smooth, hardware-accelerated node editing, custom branch styles, and auto layout with Dagre.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                            <Users className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Team Collaboration</h3>
                        <p className="text-sm text-gray-500">
                            Share with individual collaborators, grant view or edit rights, and share public view links.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-white border border-gray-200 shadow-2xs">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 mb-2">Export to PDF, PNG & Video</h3>
                        <p className="text-sm text-gray-500">
                            High resolution document exports and automatic video camera fly-through animations.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="py-8 text-sm text-gray-500 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between px-6 gap-4 max-w-7xl mx-auto w-full">
                <div>
                    Talawire &copy; 2026. Built with Laravel v{laravelVersion}.
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                    <a href="https://chat.kravti.com" target="_blank" rel="noopener noreferrer" className="hover:underline">Chat Kravti</a>
                    <Link href={route('terms.show')} className="hover:underline">Terms of Service</Link>
                    <Link href={route('policy.show')} className="hover:underline">Privacy Policy</Link>
                </div>
            </footer>
        </div>
    );
}
