import React, { useEffect, useRef, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow, Node, Edge } from '@xyflow/react';
import { Plus } from 'lucide-react';
import { layoutMindmap } from '../Utils/mindmapLayout';

export default function MindmapNode({
    id,
    data,
    selected,
}: NodeProps) {
    const { setNodes, setEdges, getEdges, getNodes } = useReactFlow();
    const [isEditing, setIsEditing] = useState(Boolean(data?.isNew));
    const [localLabel, setLocalLabel] = useState((data?.label as string) ?? '');
    const inputRef = useRef<HTMLInputElement>(null);

    const isRoot = id === 'root' || Boolean(data?.isRoot) || data?.level === 0;
    const isLevel1 = data?.level === 1;
    const isLevel2 = data?.level === 2;
    const isLevel3Plus = !isRoot && !isLevel1 && !isLevel2;
    const canEdit = data?.canEdit !== false;
    const branchColor = (data?.branchColor as string) || '#ff6b4a';
    const isLeft = data?.branchDirection === 'left';

    const hexToRgba = (hex: string, alpha: number): string => {
        const cleanHex = (hex || '#ff6b4a').replace('#', '');
        let fullHex = cleanHex;
        if (cleanHex.length === 3) {
            fullHex = cleanHex.split('').map((c) => c + c).join('');
        }
        const num = parseInt(fullHex, 16) || 0;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    useEffect(() => {
        setLocalLabel((data?.label as string) ?? '');
    }, [data?.label]);

    useEffect(() => {
        if (data?.isNew) {
            setIsEditing(true);
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const len = inputRef.current.value.length;
                    inputRef.current.setSelectionRange(len, len);
                }
            }, 30);
        }
    }, [data?.isNew]);

    useEffect(() => {
        if (!selected && isEditing) {
            setIsEditing(false);
            commitChange(localLabel);
        }
    }, [selected]);

    const commitChange = (newText: string) => {
        const currentNodes = getNodes();
        const currentEdges = getEdges();
        
        const updatedNodes = currentNodes.map((n) => {
            if (n.id === id) {
                return { ...n, data: { ...n.data, label: newText, isNew: false } };
            }
            return n;
        });

        const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(updatedNodes, currentEdges);
        setNodes(nextNodes);
        setEdges(nextEdges);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (canEdit) {
            setIsEditing(true);
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    const len = inputRef.current.value.length;
                    inputRef.current.setSelectionRange(len, len);
                }
            }, 10);
        }
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalLabel(e.target.value);
    };

    const handleBlur = () => {
        setIsEditing(false);
        commitChange(localLabel);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!canEdit) return;

        if (e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            commitChange(localLabel);
            setIsEditing(false);
            addChild(isLeft ? 'left' : 'right');
        } else if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commitChange(localLabel);
            setIsEditing(false);
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setLocalLabel((data?.label as string) ?? '');
            setIsEditing(false);
            inputRef.current?.blur();
        }
    };

    const addChild = (dir?: 'left' | 'right') => {
        if (!canEdit) return;
        const newId = `node-${Date.now()}`;
        const currentEdges = getEdges();
        const currentNodes = getNodes();

        let branchDir: 'left' | 'right' | undefined = undefined;
        if (isRoot) {
            branchDir = dir;
        } else {
            branchDir = isLeft ? 'left' : 'right';
        }

        const newEdge: Edge = {
            id: `e-${id}-${newId}`,
            source: id,
            target: newId,
            type: 'brace',
        };
        const rawEdges = [...currentEdges, newEdge];

        const newNode: Node = {
            id: newId,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
                label: '',
                branchDirection: branchDir,
                isNew: true,
                canEdit: true,
            },
        };
        const unselectedNodes = currentNodes.map((n) => ({ ...n, selected: false }));
        const rawNextNodes = [...unselectedNodes, { ...newNode, selected: true }];

        const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(rawNextNodes, rawEdges);
        setNodes(nextNodes);
        setEdges(nextEdges);
    };

    const addSibling = () => {
        if (!canEdit || isRoot) return;
        const currentEdges = getEdges();
        const currentNodes = getNodes();

        const incomingEdge = currentEdges.find((e) => e.target === id);
        const parentId = incomingEdge ? incomingEdge.source : 'root';
        const isParentRoot = parentId === 'root' || Boolean(currentNodes.find((n) => n.id === parentId)?.data?.isRoot);

        const newId = `node-${Date.now()}`;

        const newEdge: Edge = {
            id: `e-${parentId}-${newId}`,
            source: parentId,
            target: newId,
            type: 'brace',
        };
        const rawEdges = [...currentEdges, newEdge];

        const newNode: Node = {
            id: newId,
            type: 'custom',
            position: { x: 0, y: 0 },
            data: {
                label: '',
                branchDirection: isParentRoot ? undefined : (isLeft ? 'left' : 'right'),
                isNew: true,
                canEdit: true,
            },
        };
        const unselectedNodes = currentNodes.map((n) => ({ ...n, selected: false }));
        const rawNextNodes = [...unselectedNodes, { ...newNode, selected: true }];

        const { nodes: nextNodes, edges: nextEdges } = layoutMindmap(rawNextNodes, rawEdges);
        setNodes(nextNodes);
        setEdges(nextEdges);
    };

    let cardClass = '';
    let cardStyle: React.CSSProperties = {};
    let textStyle: React.CSSProperties = {};
    let placeholderText = '';

    let cardPositionClass = 'w-full h-full';
    if (isEditing) {
        if (isRoot) {
            cardPositionClass = 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 min-w-full w-max h-full z-50 shadow-md';
        } else if (isLeft) {
            cardPositionClass = 'absolute right-0 top-0 min-w-full w-max h-full z-50 shadow-sm';
        } else {
            cardPositionClass = 'absolute left-0 top-0 min-w-full w-max h-full z-50 shadow-sm';
        }
    }

    if (isRoot) {
        cardClass = `${cardPositionClass} px-3 flex items-center justify-center transition-all ${
            isEditing ? 'cursor-text' : 'cursor-pointer'
        } ${
            selected || isEditing
                ? 'bg-white border-2 border-blue-500 rounded-xl ring-2 ring-blue-500/20 shadow-xs'
                : 'bg-transparent border-2 border-transparent rounded-xl hover:bg-white/80 hover:border-blue-400 hover:ring-2 hover:ring-blue-400/20'
        }`;
        cardStyle = {
            backgroundColor: selected || isEditing ? '#ffffff' : (data?.bgColor as string) || 'transparent',
        };
        textStyle = {
            color: (data?.textColor as string) || '#0f172a',
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.3px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            textAlign: 'center',
        };
        placeholderText = 'Central Topic';
    } else if (isLevel1) {
        cardClass = `${cardPositionClass} px-3 rounded-lg flex items-center justify-center transition-all shadow-2xs ${
            isEditing ? 'cursor-text' : 'cursor-pointer'
        } ${
            selected || isEditing
                ? 'ring-2 ring-offset-1 ring-blue-500 shadow-sm'
                : 'hover:ring-2 hover:ring-offset-1 hover:ring-blue-500/70'
        }`;
        cardStyle = {
            backgroundColor: (data?.bgColor as string) || branchColor,
        };
        textStyle = {
            color: '#ffffff',
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.25,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            textAlign: 'center',
        };
        placeholderText = 'Main Topic';
    } else if (isLevel2) {
        // Level 2 Subtopic: Soft Tint Pill Badge
        cardClass = `${cardPositionClass} px-2 py-0.5 rounded-md flex items-center justify-center transition-all ${
            isEditing ? 'cursor-text' : 'cursor-pointer'
        } ${
            selected || isEditing
                ? 'bg-white ring-2 ring-blue-500 shadow-2xs'
                : 'hover:ring-1.5 hover:ring-blue-400'
        }`;
        cardStyle = {
            backgroundColor: selected || isEditing ? '#ffffff' : hexToRgba(branchColor, 0.12),
            border: selected || isEditing ? '1.5px solid #3b82f6' : '1px solid ' + hexToRgba(branchColor, 0.28),
        };
        textStyle = {
            color: '#1e293b',
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.25,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            textAlign: 'center',
        };
        placeholderText = 'Subtopic';
    } else {
        // Level 3+ Sub-subtopics: Clean Plain Text (No Underline)
        cardClass = `${cardPositionClass} px-1.5 flex items-center ${isLeft ? 'justify-end text-right' : 'justify-start text-left'} transition-all ${
            isEditing ? 'cursor-text' : 'cursor-pointer'
        } ${
            selected || isEditing
                ? 'bg-white border-2 border-blue-500 rounded-md ring-2 ring-blue-500/20'
                : 'bg-transparent border-2 border-transparent rounded-md hover:bg-white hover:border-blue-400 hover:ring-2 hover:ring-blue-400/20'
        }`;
        cardStyle = {
            backgroundColor: selected || isEditing ? '#ffffff' : 'transparent',
        };
        textStyle = {
            color: '#1e293b',
            fontSize: '13px',
            fontWeight: 500,
            lineHeight: 1.25,
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            textAlign: isLeft ? 'right' : 'left',
        };
        placeholderText = 'Subtopic';
    }

    return (
        <div
            id={`node-wrapper-${id}`}
            className="w-full h-full flex items-center justify-center relative cursor-pointer group"
            onDoubleClick={handleDoubleClick}
        >
            <div
                className={cardClass}
                style={cardStyle}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={isEditing ? localLabel : ((data?.label as string) || '')}
                    readOnly={!isEditing}
                    onChange={handleTextChange}
                    onKeyDown={handleKeyDown}
                    onBlur={handleBlur}
                    style={{
                        ...textStyle,
                        cursor: isEditing ? 'text' : 'pointer',
                        pointerEvents: isEditing ? 'auto' : 'none',
                        userSelect: isEditing ? 'auto' : 'none',
                        width: isEditing ? `${Math.max(2, (localLabel || placeholderText).length + 2)}ch` : '100%',
                        minWidth: '100%',
                    }}
                    className="nodrag nopan bg-transparent outline-none border-none p-0 m-0 whitespace-nowrap cursor-pointer"
                    placeholder={placeholderText}
                />
            </div>

            {/* Interactive Plus (+) Buttons when Node is Selected */}
            {selected && !isEditing && canEdit && (
                <>
                    {isRoot ? (
                        <>
                            {/* Root: Left Plus button */}
                            <button
                                type="button"
                                className="nodrag nopan absolute top-1/2 -translate-y-1/2 -left-6 w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-110 z-30"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addChild('left');
                                }}
                                title="Tambah Topik Kiri"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* Root: Right Plus button */}
                            <button
                                type="button"
                                className="nodrag nopan absolute top-1/2 -translate-y-1/2 -right-6 w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-110 z-30"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addChild('right');
                                }}
                                title="Tambah Topik Kanan"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </>
                    ) : (
                        <>
                            {/* Child Subtopic Button (Right or Left side) */}
                            <button
                                type="button"
                                className={`nodrag nopan absolute top-1/2 -translate-y-1/2 ${
                                    isLeft ? '-left-6' : '-right-6'
                                } w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-110 z-30`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addChild(isLeft ? 'left' : 'right');
                                }}
                                title="Tambah Subtopik (Tab)"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* Sibling Topic Button (Bottom side) */}
                            <button
                                type="button"
                                className="nodrag nopan absolute -bottom-6 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-transform hover:scale-110 z-30"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    addSibling();
                                }}
                                title="Tambah Topik Sejajar (Enter)"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                        </>
                    )}
                </>
            )}

            {/* Connection Handles anchored to exact vertical center */}
            <Handle
                type="target"
                position={Position.Left}
                id="target-left"
                style={{ top: '50%', transform: 'translateY(-50%)', opacity: 0, width: 2, height: 2, pointerEvents: 'none', border: 'none', background: 'transparent' }}
            />
            <Handle
                type="target"
                position={Position.Right}
                id="target-right"
                style={{ top: '50%', transform: 'translateY(-50%)', opacity: 0, width: 2, height: 2, pointerEvents: 'none', border: 'none', background: 'transparent' }}
            />
            <Handle
                type="source"
                position={Position.Left}
                id="source-left"
                style={{ top: '50%', transform: 'translateY(-50%)', opacity: 0, width: 2, height: 2, pointerEvents: 'none', border: 'none', background: 'transparent' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="source-right"
                style={{ top: '50%', transform: 'translateY(-50%)', opacity: 0, width: 2, height: 2, pointerEvents: 'none', border: 'none', background: 'transparent' }}
            />
        </div>
    );
}
