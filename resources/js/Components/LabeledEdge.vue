<script setup>
import { ref, computed, nextTick, watch } from 'vue';
import { EdgeLabelRenderer, getBezierPath, getSmoothStepPath, getStraightPath, useVueFlow } from '@vue-flow/core';

defineOptions({ inheritAttrs: false });

const props = defineProps({
    id: { type: String, required: true },
    sourceX: { type: Number, required: true },
    sourceY: { type: Number, required: true },
    targetX: { type: Number, required: true },
    targetY: { type: Number, required: true },
    sourcePosition: { type: String, required: true },
    targetPosition: { type: String, required: true },
    data: { type: Object, required: false },
    markerEnd: { type: String, required: false },
    markerStart: { type: String, required: false },
    style: { type: Object, required: false },
    animated: { type: Boolean, required: false },
});

const { viewport, findEdge, project } = useVueFlow();

const updateEdgeData = (mutator) => {
    const edge = findEdge(props.id);
    if (!edge) return;
    if (!edge.data || Array.isArray(edge.data)) {
        edge.data = { ...edge.data };
    }
    mutator(edge.data);
    
    // Dispatch global event to notify Edit.vue to commit history and save
    window.dispatchEvent(new CustomEvent('mindmap-edge-mutated'));
};

const editingId = ref(null);
const draggingId = ref(null);
const labelInput = ref('');

// Real-time text sync so Ctrl+S works even without blurring
watch(labelInput, (newVal) => {
    if (editingId.value) {
        updateEdgeData(data => {
            if (!data.labels) return;
            const targetLabel = data.labels.find(l => l.id === editingId.value);
            if (targetLabel) {
                targetLabel.text = newVal.trim();
            }
        });
    }
});
const inputRefs = ref({});
const edgePathRef = ref(null);
const labelPositions = ref({});

const setInputRef = (el, id) => {
    if (el) inputRefs.value[id] = el;
};

const calculatePositions = () => {
    if (!edgePathRef.value) return;
    const len = edgePathRef.value.getTotalLength();
    if (len === 0) return;
    
    const newPositions = {};
    edgeLabels.value.forEach(label => {
        let p = label.progress;
        if (p === undefined) p = 0.5; // fallback to middle
        // Clamp progress
        p = Math.max(0, Math.min(1, p));
        
        try {
            const pLength = p * len;
            const pt = edgePathRef.value.getPointAtLength(pLength);
            
            // Calculate tangent angle for Follow Line
            const step = 2; // calculate derivative over 2 pixels
            let pt1 = pt, pt2;
            if (pLength + step <= len) {
                pt2 = edgePathRef.value.getPointAtLength(pLength + step);
            } else if (pLength - step >= 0) {
                pt1 = edgePathRef.value.getPointAtLength(pLength - step);
                pt2 = pt;
            } else {
                pt2 = pt; // path is too short
            }
            
            let angle = Math.atan2(pt2.y - pt1.y, pt2.x - pt1.x) * (180 / Math.PI);
            
            // Keep text readable (never upside down)
            if (angle > 90 || angle < -90) {
                angle += 180;
            }
            
            newPositions[label.id] = { x: pt.x, y: pt.y, angle };
        } catch (e) {
            newPositions[label.id] = { x: 0, y: 0, angle: 0 };
        }
    });
    labelPositions.value = newPositions;
};

// Normalize labels data
const edgeLabels = computed(() => {
    let labels = [];
    if (props.data?.labels && Array.isArray(props.data.labels)) {
        labels = props.data.labels;
    } else if (props.data?.label) {
        // Fallback for old single label
        labels = [{ id: 'default', text: props.data.label, offsetX: 0, offsetY: 0 }];
    }
    return labels;
});

const pathData = computed(() => {
    const params = {
        sourceX: props.sourceX,
        sourceY: props.sourceY,
        targetX: props.targetX,
        targetY: props.targetY,
        sourcePosition: props.sourcePosition,
        targetPosition: props.targetPosition,
        borderRadius: 20
    };

    let pathResult;
    const edgeType = props.data?.type || 'smoothstep';

    if (edgeType === 'bezier') {
        pathResult = getBezierPath(params);
    } else if (edgeType === 'straight') {
        pathResult = getStraightPath(params);
    } else if (edgeType === 'step') {
        pathResult = getSmoothStepPath({ ...params, borderRadius: 0 });
    } else {
        pathResult = getSmoothStepPath(params); // smoothstep
    }

    return {
        path: pathResult[0],
        labelX: pathResult[1],
        labelY: pathResult[2],
        offsetX: pathResult[3],
        offsetY: pathResult[4],
    };
});

watch(() => pathData.value, () => {
    nextTick(calculatePositions);
}, { deep: true, immediate: true });
watch(() => edgeLabels.value, () => {
    nextTick(calculatePositions);
}, { deep: true });

const getLabelRotation = (label) => {
    // Label can override rotation. Default to follow if not specified.
    const rotationPref = label.rotation || 'horizontal';
    return rotationPref === 'follow' ? (labelPositions.value[label.id]?.angle || 0) : 0;
};

