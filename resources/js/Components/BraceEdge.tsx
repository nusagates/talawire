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
        // Compact organic S-curve
        const cp1X = sourceX + (isRightBranch ? Math.min(18, absDx * 0.4) : -Math.min(18, absDx * 0.4));
        const cp2X = targetX - (isRightBranch ? Math.min(20, absDx * 0.45) : -Math.min(20, absDx * 0.45));
        path = `M ${sourceX} ${sourceY} C ${cp1X} ${sourceY}, ${cp2X} ${targetY}, ${targetX} ${targetY}`;
    } else {
        // Compact Tree Bracket Fork for Subtopics
        const forkOffset = Math.min(8, Math.max(5, absDx * 0.35));
        const forkX = isRightBranch ? sourceX + forkOffset : sourceX - forkOffset;
        const dirX = isRightBranch ? 1 : -1;
        const dirY = dy > 0 ? 1 : -1;

        const maxR = Math.min(4, forkOffset, absDy / 2, (absDx - forkOffset) / 2);
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
