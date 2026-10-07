import { Node, Edge } from '@xyflow/react';

export const XMIND_BRANCH_COLORS = [
    '#ff6b4a', // 1. Warm Coral Red
    '#f78e1e', // 2. Vibrant Tangerine Orange
    '#10b981', // 3. Emerald Green
    '#06b6d4', // 4. Cyan / Ocean Blue
    '#3b82f6', // 5. Sky Blue / Cobalt
    '#a855f7', // 6. Vibrant Purple / Orchid
    '#ec4899', // 7. Rose Pink / Magenta
    '#eab308', // 8. Golden Amber
];

// Canvas measurement helper for exact text widths
let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function measureText(text: string, font: string, fallbackCharWidth: number): number {
    if (typeof document !== 'undefined') {
        if (!measureCanvas) {
            measureCanvas = document.createElement('canvas');
            measureCtx = measureCanvas.getContext('2d');
        }
        if (measureCtx) {
            measureCtx.font = font;
            return Math.ceil(measureCtx.measureText(text || ' ').width);
        }
    }
    return Math.ceil((text || ' ').length * fallbackCharWidth);
}

export function layoutMindmap(
    rawNodes: Node[],
    rawEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
    if (!rawNodes || rawNodes.length === 0) return { nodes: rawNodes, edges: rawEdges };

    const root = rawNodes.find((n) => n.id === 'root' || n.data?.isRoot) || rawNodes[0];
    const rootId = root.id;

    // Build tree adjacency list: parent -> children
    const initialChildrenMap = new Map<string, string[]>();
    rawNodes.forEach((n) => initialChildrenMap.set(n.id, []));

    rawEdges.forEach((e) => {
        if (initialChildrenMap.has(e.source)) {
            const list = initialChildrenMap.get(e.source)!;
            if (!list.includes(e.target)) {
                list.push(e.target);
            }
        }
    });

    // Prune any disconnected / orphan subtrees not reachable from root
    const reachableNodes = new Set<string>([rootId]);
    const queue = [rootId];
    while (queue.length > 0) {
        const current = queue.shift()!;
        const children = initialChildrenMap.get(current) || [];
        children.forEach((cId) => {
            if (!reachableNodes.has(cId)) {
                reachableNodes.add(cId);
                queue.push(cId);
            }
        });
    }

    const nodes = rawNodes.filter((n) => reachableNodes.has(n.id));
    const edges = rawEdges.filter((e) => reachableNodes.has(e.source) && reachableNodes.has(e.target));

    const childrenMap = new Map<string, string[]>();
    nodes.forEach((n) => childrenMap.set(n.id, []));

    edges.forEach((e) => {
        if (childrenMap.has(e.source)) {
            const list = childrenMap.get(e.source)!;
            if (!list.includes(e.target)) {
                list.push(e.target);
            }
        }
    });

    // Snug node dimensions matching exact text boundaries with comfortable padding
    const getNodeDim = (nodeId: string, level: number) => {
        const n = nodes.find((item) => item.id === nodeId);
        const label = (n?.data?.label as string) || '';

        if (nodeId === rootId || level === 0) {
            const textW = measureText(label || 'Central Topic', 'bold 22px Inter, -apple-system, sans-serif', 14);
            return { width: Math.max(110, textW + 32), height: 42 };
        }
        if (level === 1) {
            const textW = measureText(label || 'Main Topic', '600 14px Inter, -apple-system, sans-serif', 10);
            return { width: Math.max(70, textW + 28), height: 34 };
        }
        if (level === 2) {
            // Level 2 Subtopic: Soft Tint Pill Badge
            const textW = measureText(label || 'Subtopic', '500 13px Inter, -apple-system, sans-serif', 9);
            return { width: Math.max(50, textW + 24), height: 28 };
        }
        // Level 3+ Subtopics: Clean Plain Text
        const textW = measureText(label || 'Subtopic', '500 13px Inter, -apple-system, sans-serif', 9);
        return { width: Math.max(36, textW + 18), height: 24 };
    };

    const H_GAP_ROOT = 55;  // Organic sweeping horizontal gap from Central Topic to Main Topics
    const H_GAP_SUB = 18;   // Compact snug horizontal gap for subtopic tree brackets
    const V_GAP_MAIN = 32;  // Comfortable vertical gap between different Main Topic clusters
    const V_GAP_SUB = 8;    // Compact vertical gap between sibling subtopics within the same branch

    const rootChildren = childrenMap.get(rootId) || [];

    // Calculate preliminary node dimensions with accurate levels
    const nodeWidths = new Map<string, number>();
    const nodeHeights = new Map<string, number>();
    nodes.forEach((n) => {
        const isRootNode = n.id === rootId;
        const isLevel1Node = rootChildren.includes(n.id);
        const dim = getNodeDim(n.id, isRootNode ? 0 : isLevel1Node ? 1 : 2);
        nodeWidths.set(n.id, dim.width);
        nodeHeights.set(n.id, dim.height);
    });

    // Subtree height calculation helper
    const calcRawSubtreeHeight = (nodeId: string): number => {
        const children = childrenMap.get(nodeId) || [];
        const selfH = nodeHeights.get(nodeId) || 26;
        if (children.length === 0) return selfH;
        let total = 0;
        children.forEach((cId) => {
            total += calcRawSubtreeHeight(cId);
        });
        total += (children.length - 1) * V_GAP_SUB;
        return Math.max(selfH, total);
    };

    // Separate Root's children into Left and Right branches dynamically based on space & subtree load
    const leftChildren: string[] = [];
    const rightChildren: string[] = [];

    let leftSubtreeTotalH = 0;
    let rightSubtreeTotalH = 0;

    const nodeLevelMap = new Map<string, number>();
    const nodeBranchColorMap = new Map<string, string>();
    const branchDirMap = new Map<string, 'left' | 'right'>();

    nodeLevelMap.set(rootId, 0);

    rootChildren.forEach((childId, idx) => {
        const childNode = nodes.find((n) => n.id === childId);
        const childSubH = calcRawSubtreeHeight(childId);
        
        let dir: 'left' | 'right';
        if (childNode?.data?.isManualDirection && childNode?.data?.branchDirection) {
            dir = childNode.data.branchDirection as 'left' | 'right';
        } else {
            // Dynamic auto-balance:
            // 1. If left side has strictly less height/load -> go Left
            // 2. If right side has strictly less height/load -> go Right
            // 3. If equal -> alternate (0 -> right, 1 -> left, 2 -> right, 3 -> left...)
            if (leftSubtreeTotalH < rightSubtreeTotalH) {
                dir = 'left';
            } else if (rightSubtreeTotalH < leftSubtreeTotalH) {
                dir = 'right';
            } else {
                dir = idx % 2 === 0 ? 'right' : 'left';
            }
        }

        if (dir === 'left') {
            leftChildren.push(childId);
            leftSubtreeTotalH += childSubH + V_GAP_MAIN;
        } else {
            rightChildren.push(childId);
            rightSubtreeTotalH += childSubH + V_GAP_MAIN;
        }

        // Each Main Topic gets a distinct theme color
        const color = XMIND_BRANCH_COLORS[idx % XMIND_BRANCH_COLORS.length];

        const assignDescendants = (cId: string, lvl: number, clr: string) => {
            nodeLevelMap.set(cId, lvl);
            nodeBranchColorMap.set(cId, clr);
            branchDirMap.set(cId, dir);
            const subs = childrenMap.get(cId) || [];
            subs.forEach((subId) => assignDescendants(subId, lvl + 1, clr));
        };

        assignDescendants(childId, 1, color);
    });

    // Re-verify exact node dimensions with accurate levels
    nodes.forEach((n) => {
        const lvl = nodeLevelMap.get(n.id) || 0;
        const dim = getNodeDim(n.id, lvl);
        nodeWidths.set(n.id, dim.width);
        nodeHeights.set(n.id, dim.height);
    });

    // Recursive calculation of subtree heights for final placement
    const subtreeHeightMap = new Map<string, number>();
    const calcSubtreeHeight = (nodeId: string): number => {
        const children = childrenMap.get(nodeId) || [];
        const selfH = nodeHeights.get(nodeId) || 26;
        if (children.length === 0) {
            subtreeHeightMap.set(nodeId, selfH);
            return selfH;
        }
        let totalChildH = 0;
        children.forEach((cId) => {
            totalChildH += calcSubtreeHeight(cId);
        });
        totalChildH += (children.length - 1) * V_GAP_SUB;
        const finalH = Math.max(selfH, totalChildH);
        subtreeHeightMap.set(nodeId, finalH);
        return finalH;
    };

    leftChildren.forEach((cId) => calcSubtreeHeight(cId));
    rightChildren.forEach((cId) => calcSubtreeHeight(cId));

    const positions = new Map<string, { x: number; y: number }>();
    const rootW = nodeWidths.get(rootId) || 100;
    const rootH = nodeHeights.get(rootId) || 40;
    const rootX = 500;
    const rootY = 350;

    positions.set(rootId, { x: rootX, y: rootY });

    // Recursive placement of child nodes
    const layoutSubtree = (
        parentId: string,
        parentX: number,
        parentCenterY: number,
        isLeft: boolean,
        childrenList?: string[]
    ) => {
        const children = childrenList || childrenMap.get(parentId) || [];
        if (!children.length) return;

        const isParentRoot = parentId === rootId;
        const hGap = isParentRoot ? H_GAP_ROOT : H_GAP_SUB;
        const vGap = isParentRoot ? V_GAP_MAIN : V_GAP_SUB;

        let totalChildrenH = 0;
        children.forEach((cId) => {
            totalChildrenH += subtreeHeightMap.get(cId) || nodeHeights.get(cId) || 26;
        });
        totalChildrenH += (children.length - 1) * vGap;

        let currentY = parentCenterY - totalChildrenH / 2;

        children.forEach((cId) => {
            const childSubH = subtreeHeightMap.get(cId) || nodeHeights.get(cId) || 26;
            const childH = nodeHeights.get(cId) || 26;
            const childW = nodeWidths.get(cId) || 60;
            const parentW = nodeWidths.get(parentId) || 80;

            const childCenterY = currentY + childSubH / 2;
            const childY = childCenterY - childH / 2;
            const childX = isLeft
                ? parentX - hGap - childW
                : parentX + parentW + hGap;

            positions.set(cId, { x: childX, y: childY });

            // Layout subsequent children
            layoutSubtree(cId, childX, childCenterY, isLeft);

            currentY += childSubH + vGap;
        });
    };

    // Layout left side
    layoutSubtree(rootId, rootX, rootY + rootH / 2, true, leftChildren);

    // Layout right side
    layoutSubtree(rootId, rootX, rootY + rootH / 2, false, rightChildren);

    const nextNodes = nodes.map((node) => {
        const pos = positions.get(node.id);
        const dir = branchDirMap.get(node.id) || (node.data?.branchDirection as 'left' | 'right') || 'right';
        const lvl = nodeLevelMap.get(node.id) ?? (node.id === rootId ? 0 : 2);
        const branchColor = nodeBranchColorMap.get(node.id) || XMIND_BRANCH_COLORS[0];
        const w = nodeWidths.get(node.id) || (lvl === 0 ? 110 : lvl === 1 ? 70 : lvl === 2 ? 50 : 36);
        const h = nodeHeights.get(node.id) || (lvl === 0 ? 42 : lvl === 1 ? 34 : lvl === 2 ? 28 : 24);

        return {
            ...node,
            draggable: false,
            position: pos || node.position,
            style: {
                width: w,
                height: h,
            },
            data: {
                ...node.data,
                level: lvl,
                branchColor,
                branchDirection: node.id === rootId ? undefined : dir,
                width: w,
                height: h,
            },
        };
    });

    const nextEdges = edges.map((edge) => {
        const targetNode = nextNodes.find((n) => n.id === edge.target);
        const isLeft = targetNode?.data?.branchDirection === 'left';
        const branchColor = (targetNode?.data?.branchColor as string) || '#fa8c16';
        const isRootEdge = edge.source === rootId || edge.source === 'root';

        return {
            ...edge,
            type: 'brace',
            sourceHandle: isLeft ? 'source-left' : 'source-right',
            targetHandle: isLeft ? 'target-right' : 'target-left',
            style: {
                stroke: branchColor,
                strokeWidth: isRootEdge ? 2.5 : 2,
            },
        };
    });

    return { nodes: nextNodes, edges: nextEdges };
}
