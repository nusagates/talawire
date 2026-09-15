<script setup>
import { Handle, useVueFlow } from '@vue-flow/core'
import { NodeResizer, NodeResizeControl } from '@vue-flow/node-resizer'
import { ref, onMounted, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import twemoji from '@twemoji/api';

import '@vue-flow/node-resizer/dist/style.css'

const props = defineProps(['id', 'data', 'selected', 'canEdit', 'sourcePosition', 'targetPosition'])
const emit = defineEmits(['quick-connect', 'resize-end', 'content-changed']);
const { removeNodes, getNodes, updateNodeInternals, getEdges } = useVueFlow()

const inputRef = ref(null)

const isWaypointVisible = computed(() => {
    if (props.data.shape !== 'waypoint') return false;
    if (props.selected) return true;
    const edges = getEdges.value;
    return edges.some(e => (e.source === props.id || e.target === props.id) && e.selected);
});

const connectedEdge = computed(() => {
    if (props.data.shape !== 'waypoint') return null;
    const edges = getEdges.value;
    return edges.find(e => e.source === props.id || e.target === props.id);
});

const waypointColor = computed(() => {
    if (!connectedEdge.value) return '#a3a3a3';
    return connectedEdge.value.style?.stroke || '#a3a3a3';
});

const waypointSize = computed(() => {
    if (!connectedEdge.value) return 2;
    return parseInt(connectedEdge.value.style?.strokeWidth || 2);
});

let animationFrameId = null;
const updateEdgesDuringAnimation = () => {
    if (props.data.animation) {
        updateNodeInternals([props.id]);
        animationFrameId = requestAnimationFrame(updateEdgesDuringAnimation);
    }
};

watch(() => props.data.animation, (newVal) => {
    if (newVal) {
        if (!animationFrameId) {
            updateEdgesDuringAnimation();
        }
    } else {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
    }
}, { immediate: true });

onBeforeUnmount(() => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
});

// Calculate twemoji image
const parsedEmoji = computed(() => {
    if (props.data.shape !== 'emoji') return '';
    return twemoji.parse(props.data.emoji || '😀', {
        folder: 'svg',
        ext: '.svg',
        className: 'w-16 h-16 inline-block select-none pointer-events-none'
    });
});

const isEditingText = ref(!!props.data.isNew);

onMounted(async () => {
    if (props.data.isNew && props.canEdit !== false) {
        isEditingText.value = true;
        await nextTick();
        setTimeout(() => {
            inputRef.value?.focus();
            inputRef.value?.select();
        }, 50);
    }
    adjustHeight();
});

const adjustHeight = () => {
    if (inputRef.value) {
        inputRef.value.style.height = 'auto';
        inputRef.value.style.height = inputRef.value.scrollHeight + 'px';
    }
};

const enableEditing = async () => {
    if (props.canEdit === false) return;
    isEditingText.value = true;
    await nextTick();
    if (inputRef.value) {
        inputRef.value.focus();
        inputRef.value.select();
    }
};

const disableEditing = () => {
    isEditingText.value = false;
};

const onKeyDown = (e) => {
    if (props.canEdit === false) return;

    if (e.key === 'Tab') {
        e.preventDefault();
        if (typeof props.data.onAddChild === 'function') {
            props.data.onAddChild(props.id);
        }
    } else if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault();
            if (typeof props.data.onAddSibling === 'function') {
                props.data.onAddSibling(props.id);
            }
        }
    } else if (e.key === 'Backspace' && props.data.label === '') {
        if (props.id !== 'root') {
            e.preventDefault();
            if (typeof props.data.onDeleteNode === 'function') {
                props.data.onDeleteNode(props.id);
            } else {
                removeNodes([props.id]);
            }
        }
    }
};

