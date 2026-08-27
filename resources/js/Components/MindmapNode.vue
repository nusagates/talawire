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

onMounted(() => {
    if (props.data.isNew && props.canEdit !== false) {
        setTimeout(() => {
            inputRef.value?.focus()
        }, 50)
    }
    adjustHeight()
})

const adjustHeight = () => {
    if (inputRef.value) {
        inputRef.value.style.height = 'auto';
        inputRef.value.style.height = inputRef.value.scrollHeight + 'px';
    }
}

const isEditingText = ref(false);

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
        e.preventDefault()
        props.data.onAddChild(props.id)
    } else if (e.key === 'Enter') {
        if (!e.shiftKey) {
            e.preventDefault()
            props.data.onAddSibling(props.id)
        }
    } else if (e.key === 'Backspace' && props.data.label === '') {
        if (props.id !== 'root') {
            e.preventDefault()
            removeNodes([props.id])
        }
    }
}

const shapeClasses = computed(() => {
    const shape = props.data.shape || 'box';
    const isResized = !!props.data.width || !!props.data.height;
    
    // Helper to strip min-width and min-height classes when explicitly resized
    const classes = (cls) => {
        if (!isResized) return cls;
        return cls.replace(/min-w-\[[^\]]+\]/g, '').replace(/min-h-\[[^\]]+\]/g, '');
    }

    if (shape === 'underline') {
        return classes('px-4 py-1 border-b-2 bg-transparent min-w-[120px]');
    } else if (shape === 'pill') {
        return classes('px-6 py-3 rounded-full border-2 shadow-sm min-w-[120px]');
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
    return classes('px-4 py-3 rounded-lg border-2 shadow-sm min-w-[150px]');
})

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
    const baseColor = props.selected ? '#3b82f6' : (props.data.borderColor || '#e5e7eb');
    
    let style = {
        borderColor: baseColor,
        borderWidth: (props.data.borderWidth !== undefined ? props.data.borderWidth : 2) + 'px',
        borderStyle: props.data.borderStyle || 'solid',
    };

    if (shape === 'underline') {
        style.backgroundColor = 'transparent';
        style.borderTopWidth = '0px';
        style.borderLeftWidth = '0px';
        style.borderRightWidth = '0px';
        style.borderBottomWidth = (props.data.borderWidth !== undefined ? props.data.borderWidth : 2) + 'px';
    } else if (shape === 'image' || shape === 'emoji' || shape === 'text') {
        style.backgroundColor = 'transparent';
        style.borderColor = 'transparent';
        style.borderWidth = '0px';
    } else {
        style.backgroundColor = props.data.bgColor || '#ffffff';
    }

    // Clip paths for complex shapes removed, as they are now handled by SVG
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
             :class="[shapeClasses, selected && data.shape !== 'underline' ? 'shadow-lg' : '']" 
             :style="['diamond', 'parallelogram', 'hexagon', 'document', 'callout'].includes(data.shape) ? { padding: 0, backgroundColor: 'transparent', border: 'none' } : backgroundStyle">
            
            <!-- SVG Background for Complex Shapes -->
            <svg v-if="['diamond', 'parallelogram', 'hexagon', 'document', 'callout'].includes(data.shape)" 
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
                    class="w-full h-full flex items-center overflow-hidden whitespace-pre-wrap select-none pointer-events-auto"
                    :class="[data.shape === 'paragraph' ? 'justify-start text-left' : 'justify-center text-center']"
                    :style="{ color: data.textColor || '#111827', fontSize: (data.fontSize || 14) + 'px', fontFamily: data.fontFamily || 'Inter' }">
                    <span :class="[data.shape === 'underline' ? 'pb-1' : '']" class="px-2">{{ data.label || (data.shape === 'text' ? 'Judul Teks' : (data.shape === 'paragraph' ? 'Tulis paragraf...' : 'New Node')) }}</span>
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
                    :style="{ color: data.textColor || '#111827', fontSize: (data.fontSize || 14) + 'px', fontFamily: data.fontFamily || 'Inter' }"
                    :class="[data.shape === 'paragraph' ? 'text-left' : 'text-center']"
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
        
        <!-- Target Handles (Inputs) - Tiny anchors -->
        <template v-if="data.shape !== 'text' && data.shape !== 'paragraph' && data.shape !== 'waypoint'">
            <Handle type="target" position="top" id="target-top" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" />
            <Handle type="target" position="right" id="target-right" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" />
            <Handle type="target" position="bottom" id="target-bottom" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" />
            <Handle type="target" position="left" id="target-left" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0" />
                      <!-- Source Handles (Draggable Arrows) - Tiny anchors with large visual hitboxes inside -->
            <Handle type="source" position="top" id="source-top" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0 overflow-visible">
                <div @click.stop="handleQuickConnect('top')" :class="['absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pb-2 transition-all cursor-crosshair flex items-center justify-center w-8 h-8 hover:text-blue-500', selected ? 'opacity-100 text-blue-300 z-20' : 'opacity-0 pointer-events-none']">
                    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
                </div>
            </Handle>
            <Handle type="source" position="right" id="source-right" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0 overflow-visible">
                <div @click.stop="handleQuickConnect('right')" :class="['absolute top-1/2 left-1/2 pl-2 -translate-y-1/2 transition-all cursor-crosshair flex items-center justify-center w-8 h-8 hover:text-blue-500', selected ? 'opacity-100 text-blue-300 z-20' : 'opacity-0 pointer-events-none']">
                    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7-7m7-7H3"></path></svg>
                </div>
            </Handle>
            <Handle type="source" position="bottom" id="source-bottom" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0 overflow-visible">
                <div @click.stop="handleQuickConnect('bottom')" :class="['absolute top-1/2 left-1/2 -translate-x-1/2 pt-2 transition-all cursor-crosshair flex items-center justify-center w-8 h-8 hover:text-blue-500', selected ? 'opacity-100 text-blue-300 z-20' : 'opacity-0 pointer-events-none']">
                    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path></svg>
                </div>
            </Handle>
            <Handle type="source" position="left" id="source-left" class="!w-1 !h-1 !bg-transparent !border-none !min-w-0 !min-h-0 overflow-visible">
                <div @click.stop="handleQuickConnect('left')" :class="['absolute top-1/2 right-1/2 pr-2 -translate-y-1/2 transition-all cursor-crosshair flex items-center justify-center w-8 h-8 hover:text-blue-500', selected ? 'opacity-100 text-blue-300 z-20' : 'opacity-0 pointer-events-none']">
                    <svg class="w-5 h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </div>
            </Handle>
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
