import React from 'react';
import { BaseEdge, EdgeProps } from '@xyflow/react';

export default function BraceEdge({
    id,
    source,
    sourceX,
    sourceY,
    targetX,
    targetY,
    style = {},
    markerEnd,
    markerStart,
    animated,
}: EdgeProps) {
    const isRootEdge = source === 'root' || id.startsWith('e-root-');
    const isRightBranch = targetX >= sourceX;
    const dx = targetX - sourceX;
    const dy = targetY - sourceY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let path = '';

    if (absDy < 1.5) {
        // Direct straight horizontal line
        path = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    } else if (isRootEdge) {
        // Organic sweeping cubic bezier from Central Topic to Main Topics (Xmind style)
        const cp1X = sourceX + dx * 0.45;
        const cp1Y = sourceY;
        const cp2X = sourceX + dx * 0.55;
        const cp2Y = targetY;
        path = `M ${sourceX} ${sourceY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;
    } else {
        // Smooth Fillet Tree Bracket Fork for Subtopics
        const forkOffset = Math.min(10, Math.max(6, absDx * 0.4));
        const forkX = isRightBranch ? sourceX + forkOffset : sourceX - forkOffset;
        const dirX = isRightBranch ? 1 : -1;
        const dirY = dy > 0 ? 1 : -1;

        const maxR = Math.min(5, forkOffset, absDy / 2, Math.max(0, absDx - forkOffset) / 2);
        const r = Math.max(0, maxR);

        if (r <= 1) {
            path = `M ${sourceX} ${sourceY} L ${forkX} ${sourceY} L ${forkX} ${targetY} L ${targetX} ${targetY}`;
        } else {
            path = [
                `M ${sourceX} ${sourceY}`,
                `L ${forkX - dirX * r} ${sourceY}`,
                `Q ${forkX} ${sourceY} ${forkX} ${sourceY + dirY * r}`,
                `L ${forkX} ${targetY - dirY * r}`,
                `Q ${forkX} ${targetY} ${forkX + dirX * r} ${targetY}`,
                `L ${targetX} ${targetY}`,
            ].join(' ');
        }
    }

    const mergedStyle: React.CSSProperties = {
        strokeWidth: isRootEdge ? 2.5 : 2,
        ...style,
        stroke: style.stroke || '#fa8c16',
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
    };

    return (
        <BaseEdge
            id={id}
            path={path}
            style={mergedStyle}
            markerEnd={markerEnd}
            markerStart={markerStart}
            className={animated ? 'animated' : ''}
        />
    );
}