// Calculate high-contrast text color based on background luminance
const effectiveTextColor = computed(() => {
    // If explicit custom textColor is provided (and not matching obsolete default), respect it
    if (props.data.textColor) {
        // If textColor is white but background is light or transparent/underline, override to dark slate
        const shape = props.data.shape || 'box';
        const isUnderline = shape === 'underline';
        if (isUnderline && props.data.textColor === '#ffffff') {
            return '#0f172a';
        }
        return props.data.textColor;
    }

    const shape = props.data.shape || 'box';
    const isRoot = props.id === 'root' || props.data.isRoot;

    // Underline, transparent, text, image, emoji
    if (shape === 'underline' || shape === 'text' || shape === 'emoji' || shape === 'image') {
        return '#0f172a';
    }

    // Central Topic Root
    if (isRoot) {
        return '#0f172a';
    }

    // Check background luminance
    const bg = props.data.bgColor;
    if (!bg || bg === 'transparent' || bg === '#ffffff' || bg === '#fff') {
        return '#0f172a';
    }

    let hex = bg.replace('#', '').trim();
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length === 6) {
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        return lum > 0.55 ? '#0f172a' : '#ffffff';
    }

    return '#0f172a';
});

const shapeClasses = computed(() => {
    const shape = props.data.shape || 'box';
    const isResized = !!props.data.width || !!props.data.height;
    
    // Helper to strip min-width and min-height classes when explicitly resized
    const classes = (cls) => {
        if (!isResized) return cls;
        return cls.replace(/min-w-\[[^\]]+\]/g, '').replace(/min-h-\[[^\]]+\]/g, '');
    }

    if (props.id === 'root' || props.data.isRoot) {
        return classes('px-6 py-2.5 rounded-2xl min-w-[140px] font-bold text-center tracking-tight text-slate-900 shadow-xs border-2 border-slate-800');
    }

    if (shape === 'underline') {
        return classes('px-2 py-1 bg-transparent min-w-[60px] text-xs font-medium');
    } else if (shape === 'pill') {
        return classes('px-4 py-1.5 rounded-xl shadow-xs min-w-[100px] text-sm font-semibold tracking-wide');
    } else if (shape === 'diamond') {
        return classes('px-8 py-8 min-w-[100px] min-h-[100px] flex items-center justify-center');
    } else if (shape === 'parallelogram') {
        return classes('px-6 py-4 min-w-[140px]');
    } else if (shape === 'hexagon') {
        return classes('px-8 py-6 min-w-[140px]');
    } else if (shape === 'cylinder') {
        return classes('px-4 py-6 border-2 shadow-sm min-w-[120px] rounded-xl');
    } else if (shape === 'image' || shape === 'emoji') {
        return classes('bg-transparent min-w-[60px] min-h-[60px] flex items-center justify-center');
    } else if (shape === 'group') {
        return classes('border-2 shadow-sm rounded-md min-w-[100px] min-h-[100px]');
    } else if (shape === 'text') {
        return classes('bg-transparent min-w-[100px] min-h-[40px] border-none flex items-center justify-center');
    } else if (shape === 'paragraph') {
        return classes('px-4 py-3 rounded-lg border-2 shadow-sm min-w-[100px] min-h-[40px] flex items-center justify-start');
    } else if (shape === 'document' || shape === 'callout') {
        return classes('px-6 py-6 min-w-[120px]');
    } else if (shape === 'waypoint') {
        return 'w-3 h-3 rounded-full bg-blue-400 border border-white opacity-40 hover:opacity-100 transition-opacity shadow-sm cursor-move';
    }
    // Default box
    return classes('px-4 py-2 rounded-xl border-2 shadow-xs min-w-[120px]');
})

// Anchor Position (Underline connects at bottom 100% SVG line; Pills/Boxes connect at 50% center)
const handleAnchorStyle = computed(() => {
    if (props.data.shape === 'underline' || props.data.anchorPosition === 'bottom') {
        return { top: 'auto !important', bottom: '0px !important', transform: 'none !important' };
    }
    // Default to Center (50%) for pills, boxes, and central topic
    return { top: '50% !important', transform: 'translateY(-50%) !important' };
});

