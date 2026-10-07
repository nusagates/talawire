import React from 'react';
import ApplicationLogo from './ApplicationLogo';
import { FolderGit2, Network } from 'lucide-react';

export default function Welcome() {
    return (
        <div>
            <div className="p-6 lg:p-8 bg-white border-b border-gray-200">
                <ApplicationLogo className="block h-12 w-auto" />

                <h1 className="mt-8 text-2xl font-semibold text-gray-900">
                    Welcome to your Talawire workspace!
                </h1>

                <p className="mt-4 text-gray-600 leading-relaxed text-sm">
                    Start by creating a new Project for your organization, then build collaborative mindmaps inside it.
                    Use the top navigation menu to manage your Teams or Profile settings.
                </p>
            </div>

            <div className="bg-gray-50/50 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 p-6 lg:p-8">
                <div className="flex items-start">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div className="ml-4">
                        <h2 className="text-base font-semibold text-gray-900">Projects</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Organize your mindmaps into specific projects. Each project belongs to a Team and can be accessed by its members.
                        </p>
                    </div>
                </div>

                <div className="flex items-start">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                        <Network className="w-5 h-5" />
                    </div>
                    <div className="ml-4">
                        <h2 className="text-base font-semibold text-gray-900">Mindmaps</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Interactive nodes and edges that you can drag and drop. Collaborate and visualize ideas seamlessly with React Flow.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
