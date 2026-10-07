import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import axios from 'axios';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
    ReactFlowProvider,
    useReactFlow,
    BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import dagre from '@dagrejs/dagre';

import MindmapNode from '@/Components/MindmapNode';
import BraceEdge from '@/Components/BraceEdge';
import LabeledEdge from '@/Components/LabeledEdge';
import { layoutMindmap } from '@/Utils/mindmapLayout';
import DialogModal from '@/Components/DialogModal';
import SecondaryButton from '@/Components/SecondaryButton';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Mindmap, MindmapShare } from '@/types';
import {
    saveLocalMindmap,
    getLocalMindmap,
    exportMindmapToFile,
    importMindmapFromFile,
} from '@/Utils/mindmapStorage';

import {
    ArrowLeft,
    Undo2,
    Redo2,
    Plus,
    Layout,
    Share2,
    Download,
    Eye,
    Sparkles,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Minimize2,
    Sliders,
    ListTree,
    Trash2,
    Palette,
    Type,
    Video,
    Check,
    X,
    FolderGit2,
    Upload,
} from 'lucide-react';

const nodeTypes = {
    custom: MindmapNode,
};

const edgeTypes = {
    brace: BraceEdge,
    labeled: LabeledEdge,
};

const mindmapBranchColors = [
    { bg: '#ef4444', text: '#ffffff', line: '#ef4444' },
    { bg: '#f97316', text: '#ffffff', line: '#f97316' },
    { bg: '#10b981', text: '#ffffff', line: '#10b981' },
    { bg: '#06b6d4', text: '#ffffff', line: '#06b6d4' },
    { bg: '#3b82f6', text: '#ffffff', line: '#3b82f6' },
    { bg: '#8b5cf6', text: '#ffffff', line: '#8b5cf6' },
    { bg: '#ec4899', text: '#ffffff', line: '#ec4899' },
    { bg: '#f59e0b', text: '#0f172a', line: '#d97706' },
    { bg: '#14b8a6', text: '#ffffff', line: '#14b8a6' },
    { bg: '#6366f1', text: '#ffffff', line: '#6366f1' },
];

const canvasBackgrounds = [
    '#ffffff',
    '#f8fafc',
    '#f1f5f9',
    '#fef3c7',
    '#dcfce7',
    '#dbeafe',
    '#f3e8ff',
    '#1e293b',
    '#0f172a',
];

interface EditProps {
    mindmap: Mindmap;
    canEdit?: boolean;
    isRenderView?: boolean;
}