const containerStyle = computed(() => {
    let style = {};
    if (props.data.width) {
        style.width = `${props.data.width}px`;
        style.minWidth = '0 !important';
    }
    if (props.data.height) {
        style.height = `${props.data.height}px`;
        style.minHeight = '0 !important';
    }
    return style;
})

const backgroundStyle = computed(() => {
    const shape = props.data.shape || 'box';
    const isRoot = props.id === 'root' || props.data.isRoot;
    const baseColor = props.selected ? '#38bdf8' : (props.data.borderColor || (isRoot ? '#1e293b' : 'transparent'));
    
    let style = {
        borderColor: baseColor,
        borderWidth: (props.selected ? 2 : (props.data.borderWidth !== undefined ? props.data.borderWidth : (isRoot ? 2 : 0))) + 'px',
        borderStyle: props.data.borderStyle || 'solid',
    };

    if (shape === 'underline') {
        style.backgroundColor = 'transparent';
        style.border = 'none';
    } else if (shape === 'image' || shape === 'emoji' || shape === 'text') {
        style.backgroundColor = 'transparent';
        style.borderColor = 'transparent';
        style.borderWidth = '0px';
    } else {
        style.backgroundColor = props.data.bgColor || (isRoot ? '#ffffff' : '#ffffff');
    }

    if (shape === 'cylinder') {
        style.borderRadius = '50% / 15%';
    } else if (shape === 'group') {
        if (props.data.isBorderOnly) {
            style.backgroundColor = 'transparent';
        }
    }

    return style;
})

const onResize = (payload) => {
    // vue-flow/node-resizer emits { event, params: { width, height, x, y } }
    if (payload && payload.params) {
        props.data.width = payload.params.width;
        props.data.height = payload.params.height;
    }
}

const handleQuickConnect = (direction) => {
    emit('quick-connect', { id: props.id, direction });
}
</script>