const startEditing = (label) => {
    editingId.value = label.id;
    labelInput.value = label.text || '';
    
    const focusInput = () => {
        const input = inputRefs.value[label.id];
        if (input) {
            input.focus();
            input.select();
        }
    };
    
    nextTick(() => {
        focusInput();
        setTimeout(focusInput, 50); // Fallback for slower rendering cycles
    });
};

const stopEditing = (label) => {
    if (editingId.value === label.id) {
        editingId.value = null;
        
        updateEdgeData(data => {
            if (!data.labels) {
                data.labels = [...edgeLabels.value];
                data.label = undefined;
            }
            const targetLabel = data.labels.find(l => l.id === label.id);
            if (targetLabel) {
                targetLabel.text = labelInput.value.trim();
            }
        });
    }
};

const handleKeyDown = (e, label) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
        stopEditing(label);
    }
};

const getClosestProgress = (clientX, clientY) => {
    if (!edgePathRef.value) return 0.5;
    
    const path = edgePathRef.value;
    const svg = path.ownerSVGElement;
    if (!svg) return 0.5;
    
    // Precisely map screen coords to the SVG's internal coordinate system
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = path.getScreenCTM();
    if (!ctm) return 0.5;
    
    const svgP = pt.matrixTransform(ctm.inverse());
    
    const len = path.getTotalLength();
    if (len === 0) return 0.5;
    
    let minD = Infinity;
    let bestT = 0.5;
    const samples = 100;
    
    for (let i = 0; i <= samples; i++) {
        let t = i / samples;
        try {
            let p = path.getPointAtLength(t * len);
            let dx = p.x - svgP.x;
            let dy = p.y - svgP.y;
            let d = dx * dx + dy * dy;
            if (d < minD) {
                minD = d;
                bestT = t;
            }
        } catch(e) {}
    }
    return bestT;
};

// Dragging logic
let startDragX = 0;
let startDragY = 0;

const startDrag = (e, label) => {
    if (editingId.value === label.id) return;
    
    updateEdgeData(data => {
        data.selectedLabelId = label.id;
        if (!data.labels) {
            data.labels = [...edgeLabels.value];
            data.label = undefined;
        }
    });
    
    const edge = findEdge(props.id);
    if (edge) {
        edge.selected = true;
    }
    
    e.stopPropagation();
    draggingId.value = label.id;
    
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
};

const onDrag = (e) => {
    if (!draggingId.value) return;
    
    updateEdgeData(data => {
        const targetLabel = data.labels.find(l => l.id === draggingId.value);
        if (targetLabel) {
            targetLabel.progress = getClosestProgress(e.clientX, e.clientY);
        }
    });
};

const stopDrag = () => {
    draggingId.value = null;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
};

const onPathDoubleClick = (e) => {
    const p = getClosestProgress(e.clientX, e.clientY);
    const newLabelId = 'lbl_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    
    updateEdgeData(data => {
        if (!data.labels) {
            data.labels = [];
            if (data.label) {
                data.labels.push({ id: 'lbl_' + Date.now() + '_old', text: data.label, progress: 0.5 });
                data.label = undefined;
            }
        }
        data.labels.push({ id: newLabelId, text: '', progress: p });
    });
    
    nextTick(() => {
        const newLabelObj = edgeLabels.value.find(l => l.id === newLabelId) || { id: newLabelId };
        startEditing(newLabelObj);
    });
};
</script>

