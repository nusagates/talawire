import React, { useState } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AppLayout from '@/Layouts/AppLayout';
import ConfirmationModal from '@/Components/ConfirmationModal';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import { Project, Mindmap } from '@/types';
import { Plus, Network, Trash2, FolderGit2, Upload } from 'lucide-react';
import { importMindmapFromFile } from '@/Utils/mindmapStorage';

interface DashboardProps {
    projects?: Project[];
}

export default function Dashboard({ projects = [] }: DashboardProps) {
    const [mindmapToDelete, setMindmapToDelete] = useState<Mindmap | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const deleteMindmap = () => {
        if (mindmapToDelete) {
            router.delete(route('mindmaps.destroy', mindmapToDelete.id), {
                onFinish: () => setMindmapToDelete(null),
            });
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const data = await importMindmapFromFile(file);
            router.post(route('mindmaps.store'), {
                name: data.name || file.name.replace(/\.(talawire|json)$/i, ''),
                nodes: data.nodes || [],
                edges: data.edges || [],
                settings: data.settings || {},
            });
        } catch (err: any) {
            alert('Gagal mengimpor file: ' + err.message);
            setIsImporting(false);
        }
    };

    const hasMindmaps = projects.some((p) => p.mindmaps && p.mindmaps.length > 0);

    return (
        <AppLayout
            title="Dashboard"
            renderHeader={() => (
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="font-semibold text-xl text-gray-900 leading-tight">
                            Dashboard
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">Manage your team projects and visual mindmaps</p>
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".talawire,.json"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isImporting}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-300 rounded-lg font-medium text-xs text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                        >
                            <Upload className="w-4 h-4 text-gray-500" />
                            {isImporting ? 'Importing...' : 'Import (.talawire)'}
                        </button>

                        <Link
                            href={route('mindmaps.store')}
                            method="post"
                            as="button"
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 border border-transparent rounded-lg font-medium text-xs text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all shadow-sm cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            New Mindmap
                        </Link>
                    </div>
                </div>
            )}
        >
            <div className="py-8">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="mb-6 flex items-center justify-between">
                        <h3 className="text-base font-semibold text-gray-900">Your Mindmaps</h3>
                    </div>

                    {!hasMindmaps ? (
                        <div className="bg-white border border-gray-200 shadow-xs rounded-xl p-12 text-center max-w-2xl mx-auto">
                            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
                                <Network className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">No mindmaps yet</h3>
                            <p className="mt-1 text-sm text-gray-500 max-w-sm mx-auto">
                                Get started by creating your first mindmap canvas to brainstorm and structure your ideas.
                            </p>
                            <div className="mt-6">
                                <Link
                                    href={route('mindmaps.store')}
                                    method="post"
                                    as="button"
                                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 border border-transparent rounded-lg font-medium text-xs text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
                                >
                                    <Plus className="w-4 h-4" />
                                    Create First Mindmap
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                            {projects.map((project) =>
                                (project.mindmaps || []).map((mindmap) => (
                                    <div
                                        key={mindmap.id}
                                        className="relative rounded-xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between hover:border-gray-300 hover:shadow-sm transition-all group"
                                    >
                                        <div className="flex items-start space-x-3.5 mb-4">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                <Network className="w-5 h-5" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <Link
                                                    href={route('mindmaps.edit', mindmap.id)}
                                                    className="focus:outline-none"
                                                >
                                                    <span className="absolute inset-0 z-10" aria-hidden="true" />
                                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                                        {mindmap.name || 'Untitled Mindmap'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate mt-0.5 flex items-center gap-1">
                                                        <FolderGit2 className="w-3 h-3 text-gray-400" />
                                                        {project.name}
                                                    </p>
                                                </Link>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between border-t border-gray-100 pt-3 relative z-20">
                                            <span className="text-[11px] text-gray-400">
                                                {mindmap.is_public ? 'Public' : 'Private'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setMindmapToDelete(mindmap);
                                                }}
                                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-md transition-colors"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                                Hapus
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmationModal
                show={mindmapToDelete !== null}
                onClose={() => setMindmapToDelete(null)}
                title="Hapus Mindmap"
                content={
                    <span>
                        Apakah Anda yakin ingin menghapus mindmap <strong>{mindmapToDelete?.name || 'Untitled'}</strong>? Data yang sudah dihapus tidak dapat dikembalikan.
                    </span>
                }
                footer={
                    <>
                        <SecondaryButton onClick={() => setMindmapToDelete(null)}>
                            Batal
                        </SecondaryButton>
                        <DangerButton onClick={deleteMindmap}>
                            Hapus
                        </DangerButton>
                    </>
                }
            />
        </AppLayout>
    );
}