<template>
    <div :id="'node-wrapper-' + id" 
         class="w-full h-full flex flex-col justify-center transition-all relative group" 
         :class="data.animation ? `animate__animated animate__${data.animation} animate__infinite animate__slower` : ''"
         :style="containerStyle">
        <!-- Sizing layer (invisible border just for padding/sizing match) -->
        <div v-if="data.shape !== 'waypoint'" :class="[shapeClasses, 'invisible pointer-events-none border-2 flex flex-col', data.shape === 'paragraph' ? 'justify-start text-left' : 'justify-center text-center']" style="white-space: pre-wrap; word-break: break-word;">
            <span :class="[data.shape === 'underline' ? 'pb-1' : '']" class="px-2" :style="{ fontSize: (data.fontSize || 14) + 'px', fontFamily: data.fontFamily || 'Inter' }">{{ data.label || (data.shape === 'text' ? 'Judul Teks' : (data.shape === 'paragraph' ? 'Tulis paragraf panjang atau keterangan di sini...' : 'New Node')) }}</span>
        </div>

        <!-- The actual visible background shape -->
        <div v-if="data.shape !== 'waypoint'" class="absolute inset-0 z-0 pointer-events-none transition-all" 
             :class="[shapeClasses, selected && data.shape !== 'underline' ? 'shadow-md' : '']" 
             :style="['diamond', 'parallelogram', 'hexagon', 'document', 'callout', 'underline'].includes(data.shape) ? { padding: 0, backgroundColor: 'transparent', border: 'none' } : backgroundStyle">
            
            <!-- SVG Underline for Pixel-Perfect Seamless Vector Curves -->
            <svg v-if="data.shape === 'underline'" class="w-full h-full overflow-visible pointer-events-none" preserveAspectRatio="none">
                <line x1="0" y1="100%" x2="100%" y2="100%" 
                      :stroke="selected ? '#38bdf8' : (data.branchLineColor || data.borderColor || '#38bdf8')" 
                      :stroke-width="data.borderWidth !== undefined ? data.borderWidth : 2" 
                      stroke-linecap="round" />
            </svg>
            
            <!-- SVG Background for Complex Shapes -->
            <svg v-else-if="['diamond', 'parallelogram', 'hexagon', 'document', 'callout'].includes(data.shape)" 
                 class="w-full h-full overflow-visible drop-shadow-sm" preserveAspectRatio="none" viewBox="0 0 100 100">
                 
                <!-- Diamond -->
                <polygon v-if="data.shape === 'diamond'" 
                         points="50,0 100,50 50,100 0,50" 
                         :fill="backgroundStyle.backgroundColor" 
                         :stroke="backgroundStyle.borderColor" 
                         :stroke-width="parseFloat(backgroundStyle.borderWidth)"
                         :stroke-dasharray="backgroundStyle.borderStyle === 'dashed' ? '5,5' : (backgroundStyle.borderStyle === 'dotted' ? '2,2' : 'none')"
                         vector-effect="non-scaling-stroke" />
                         
                <!-- Parallelogram -->
                <polygon v-else-if="data.shape === 'parallelogram'" 
                         points="15,0 100,0 85,100 0,100" 
                         :fill="backgroundStyle.backgroundColor" 
                         :stroke="backgroundStyle.borderColor" 
                         :stroke-width="parseFloat(backgroundStyle.borderWidth)"
                         :stroke-dasharray="backgroundStyle.borderStyle === 'dashed' ? '5,5' : (backgroundStyle.borderStyle === 'dotted' ? '2,2' : 'none')"
                         vector-effect="non-scaling-stroke" />
                         
                <!-- Hexagon -->
                <polygon v-else-if="data.shape === 'hexagon'" 
                         points="25,0 75,0 100,50 75,100 25,100 0,50" 
                         :fill="backgroundStyle.backgroundColor" 
                         :stroke="backgroundStyle.borderColor" 
                         :stroke-width="parseFloat(backgroundStyle.borderWidth)"
                         :stroke-dasharray="backgroundStyle.borderStyle === 'dashed' ? '5,5' : (backgroundStyle.borderStyle === 'dotted' ? '2,2' : 'none')"
                         vector-effect="non-scaling-stroke" />
                         
                <!-- Document -->
                <polygon v-else-if="data.shape === 'document'" 
                         points="0,0 100,0 100,85 85,100 50,85 15,100 0,85" 
                         :fill="backgroundStyle.backgroundColor" 
                         :stroke="backgroundStyle.borderColor" 
                         :stroke-width="parseFloat(backgroundStyle.borderWidth)"
                         :stroke-dasharray="backgroundStyle.borderStyle === 'dashed' ? '5,5' : (backgroundStyle.borderStyle === 'dotted' ? '2,2' : 'none')"
                         vector-effect="non-scaling-stroke" />

                <!-- Callout -->
                <path v-else-if="data.shape === 'callout'" 
                      d="M 5,5 L 95,5 L 95,75 L 60,75 L 40,95 L 40,75 L 5,75 Z"
                      :fill="backgroundStyle.backgroundColor" 
                      :stroke="backgroundStyle.borderColor" 
                      :stroke-width="parseFloat(backgroundStyle.borderWidth)"
                      :stroke-dasharray="backgroundStyle.borderStyle === 'dashed' ? '5,5' : (backgroundStyle.borderStyle === 'dotted' ? '2,2' : 'none')"
                      vector-effect="non-scaling-stroke" />
            </svg>
        </div>

        <!-- Waypoint specific visual -->
        <div v-if="data.shape === 'waypoint'" class="waypoint-visual flex items-center justify-center" style="width: 1px; height: 1px;">
            <!-- Large invisible hit area for easy dragging -->
            <div class="waypoint-drag-handle flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full pointer-events-auto cursor-move group/wp">
                <!-- Visual Joint / Drag dot -->
                <div class="rounded-full shadow-sm transition-all duration-200"
                     :style="isWaypointVisible ? {} : { backgroundColor: waypointColor, width: waypointSize + 'px', height: waypointSize + 'px', boxShadow: 'none' }"
                     :class="isWaypointVisible ? 'w-2 h-2 bg-blue-500 ring-2 ring-blue-300 ring-offset-1 opacity-100' : 'opacity-100 group-hover/wp:opacity-100 group-hover/wp:w-2 group-hover/wp:h-2 group-hover/wp:bg-blue-400 group-hover/wp:!shadow-sm'">
                </div>
            </div>
        </div>

        <!-- Content Layer -->
        <div v-if="data.shape !== 'waypoint'" class="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <!-- Emoji Node -->
            <div v-if="data.shape === 'emoji'" class="text-6xl text-center select-none pointer-events-auto" :style="{ opacity: selected ? 0.8 : 1 }" v-html="parsedEmoji">
            </div>
            
            <!-- Image Node -->
            <div v-else-if="data.shape === 'image'" class="relative pointer-events-auto" :style="{ opacity: selected ? 0.8 : 1 }">
                <img :src="data.imageUrl || 'https://via.placeholder.com/150'" class="max-w-[200px] h-auto rounded-lg shadow-sm" draggable="false" />
            </div>
            
            <!-- Text / Paragraph Node (Default) -->
            <template v-else>
                <div v-if="!isEditingText" 
                    @dblclick="enableEditing"
                    class="w-full h-full flex items-center overflow-hidden whitespace-pre-wrap select-none pointer-events-auto font-medium"
                    :class="[data.shape === 'paragraph' ? 'justify-start text-left' : 'justify-center text-center', data.shape === 'underline' ? 'font-semibold' : '']"
                    :style="{ color: effectiveTextColor, fontSize: (data.fontSize || (id === 'root' || data.isRoot ? 18 : 14)) + 'px', fontFamily: data.fontFamily || 'Inter' }">
                    <span :class="[data.shape === 'underline' ? 'pb-0.5' : '']" class="px-2">{{ data.label || (data.shape === 'text' ? 'Judul Teks' : (data.shape === 'paragraph' ? 'Tulis paragraf...' : (id === 'root' || data.isRoot ? 'Central Topic' : 'New Node'))) }}</span>
                </div>
                <textarea v-else
                    ref="inputRef"
                    v-model="data.label"
                    :readonly="canEdit === false"
                    @keydown="onKeyDown"
                    @keydown.delete.stop
                    @keydown.backspace.stop
                    @input="() => { adjustHeight(); emit('content-changed'); }"
                    @blur="disableEditing"
                    rows="1"
                    :style="{ color: effectiveTextColor, fontSize: (data.fontSize || (id === 'root' || data.isRoot ? 18 : 14)) + 'px', fontFamily: data.fontFamily || 'Inter' }"
                    :class="[data.shape === 'paragraph' ? 'text-left' : 'text-center', data.shape === 'underline' ? 'font-semibold' : '']"
                    class="border-none focus:ring-0 p-0 m-0 w-full bg-transparent font-medium outline-none placeholder-gray-400 resize-none overflow-hidden block pointer-events-auto"
                    placeholder="Ketik ide..."
                ></textarea>
            </template>
        </div>

        <!-- Resize Handles and Target/Source Anchors -->
        <NodeResizer 
            v-if="selected && canEdit !== false && data.shape !== 'underline' && data.shape !== 'image' && data.shape !== 'emoji' && data.shape !== 'waypoint'" 
            color="#3b82f6" 
            :min-width="40" :min-height="40" 
            @resize="onResize" 
            @resize-end="emit('resize-end')"
        />
        
        <!-- Waypoint Center Handles -->
        <template v-if="data.shape === 'waypoint'">
            <Handle type="target" position="top" id="wp-target" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent" style="top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important;" />
            <Handle type="source" position="bottom" id="wp-source" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent" style="top: 50% !important; left: 50% !important; transform: translate(-50%, -50%) !important;" />
        </template>
        
        <!-- Invisible Exact Anchors (Zero Size, Pure Connector Points) -->
        <template v-if="data.shape !== 'waypoint'">
            <Handle type="target" position="top" id="target-top" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" />
            <Handle type="target" position="right" id="target-right" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" :style="handleAnchorStyle" />
            <Handle type="target" position="bottom" id="target-bottom" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" />
            <Handle type="target" position="left" id="target-left" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" :style="handleAnchorStyle" />
            
            <Handle type="source" position="top" id="source-top" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" />
            <Handle type="source" position="right" id="source-right" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" :style="handleAnchorStyle" />
            <Handle type="source" position="bottom" id="source-bottom" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" />
            <Handle type="source" position="left" id="source-left" class="!w-0 !h-0 !opacity-0 !pointer-events-none !border-none !bg-transparent !min-w-0 !min-h-0" :style="handleAnchorStyle" />
        </template>

        <!-- Circular (+) Action Buttons (XMind/Mindmeister Style) -->
        <template v-if="selected && canEdit !== false && data.shape !== 'waypoint'">
            <!-- Right (+) Button: Add Child to Right -->
            <button 
                v-if="id === 'root' || data.isRoot || data.branchDirection !== 'left'"
                type="button"
                @click.stop="typeof data.onAddChild === 'function' ? data.onAddChild(id, 'right') : null" 
                class="nodrag absolute top-1/2 -right-3 -translate-y-1/2 w-5 h-5 bg-blue-500 hover:bg-blue-600 active:scale-90 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform z-30 pointer-events-auto border-2 border-white ring-1 ring-blue-300"
                title="Tambah Cabang / Sub-Topik (Tab)"
            >
                <svg class="w-3 h-3 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            </button>

            <!-- Left (+) Button: Add Child to Left (for Root or Left-directed branches) -->
            <button 
                v-if="id === 'root' || data.isRoot || data.branchDirection === 'left'"
                type="button"
                @click.stop="typeof data.onAddChild === 'function' ? data.onAddChild(id, 'left') : null" 
                class="nodrag absolute top-1/2 -left-3 -translate-y-1/2 w-5 h-5 bg-blue-500 hover:bg-blue-600 active:scale-90 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform z-30 pointer-events-auto border-2 border-white ring-1 ring-blue-300"
                title="Tambah Cabang Kiri (Tab)"
            >
                <svg class="w-3 h-3 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            </button>

            <!-- Bottom (+) Button: Add Sibling below (for non-root nodes) -->
            <button 
                v-if="id !== 'root' && !data.isRoot"
                type="button"
                @click.stop="typeof data.onAddSibling === 'function' ? data.onAddSibling(id) : null" 
                class="nodrag absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 bg-blue-500 hover:bg-blue-600 active:scale-90 text-white rounded-full flex items-center justify-center shadow-md cursor-pointer transition-transform z-30 pointer-events-auto border-2 border-white ring-1 ring-blue-300"
                title="Tambah Topik Sejajar (Enter)"
            >
                <svg class="w-3 h-3 stroke-[3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            </button>
        </template>
    </div>
</template>

<style>
/* Override Vue Flow Resizer to match draw.io style */
.vue-flow__resize-control.handle {
    width: 8px !important;
    height: 8px !important;
    border-radius: 50% !important;
    background-color: #3b82f6 !important;
    border: 1px solid #fff !important;
}

/* Dashed bounding box lines for NodeResizer */
.vue-flow__resize-control.line {
    border-color: #3b82f6 !important;
    border-style: dashed !important;
    border-width: 1px !important;
}
.vue-flow__resize-control.line.left,
.vue-flow__resize-control.line.right {
    border-top-width: 0 !important;
    border-bottom-width: 0 !important;
}
.vue-flow__resize-control.line.top,
.vue-flow__resize-control.line.bottom {
    border-left-width: 0 !important;
    border-right-width: 0 !important;
}
</style>