<template>
    <!-- Base Edge Path -->
    <path
        :id="'edge-path-' + id"
        ref="edgePathRef"
        :d="pathData.path"
        :style="{ ...style, strokeWidth: parseFloat(style?.strokeWidth || 2) }"
        :marker-end="markerEnd"
        :marker-start="markerStart"
        fill="none"
        :class="['vue-flow__edge-path base-edge', data?.pattern === 'dotted' ? 'dotted-pattern' : '']"
    />
    
    <!-- Snake Traveling Dot Layer -->
    <path
        v-if="animated && data?.animStyle === 'snake'"
        :id="id + '-snake'"
        :d="pathData.path"
        :style="{ ...style, strokeWidth: parseFloat(style?.strokeWidth || 2) + 6 }"
        class="animated-edge snake-dot vue-flow__edge-path"
        fill="none"
    />

    <!-- Invisible wider edge for easier double clicking/hovering -->
    <path 
        :d="pathData.path" 
        fill="none" 
        stroke="transparent" 
        stroke-width="20" 
        class="cursor-pointer"
        @dblclick.stop="onPathDoubleClick"
        @click="() => { updateEdgeData(d => d.selectedLabelId = null); }"
    />

    <!-- Curving Text Labels (SVG textPath) -->
    <text v-for="label in edgeLabels.filter(l => l.theme === 'transparent' && l.rotation === 'follow')"
          :key="'svg-' + label.id"
          class="cursor-pointer"
          style="user-select: none;"
          :style="{
              fontSize: (label.fontSize || 14) + 'px',
              fill: label.color || '#374151',
              filter: data?.selectedLabelId === label.id ? 'drop-shadow(0px 0px 4px rgba(59, 130, 246, 1))' : 'none',
              outline: 'none'
          }"
          dy="-5"
          @mousedown.stop="startDrag($event, label)"
          @dblclick.stop="startEditing(label)"
          @click="() => { updateEdgeData(d => d.selectedLabelId = label.id); }"
    >
        <textPath :href="'#edge-path-' + id" :startOffset="(label.progress ?? 0.5) * 100 + '%'" text-anchor="middle">
            {{ label.text }}
        </textPath>
    </text>

    <!-- Edge Labels -->
    <EdgeLabelRenderer>
        <div
            v-for="label in edgeLabels"
            :key="label.id"
            class="nodrag nopan"
            :style="{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: `translate(${(labelPositions[label.id]?.x || pathData.labelX)}px, ${(labelPositions[label.id]?.y || pathData.labelY)}px) translate(-50%, -50%) rotate(${getLabelRotation(label)}deg) ${label.theme === 'transparent' && label.rotation === 'follow' ? 'translate(0, -14px)' : ''}`,
                pointerEvents: 'all',
                cursor: draggingId === label.id ? 'grabbing' : 'grab',
                zIndex: (data?.selectedLabelId === label.id) ? 100 : 50
            }"
            @dblclick.stop="startEditing(label)"
            @mousedown="startDrag($event, label)"
        >
            <input
                v-if="editingId === label.id"
                :ref="el => setInputRef(el, label.id)"
                v-model="labelInput"
                class="px-2 py-1 bg-white border border-blue-500 rounded text-sm text-center shadow-lg focus:outline-none ring-2 ring-blue-300"
                style="min-width: 80px;"
                @blur="stopEditing(label)"
                @keydown="handleKeyDown($event, label)"
                @mousedown.stop
            />
            <div 
                v-else-if="label.text && !(label.theme === 'transparent' && label.rotation === 'follow')"
                :class="[
                    'relative px-2 py-1 text-sm font-medium whitespace-nowrap transition-all select-none',
                    (!label.theme || label.theme === 'pill') ? 'border border-gray-200 rounded shadow-sm hover:shadow-md hover:border-gray-300' : 'rounded',
                    (label.theme === 'transparent') ? 'bg-transparent text-shadow-sm' : '',
                    (label.theme === 'cut') ? [
                        'edge-label-cutout',
                        label.animated ? 'animated' : '',
                        label.animDirection === 'reverse' ? 'vue-flow__edge-reverse-anim' : '',
                        label.animSpeed === 'slow' ? 'anim-slow' : '',
                        label.animSpeed === 'fast' ? 'anim-fast' : '',
                        label.animStyle === 'pulse' ? 'anim-style-pulse' : '',
                        label.animStyle === 'ants' ? 'anim-style-ants' : '',
                        label.animStyle === 'snake' ? 'anim-style-snake' : ''
                    ].join(' ') : '',
                    (data?.selectedLabelId === label.id) ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                ]"
                :style="{
                    color: label.color || '#374151',
                    backgroundColor: label.theme === 'transparent' ? 'transparent' : (label.bgColor || '#ffffff'),
                    fontSize: (label.fontSize || 14) + 'px'
                }"
            >
                <svg v-if="label.theme === 'cut'" class="absolute inset-0 w-full h-full pointer-events-none" style="border-radius: 4px;">
                    <rect x="0" y="0" width="100%" height="100%" rx="4" ry="4" fill="none"
                          :class="['vue-flow__edge-path base-edge', label.pattern === 'dotted' ? 'dotted-pattern' : '']"
                          :style="{ 
                              stroke: label.borderColor || style?.stroke || '#94a3b8', 
                              strokeWidth: label.borderWidth || style?.strokeWidth || 2, 
                              strokeDasharray: label.pattern === 'dashed' ? '6,6' : (label.pattern === 'dotted' ? '2,4' : undefined),
                              strokeLinecap: label.pattern === 'dotted' ? 'round' : undefined
                          }" />
                    
                    <rect v-if="label.animated && label.animStyle === 'snake'"
                          x="0" y="0" width="100%" height="100%" rx="4" ry="4" fill="none"
                          :style="{ 
                              stroke: label.borderColor || style?.stroke || '#94a3b8', 
                              strokeWidth: parseFloat(label.borderWidth || style?.strokeWidth || 2) + 6,
                              strokeDasharray: label.pattern === 'dashed' ? '6,6' : (label.pattern === 'dotted' ? '2,4' : undefined),
                              strokeLinecap: label.pattern === 'dotted' ? 'round' : undefined
                          }"
                          class="animated-edge snake-dot vue-flow__edge-path" />
                </svg>
                <div class="relative z-10">{{ label.text }}</div>
            </div>
        </div>
    </EdgeLabelRenderer>
</template>

<style scoped>
.animated-edge {
    stroke-dasharray: 5;
    animation: dashdraw 0.5s linear infinite;
}
@keyframes dashdraw {
    from { stroke-dashoffset: 10; }
}
.text-shadow-sm {
    text-shadow: 1px 1px 0 #fff, -1px 1px 0 #fff, 1px -1px 0 #fff, -1px -1px 0 #fff;
}
</style>