function MindmapCanvas({ mindmap, canEdit = true, isRenderView = false }: EditProps) {
    const { fitView, zoomIn, zoomOut, zoomTo, getViewport, screenToFlowPosition } = useReactFlow();

    // Title state
    const [title, setTitle] = useState(mindmap.name || 'Untitled Mindmap');
    const [isEditingTitle, setIsEditingTitle] = useState(false);

    // Settings
    const defaultSettings = {
        backgroundStyle: 'none',
        backgroundColor: '#ffffff',
        edgeStyle: 'brace',
        edgeColor: '#ff6b4a',
        diagramMode: 'mindmap',
        showMinimap: false,
        showControls: true,
    };
    const [settings, setSettings] = useState({ ...defaultSettings, ...(mindmap.settings || {}) });

    // Toast state
    const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({
        show: false,
        message: '',
        type: 'success',
    });
    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, message, type });
        setTimeout(() => setToast((t) => ({ ...t, show: false })), 3500);
    };

    // UI Panels & Modals
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);
    const [isOutlinerOpen, setIsOutlinerOpen] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isVideoRecordModalOpen, setIsVideoRecordModalOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Share state
    const [shareEmail, setShareEmail] = useState('');
    const [sharePermission, setSharePermission] = useState<'view' | 'edit'>('view');
    const [isPublic, setIsPublic] = useState(mindmap.is_public);
    const [publicPermission, setPublicPermission] = useState(mindmap.public_permission);

    // Video Recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordDuration, setRecordDuration] = useState(5);

    // Initial Node/Edge setup
    const initialEdges: Edge[] = useMemo(() => {
        if (mindmap.edges && mindmap.edges.length > 0) {
            return mindmap.edges.map((e: any) => ({
                id: String(e.id),
                source: String(e.source),
                target: String(e.target),
                sourceHandle: e.sourceHandle,
                targetHandle: e.targetHandle,
                type: e.type || 'brace',
                style: e.style || { stroke: '#f97316', strokeWidth: 2 },
                data: e.data,
            }));
        }
        return [];
    }, [mindmap.edges]);

    const initialNodes: Node[] = useMemo(() => {
        let rawNodes: Node[] = [];
        if (mindmap.nodes && mindmap.nodes.length > 0) {
            rawNodes = mindmap.nodes.map((n: any) => ({
                id: String(n.id),
                type: n.type || 'custom',
                position: n.position || { x: 500, y: 350 },
                data: {
                    ...n.data,
                    canEdit,
                },
            }));
        } else {
            rawNodes = [
                {
                    id: 'root',
                    type: 'custom',
                    position: { x: 500, y: 350 },
                    data: {
                        label: mindmap.name || 'Central Topic',
                        isRoot: true,
                        level: 0,
                        shape: 'box',
                        bgColor: '#ffffff',
                        borderWidth: 2,
                        fontSize: 22,
                        fontFamily: 'Inter',
                        canEdit,
                    },
                },
            ];
        }

        const { nodes: layouted } = layoutMindmap(rawNodes, initialEdges);
        return layouted;
    }, [mindmap.nodes, initialEdges, mindmap.name, canEdit]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Undo / Redo history
    const [history, setHistory] = useState<{ nodes: Node[]; edges: Edge[] }[]>([
        { nodes: initialNodes, edges: initialEdges },
    ]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const commitHistory = useCallback(
        (newNodes: Node[], newEdges: Edge[]) => {
            setHistory((prev) => {
                const updated = prev.slice(0, historyIndex + 1);
                return [...updated, { nodes: newNodes, edges: newEdges }];
            });
            setHistoryIndex((prev) => prev + 1);
        },
        [historyIndex]
    );

    const handleUndo = () => {
        if (historyIndex > 0) {
            const nextIdx = historyIndex - 1;
            setHistoryIndex(nextIdx);
            setNodes(history[nextIdx].nodes);
            setEdges(history[nextIdx].edges);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const nextIdx = historyIndex + 1;
            setHistoryIndex(nextIdx);
            setNodes(history[nextIdx].nodes);
            setEdges(history[nextIdx].edges);
        }
    };

    // Auto layout mindmap tree
    const layoutTree = useCallback(() => {
        const { nodes: layoutedNodes, edges: layoutedEdges } = layoutMindmap(nodes, edges);
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        commitHistory(layoutedNodes, layoutedEdges);
        setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
        showToast('Diagram layout diatur ulang.', 'success');
    }, [nodes, edges, commitHistory, fitView]);

    // Selected node tracking
    const selectedNode = useMemo(() => nodes.find((n) => n.selected), [nodes]);

    // Node addition handlers
    const handleAddChild = useCallback(
        (parentId: string, dir?: string) => {
            const parent = nodes.find((n) => n.id === parentId);
            if (!parent) return;

            const isRootNode = parent.id === 'root' || Boolean(parent.data?.isRoot);
            const newId = `node-${Date.now()}`;
            
            let branchDir: 'left' | 'right' | undefined = undefined;
            if (isRootNode) {
                branchDir = (dir === 'left' || dir === 'right') ? dir : undefined;
            } else {
                branchDir = parent.data?.branchDirection === 'left' ? 'left' : 'right';
            }

            const newNode: Node = {
                id: newId,
                type: 'custom',
                position: { x: 0, y: 0 },
                data: {
                    label: '',
                    branchDirection: branchDir,
                    isNew: true,
                    canEdit,
                },
            };

            const newEdge: Edge = {
                id: `e-${parentId}-${newId}`,
                source: parentId,
                target: newId,
                type: 'brace',
            };

            const rawNextNodes = [...nodes.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true }];
            const rawNextEdges = [...edges, newEdge];
            const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(rawNextNodes, rawNextEdges);

            setNodes(nextNodes);
            setEdges(nextEdges);
            commitHistory(nextNodes, nextEdges);
        },
        [nodes, edges, canEdit, commitHistory]
    );

    const handleAddSibling = useCallback(
        (siblingId: string) => {
            if (siblingId === 'root') return;
            const sibling = nodes.find((n) => n.id === siblingId);
            if (!sibling) return;

            const edgeToSibling = edges.find((e) => e.target === siblingId);
            const parentId = edgeToSibling ? edgeToSibling.source : 'root';
            const isParentRoot = parentId === 'root' || Boolean(nodes.find((n) => n.id === parentId)?.data?.isRoot);
            const newId = `node-${Date.now()}`;
            const isLeft = sibling.data?.branchDirection === 'left';

            const newNode: Node = {
                id: newId,
                type: 'custom',
                position: { x: 0, y: 0 },
                data: {
                    label: '',
                    branchDirection: isParentRoot ? undefined : (isLeft ? 'left' : 'right'),
                    isNew: true,
                    canEdit,
                },
            };

            const newEdge: Edge = {
                id: `e-${parentId}-${newId}`,
                source: parentId,
                target: newId,
                type: 'brace',
            };

            const rawNextNodes = [...nodes.map((n) => ({ ...n, selected: false })), { ...newNode, selected: true }];
            const rawNextEdges = [...edges, newEdge];
            const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(rawNextNodes, rawNextEdges);

            setNodes(nextNodes);
            setEdges(nextEdges);
            commitHistory(nextNodes, nextEdges);
        },
        [nodes, edges, canEdit, commitHistory]
    );

    const onConnect = useCallback(
        (connection: Connection) => {
            const nextEdges = addEdge(
                {
                    ...connection,
                    type: 'brace',
                    style: { stroke: '#94a3b8', strokeWidth: 2 },
                },
                edges
            );
            setEdges(nextEdges);
            commitHistory(nodes, nextEdges);
        },
        [edges, nodes, commitHistory]
    );

    // Auto-save debounced
    useEffect(() => {
        if (!canEdit || isRenderView) return;

        const timer = setTimeout(async () => {
            await saveLocalMindmap(mindmap.id, {
                name: title,
                nodes,
                edges,
                settings,
            });

            axios.put(route('mindmaps.update', mindmap.id), {
                name: title,
                nodes,
                edges,
                settings,
            }).catch(() => {});
        }, 1500);

        return () => clearTimeout(timer);
    }, [nodes, edges, title, settings, canEdit, isRenderView, mindmap.id]);

    // Arrow key navigation between nodes
    const navigateNode = useCallback(
        (direction: 'up' | 'down' | 'left' | 'right') => {
            if (!selectedNode) {
                const rootNode = nodes.find((n) => n.id === 'root') || nodes[0];
                if (rootNode) {
                    setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === rootNode.id })));
                }
                return;
            }

            const currentPos = selectedNode.position;
            let targetNode: Node | undefined;

            if (direction === 'up' || direction === 'down') {
                const incomingEdge = edges.find((e) => e.target === selectedNode.id);
                const parentId = incomingEdge ? incomingEdge.source : null;

                const candidateNodes = parentId
                    ? nodes.filter(
                          (n) => edges.some((e) => e.source === parentId && e.target === n.id) && n.id !== selectedNode.id
                      )
                    : nodes.filter((n) => n.id !== selectedNode.id);

                if (direction === 'up') {
                    const above = candidateNodes
                        .filter((n) => n.position.y < currentPos.y)
                        .sort((a, b) => b.position.y - a.position.y);
                    targetNode = above[0] || candidateNodes.sort((a, b) => a.position.y - b.position.y)[0];
                } else {
                    const below = candidateNodes
                        .filter((n) => n.position.y > currentPos.y)
                        .sort((a, b) => a.position.y - b.position.y);
                    targetNode = below[0] || candidateNodes.sort((a, b) => b.position.y - a.position.y)[0];
                }
            } else if (direction === 'right') {
                if (selectedNode.id === 'root' || selectedNode.data?.branchDirection !== 'left') {
                    const childEdges = edges.filter((e) => e.source === selectedNode.id);
                    const children = nodes.filter((n) => childEdges.some((e) => e.target === n.id));
                    if (children.length > 0) {
                        targetNode = children.sort(
                            (a, b) => Math.abs(a.position.y - currentPos.y) - Math.abs(b.position.y - currentPos.y)
                        )[0];
                    }
                } else {
                    const incomingEdge = edges.find((e) => e.target === selectedNode.id);
                    if (incomingEdge) {
                        targetNode = nodes.find((n) => n.id === incomingEdge.source);
                    }
                }
            } else if (direction === 'left') {
                if (selectedNode.id === 'root' || selectedNode.data?.branchDirection === 'left') {
                    const childEdges = edges.filter((e) => e.source === selectedNode.id);
                    const children = nodes.filter((n) =>
                        childEdges.some((e) => e.target === n.id && n.position.x < currentPos.x)
                    );
                    if (children.length > 0) {
                        targetNode = children.sort(
                            (a, b) => Math.abs(a.position.y - currentPos.y) - Math.abs(b.position.y - currentPos.y)
                        )[0];
                    }
                } else {
                    const incomingEdge = edges.find((e) => e.target === selectedNode.id);
                    if (incomingEdge) {
                        targetNode = nodes.find((n) => n.id === incomingEdge.source);
                    }
                }
            }

            if (targetNode) {
                setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === targetNode!.id })));
            }
        },
        [selectedNode, nodes, edges]
    );

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!canEdit) return;

            const target = e.target as HTMLElement;
            const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                handleRedo();
            } else if (!isInputFocused && (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
                e.preventDefault();
                const dirMap: Record<string, 'up' | 'down' | 'left' | 'right'> = {
                    ArrowUp: 'up',
                    ArrowDown: 'down',
                    ArrowLeft: 'left',
                    ArrowRight: 'right',
                };
                navigateNode(dirMap[e.key]);
            } else if (!isInputFocused && (e.key === 'Delete' || e.key === 'Backspace')) {
                if (selectedNode && selectedNode.id !== 'root') {
                    e.preventDefault();
                    const toDelete = new Set<string>([selectedNode.id]);
                    let added = true;
                    while (added) {
                        added = false;
                        edges.forEach((e) => {
                            if (toDelete.has(e.source) && !toDelete.has(e.target)) {
                                toDelete.add(e.target);
                                added = true;
                            }
                        });
                    }
                    const rawNextNodes = nodes.filter((n) => !toDelete.has(n.id));
                    const rawNextEdges = edges.filter(
                        (edge) => !toDelete.has(edge.source) && !toDelete.has(edge.target)
                    );
                    const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(rawNextNodes, rawNextEdges);
                    setNodes(nextNodes);
                    setEdges(nextEdges);
                    commitHistory(nextNodes, nextEdges);
                    showToast('Node dihapus.', 'success');
                }
            } else if (!isInputFocused && e.key === 'Tab') {
                if (selectedNode) {
                    e.preventDefault();
                    handleAddChild(selectedNode.id);
                }
            } else if (!isInputFocused && e.key === 'Enter' && !e.shiftKey) {
                if (selectedNode) {
                    e.preventDefault();
                    if (selectedNode.id === 'root') {
                        handleAddChild('root');
                    } else {
                        handleAddSibling(selectedNode.id);
                    }
                }
            } else if (!isInputFocused && selectedNode && (e.key === ' ' || e.key === 'F2')) {
                const wrapper = document.getElementById(`node-wrapper-${selectedNode.id}`);
                const inputEl = wrapper?.querySelector<HTMLInputElement>('input');
                if (inputEl) {
                    e.preventDefault();
                    inputEl.focus();
                    const len = inputEl.value.length;
                    inputEl.setSelectionRange(len, len);
                }
            } else if (!isInputFocused && selectedNode && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const wrapper = document.getElementById(`node-wrapper-${selectedNode.id}`);
                const inputEl = wrapper?.querySelector<HTMLInputElement>('input');
                if (inputEl) {
                    e.preventDefault();
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
                    nativeInputValueSetter?.call(inputEl, e.key);
                    inputEl.focus();
                    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canEdit, selectedNode, nodes, edges, historyIndex, history, handleAddChild, handleAddSibling, navigateNode]);

    // Export handlers
    const exportToPngImage = async () => {
        setIsExportMenuOpen(false);
        const flowEl = document.querySelector('.react-flow') as HTMLElement;
        if (!flowEl) return;

        fitView({ padding: 0.2, duration: 200 });
        await new Promise((r) => setTimeout(r, 300));

        try {
            const dataUrl = await toPng(flowEl, {
                backgroundColor: settings.backgroundColor || '#ffffff',
                pixelRatio: 2,
            });
            const link = document.createElement('a');
            link.download = `${title || 'mindmap'}.png`;
            link.href = dataUrl;
            link.click();
            showToast('Berhasil mengekspor PNG!', 'success');
        } catch {
            showToast('Gagal mengekspor PNG.', 'error');
        }
    };

    const exportToPdfDoc = async () => {
        setIsExportMenuOpen(false);
        const flowEl = document.querySelector('.react-flow') as HTMLElement;
        if (!flowEl) return;

        fitView({ padding: 0.2, duration: 200 });
        await new Promise((r) => setTimeout(r, 300));

        try {
            const dataUrl = await toPng(flowEl, {
                backgroundColor: settings.backgroundColor || '#ffffff',
                pixelRatio: 2,
            });
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'px',
                format: [flowEl.offsetWidth, flowEl.offsetHeight],
            });
            pdf.addImage(dataUrl, 'PNG', 0, 0, flowEl.offsetWidth, flowEl.offsetHeight);
            pdf.save(`${title || 'mindmap'}.pdf`);
            showToast('Berhasil mengekspor PDF!', 'success');
        } catch {
            showToast('Gagal mengekspor PDF.', 'error');
        }
    };

    const importFileInputRef = useRef<HTMLInputElement>(null);

    const exportToJsonFile = () => {
        setIsExportMenuOpen(false);
        exportMindmapToFile({
            name: title,
            nodes,
            edges,
            settings,
        });
        showToast('Berhasil mengekspor file .talawire!', 'success');
    };

    const handleImportJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const data = await importMindmapFromFile(file);
            if (data.nodes && Array.isArray(data.nodes)) {
                setNodes(data.nodes);
            }
            if (data.edges && Array.isArray(data.edges)) {
                setEdges(data.edges);
            }
            if (data.name) {
                setTitle(data.name);
            }
            if (data.settings) {
                setSettings((prev) => ({ ...prev, ...data.settings }));
            }
            setIsExportMenuOpen(false);
            showToast('Berhasil mengimpor file .talawire!', 'success');
            setTimeout(() => {
                fitView({ duration: 600, padding: 0.2 });
            }, 200);
        } catch (err: any) {
            showToast('Gagal mengimpor file: ' + err.message, 'error');
        } finally {
            if (e.target) e.target.value = '';
        }
    };

    // Video Recording Server Process
    const startVideoRender = async () => {
        setIsVideoRecordModalOpen(false);
        setIsRecording(true);
        showToast('Memulai proses render video di server...', 'success');

        try {
            await axios.post(route('mindmaps.export_video', mindmap.id), {
                duration: recordDuration * 1000,
            });

            const interval = setInterval(async () => {
                const res = await axios.get(route('mindmaps.video_status', mindmap.id));
                if (res.data.status === 'done') {
                    clearInterval(interval);
                    setIsRecording(false);
                    showToast('Video siap diunduh!', 'success');
                    const a = document.createElement('a');
                    a.href = res.data.url;
                    a.download = `mindmap-${mindmap.id}.webm`;
                    a.click();
                } else if (res.data.status === 'failed') {
                    clearInterval(interval);
                    setIsRecording(false);
                    showToast('Gagal merender video di server.', 'error');
                }
            }, 3000);
        } catch {
            setIsRecording(false);
            showToast('Gagal memicu render video.', 'error');
        }
    };

    // Update Node Style from Inspector Panel
    const updateSelectedNodeStyle = (updates: Record<string, any>) => {
        if (!selectedNode) return;
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id === selectedNode.id) {
                    return {
                        ...n,
                        data: {
                            ...n.data,
                            ...updates,
                        },
                    };
                }
                return n;
            })
        );
    };

    return (
        <div className="w-screen h-screen flex flex-col bg-gray-50 overflow-hidden font-sans select-none">
            <Head title={`${title} - Mindmap Editor`} />

            {/* Custom Toast Notification (No native alert/prompt/confirm) */}
            {toast.show && (
                <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-gray-900 text-white text-xs font-medium rounded-xl shadow-lg animate-bounce">
                    {toast.type === 'success' ? (
                        <Check className="w-4 h-4 text-green-400" />
                    ) : (
                        <X className="w-4 h-4 text-red-400" />
                    )}
                    <span>{toast.message}</span>
                </div>
            )}

            {/* Top Minimalist Header */}
            {!isRenderView && (
                <header className="h-14 bg-white border-b border-gray-200 px-4 flex items-center justify-between z-30 shrink-0">
                    <div className="flex items-center space-x-3">
                        <Link
                            href={route('dashboard')}
                            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
                            title="Back to Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>

                        {/* Mindmap Title */}
                        {isEditingTitle ? (
                            <input
                                value={title}
                                autoFocus
                                onChange={(e) => setTitle(e.target.value)}
                                onBlur={() => setIsEditingTitle(false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') setIsEditingTitle(false);
                                }}
                                className="px-2 py-1 text-sm font-semibold text-gray-900 border border-blue-500 rounded-lg focus:outline-none ring-2 ring-blue-100"
                            />
                        ) : (
                            <button
                                onClick={() => canEdit && setIsEditingTitle(true)}
                                className="text-sm font-semibold text-gray-900 hover:bg-gray-50 px-2 py-1 rounded-lg transition truncate max-w-xs"
                                title="Click to Rename"
                            >
                                {title}
                            </button>
                        )}
                    </div>

                    {/* Middle Controls (Undo, Redo, Add Node, Layout) */}
                    <div className="hidden md:flex items-center space-x-1 bg-gray-100/70 p-1 rounded-xl border border-gray-200/80">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Undo (Ctrl+Z)"
                        >
                            <Undo2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Redo (Ctrl+Y)"
                        >
                            <Redo2 className="w-4 h-4" />
                        </button>

                        <div className="w-px h-4 bg-gray-300 mx-1" />

                        <button
                            onClick={() => selectedNode ? handleAddChild(selectedNode.id) : handleAddChild('root')}
                            disabled={!canEdit}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-blue-600 hover:bg-white rounded-lg transition"
                            title="Add Child Subtopic (Tab)"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Node</span>
                        </button>

                        <button
                            onClick={() => layoutTree('LR')}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:text-blue-600 hover:bg-white rounded-lg transition"
                            title="Auto Tidy Layout"
                        >
                            <Layout className="w-3.5 h-3.5" />
                            <span>Auto Layout</span>
                        </button>
                    </div>

                    {/* Right Actions (Outliner, Inspector, Share, Export) */}
                    <div className="flex items-center space-x-2">
                        {/* Outliner toggle */}
                        <button
                            onClick={() => setIsOutlinerOpen((v) => !v)}
                            className={`p-2 rounded-lg transition text-xs font-medium inline-flex items-center gap-1.5 ${
                                isOutlinerOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title="Outline View"
                        >
                            <ListTree className="w-4 h-4" />
                            <span className="hidden lg:inline">Outline</span>
                        </button>

                        {/* Inspector Panel toggle */}
                        <button
                            onClick={() => setIsRightPanelOpen((v) => !v)}
                            className={`p-2 rounded-lg transition text-xs font-medium inline-flex items-center gap-1.5 ${
                                isRightPanelOpen ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'
                            }`}
                            title="Format Inspector"
                        >
                            <Sliders className="w-4 h-4" />
                            <span className="hidden lg:inline">Style</span>
                        </button>

                        {/* Hidden Import Input */}
                        <input
                            ref={importFileInputRef}
                            type="file"
                            accept=".talawire,.json"
                            className="hidden"
                            onChange={handleImportJsonFile}
                        />

                        {/* Import Button */}
                        <button
                            onClick={() => importFileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs transition"
                            title="Import .talawire / JSON"
                        >
                            <Upload className="w-3.5 h-3.5 text-gray-500" />
                            <span className="hidden sm:inline">Import</span>
                        </button>

                        {/* Export Menu */}
                        <div className="relative">
                            <button
                                onClick={() => setIsExportMenuOpen((v) => !v)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 shadow-2xs transition"
                            >
                                <Download className="w-3.5 h-3.5" />
                                <span>Export</span>
                            </button>

                            {isExportMenuOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-lg py-1.5 z-50">
                                    <button
                                        onClick={() => {
                                            setIsExportMenuOpen(false);
                                            importFileInputRef.current?.click();
                                        }}
                                        className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                                    >
                                        <span>Import (.talawire)</span>
                                        <Upload className="w-3.5 h-3.5 text-gray-400" />
                                    </button>
                                    <div className="border-t border-gray-100 my-1" />
                                    <button
                                        onClick={exportToPngImage}
                                        className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                                    >
                                        <span>Export Image (PNG)</span>
                                    </button>
                                    <button
                                        onClick={exportToPdfDoc}
                                        className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                                    >
                                        <span>Export Document (PDF)</span>
                                    </button>
                                    <button
                                        onClick={exportToJsonFile}
                                        className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-between"
                                    >
                                        <span>Download (.talawire)</span>
                                    </button>
                                    <div className="border-t border-gray-100 my-1" />
                                    <button
                                        onClick={() => {
                                            setIsExportMenuOpen(false);
                                            setIsVideoRecordModalOpen(true);
                                        }}
                                        className="w-full px-4 py-2 text-left text-xs font-medium text-blue-600 hover:bg-blue-50 flex items-center justify-between"
                                    >
                                        <span>Render Video</span>
                                        <Video className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Share Button */}
                        <button
                            onClick={() => setIsShareModalOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition"
                        >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share</span>
                        </button>
                    </div>
                </header>
            )}

            {/* Main Canvas Area */}
            <div className="flex-1 relative flex overflow-hidden">
                {/* Outliner Sidebar (Tree View) */}
                {isOutlinerOpen && (
                    <aside className="w-64 bg-white border-r border-gray-200 h-full flex flex-col z-20 shadow-sm">
                        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Outliner</span>
                            <button
                                onClick={() => setIsOutlinerOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            {nodes.map((n) => (
                                <button
                                    key={n.id}
                                    onClick={() => {
                                        setNodes((nds) =>
                                            nds.map((item) => ({
                                                ...item,
                                                selected: item.id === n.id,
                                            }))
                                        );
                                        zoomTo(1, { duration: 300 });
                                    }}
                                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs truncate transition flex items-center gap-2 ${
                                        n.selected ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-50'
                                    }`}
                                >
                                    <div
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: (n.data?.borderColor as string) || '#38bdf8' }}
                                    />
                                    <span className="truncate">{(n.data?.label as string) || 'Untitled'}</span>
                                </button>
                            ))}
                        </div>
                    </aside>
                )}

                {/* React Flow Core Viewport */}
                <div className="flex-1 h-full w-full relative">
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        nodesDraggable={false}
                        elementsSelectable={true}
                        zoomOnDoubleClick={false}
                        fitView
                        minZoom={0.1}
                        maxZoom={2.5}
                        style={{ backgroundColor: settings.backgroundColor }}
                    >
                        {settings.backgroundStyle === 'dots' && (
                            <Background
                                variant={BackgroundVariant.Dots}
                                gap={24}
                                size={1}
                                color="#e2e8f0"
                            />
                        )}
                        {settings.backgroundStyle === 'lines' && (
                            <Background
                                variant={BackgroundVariant.Lines}
                                gap={24}
                                color="#f1f5f9"
                            />
                        )}
                        {settings.showControls && <Controls className="bg-white border border-gray-200 shadow-sm rounded-xl" />}
                        {settings.showMinimap && (
                            <MiniMap
                                className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
                                nodeColor={(n) => (n.data?.bgColor as string) || '#3b82f6'}
                                maskColor="rgba(241, 245, 249, 0.7)"
                            />
                        )}
                    </ReactFlow>
                </div>

                {/* Right Inspector Style Panel */}
                {isRightPanelOpen && (
                    <aside className="w-72 bg-white border-l border-gray-200 h-full flex flex-col z-20 shadow-sm overflow-y-auto">
                        <div className="p-3.5 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-900 uppercase tracking-wider">
                                {selectedNode ? 'Format Node' : 'Canvas Settings'}
                            </span>
                            <button
                                onClick={() => setIsRightPanelOpen(false)}
                                className="p-1 text-gray-400 hover:text-gray-700 rounded"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 space-y-6">
                            {selectedNode ? (
                                <>
                                    {/* Selected Node Label */}
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600 block mb-1.5">Topic Text</label>
                                        <input
                                            type="text"
                                            value={(selectedNode.data?.label as string) || ''}
                                            onChange={(e) => updateSelectedNodeStyle({ label: e.target.value })}
                                            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                                            placeholder="Topic name..."
                                        />
                                    </div>

                                    {/* Branch Color Theme */}
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600 block mb-2">Branch Accent Color</label>
                                        <div className="grid grid-cols-5 gap-2">
                                            {mindmapBranchColors.map((color, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() =>
                                                        updateSelectedNodeStyle({
                                                            borderColor: color.line,
                                                            branchLineColor: color.line,
                                                        })
                                                    }
                                                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${
                                                        (selectedNode.data?.borderColor || selectedNode.data?.branchColor) === color.line
                                                            ? 'ring-2 ring-blue-500 border-white shadow-sm scale-110'
                                                            : 'border-white shadow-2xs'
                                                    }`}
                                                    style={{ backgroundColor: color.line }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Font Size */}
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600 block mb-2">Font Size</label>
                                        <div className="flex items-center gap-1.5">
                                            {[12, 14, 16, 18, 20].map((sz) => (
                                                <button
                                                    key={sz}
                                                    onClick={() => updateSelectedNodeStyle({ fontSize: sz })}
                                                    className={`flex-1 py-1 text-xs rounded-lg border transition text-center ${
                                                        (selectedNode.data?.fontSize || 14) === sz
                                                            ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                                                            : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {sz}px
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Delete Node */}
                                    {selectedNode.id !== 'root' && (
                                        <div className="pt-2 border-t border-gray-100">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const rawNextNodes = nodes.filter((n) => n.id !== selectedNode.id);
                                                    const rawNextEdges = edges.filter(
                                                        (edge) => edge.source !== selectedNode.id && edge.target !== selectedNode.id
                                                    );
                                                    const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(rawNextNodes, rawNextEdges);
                                                    setNodes(nextNodes);
                                                    setEdges(nextEdges);
                                                    commitHistory(nextNodes, nextEdges);
                                                    showToast('Topik berhasil dihapus.', 'success');
                                                }}
                                                className="w-full py-2 px-3 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Hapus Topik Ini</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* Canvas Background Color */}
                                    <div>
                                        <label className="text-xs font-semibold text-gray-600 block mb-2">Canvas Background</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {canvasBackgrounds.map((bg, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setSettings((s) => ({ ...s, backgroundColor: bg }))}
                                                    className="w-full h-8 rounded-lg border border-gray-200 shadow-2xs hover:scale-105 transition-transform"
                                                    style={{ backgroundColor: bg }}
                                                />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Toggle Minimap / Controls */}
                                    <div className="space-y-3">
                                        <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                                            <span>Show Minimap</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.showMinimap}
                                                onChange={(e) => setSettings((s) => ({ ...s, showMinimap: e.target.checked }))}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                        </label>

                                        <label className="flex items-center justify-between text-xs text-gray-700 cursor-pointer">
                                            <span>Show Controls</span>
                                            <input
                                                type="checkbox"
                                                checked={settings.showControls}
                                                onChange={(e) => setSettings((s) => ({ ...s, showControls: e.target.checked }))}
                                                className="rounded text-blue-600 focus:ring-blue-500"
                                            />
                                        </label>
                                    </div>
                                </>
                            )}
                        </div>
                    </aside>
                )}
            </div>

            {/* Share Modal */}
            <DialogModal
                show={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                title="Share Mindmap"
                content={
                    <div className="space-y-6">
                        {/* Public Link Toggle */}
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900">Public Link Access</h4>
                                <p className="text-xs text-gray-500 mt-0.5">Anyone with the link can access this mindmap.</p>
                            </div>

                            <button
                                onClick={() => {
                                    const next = !isPublic;
                                    setIsPublic(next);
                                    router.put(route('mindmaps.public.update', mindmap.id), {
                                        is_public: next,
                                        public_permission: publicPermission,
                                    }, { preserveScroll: true });
                                }}
                                className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                                    isPublic ? 'bg-blue-600' : 'bg-gray-300'
                                }`}
                            >
                                <div
                                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                                        isPublic ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                />
                            </button>
                        </div>

                        {/* Invite Collaborator by Email */}
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Invite Collaborator</label>
                            <div className="flex gap-2">
                                <TextInput
                                    type="email"
                                    placeholder="colleague@example.com"
                                    value={shareEmail}
                                    onChange={(e) => setShareEmail(e.target.value)}
                                    className="flex-1 text-xs"
                                />
                                <select
                                    value={sharePermission}
                                    onChange={(e) => setSharePermission(e.target.value as any)}
                                    className="border-gray-300 rounded-lg text-xs text-gray-700"
                                >
                                    <option value="view">View</option>
                                    <option value="edit">Edit</option>
                                </select>
                                <PrimaryButton
                                    onClick={() => {
                                        if (!shareEmail) return;
                                        router.post(
                                            route('mindmaps.share.add', mindmap.id),
                                            { email: shareEmail, permission: sharePermission },
                                            {
                                                preserveScroll: true,
                                                onSuccess: () => {
                                                    setShareEmail('');
                                                    showToast('Undangan berhasil dikirim!', 'success');
                                                },
                                            }
                                        );
                                    }}
                                >
                                    Invite
                                </PrimaryButton>
                            </div>
                        </div>

                        {/* Collaborators List */}
                        {mindmap.shares && mindmap.shares.length > 0 && (
                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase">Collaborators</h4>
                                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                                    {mindmap.shares.map((share) => (
                                        <div key={share.id} className="p-2.5 flex items-center justify-between text-xs">
                                            <span className="text-gray-900 font-medium">{share.email}</span>
                                            <div className="flex items-center gap-3">
                                                <span className="text-gray-400 capitalize">{share.permission}</span>
                                                <button
                                                    onClick={() =>
                                                        router.delete(
                                                            route('mindmaps.share.remove', [mindmap.id, share.email]),
                                                            { preserveScroll: true }
                                                        )
                                                    }
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                }
                footer={
                    <SecondaryButton onClick={() => setIsShareModalOpen(false)}>
                        Done
                    </SecondaryButton>
                }
            />

            {/* Video Render Modal */}
            <DialogModal
                show={isVideoRecordModalOpen}
                onClose={() => setIsVideoRecordModalOpen(false)}
                title="Render Mindmap Video"
                content={
                    <div className="space-y-4">
                        <p className="text-xs text-gray-600">
                            Our server will generate a smooth, cinematic camera pan-and-zoom animation video of your mindmap diagram.
                        </p>
                        <div>
                            <label className="text-xs font-semibold text-gray-700 block mb-1">Duration (seconds)</label>
                            <TextInput
                                type="number"
                                min={3}
                                max={30}
                                value={recordDuration}
                                onChange={(e) => setRecordDuration(Number(e.target.value))}
                                className="w-full text-xs"
                            />
                        </div>
                    </div>
                }
                footer={
                    <>
                        <SecondaryButton onClick={() => setIsVideoRecordModalOpen(false)}>
                            Cancel
                        </SecondaryButton>
                        <PrimaryButton onClick={startVideoRender}>
                            Start Render
                        </PrimaryButton>
                    </>
                }
            />
        </div>
    );
}

export default function Edit(props: EditProps) {
    return (
        <ReactFlowProvider>
            <MindmapCanvas {...props} />
        </ReactFlowProvider>
    );
}
