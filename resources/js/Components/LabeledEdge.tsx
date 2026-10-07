import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    EdgeProps,
    EdgeLabelRenderer,
    getBezierPath,
    getSmoothStepPath,
    getStraightPath,
    useReactFlow,
} from '@xyflow/react';

export default function LabeledEdge(props: EdgeProps) {
    const {
        id,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        data,
        markerEnd,
        markerStart,
        style = {},
        animated,
    } = props;

    const { setEdges } = useReactFlow();
    const edgePathRef = useRef<SVGPathElement>(null);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [labelInput, setLabelInput] = useState('');
    const [labelPositions, setLabelPositions] = useState<Record<string, { x: number; y: number; angle: number }>>({});
    const inputRef = useRef<HTMLInputElement>(null);

    const edgeLabels = useMemo(() => {
        let labels: any[] = [];
        if (data?.labels && Array.isArray(data.labels)) {
            labels = data.labels as any[];
        } else if (data?.label) {
            labels = [{ id: 'default', text: data.label as string, progress: 0.5 }];
        }
        return labels;
    }, [data?.labels, data?.label]);

    const pathData = useMemo(() => {
        const params = {
            sourceX,
            sourceY,
            targetX,
            targetY,
            sourcePosition,
            targetPosition,
            borderRadius: 20,
        };

        const edgeType = (data?.type as string) || props.type || 'bezier';

        if (edgeType === 'bezier') {
            const dx = Math.abs(targetX - sourceX);
            if (sourcePosition === 'left' || sourcePosition === 'right') {
                const isLeft = sourcePosition === 'left';
                const c1x = isLeft ? sourceX - dx * 0.5 : sourceX + dx * 0.5;
                const c2x = isLeft ? targetX + dx * 0.5 : targetX - dx * 0.5;
                const pathStr = `M ${sourceX} ${sourceY} C ${c1x} ${sourceY}, ${c2x} ${targetY}, ${targetX} ${targetY}`;
                return {
                    path: pathStr,
                    labelX: (sourceX + targetX) / 2,
                    labelY: (sourceY + targetY) / 2,
                };
            }
            const [path, labelX, labelY] = getBezierPath({ ...params, curvature: 0.45 });
            return { path, labelX, labelY };
        } else if (edgeType === 'straight') {
            const [path, labelX, labelY] = getStraightPath(params);
            return { path, labelX, labelY };
        } else if (edgeType === 'step') {
            const [path, labelX, labelY] = getSmoothStepPath({ ...params, borderRadius: 0 });
            return { path, labelX, labelY };
        } else {
            const [path, labelX, labelY] = getSmoothStepPath(params);
            return { path, labelX, labelY };
        }
    }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data?.type, props.type]);

    const calculatePositions = () => {
        if (!edgePathRef.current) return;
        const len = edgePathRef.current.getTotalLength();
        if (len === 0) return;

        const newPositions: Record<string, { x: number; y: number; angle: number }> = {};
        edgeLabels.forEach((label) => {
            let p = label.progress ?? 0.5;
            p = Math.max(0, Math.min(1, p));

            try {
                const pLength = p * len;
                const pt = edgePathRef.current!.getPointAtLength(pLength);

                const step = 2;
                let pt1 = pt;
                let pt2 = pt;
                if (pLength + step <= len) {
                    pt2 = edgePathRef.current!.getPointAtLength(pLength + step);
                } else if (pLength - step >= 0) {
                    pt1 = edgePathRef.current!.getPointAtLength(pLength - step);
                }

                let angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * (180 / Math.PI);
                if (angle > 90 || angle < -90) {
                    angle += 180;
                }

                newPositions[label.id] = { x: pt.x, y: pt.y, angle };
            } catch {
                newPositions[label.id] = { x: 0, y: 0, angle: 0 };
            }
        });
        setLabelPositions(newPositions);
    };

    useEffect(() => {
        calculatePositions();
    }, [pathData.path, edgeLabels]);

    const updateEdgeData = (mutator: (edgeData: any) => void) => {
        setEdges((eds) =>
            eds.map((e) => {
                if (e.id === id) {
                    const currentData = { ...(e.data || {}) };
                    mutator(currentData);
                    return { ...e, data: currentData };
                }
                return e;
            })
        );
        window.dispatchEvent(new CustomEvent('mindmap-edge-mutated'));
    };

    const startEditing = (label: any) => {
        setEditingId(label.id);
        setLabelInput(label.text || '');
        setTimeout(() => {
            inputRef.current?.focus();
            inputRef.current?.select();
        }, 50);
    };

    const stopEditing = (labelId: string) => {
        if (editingId === labelId) {
            setEditingId(null);
            updateEdgeData((d) => {
                if (!d.labels) d.labels = [...edgeLabels];
                const target = d.labels.find((l: any) => l.id === labelId);
                if (target) {
                    target.text = labelInput.trim();
                }
            });
        }
    };

    const getClosestProgress = (clientX: number, clientY: number) => {
        if (!edgePathRef.current) return 0.5;
        const pathEl = edgePathRef.current;
        const svg = pathEl.ownerSVGElement;
        if (!svg) return 0.5;

        const pt = svg.createSVGPoint();
        pt.x = clientX;
        pt.y = clientY;
        const ctm = pathEl.getScreenCTM();
        if (!ctm) return 0.5;

        const svgP = pt.matrixTransform(ctm.inverse());
        const len = pathEl.getTotalLength();
        if (len === 0) return 0.5;

        let minD = Infinity;
        let bestT = 0.5;
        const samples = 80;

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            try {
                const p = pathEl.getPointAtLength(t * len);
                const dx = p.x - svgP.x;
                const dy = p.y - svgP.y;
                const d = dx * dx + dy * dy;
                if (d < minD) {
                    minD = d;
                    bestT = t;
                }
            } catch {}
        }
        return bestT;
    };

    const startDrag = (e: React.MouseEvent, label: any) => {
        if (editingId === label.id) return;
        e.stopPropagation();
        setDraggingId(label.id);

        const onDrag = (moveEvt: MouseEvent) => {
            const progress = getClosestProgress(moveEvt.clientX, moveEvt.clientY);
            updateEdgeData((d) => {
                if (!d.labels) d.labels = [...edgeLabels];
                const target = d.labels.find((l: any) => l.id === label.id);
                if (target) {
                    target.progress = progress;
                }
            });
        };

        const stopDrag = () => {
            setDraggingId(null);
            window.removeEventListener('mousemove', onDrag);
            window.removeEventListener('mouseup', stopDrag);
        };

        window.addEventListener('mousemove', onDrag);
        window.addEventListener('mouseup', stopDrag);
    };

    const getLabelRotation = (label: any) => {
        const rotationPref = label.rotation || 'horizontal';
        return rotationPref === 'follow' ? labelPositions[label.id]?.angle || 0 : 0;
    };

    return (
        <>
            {/* Base SVG Path */}
            <path
                id={`edge-path-${id}`}
                ref={edgePathRef}
                d={pathData.path}
                style={{ ...style, strokeWidth: Number(style?.strokeWidth || 2) }}
                markerEnd={markerEnd}
                markerStart={markerStart}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className={`react-flow__edge-path base-edge ${data?.pattern === 'dotted' ? 'dotted-pattern' : ''}`}
            />

            {/* Edge Labels */}
            <EdgeLabelRenderer>
                {edgeLabels.map((label) => {
                    const pos = labelPositions[label.id] || { x: pathData.labelX, y: pathData.labelY, angle: 0 };
                    const isEditing = editingId === label.id;
                    const isSelected = data?.selectedLabelId === label.id;

                    return (
                        <div
                            key={label.id}
                            className="nodrag nopan"
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%) rotate(${getLabelRotation(label)}deg)`,
                                pointerEvents: 'all',
                                cursor: draggingId === label.id ? 'grabbing' : 'grab',
                                zIndex: isSelected ? 100 : 50,
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                startEditing(label);
                            }}
                            onMouseDown={(e) => startDrag(e, label)}
                        >
                            {isEditing ? (
                                <input
                                    ref={inputRef}
                                    value={labelInput}
                                    onChange={(e) => setLabelInput(e.target.value)}
                                    onBlur={() => stopEditing(label.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === 'Escape') {
                                            stopEditing(label.id);
                                        }
                                    }}
                                    className="px-2 py-1 bg-white border border-blue-500 rounded text-sm text-center shadow-lg focus:outline-none ring-2 ring-blue-300"
                                    style={{ minWidth: 80 }}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                />
                            ) : (
                                label.text && (
                                    <div
                                        className={`relative px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all select-none rounded-md bg-white border border-gray-200 shadow-xs hover:border-gray-300 ${
                                            isSelected ? 'ring-2 ring-blue-500' : ''
                                        }`}
                                        style={{
                                            color: label.color || '#374151',
                                            backgroundColor: label.bgColor || '#ffffff',
                                            fontSize: `${label.fontSize || 13}px`,
                                        }}
                                    >
                                        {label.text}
                                    </div>
                                )
                            )}
                        </div>
                    );
                })}
            </EdgeLabelRenderer>
        </>
    );
}
