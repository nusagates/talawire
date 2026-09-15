<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { router, Head, Link } from '@inertiajs/vue3';
import axios from 'axios';
import { toPng } from 'html-to-image';
import { jsPDF } from 'jspdf';
import AppLayout from '@/Layouts/AppLayout.vue';
import { VueFlow, useVueFlow, MarkerType, updateEdge } from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { MiniMap } from '@vue-flow/minimap';
import { useManualRefHistory, onKeyStroke } from '@vueuse/core';
import debounce from 'lodash/debounce';
import MindmapNode from '@/Components/MindmapNode.vue';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import DialogModal from '@/Components/DialogModal.vue';
import SecondaryButton from '@/Components/SecondaryButton.vue';
import PrimaryButton from '@/Components/PrimaryButton.vue';
import TextInput from '@/Components/TextInput.vue';
import BraceEdge from '@/Components/BraceEdge.vue';
import LabeledEdge from '@/Components/LabeledEdge.vue';
import dagre from '@dagrejs/dagre';
import EmojiPicker from 'vue3-emoji-picker';
import 'vue3-emoji-picker/css';
import 'animate.css';

const canvasBackgrounds = [
    '#ffffff', '#f8fafc', '#f1f5f9', '#fef3c7', '#dcfce7', '#dbeafe', '#f3e8ff', '#1e293b', '#0f172a',
    'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)',
    'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
    'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
    'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    'radial-gradient(#d1d5db 2px, transparent 2px) 0 0 / 20px 20px #ffffff',
    'repeating-linear-gradient(45deg, #f3f4f6 25%, transparent 25%, transparent 75%, #f3f4f6 75%, #f3f4f6), repeating-linear-gradient(45deg, #f3f4f6 25%, #ffffff 25%, #ffffff 75%, #f3f4f6 75%, #f3f4f6) 0 0 / 20px 20px'
];

import animateCssRaw from 'animate.css/animate.min.css?raw';
import twemoji from '@twemoji/api';

const props = defineProps({
    mindmap: Object,
    canEdit: {
        type: Boolean,
        default: true
    },
    isRenderView: {
        type: Boolean,
        default: false
    }
});

const title = ref(props.mindmap.name);
const isEditingTitle = ref(false);
const canvasContainer = ref(null);
const whiteCanvasRef = ref(null);
const recordingWidth = ref(null);
const recordingHeight = ref(null);

const isShareModalOpen = ref(false);
const shareEmail = ref('');
const sharePermission = ref('view');
const isPublic = ref(props.mindmap.is_public);
const publicPermission = ref(props.mindmap.public_permission);

// Modern clean editor UI states
const isRightPanelOpen = ref(false);
const isOutlinerOpen = ref(false);
const isExportMenuOpen = ref(false);
const isFileMenuOpen = ref(false);
const isFavorite = ref(false);
const isFullscreen = ref(false);
const isZoomMenuOpen = ref(false);
const currentSheet = ref('Map 1');
const sheets = ref(['Map 1']);

const toast = ref({ show: false, message: '', type: 'success' });
const showToast = (message, type = 'success') => {
    toast.value = { show: true, message, type };
    setTimeout(() => { toast.value.show = false; }, 3500);
};

const defaultEmojiIcon = computed(() => {
    return twemoji.parse('😀', {
        folder: 'svg',
        ext: '.svg',
        className: 'w-8 h-8 inline-block select-none pointer-events-none'
    });
});

const updatePublicSettings = () => {
    router.put(route('mindmaps.public.update', props.mindmap.id), {
        is_public: isPublic.value,
        public_permission: publicPermission.value
    }, { preserveScroll: true });
};

const inviteUser = () => {
    if (!shareEmail.value) return;
    router.post(route('mindmaps.share.add', props.mindmap.id), {
        email: shareEmail.value,
        permission: sharePermission.value
    }, { 
        preserveScroll: true,
        onSuccess: () => { shareEmail.value = ''; }
    });
};

const removeUser = (email) => {
    router.delete(route('mindmaps.share.remove', [props.mindmap.id, email]), { preserveScroll: true });
};

const { findNode, addNodes, addEdges, getNodes, getEdges, onConnect, getSelectedEdges, getSelectedNodes, fitView, zoomIn, zoomOut, zoomTo, viewport } = useVueFlow();

const currentZoom = computed(() => {
    return Math.round((viewport?.value?.zoom || 1) * 100);
});

const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
        isFullscreen.value = true;
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
            isFullscreen.value = false;
        }
    }
};

// --- EXPORT TO PDF ---
const isExporting = ref(false);
const isRecording = ref(false);
let mediaRecorder;
let recordedChunks = [];
const exportFilter = (node) => {
    const exclusions = [
        'vue-flow__controls', 
        'vue-flow__minimap', 
        'vue-flow__panel',
        'vue-flow__nodesselection',
        'vue-flow__nodesselection-rect',
        'vue-flow__selectionpane',
        'vue-flow__edgeselection',
        'waypoint-visual'
    ];
    return !exclusions.some(c => node.classList?.contains(c));
};

const exportToPdf = async () => {
    isExporting.value = true;
    const flowWrapper = document.querySelector('.vue-flow');
    if (!flowWrapper) return;
    
    // Clear selection visually before export to ensure no handles/borders are captured
    const selectedNodes = getSelectedNodes.value;
    const selectedEdges = getSelectedEdges.value;
    selectedNodes.forEach(n => n.selected = false);
    selectedEdges.forEach(e => e.selected = false);
    
    fitView({ padding: 0.2, duration: 300 });
    await new Promise(r => setTimeout(r, 400)); // wait for animation
    
    try {
        const dataUrl = await toPng(flowWrapper, {
            backgroundColor: settings.value.backgroundColor,
            pixelRatio: 2,
            filter: exportFilter
        });
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [flowWrapper.offsetWidth, flowWrapper.offsetHeight]
        });
        pdf.addImage(dataUrl, 'PNG', 0, 0, flowWrapper.offsetWidth, flowWrapper.offsetHeight);
        pdf.save(`${title.value || 'Mindmap'}.pdf`);
    } catch (e) {
        console.error("Export failed", e);
        showToast("Gagal mengekspor PDF.", "error");
    } finally {
        // Restore selection
        selectedNodes.forEach(n => n.selected = true);
        selectedEdges.forEach(e => e.selected = true);
        isExporting.value = false;
    }
};

const exportToSvg = async () => {
    isExporting.value = true;
    const flowWrapper = document.querySelector('.vue-flow');
    if (!flowWrapper) return;
    
    // Clear selection visually
    const selectedNodes = getSelectedNodes.value;
    const selectedEdges = getSelectedEdges.value;
    selectedNodes.forEach(n => n.selected = false);
    selectedEdges.forEach(e => e.selected = false);
    
    fitView({ padding: 0.2, duration: 300 });
    await new Promise(r => setTimeout(r, 400));
    
    try {
        const { toSvg } = await import('html-to-image');
        let dataUrl = await toSvg(flowWrapper, {
            backgroundColor: settings.value.backgroundColor,
            filter: exportFilter
        });
        
        // Extract SVG string to manually inject animation keyframes at the root level 
        // to bypass browser restrictions on foreignObject
        let svgString = decodeURIComponent(dataUrl.split(',')[1]);
        const styleToInject = `<style>
            ${animateCssRaw}
            
            @keyframes dashdraw {
                from { stroke-dashoffset: 10; }
                to { stroke-dashoffset: 0; }
            }
            .vue-flow__edge path {
                fill: none !important;
            }
            .vue-flow__edge.animated path {
                stroke-dasharray: 5 !important;
                animation: dashdraw 0.5s linear infinite !important;
            }
            .vue-flow__edge.vue-flow__edge-reverse-anim.animated path {
                animation-direction: reverse !important;
            }
        </style>`;
        
        svgString = svgString.replace('<foreignObject', styleToInject + '<foreignObject');
        dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
        
        const link = document.createElement('a');
        link.download = `${title.value || 'Diagram'}.svg`;
        link.href = dataUrl;
        link.click();
    } catch (error) {
        showToast("Gagal mengekspor animasi SVG.", "error");
        console.error(error);
    } finally {
        // Restore selection
        selectedNodes.forEach(n => n.selected = true);
        selectedEdges.forEach(e => e.selected = true);
        isExporting.value = false;
    }
};

const isVideoRecordModalOpen = ref(false);
const recordDurationTemp = ref(10);
const isHttpsErrorModalOpen = ref(false);

const startVideoRecording = async () => {
    try {
        const durationSec = parseInt(recordDurationTemp.value);
        if (isNaN(durationSec) || durationSec < 1) return;
        isVideoRecordModalOpen.value = false;

        showToast('Memulai proses render video di server...', 'success');
        isRecording.value = true;
        
        await axios.post(route('mindmaps.export_video', props.mindmap.id), {
            duration: durationSec * 1000
        });

        // Start polling for status
        const interval = setInterval(async () => {
            const res = await axios.get(route('mindmaps.video_status', props.mindmap.id));
            if (res.data.status === 'done') {
                clearInterval(interval);
                isRecording.value = false;
                showToast('Video berhasil dibuat! Mengunduh...', 'success');
                
                const link = document.createElement('a');
                link.href = res.data.url;
                link.download = `mindmap-${props.mindmap.id}.webm`;
                link.click();
            } else if (res.data.status === 'failed') {
                clearInterval(interval);
                isRecording.value = false;
                showToast('Gagal merender video di server.', 'error');
            }
        }, 3000);
        
    } catch (e) {
        console.error(e);
        showToast('Gagal memicu render video.', 'error');
        isRecording.value = false;
    }
};

const stopVideoRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
};

// --- STATE MANAGEMENT ---
const defaultSettings = { 
    backgroundStyle: 'dots', backgroundColor: '#f8fafc', edgeStyle: 'smoothstep', edgeColor: '#94a3b8',
    diagramMode: 'mindmap', // 'mindmap' | 'flowchart' | 'uml'
    aspectRatio: 'auto', // 'auto' | '16/9' | '9/16' | '1/1'
    showMinimap: true,
    showControls: true
};
const settings = ref({ ...defaultSettings, ...(props.mindmap.settings || {}) });

// Force reset legacy gray background that hides dots
if (settings.value.backgroundColor === '#aaa') {
    settings.value.backgroundColor = '#f8fafc';
}

// --- SELECTION TRACKING ---
const openCategories = ref({
    basic: true,
    flowchart: true,
    media: true
});
const toggleCategory = (cat) => {
    openCategories.value[cat] = !openCategories.value[cat];
};

const selectedNodeIds = ref([]);
const selectedEdgeIds = ref([]);

watch([getSelectedNodes, getSelectedEdges], ([nodesList, selectedEdgesList]) => {
    selectedNodeIds.value = nodesList.map(n => n.id);
    
    // In mindmap mode, structural branches cannot be selected
    if (settings.value.diagramMode === 'mindmap' && selectedEdgesList.length > 0) {
        selectedEdgesList.forEach(e => { e.selected = false; });
        selectedEdgeIds.value = [];
    } else {
        const newSelectedEdgeIds = selectedEdgesList.map(e => e.id);
        selectedEdgeIds.value = newSelectedEdgeIds;
        
        // Auto-clear label selections for any unselected edges (e.g., clicking canvas)
        const selectedEdgesSet = new Set(newSelectedEdgeIds);
        getEdges.value.forEach(e => {
            if (!selectedEdgesSet.has(e.id) && e.data?.selectedLabelId) {
                e.data.selectedLabelId = null;
            }
        });
    }
}, { deep: true });

const activeSelectionType = computed(() => {
    if (getSelectedNodes.value.length > 0) return 'node';
    if (settings.value.diagramMode !== 'mindmap' && getSelectedEdges.value.length > 0) return 'edge';
    return 'none';
});
const activeNode = computed(() => getSelectedNodes.value[0]);
const activeEdge = computed(() => settings.value.diagramMode !== 'mindmap' ? getSelectedEdges.value[0] : null);
const activeEdgeLabelId = computed(() => activeEdge.value?.data?.selectedLabelId);
const activeEdgeLabel = computed(() => {
    if (!activeEdge.value || !activeEdgeLabelId.value) return null;
    return activeEdge.value.data?.labels?.find(l => l.id === activeEdgeLabelId.value);
});

// --- CONTEXT MENU & RIGHT DRAG PAN DETECTION ---
let isRightDragging = false;
let rightClickStartPos = null;

const onGlobalMouseDown = (e) => {
    if (e.button === 2) {
        rightClickStartPos = { x: e.clientX, y: e.clientY };
        isRightDragging = false;
    }
};

const onGlobalMouseMove = (e) => {
    if (rightClickStartPos) {
        const dist = Math.hypot(e.clientX - rightClickStartPos.x, e.clientY - rightClickStartPos.y);
        if (dist > 5) {
            isRightDragging = true;
        }
    }
};

const onGlobalMouseUp = (e) => {
    rightClickStartPos = null;
    setTimeout(() => {
        isRightDragging = false;
    }, 100);
};

const contextMenu = ref({ show: false, x: 0, y: 0, nodeId: null, edgeId: null, clickEvent: null });
const onNodeContextMenu = (event) => {
    if (!props.canEdit || isRightDragging) return;
    event.event.preventDefault();
    contextMenu.value = {
        show: true,
        x: event.event.clientX,
        y: event.event.clientY,
        nodeId: event.node.id,
        edgeId: null,
        clickEvent: null
    };
};
const onEdgeContextMenu = (event) => {
    if (!props.canEdit || settings.value.diagramMode === 'mindmap' || isRightDragging) return;
    event.event.preventDefault();
    contextMenu.value = {
        show: true,
        x: event.event.clientX,
        y: event.event.clientY,
        nodeId: null,
        edgeId: event.edge.id,
        clickEvent: { clientX: event.event.clientX, clientY: event.event.clientY }
    };
};
const closeContextMenu = () => { contextMenu.value.show = false; };
document.addEventListener('click', closeContextMenu);

// --- NODE/EDGE FUNCTIONS ---
const { project, removeNodes, removeEdges } = useVueFlow();

const onDragStart = (event, nodeType, shape, emojiOrUrl = null) => {
    if (event.dataTransfer) {
        const data = { type: nodeType, shape };
        if (shape === 'emoji') data.emoji = emojiOrUrl;
        if (shape === 'image') data.imageUrl = emojiOrUrl;
        
        event.dataTransfer.setData('application/vueflow', JSON.stringify(data));
        event.dataTransfer.effectAllowed = 'move';
    }
};

const onDrop = (event) => {
    const dataStr = event.dataTransfer?.getData('application/vueflow');
    if (!dataStr) return;
    
    const data = JSON.parse(dataStr);
    const position = project({ x: event.clientX, y: event.clientY - 130 }); // 130 is the header offset roughly, but wait, `project` takes clientX/clientY directly if we pass it correctly? Actually `project` converts client coordinates to flow coordinates! Wait, project usually takes `{ x: event.clientX - flowRect.left, y: event.clientY - flowRect.top }`.

    const flowWrapper = document.querySelector('.vue-flow').getBoundingClientRect();
    const x = event.clientX - flowWrapper.left;
    const y = event.clientY - flowWrapper.top;
    
    const projectedPosition = project({ x, y });

    const newNode = {
        id: `node-${Date.now()}`,
        type: data.type || 'custom',
        position: projectedPosition,
        data: { 
            label: data.shape === 'emoji' || data.shape === 'image' ? '' : (data.shape === 'text' ? 'Judul Teks' : (data.shape === 'paragraph' ? 'Tulis paragraf panjang atau keterangan di sini...' : 'New Node')), 
            shape: data.shape,
            emoji: data.emoji,
            imageUrl: data.imageUrl,
            bgColor: data.shape === 'text' || data.shape === 'paragraph' || data.shape === 'group' ? 'transparent' : '#ffffff',
            textColor: '#111827',
            fontSize: data.shape === 'text' ? 24 : 14,
            fontFamily: 'Inter',
            isBorderOnly: data.shape === 'group' ? true : false,
            width: data.shape === 'group' ? 300 : (data.shape === 'paragraph' ? 250 : null),
            height: data.shape === 'group' ? 200 : null,
            isNew: true,
            onAddChild: handleAddChild,
            onAddSibling: handleAddSibling
        }
    };
    
    addNodes([newNode]);
    commitHistory();
};

const addEdgeLabel = () => {
    if (!activeEdge.value) return;
    
    const e = activeEdge.value;
    if (!e.data || Array.isArray(e.data)) e.data = { ...e.data };
    if (!e.data.labels) {
        e.data.labels = [];
        if (e.data.label) {
            e.data.labels.push({ id: 'lbl_' + Date.now() + '_0', text: e.data.label, progress: 0.5 });
            e.data.label = undefined;
        }
    }
    
    e.data.labels.push({
        id: 'lbl_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        text: 'Teks Baru',
        progress: 0.5
    });
    
    commitHistory();
};

const uploadImageNode = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const imageUrl = e.target.result;
        
        // Add image node roughly at center
        const flowWrapper = document.querySelector('.vue-flow').getBoundingClientRect();
        const x = flowWrapper.width / 2;
        const y = flowWrapper.height / 2;
        
        const projectedPosition = project({ x, y });
        
        const newNode = {
            id: `node-${Date.now()}`,
            type: 'custom',
            position: projectedPosition,
            data: { 
                label: '', 
                shape: 'image',
                imageUrl: imageUrl,
                bgColor: '#ffffff', 
                textColor: '#111827', 
                fontSize: 14, 
                onAddChild: handleAddChild, 
                onAddSibling: handleAddSibling 
            }
        };
        
        addNodes([newNode]);
        commitHistory();
        
        // Reset file input
        event.target.value = '';
    };
    reader.readAsDataURL(file);
};


const exportToPng = async () => {
    isExporting.value = true;
    const flowWrapper = document.querySelector('.vue-flow');
    if (!flowWrapper) return;
    
    const selectedNodes = getSelectedNodes.value;
    const selectedEdges = getSelectedEdges.value;
    selectedNodes.forEach(n => n.selected = false);
    selectedEdges.forEach(e => e.selected = false);
    
    fitView({ padding: 0.2, duration: 300 });
    await new Promise(r => setTimeout(r, 400));
    
    try {
        const dataUrl = await toPng(flowWrapper, {
            backgroundColor: settings.value.backgroundColor || '#ffffff',
            pixelRatio: 2,
            filter: exportFilter
        });
        const link = document.createElement('a');
        link.download = `${title.value || 'Mindmap'}.png`;
        link.href = dataUrl;
        link.click();
        showToast("Berhasil mengekspor gambar PNG!", "success");
    } catch (e) {
        console.error("Export PNG failed", e);
        showToast("Gagal mengekspor gambar PNG.", "error");
    } finally {
        selectedNodes.forEach(n => n.selected = true);
        selectedEdges.forEach(e => e.selected = true);
        isExporting.value = false;
    }
};

const mindmapBranchColors = [
    { bg: '#ef4444', text: '#ffffff', line: '#ef4444' }, // Red (High Contrast White)
    { bg: '#f97316', text: '#ffffff', line: '#f97316' }, // Orange (High Contrast White)
    { bg: '#10b981', text: '#ffffff', line: '#10b981' }, // Emerald Green (High Contrast White)
    { bg: '#06b6d4', text: '#ffffff', line: '#06b6d4' }, // Cyan (High Contrast White)
    { bg: '#3b82f6', text: '#ffffff', line: '#3b82f6' }, // Blue (High Contrast White)
    { bg: '#8b5cf6', text: '#ffffff', line: '#8b5cf6' }, // Purple (High Contrast White)
    { bg: '#ec4899', text: '#ffffff', line: '#ec4899' }, // Pink (High Contrast White)
    { bg: '#f59e0b', text: '#0f172a', line: '#d97706' }, // Amber/Yellow (High Contrast Dark Slate)
    { bg: '#14b8a6', text: '#ffffff', line: '#14b8a6' }, // Teal (High Contrast White)
    { bg: '#6366f1', text: '#ffffff', line: '#6366f1' }, // Indigo (High Contrast White)
];

// --- ADVANCED ZERO-COLLISION MINDMAP TREE LAYOUT ---
const calculateMindmapLayout = () => {
    if (settings.value.diagramMode !== 'mindmap') return;

    const root = findNode('root') || nodes.value.find(n => n.data?.isRoot);
    if (!root) return;

    const rootX = root.position?.x ?? 500;
    const rootY = root.position?.y ?? 350;
    const allEdges = getEdges.value || edges.value;
    const allNodes = getNodes.value || nodes.value;

    const getChildren = (nodeId) => {
        return allEdges
            .filter(e => e.source === nodeId)
            .map(e => allNodes.find(n => n.id === e.target))
            .filter(Boolean);
    };

    // Partition root children into Left and Right
    const rootEdges = allEdges.filter(e => e.source === root.id);
    const rightRootChildren = [];
    const leftRootChildren = [];

    rootEdges.forEach(e => {
        const targetNode = allNodes.find(n => n.id === e.target);
        if (!targetNode) return;
        
        const dir = targetNode.data?.branchDirection || (targetNode.position?.x < rootX ? 'left' : 'right');
        if (dir === 'left') {
            leftRootChildren.push(targetNode);
        } else {
            rightRootChildren.push(targetNode);
        }
    });

    // Subtree height calculation
    const calcSubtree = (node, depth = 1) => {
        const children = getChildren(node.id);
        const isUnderline = node.data?.shape === 'underline';
        const nodeHeight = isUnderline ? 34 : 44;
        const vMargin = isUnderline ? 18 : 26;

        if (children.length === 0) {
            return {
                node,
                depth,
                height: nodeHeight + vMargin,
                children: []
            };
        }

        const childTrees = children.map(c => calcSubtree(c, depth + 1));
        const totalChildrenHeight = childTrees.reduce((sum, c) => sum + c.height, 0);
        const height = Math.max(nodeHeight + vMargin, totalChildrenHeight);

        return {
            node,
            depth,
            height,
            children: childTrees
        };
    };

    // Position a branch side
    const positionSide = (rootChildren, side) => {
        const isRight = (side === 'right');
        const dir = isRight ? 'right' : 'left';

        const subtrees = rootChildren.map(c => calcSubtree(c, 1));
        const totalHeight = subtrees.reduce((sum, t) => sum + t.height, 0);
        
        let startY = rootY - totalHeight / 2;

        const layoutRecursive = (tree, parentX, startSubY, depth) => {
            const node = tree.node;
            const xOffset = depth === 1 ? 210 : (depth === 2 ? 145 : 125);
            const posX = isRight ? parentX + xOffset : parentX - xOffset;
            const centerY = startSubY + tree.height / 2;
            const isUnderline = node.data?.shape === 'underline';
            const selfH = isUnderline ? 28 : 38;

            node.position = { x: posX, y: Math.round(centerY - selfH / 2) };
            if (!node.data) node.data = {};
            node.data.branchDirection = dir;

            let childY = startSubY;
            tree.children.forEach(childTree => {
                layoutRecursive(childTree, posX, childY, depth + 1);
                childY += childTree.height;
            });
        };

        let currentY = startY;
        subtrees.forEach(tree => {
            layoutRecursive(tree, rootX, currentY, 1);
            currentY += tree.height;
        });
    };

    positionSide(rightRootChildren, 'right');
    positionSide(leftRootChildren, 'left');

    // Update edge handles and stroke styles
    edges.value.forEach(edge => {
        const targetNode = allNodes.find(n => n.id === edge.target);
        if (!targetNode) return;

        const isLeft = (targetNode.data?.branchDirection === 'left' || targetNode.position?.x < rootX);
        edge.sourceHandle = isLeft ? 'source-left' : 'source-right';
        edge.targetHandle = isLeft ? 'target-right' : 'target-left';
        edge.type = 'bezier';

        const bColor = targetNode.data?.branchLineColor || targetNode.data?.bgColor || '#38bdf8';
        edge.style = {
            stroke: bColor,
            strokeWidth: 2
        };
    });

    commitHistory();
};

const handleAddChild = (parentId, preferredDirection = null) => {
    const parent = findNode(parentId);
    if (!parent) return;
    
    const activeEdges = getEdges.value || [];
    const isRoot = parentId === 'root' || parent.data?.isRoot;
    
    // Determine branch direction (left or right)
    let direction = 'right';
    if (preferredDirection) {
        direction = preferredDirection;
    } else if (isRoot) {
        const allNodes = getNodes.value || nodes.value;
        const rootNode = findNode('root') || parent;
        const rootX = rootNode.position?.x ?? 500;
        
        // Direct root child nodes
        const rootEdges = activeEdges.filter(e => e.source === (rootNode.id || 'root'));
        const rootChildNodes = rootEdges.map(e => allNodes.find(n => n.id === e.target)).filter(Boolean);
        
        const rightCount = rootChildNodes.filter(n => n.data?.branchDirection === 'right' || (n.position && n.position.x >= rootX)).length;
        const leftCount = rootChildNodes.filter(n => n.data?.branchDirection === 'left' || (n.position && n.position.x < rootX)).length;
        
        // Balance: if right has more, add to left; otherwise add to right
        direction = rightCount > leftCount ? 'left' : 'right';
    } else {
        direction = parent.data?.branchDirection || (parent.position.x < (findNode('root')?.position.x || 400) ? 'left' : 'right');
    }
    
    // Determine branch color
    let branchColor;
    if (isRoot) {
        const rootChildCount = activeEdges.filter(e => e.source === 'root' || e.source === parent.id).length;
        branchColor = mindmapBranchColors[rootChildCount % mindmapBranchColors.length];
    } else {
        branchColor = {
            bg: parent.data?.bgColor || '#ff9f43',
            text: parent.data?.textColor || '#ffffff',
            line: parent.data?.branchLineColor || parent.data?.bgColor || '#ff9f43'
        };
    }
    
    const newId = `node-${Date.now()}`;
    const sourceHandle = direction === 'right' ? 'source-right' : 'source-left';
    const targetHandle = direction === 'right' ? 'target-left' : 'target-right';
    
    const isLevel1 = isRoot;
    const newNode = {
        id: newId, 
        type: 'custom',
        position: { x: parent.position.x + (direction === 'right' ? 180 : -180), y: parent.position.y },
        data: { 
            label: '', 
            isNew: true, 
            shape: isLevel1 ? 'pill' : 'underline',
            bgColor: isLevel1 ? branchColor.bg : 'transparent', 
            textColor: isLevel1 ? branchColor.text : '#0f172a', 
            branchLineColor: branchColor.line,
            branchDirection: direction,
            fontSize: isLevel1 ? 14 : 13, 
            borderWidth: isLevel1 ? 0 : 2,
            onAddChild: handleAddChild, 
            onAddSibling: handleAddSibling,
            onDeleteNode: handleDeleteNode
        }
    };
    
    addNodes([newNode]);

    addEdges([{
        id: `edge-${parentId}-${newId}`, 
        source: parentId, 
        target: newId,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: 'bezier',
        data: { type: 'bezier' },
        style: { stroke: branchColor.line, strokeWidth: 2 }
    }]);

    calculateMindmapLayout();

    nextTick(() => {
        getNodes.value.forEach(n => {
            n.selected = (n.id === newId);
        });
    });
};

const cloneNode = (nodeId) => {
    const nodeToClone = findNode(nodeId);
    if (!nodeToClone) return;
    
    const newId = 'n_' + Math.random().toString(36).substr(2, 9);
    const newNode = {
        id: newId,
        type: nodeToClone.type,
        position: { x: nodeToClone.position.x + 30, y: nodeToClone.position.y + 30 },
        data: JSON.parse(JSON.stringify(nodeToClone.data)),
        style: nodeToClone.style ? JSON.parse(JSON.stringify(nodeToClone.style)) : undefined,
    };
    
    newNode.data.onAddChild = handleAddChild;
    newNode.data.onAddSibling = handleAddSibling;
    newNode.data.onDeleteNode = handleDeleteNode;
    newNode.data.isNew = true;
    
    addNodes([newNode]);
    commitHistory();
};

const handleAddSibling = (nodeId) => {
    if (nodeId === 'root') {
        handleAddChild('root');
        return;
    }
    const node = findNode(nodeId);
    if (!node) return;
    
    const activeEdges = getEdges.value || [];
    const parentEdge = activeEdges.find(e => e.target === nodeId);
    const parentId = parentEdge ? parentEdge.source : 'root';
    const newId = `node-${Date.now()}`;
    
    const direction = node.data?.branchDirection || (node.position.x < (findNode('root')?.position.x || 400) ? 'left' : 'right');
    const sourceHandle = direction === 'right' ? 'source-right' : 'source-left';
    const targetHandle = direction === 'right' ? 'target-left' : 'target-right';
    
    const isLevel1 = (parentId === 'root');
    let branchColor;
    if (isLevel1) {
        const rootChildCount = activeEdges.filter(e => e.source === 'root').length;
        branchColor = mindmapBranchColors[rootChildCount % mindmapBranchColors.length];
    } else {
        branchColor = {
            bg: node.data?.bgColor || '#ff9f43',
            text: node.data?.textColor || '#ffffff',
            line: node.data?.branchLineColor || node.data?.bgColor || '#ff9f43'
        };
    }
    
    const newNode = {
        id: newId, 
        type: 'custom',
        position: { x: node.position.x, y: node.position.y + 40 },
        data: { 
            label: '', 
            isNew: true, 
            shape: isLevel1 ? 'pill' : 'underline',
            bgColor: isLevel1 ? branchColor.bg : 'transparent', 
            textColor: isLevel1 ? branchColor.text : '#0f172a', 
            branchLineColor: branchColor.line,
            branchDirection: direction,
            fontSize: isLevel1 ? 14 : 13, 
            borderWidth: isLevel1 ? 0 : 2,
            onAddChild: handleAddChild, 
            onAddSibling: handleAddSibling,
            onDeleteNode: handleDeleteNode
        }
    };
    
    addNodes([newNode]);

    addEdges([{
        id: `edge-${parentId}-${newId}`, 
        source: parentId, 
        target: newId,
        sourceHandle: sourceHandle,
        targetHandle: targetHandle,
        type: 'bezier', 
        data: { type: 'bezier' },
        style: { stroke: branchColor.line, strokeWidth: 2 }
    }]);

    calculateMindmapLayout();

    nextTick(() => {
        getNodes.value.forEach(n => {
            n.selected = (n.id === newId);
        });
    });
};

const loadExampleMindmap = () => {
    const rootNode = {
        id: 'root',
        type: 'custom',
        position: { x: 500, y: 350 },
        data: {
            label: 'Central Topic',
            isRoot: true,
            shape: 'box',
            bgColor: '#ffffff',
            textColor: '#0f172a',
            fontSize: 20,
            borderWidth: 2,
            borderColor: '#1e293b',
            onAddChild: handleAddChild,
            onAddSibling: handleAddSibling
        }
    };

    const exNodes = [rootNode];
    const exEdges = [];

    // Right branches
    const rightTopics = [
        { id: 'mt-1', label: 'Main Topic 1', color: '#ef4444' },
        { id: 'mt-2', label: 'Main Topic 2', color: '#f97316' },
        { id: 'mt-3', label: 'Main Topic 3', color: '#10b981' },
        { 
            id: 'mt-4', label: 'Main Topic 4', color: '#06b6d4',
            subtopics: [
                { id: 'st-4-1', label: 'Subtopic 1' },
                { 
                    id: 'st-4-2', label: 'Subtopic 2',
                    subtopics: [
                        { 
                            id: 'st-4-2-1', label: 'Subtopic 1',
                            subtopics: [
                                { id: 'st-4-2-1-1', label: 'Subtopic 1' }
                            ]
                        }
                    ]
                }
            ]
        },
        { 
            id: 'mt-14', label: 'Main Topic 14', color: '#3b82f6',
            subtopics: [
                { id: 'st-14-1', label: 'Subtopic 1' },
                { id: 'st-14-2', label: 'Subtopic 2' }
            ]
        },
        { id: 'mt-5', label: 'Main Topic 5', color: '#8b5cf6' },
        { id: 'mt-6', label: 'Main Topic 6', color: '#ec4899' },
    ];

    // Left branches
    const leftTopics = [
        { id: 'mt-13', label: 'Main Topic 13', color: '#f59e0b' },
        { id: 'mt-12', label: 'Main Topic 12', color: '#ef4444' },
        { id: 'mt-11', label: 'Main Topic 11', color: '#8b5cf6' },
        { id: 'mt-10', label: 'Main Topic 10', color: '#3b82f6' },
        { id: 'mt-9', label: 'Main Topic 9', color: '#06b6d4' },
        { id: 'mt-8', label: 'Main Topic 8', color: '#10b981' },
        { id: 'mt-7', label: 'Main Topic 7', color: '#f97316' },
    ];

    rightTopics.forEach(t => {
        exNodes.push({
            id: t.id,
            type: 'custom',
            position: { x: 720, y: 350 },
            data: {
                label: t.label,
                shape: 'pill',
                bgColor: t.color,
                textColor: '#ffffff',
                branchLineColor: t.color,
                branchDirection: 'right',
                fontSize: 14,
                borderWidth: 0,
                onAddChild: handleAddChild,
                onAddSibling: handleAddSibling
            }
        });
        exEdges.push({
            id: `edge-root-${t.id}`,
            source: 'root',
            target: t.id,
            sourceHandle: 'source-right',
            targetHandle: 'target-left',
            type: 'bezier',
            data: { type: 'bezier' },
            style: { stroke: t.color, strokeWidth: 2 }
        });

        if (t.subtopics) {
            const addSubTree = (subs, parentId, pColor) => {
                subs.forEach(sub => {
                    exNodes.push({
                        id: sub.id,
                        type: 'custom',
                        position: { x: 860, y: 350 },
                        data: {
                            label: sub.label,
                            shape: 'underline',
                            bgColor: 'transparent',
                            textColor: '#0f172a',
                            branchLineColor: pColor,
                            branchDirection: 'right',
                            fontSize: 13,
                            borderWidth: 2,
                            onAddChild: handleAddChild,
                            onAddSibling: handleAddSibling
                        }
                    });
                    exEdges.push({
                        id: `edge-${parentId}-${sub.id}`,
                        source: parentId,
                        target: sub.id,
                        sourceHandle: 'source-right',
                        targetHandle: 'target-left',
                        type: 'bezier',
                        data: { type: 'bezier' },
                        style: { stroke: pColor, strokeWidth: 2 }
                    });
                    if (sub.subtopics) {
                        addSubTree(sub.subtopics, sub.id, pColor);
                    }
                });
            };
            addSubTree(t.subtopics, t.id, t.color);
        }
    });

    leftTopics.forEach(t => {
        exNodes.push({
            id: t.id,
            type: 'custom',
            position: { x: 280, y: 350 },
            data: {
                label: t.label,
                shape: 'pill',
                bgColor: t.color,
                textColor: '#ffffff',
                branchLineColor: t.color,
                branchDirection: 'left',
                fontSize: 14,
                borderWidth: 0,
                onAddChild: handleAddChild,
                onAddSibling: handleAddSibling
            }
        });
        exEdges.push({
            id: `edge-root-${t.id}`,
            source: 'root',
            target: t.id,
            sourceHandle: 'source-left',
            targetHandle: 'target-right',
            type: 'bezier',
            data: { type: 'bezier' },
            style: { stroke: t.color, strokeWidth: 2 }
        });
    });

    nodes.value = exNodes;
    edges.value = exEdges;
    calculateMindmapLayout();

    setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
    }, 100);
};

const loadExampleFlowchart = () => {
    const fcNodes = [
        { id: 'fc-1', type: 'custom', position: { x: 400, y: 100 }, data: { label: 'Start Process', shape: 'pill', bgColor: '#3b82f6', textColor: '#ffffff', fontSize: 14, onAddChild: handleAddChild, onAddSibling: handleAddSibling } },
        { id: 'fc-2', type: 'custom', position: { x: 400, y: 220 }, data: { label: 'Fetch User Data', shape: 'box', bgColor: '#f8fafc', textColor: '#1e293b', borderWidth: 2, borderColor: '#cbd5e1', fontSize: 14, onAddChild: handleAddChild, onAddSibling: handleAddSibling } },
        { id: 'fc-3', type: 'custom', position: { x: 400, y: 350 }, data: { label: 'Is Verified?', shape: 'diamond', bgColor: '#fef3c7', textColor: '#92400e', borderWidth: 2, borderColor: '#f59e0b', fontSize: 13, onAddChild: handleAddChild, onAddSibling: handleAddSibling } },
        { id: 'fc-4', type: 'custom', position: { x: 600, y: 480 }, data: { label: 'Send Welcome Email', shape: 'box', bgColor: '#dcfce7', textColor: '#166534', borderWidth: 2, borderColor: '#86efac', fontSize: 14, onAddChild: handleAddChild, onAddSibling: handleAddSibling } },
        { id: 'fc-5', type: 'custom', position: { x: 200, y: 480 }, data: { label: 'Prompt Verification', shape: 'box', bgColor: '#fee2e2', textColor: '#991b1b', borderWidth: 2, borderColor: '#fca5a5', fontSize: 14, onAddChild: handleAddChild, onAddSibling: handleAddSibling } },
    ];
    const fcEdges = [
        { id: 'fce-1', source: 'fc-1', target: 'fc-2', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 }, markerEnd: 'marker-arrowclosed-end-94a3b8' },
        { id: 'fce-2', source: 'fc-2', target: 'fc-3', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'smoothstep', style: { stroke: '#94a3b8', strokeWidth: 2 }, markerEnd: 'marker-arrowclosed-end-94a3b8' },
        { id: 'fce-3', source: 'fc-3', target: 'fc-4', sourceHandle: 'source-right', targetHandle: 'target-top', type: 'smoothstep', style: { stroke: '#10b981', strokeWidth: 2 }, markerEnd: 'marker-arrowclosed-end-10b981', data: { labels: [{ id: 'lbl-yes', text: 'Yes', progress: 0.5 }] } },
        { id: 'fce-4', source: 'fc-3', target: 'fc-5', sourceHandle: 'source-left', targetHandle: 'target-top', type: 'smoothstep', style: { stroke: '#ef4444', strokeWidth: 2 }, markerEnd: 'marker-arrowclosed-end-ef4444', data: { labels: [{ id: 'lbl-no', text: 'No', progress: 0.5 }] } },
    ];
    nodes.value = fcNodes;
    edges.value = fcEdges;
    commitHistory();
    setTimeout(() => {
        fitView({ padding: 0.2, duration: 400 });
    }, 100);
};

// --- RECURSIVE CASCADE DELETE ---
const getAllDescendantNodeIds = (startNodeIds) => {
    const toDelete = new Set(startNodeIds);
    const queue = [...startNodeIds];
    const allEdges = getEdges?.value || edges?.value || [];
    
    while (queue.length > 0) {
        const currentId = queue.shift();
        const childEdges = allEdges.filter(e => e.source === currentId);
        childEdges.forEach(e => {
            if (!toDelete.has(e.target)) {
                toDelete.add(e.target);
                queue.push(e.target);
            }
        });
    }
    return Array.from(toDelete);
};

const handleDeleteNodes = (nodeIds) => {
    if (!props.canEdit || !nodeIds || nodeIds.length === 0) return;
    
    const targetIds = Array.isArray(nodeIds) ? nodeIds : [nodeIds];
    // Filter out root from deletion (Central Topic cannot be deleted)
    const filteredTargetIds = targetIds.filter(id => id !== 'root');
    if (filteredTargetIds.length === 0) return;

    // Get all descendant IDs (cascade delete parent and all children recursively)
    const allIdsToDelete = getAllDescendantNodeIds(filteredTargetIds).filter(id => id !== 'root');
    const deleteSet = new Set(allIdsToDelete);

    // Remove nodes
    nodes.value = (nodes.value || []).filter(n => !deleteSet.has(n.id));

    // Remove connected edges
    edges.value = (edges.value || []).filter(e => !deleteSet.has(e.source) && !deleteSet.has(e.target));

    if (settings.value.diagramMode === 'mindmap') {
        calculateMindmapLayout();
    }
    commitHistory();
};

const handleDeleteNode = (nodeId) => {
    const selectedNodes = getSelectedNodes?.value || [];
    if (selectedNodes.some(n => n.id === nodeId)) {
        handleDeleteNodes(selectedNodes.map(n => n.id));
    } else {
        handleDeleteNodes([nodeId]);
    }
};

const mapNodes = (rawNodes) => {
    let nodesArray = rawNodes || [];
    if (nodesArray.length === 0 && settings.value.diagramMode === 'mindmap') {
        nodesArray = [{ 
            id: 'root', 
            type: 'custom', 
            position: { x: 450, y: 250 }, 
            data: { 
                label: 'Central Topic', 
                isRoot: true,
                shape: 'box',
                bgColor: '#ffffff', 
                textColor: '#0f172a', 
                borderColor: '#38bdf8',
                borderWidth: 2,
                fontSize: 22,
                fontWeight: 'bold'
            } 
        }];
    }
    return nodesArray.map(n => ({ 
        ...n, 
        data: { 
            ...n.data, 
            onAddChild: handleAddChild, 
            onAddSibling: handleAddSibling,
            onDeleteNode: handleDeleteNode
        } 
    }));
};

const state = ref({
    nodes: mapNodes(props.mindmap.nodes),
    edges: props.mindmap.edges || [],
    settings: settings.value
});

const nodes = ref(state.value.nodes);
const edges = ref(state.value.edges);

// --- UNDO / REDO HISTORY ---
const { undo, redo, commit, canUndo, canRedo } = useManualRefHistory(state, { clone: true, capacity: 50 });
const saveState = ref('');

const commitHistory = debounce(() => {
    state.value = {
        nodes: getNodes.value.map(n => ({ id: n.id, type: n.type, position: n.position, zIndex: n.zIndex || 0, style: n.style, data: { ...n.data, onAddChild: undefined, onAddSibling: undefined } })),
        edges: getEdges.value.map(e => ({
            id: e.id, source: e.source, target: e.target,
            sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
            type: e.type, animated: e.animated, style: e.style,
            class: e.class, markerEnd: e.markerEnd, markerStart: e.markerStart,
            data: e.data, label: e.label
        })),
        settings: JSON.parse(JSON.stringify(settings.value))
    };
    commit();
}, 200);

watch(state, (newState) => {
    nodes.value = mapNodes(newState.nodes);
    edges.value = newState.edges;
    settings.value = newState.settings;
}, { deep: false });

onKeyStroke(['z', 'Z'], (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); if (canUndo.value) undo(); }
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); if (canRedo.value) redo(); }
});
onKeyStroke(['y', 'Y'], (e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); if (canRedo.value) redo(); }
});

onKeyStroke('Tab', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (settings.value.diagramMode === 'mindmap' && getSelectedNodes.value.length === 1) {
        e.preventDefault();
        handleAddChild(getSelectedNodes.value[0].id);
    }
});

onKeyStroke('Enter', (e) => {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (settings.value.diagramMode === 'mindmap' && getSelectedNodes.value.length === 1 && !e.shiftKey) {
        e.preventDefault();
        handleAddSibling(getSelectedNodes.value[0].id);
    }
});

onKeyStroke(['s', 'S'], (e) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        saveMindmapManual();
    }
});

onKeyStroke(['a', 'A'], (e) => {
    if (e.ctrlKey || e.metaKey) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        e.preventDefault();
        
        const allNodes = getNodes.value.map(n => n.id);
        const allEdges = getEdges.value.map(e => e.id);
        
        getNodes.value.forEach(n => n.selected = true);
        getEdges.value.forEach(e => e.selected = true);
    }
});

onMounted(() => {
    // Initial centering
    setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
        
        // If this is a server render view, trigger animations immediately
        if (props.isRenderView) {
            setTimeout(() => {
                triggerMindmapAnimations();
            }, 500); // Small delay to let the initial zoom settle
        }
    }, 100);
});

onConnect((params) => {
    addEdges([{...params, type: settings.value.edgeStyle, style: { stroke: settings.value.edgeColor, strokeWidth: 2 }}]);
    commitHistory();
});

const onQuickConnect = ({ id, direction }) => {
    const parentNode = findNode(id) || nodes.value.find(n => n.id === id);
    if (!parentNode) return;
    
    const newId = 'n-' + Date.now();
    let offsetX = 0;
    let offsetY = 0;
    const distanceX = 220;
    const distanceY = 120;
    
    if (direction === 'right') offsetX = distanceX;
    if (direction === 'left') offsetX = -distanceX;
    if (direction === 'bottom') offsetY = distanceY;
    if (direction === 'top') offsetY = -distanceY;
    
    const newNode = {
        id: newId,
        type: 'custom',
        position: { x: parentNode.position.x + offsetX, y: parentNode.position.y + offsetY },
        data: { 
            ...parentNode.data, 
            label: 'Ide Baru', 
            isNew: true,
            onAddChild: handleAddChild,
            onAddSibling: handleAddSibling
        }
    };
    
    addNodes([newNode]);
    
    // Choose handle based on direction
    let sourceHandle = 'source-right';
    let targetHandle = 'target-left';
    
    if (direction === 'right') { sourceHandle = 'source-right'; targetHandle = 'target-left'; }
    if (direction === 'left') { sourceHandle = 'source-left'; targetHandle = 'target-right'; }
    if (direction === 'bottom') { sourceHandle = 'source-bottom'; targetHandle = 'target-top'; }
    if (direction === 'top') { sourceHandle = 'source-top'; targetHandle = 'target-bottom'; }

    const newEdge = {
        id: `edge-${id}-${newId}`,
        source: id,
        target: newId,
        sourceHandle,
        targetHandle,
        type: settings.value.edgeStyle,
        style: { stroke: settings.value.edgeColor, strokeWidth: 2 }
    };

    if (settings.value.diagramMode === 'flowchart') {
        newEdge.data = { arrow: 'forward', arrowModel: 'arrowclosed' };
        updateArrowMarker(newEdge, 'forward', 'arrowclosed');
    }

    addEdges([newEdge]);
    
    commitHistory();
};

const onEdgeDoubleClick = ({ edge, event }) => {
    if (!props.canEdit) return;
    
    // Select the edge so addEdgeLabel acts on it
    edges.value = edges.value.map(e => ({ ...e, selected: e.id === edge.id }));
    setTimeout(() => {
        addEdgeLabel();
    }, 50);
};

const addWaypointFromContext = () => {
    const edgeId = contextMenu.value.edgeId;
    const event = contextMenu.value.clickEvent;
    if (!edgeId || !event) return;
    
    const edge = edges.value.find(e => e.id === edgeId);
    if (!edge) return;
    
    const flowWrapper = document.querySelector('.vue-flow').getBoundingClientRect();
    const x = event.clientX - flowWrapper.left;
    const y = event.clientY - flowWrapper.top;
    const projectedPosition = project({ x, y });
    
    const waypointId = `waypoint_${Date.now()}`;
    const waypointNode = {
        id: waypointId,
        type: 'custom',
        position: projectedPosition,
        data: { shape: 'waypoint' },
        dragHandle: '.waypoint-drag-handle',
        style: { zIndex: 10 }
    };
    
    const edge1 = {
        id: `e_${edge.source}_${waypointId}`,
        source: edge.source,
        target: waypointId,
        sourceHandle: edge.sourceHandle,
        targetHandle: 'wp-target',
        type: edge.type || 'smoothstep',
        animated: edge.animated,
        style: { ...edge.style },
        class: edge.class,
        markerStart: edge.markerStart,
        data: { ...(edge.data || {}) }
    };
    edge1.data.arrow = 'none';
    
    const edge2 = {
        id: `e_${waypointId}_${edge.target}`,
        source: waypointId,
        target: edge.target,
        sourceHandle: 'wp-source',
        targetHandle: edge.targetHandle,
        type: edge.type || 'smoothstep',
        animated: edge.animated,
        style: { ...edge.style },
        class: edge.class,
        markerEnd: edge.markerEnd,
        data: { ...(edge.data || {}), labels: [] }
    };
    
    nodes.value.push(waypointNode);
    edges.value = edges.value.filter(e => e.id !== edge.id);
    edges.value.push(edge1, edge2);
    
    commitHistory();
    closeContextMenu();
};

const onEdgeUpdate = ({ edge, connection }) => {
    edges.value = updateEdge(edge, connection, edges.value);
};

const onNodesChange = (changes) => {
    const removals = changes.filter(c => c.type === 'remove');
    if (removals.length > 0) {
        removals.forEach(r => {
            const node = nodes.value.find(n => n.id === r.id);
            if (node && node.data?.shape === 'waypoint') {
                const inEdge = edges.value.find(e => e.target === r.id);
                const outEdge = edges.value.find(e => e.source === r.id);
                
                if (inEdge && outEdge) {
                    const newEdge = {
                        ...inEdge,
                        id: `e_${inEdge.source}_${outEdge.target}_${Date.now()}`,
                        target: outEdge.target,
                        targetHandle: outEdge.targetHandle,
                        markerEnd: outEdge.markerEnd,
                        data: {
                            ...(inEdge.data || {}),
                            arrow: outEdge.data?.arrow || inEdge.data?.arrow
                        }
                    };
                    edges.value.push(newEdge);
                }
            }
        });
        commitHistory();
    }
};

const onEdgesChange = (changes) => {
    if (changes.some(c => c.type === 'remove')) commitHistory();
};

const onEdgeUpdateEnd = () => {
    commitHistory();
};

const onEdgeClick = ({ edge }) => {
    if (settings.value.diagramMode === 'mindmap') {
        // In mindmap mode, structural branches cannot be selected or deleted
        edges.value.forEach(e => { e.selected = false; });
        return;
    }
    const chainIds = getEdgeChain(edge);
    edges.value.forEach(e => {
        if (chainIds.includes(e.id) && !e.selected) {
            e.selected = true;
        }
    });
};

// --- UPDATING PROPERTIES ---
const updateNodeZIndex = (change) => {
    getSelectedNodes.value.forEach(n => {
        n.zIndex = (n.zIndex || 0) + change;
    });
    commitHistory();
};

const updateNodeProperty = (prop, value) => {
    getSelectedNodes.value.forEach(n => { n.data[prop] = value; });
    commitHistory();
};

const updateArrowMarker = (edge, direction, model) => {
    if (direction === 'none' || !direction) {
        edge.markerStart = undefined;
        edge.markerEnd = undefined;
        return;
    }

    const color = (edge.style?.stroke || '#94a3b8').replace('#', '');
    let markerStartId = '';
    let markerEndId = '';

    if (model === 'arrowclosed' || model === 'arrow') {
        // Use custom SVG markers for standard arrows to prevent direction reversal issues
        markerStartId = `marker-${model}-start-${color}`;
        markerEndId = `marker-${model}-end-${color}`;
    } else {
        // Custom SVG markers defined in template (circle, diamond, square)
        markerStartId = `marker-${model}-${color}`;
        markerEndId = `marker-${model}-${color}`;
    }
    
    if (direction === 'forward') {
        edge.markerEnd = markerEndId;
        edge.markerStart = undefined;
    } else if (direction === 'backward') {
        edge.markerStart = markerStartId;
        edge.markerEnd = undefined;
    } else if (direction === 'both') {
        edge.markerStart = markerStartId;
        edge.markerEnd = markerEndId;
    }
};

const getEdgeChain = (startEdge) => {
    if (!startEdge) return [];
    let chain = new Set([startEdge.id]);
    let queue = [startEdge.id];
    
    while(queue.length > 0) {
        let currentId = queue.shift();
        let current = edges.value.find(e => e.id === currentId);
        if(!current) continue;
        
        let srcNode = nodes.value.find(n => n.id === current.source);
        if (srcNode && srcNode.data?.shape === 'waypoint') {
            let inEdges = edges.value.filter(e => e.target === srcNode.id);
            inEdges.forEach(inEdge => {
                if (!chain.has(inEdge.id)) {
                    chain.add(inEdge.id);
                    queue.push(inEdge.id);
                }
            });
        }
        
        let tgtNode = nodes.value.find(n => n.id === current.target);
        if (tgtNode && tgtNode.data?.shape === 'waypoint') {
            let outEdges = edges.value.filter(e => e.source === tgtNode.id);
            outEdges.forEach(outEdge => {
                if (!chain.has(outEdge.id)) {
                    chain.add(outEdge.id);
                    queue.push(outEdge.id);
                }
            });
        }
    }
    return Array.from(chain);
};

const updateEdgeProperty = (key, value) => {
    if (!activeEdge.value) return;
    
    const chainIds = getEdgeChain(activeEdge.value);
    
    chainIds.forEach(id => {
        const e = edges.value.find(ed => ed.id === id);
        if (!e) return;
        
        if (!e.data || Array.isArray(e.data)) e.data = { ...e.data };
        
        const tgtNode = nodes.value.find(n => n.id === e.target);
        const isFinalSegment = !tgtNode || tgtNode.data?.shape !== 'waypoint';
        
        const srcNode = nodes.value.find(n => n.id === e.source);
        const isFirstSegment = !srcNode || srcNode.data?.shape !== 'waypoint';

        if (key === 'width') {
            if (!e.style) e.style = {};
            e.style.strokeWidth = value;
        } else if (key === 'color') {
            if (!e.style) e.style = {};
            e.style.stroke = value;
        } else if (key === 'animated') {
            e.animated = value;
        } else if (key === 'type') {
            e.type = value;
            e.data.type = value;
        } else if (key === 'pattern') {
            e.data.pattern = value;
            if (value === 'solid') {
                if (e.style) delete e.style.strokeDasharray;
            } else if (value === 'dashed') {
                e.style = { ...e.style, strokeDasharray: '6,6' };
            } else if (value === 'dotted') {
                e.style = { ...e.style, strokeDasharray: '2,4', strokeLinecap: 'round' };
            }
        } else if (key === 'arrow' || key === 'arrowModel' || key === 'arrowSize') {
            e.data[key] = value;
        } else {
            e.data[key] = value;
        }

        // Distribute arrows correctly across the chain
        if (e.data.arrow && e.data.arrow !== 'none') {
            let effectiveDirection = 'none';
            if (e.data.arrow === 'forward') {
                if (isFinalSegment) effectiveDirection = 'forward';
            } else if (e.data.arrow === 'backward') {
                if (isFirstSegment) effectiveDirection = 'backward';
            } else if (e.data.arrow === 'both') {
                if (isFirstSegment && isFinalSegment) effectiveDirection = 'both';
                else if (isFirstSegment) effectiveDirection = 'backward';
                else if (isFinalSegment) effectiveDirection = 'forward';
            }
            updateArrowMarker(e, effectiveDirection, e.data.arrowModel || 'arrowclosed');
        } else {
            updateArrowMarker(e, 'none');
        }
        
        if (['animated', 'animDirection', 'animSpeed', 'animStyle'].includes(key)) {
            let cls = [];
            if (e.data.animDirection === 'reverse') cls.push('vue-flow__edge-reverse-anim');
            if (e.data.animSpeed === 'slow') cls.push('anim-slow');
            if (e.data.animSpeed === 'fast') cls.push('anim-fast');
            if (e.data.animStyle === 'pulse') cls.push('anim-style-pulse');
            if (e.data.animStyle === 'ants') cls.push('anim-style-ants');
            if (e.data.animStyle === 'snake') cls.push('anim-style-snake');
            e.class = cls.join(' ');
        }
    });
    
    if (key === 'type') {
        edges.value = edges.value.map(edg => chainIds.includes(edg.id) ? { ...edg } : edg);
    }
    commitHistory();
};

const updateEdgeLabelProperty = (key, value) => {
    if (!activeEdge.value || !activeEdgeLabelId.value) return;
    const e = activeEdge.value;
    if (!e.data || !e.data.labels) return;
    const lbl = e.data.labels.find(l => l.id === activeEdgeLabelId.value);
    if (lbl) {
        lbl[key] = value;
    }
    commitHistory();
};

const updateCanvasProperty = (prop, value) => {
    settings.value[prop] = value;
    commitHistory();
};

// --- THEME ENGINE ---
const themes = {
    classic: {
        name: 'Classic Mindmap', previewClass: 'bg-white border-blue-500',
        nodeBg: '#ffffff', nodeText: '#1e40af', nodeBorder: '#3b82f6', edgeColor: '#60a5fa', edgeType: 'smoothstep', animated: false
    },
    sharp: {
        name: 'Sharp Corporate', previewClass: 'bg-slate-100 border-slate-700 rounded-none',
        nodeBg: '#f1f5f9', nodeText: '#0f172a', nodeBorder: '#334155', edgeColor: '#475569', edgeType: 'step', animated: false
    },
    cyberpunk: {
        name: 'Neon Cyberpunk', previewClass: 'bg-gray-900 border-pink-500 shadow-[0_0_10px_#ec4899]',
        nodeBg: '#1e293b', nodeText: '#06b6d4', nodeBorder: '#ec4899', edgeColor: '#3b82f6', edgeType: 'bezier', animated: true
    },
    organic: {
        name: 'Organic Flow', previewClass: 'bg-green-100 border-transparent rounded-full',
        nodeBg: '#dcfce7', nodeText: '#14532d', nodeBorder: '#dcfce7', edgeColor: '#22c55e', edgeType: 'bezier', animated: false
    },
    blueprint: {
        name: 'Blueprint', previewClass: 'bg-blue-800 border-dashed border-white',
        nodeBg: '#1e3a8a', nodeText: '#ffffff', nodeBorder: '#bfdbfe', edgeColor: '#93c5fd', edgeType: 'step', animated: false
    },
    pastel: {
        name: 'Pastel Cloud', previewClass: 'bg-pink-50 border-purple-200 rounded-full',
        nodeBg: '#fdf2f8', nodeText: '#831843', nodeBorder: '#fbcfe8', edgeColor: '#d8b4fe', edgeType: 'smoothstep', animated: true
    }
};

const applyTheme = (themeKey) => {
    const t = themes[themeKey];
    
    // Update Canvas Global Line Style
    settings.value.edgeStyle = t.edgeType;
    settings.value.edgeColor = t.edgeColor;

    // Update Nodes
    nodes.value.forEach(n => {
        n.data.bgColor = t.nodeBg;
        n.data.textColor = t.nodeText;
        n.data.borderColor = t.nodeBorder;
    });

    // Update Edges
    edges.value.forEach(e => {
        e.type = t.edgeType;
        e.style = { stroke: t.edgeColor };
        e.animated = t.animated;
    });

    commitHistory();
};

// --- TEMPLATE ENGINE ---
const templateCategories = [
    {
        name: '🌟 Mind Map (Radial)',
        templates: [
            { name: 'Classic', layout: 'RADIAL', shape: 'pill', edge: 'bezier', icon: 'M' },
            { name: 'Structured', layout: 'RADIAL', shape: 'box', edge: 'straight', icon: 'M' },
            { name: 'Minimalist', layout: 'RADIAL', shape: 'underline', edge: 'smoothstep', icon: 'M' },
            { name: 'Organic', layout: 'RADIAL', shape: 'pill', edge: 'smoothstep', icon: 'M' },
        ]
    },
    {
        name: '➡️ Logic Chart (Right)',
        templates: [
            { name: 'Standard', layout: 'LR', shape: 'box', edge: 'step', icon: '➡' },
            { name: 'Flowing', layout: 'LR', shape: 'pill', edge: 'bezier', icon: '➡' },
            { name: 'Clean', layout: 'LR', shape: 'underline', edge: 'straight', icon: '➡' },
            { name: 'Timeline', layout: 'LR', shape: 'box', edge: 'smoothstep', icon: '➡' },
        ]
    },
    {
        name: '⬅️ Logic Chart (Left)',
        templates: [
            { name: 'Standard', layout: 'RL', shape: 'box', edge: 'step', icon: '⬅' },
            { name: 'Flowing', layout: 'RL', shape: 'pill', edge: 'bezier', icon: '⬅' },
        ]
    },
    {
        name: '⬇️ Org Chart',
        templates: [
            { name: 'Corporate', layout: 'TB', shape: 'box', edge: 'step', icon: '⬇' },
            { name: 'Modern', layout: 'TB', shape: 'pill', edge: 'smoothstep', icon: '⬇' },
            { name: 'Compact', layout: 'TB', shape: 'underline', edge: 'straight', icon: '⬇' },
        ]
    },
    {
        name: '{ Brace Map',
        templates: [
            { name: 'Standard', layout: 'LR', shape: 'box', edge: 'brace', icon: '{' },
            { name: 'Underlined', layout: 'LR', shape: 'underline', edge: 'brace', icon: '{' },
            { name: 'Vertical', layout: 'TB', shape: 'box', edge: 'brace', icon: '{' },
        ]
    }
];

const applyTemplate = (layout, shape, edgeType) => {
    // 1. Update Global Canvas Edge Style
    settings.value.edgeStyle = edgeType;
    
    // 2. Update Node Shapes and ensure Edges use the new style
    nodes.value.forEach(n => {
        n.data.shape = shape;
    });
    edges.value.forEach(e => {
        e.type = edgeType;
    });

    // 3. Layout the nodes
    layoutNodes(layout); // this also commits history
};

// --- DAGRE / MINDMAP AUTO-LAYOUT ---
const layoutNodes = (direction = 'RADIAL') => {
    if (direction === 'RADIAL') {
        calculateMindmapLayout();
        return;
    }
    
    // Helper to run dagre on a set of nodes/edges for flowchart / logic chart modes
    const runDagre = (dir, nodesToLayout, edgesToLayout) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: dir, nodesep: 40, ranksep: 120 });
        g.setDefaultEdgeLabel(() => ({}));

        nodesToLayout.forEach(node => {
            const width = Math.max(140, (node.data.label?.length || 10) * 8);
            g.setNode(node.id, { width, height: 50 });
        });

        edgesToLayout.forEach(edge => {
            g.setEdge(edge.source, edge.target);
        });

        dagre.layout(g);
        return g;
    };

    const applyPositions = (nodesArray, g) => {
        return nodesArray.map(node => {
            const nodeWithPosition = g.node(node.id);
            if (!nodeWithPosition) return node;
            return {
                ...node,
                position: {
                    x: Math.round(nodeWithPosition.x - nodeWithPosition.width / 2),
                    y: Math.round(nodeWithPosition.y - nodeWithPosition.height / 2)
                }
            };
        });
    };

    const g = runDagre(direction, nodes.value, edges.value);
    nodes.value = applyPositions(nodes.value, g);

    // UPDATE ALL EDGE HANDLES TO FIX ROUTING
    edges.value.forEach(edge => {
        let sHandle = 'source-right';
        let tHandle = 'target-left';
        
        if (direction === 'RL') {
            sHandle = 'source-left';
            tHandle = 'target-right';
        } else if (direction === 'TB') {
            sHandle = 'source-bottom';
            tHandle = 'target-top';
        } else if (direction === 'BT') {
            sHandle = 'source-top';
            tHandle = 'target-bottom';
        }

        edge.sourceHandle = sHandle;
        edge.targetHandle = tHandle;
    });

    commitHistory();
};

// --- AUTO SAVE ---
let lastSavedData = '';


const performSave = (isManual = false) => {
    if (!props.canEdit) return;
    saveState.value = 'Saving...';
    
    // Force active input to blur so real-time edits commit before building payload
    if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
    }
    
    const payload = {
        name: title.value,
        nodes: getNodes.value.map(n => ({ id: n.id, type: n.type, position: n.position, zIndex: n.zIndex || 0, style: n.style, data: { ...n.data, onAddChild: undefined, onAddSibling: undefined } })),
        edges: getEdges.value.map(e => ({
            id: e.id, source: e.source, target: e.target,
            sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
            type: e.type, animated: e.animated, style: e.style,
            class: e.class, markerEnd: e.markerEnd, markerStart: e.markerStart,
            data: e.data, label: e.label
        })),
        settings: settings.value,
    };
    
    console.log('[DEBUG] Saving payload edges:', JSON.parse(JSON.stringify(payload.edges)));
    
    axios.put(route('mindmaps.update', props.mindmap.id), payload).then(() => {
        lastSavedData = JSON.stringify(payload);
        saveState.value = 'Saved';
        setTimeout(() => { if (saveState.value === 'Saved') saveState.value = ''; }, 3000);
        if (isManual) showToast('Tersimpan dengan sukses!', 'success');
    }).catch(err => {
        saveState.value = 'Error saving';
        console.error("Auto-save failed", err);
        showToast('Gagal menyimpan. Periksa koneksi Anda!', 'error');
    });
};

const saveMindmap = debounce(() => {
    performSave(false);
}, 1500);

const saveMindmapManual = () => {
    performSave(true);
};

const detectChanges = debounce(() => {
    const payload = {
        name: title.value,
        nodes: getNodes.value.map(n => ({ id: n.id, type: n.type, position: n.position, zIndex: n.zIndex || 0, style: n.style, data: { ...n.data, onAddChild: undefined, onAddSibling: undefined } })),
        edges: getEdges.value.map(e => ({
            id: e.id, source: e.source, target: e.target,
            sourceHandle: e.sourceHandle, targetHandle: e.targetHandle,
            type: e.type, animated: e.animated, style: e.style,
            class: e.class, markerEnd: e.markerEnd, markerStart: e.markerStart,
            data: e.data, label: e.label
        })),
        settings: settings.value,
    };
    const payloadStr = JSON.stringify(payload);
    if (payloadStr !== lastSavedData) {
        if (lastSavedData !== '') saveState.value = 'Unsaved changes';
        lastSavedData = payloadStr; // Update immediately so we don't trigger this again until something else changes
        saveMindmap();
    }
}, 500, { maxWait: 1000 });

// Removed deep watcher to reduce performance overhead on large graphs
// watch([nodes, edges, settings], detectChanges, { deep: true });

const updateTitle = () => {
    isEditingTitle.value = false;
    if (title.value.trim() === '') title.value = 'Untitled Mindmap';
    saveMindmap();
};

const onPaneReady = (flowInstance) => {
    if (settings.value.viewport) {
        flowInstance.setViewport(settings.value.viewport);
    } else {
        flowInstance.fitView({ padding: 0.2, maxZoom: 1, duration: 500 });
    }
};

const onMoveEnd = (event) => {
    if (!props.canEdit) return;
    if (event && event.flowTransform) {
        settings.value.viewport = { 
            x: event.flowTransform.x, 
            y: event.flowTransform.y, 
            zoom: event.flowTransform.zoom 
        };
    }
};

const handleEdgeMutated = () => {
    commitHistory();
};

// --- ROOT DRAG MOVES ENTIRE TREE ---
let lastRootPos = null;

const onNodeDragStart = (event) => {
    if (event.node.id === 'root' || event.node.data?.isRoot) {
        lastRootPos = { x: event.node.position.x, y: event.node.position.y };
    }
};

const onNodeDrag = (event) => {
    if (event.node.id === 'root' || event.node.data?.isRoot) {
        if (!lastRootPos) {
            lastRootPos = { x: event.node.position.x, y: event.node.position.y };
            return;
        }
        const dx = event.node.position.x - lastRootPos.x;
        const dy = event.node.position.y - lastRootPos.y;
        
        if (dx !== 0 || dy !== 0) {
            nodes.value.forEach(n => {
                if (n.id !== event.node.id) {
                    n.position = {
                        x: n.position.x + dx,
                        y: n.position.y + dy
                    };
                }
            });
            lastRootPos = { x: event.node.position.x, y: event.node.position.y };
        }
    }
};

const onNodeDragStop = (event) => {
    lastRootPos = null;
    commitHistory();
};

const handleDeleteEdgeChain = (edgeId) => {
    const edg = getEdges.value.find(e => e.id === edgeId);
    if (!edg) return;
    
    const chainIds = getEdgeChain(edg);
    const waypointsToDelete = new Set();
    
    chainIds.forEach(id => {
        const chainEdg = getEdges.value.find(e => e.id === id);
        if (chainEdg) {
            const srcNode = getNodes.value.find(n => n.id === chainEdg.source);
            if (srcNode && srcNode.data?.shape === 'waypoint') waypointsToDelete.add(srcNode.id);
            
            const tgtNode = getNodes.value.find(n => n.id === chainEdg.target);
            if (tgtNode && tgtNode.data?.shape === 'waypoint') waypointsToDelete.add(tgtNode.id);
        }
    });
    
    edges.value = edges.value.filter(e => !chainIds.includes(e.id));
    if (waypointsToDelete.size > 0) {
        nodes.value = nodes.value.filter(n => !waypointsToDelete.has(n.id));
    }
    commitHistory();
};

let autoSaveInterval = null;

const handleGlobalKeyDown = (e) => {
    if (!props.canEdit) return;
    
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
    }
    
    if (e.key === 'Delete' || e.key === 'Backspace') {
        // Multi-node or single-node deletion
        const selectedNodes = getSelectedNodes.value;
        if (selectedNodes.length > 0) {
            e.preventDefault();
            handleDeleteNodes(selectedNodes.map(n => n.id));
            return;
        }

        if (settings.value.diagramMode === 'mindmap') {
            return;
        }

        if (activeEdgeLabelId.value && activeEdge.value) {
            e.preventDefault();
            const edge = activeEdge.value;
            if (edge.data && edge.data.labels) {
                edge.data.labels = edge.data.labels.filter(l => l.id !== activeEdgeLabelId.value);
                edge.data.selectedLabelId = null;
                
                const newEdges = [...edges.value];
                edges.value = newEdges;
                
                commitHistory();
            }
        } else if (activeEdge.value) {
            e.preventDefault();
            handleDeleteEdgeChain(activeEdge.value.id);
        }
    }
};

onMounted(() => {
    window.addEventListener('mindmap-edge-mutated', handleEdgeMutated);
    window.addEventListener('keydown', handleGlobalKeyDown);
    window.addEventListener('mousedown', onGlobalMouseDown);
    window.addEventListener('mousemove', onGlobalMouseMove);
    window.addEventListener('mouseup', onGlobalMouseUp);
    
    // Set up auto-save interval (every 60 seconds)
    autoSaveInterval = setInterval(() => {
        detectChanges();
    }, 60000);
});

onUnmounted(() => {
    window.removeEventListener('mindmap-edge-mutated', handleEdgeMutated);
    window.removeEventListener('keydown', handleGlobalKeyDown);
    window.removeEventListener('mousedown', onGlobalMouseDown);
    window.removeEventListener('mousemove', onGlobalMouseMove);
    window.removeEventListener('mouseup', onGlobalMouseUp);
    if (autoSaveInterval) clearInterval(autoSaveInterval);
});
</script>

<template>
    <div class="h-screen w-screen overflow-hidden flex flex-col bg-white text-gray-800 select-none">
        <Head :title="title ? `${title} - Talawire` : 'Mindmap Editor'" />

        <!-- TOP NAVIGATION BAR (Xmind AI Minimalist Header) -->
        <header class="h-12 border-b border-gray-100 bg-white flex items-center justify-between px-3 z-30 shrink-0 relative">
            <!-- Left: Logo, Menu, Title, Breadcrumb & Save Status -->
            <div class="flex items-center gap-2">
                <!-- App Logo & Menu -->
                <div class="relative">
                    <button @click="isFileMenuOpen = !isFileMenuOpen" class="flex items-center gap-1.5 p-1 rounded-lg hover:bg-gray-100 text-gray-700 transition" title="Menu">
                        <div class="w-6 h-6 rounded-md bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-xs">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><circle cx="5" cy="17" r="2"/><line x1="12" y1="9" x2="12" y2="6"/><line x1="12" y1="15" x2="12" y2="18"/><line x1="9.5" y1="10.5" x2="6.5" y2="8.5"/><line x1="14.5" y1="10.5" x2="17.5" y2="8.5"/><line x1="9.5" y1="13.5" x2="6.5" y2="15.5"/><line x1="14.5" y1="13.5" x2="17.5" y2="15.5"/></svg>
                        </div>
                        <svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>

                    <!-- File Dropdown Menu -->
                    <div v-if="isFileMenuOpen" @click.outside="isFileMenuOpen = false" class="absolute left-0 top-9 w-52 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 text-xs">
                        <Link :href="route('dashboard')" class="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 font-medium">
                            <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                            Kembali ke Dashboard
                        </Link>
                        <div class="h-px bg-gray-100 my-1"></div>
                        <div class="px-3.5 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Mode Diagram</div>
                        <button @click="settings.diagramMode = 'mindmap'; isFileMenuOpen = false;" :class="['w-full text-left px-3.5 py-1.5 hover:bg-gray-50 flex items-center justify-between text-xs', settings.diagramMode === 'mindmap' ? 'text-blue-600 font-bold' : 'text-gray-700']">
                            <span>🧠 Mind Map</span>
                            <span v-if="settings.diagramMode === 'mindmap'">✓</span>
                        </button>
                        <button @click="settings.diagramMode = 'flowchart'; isFileMenuOpen = false;" :class="['w-full text-left px-3.5 py-1.5 hover:bg-gray-50 flex items-center justify-between text-xs', settings.diagramMode === 'flowchart' ? 'text-blue-600 font-bold' : 'text-gray-700']">
                            <span>🔀 Flowchart</span>
                            <span v-if="settings.diagramMode === 'flowchart'">✓</span>
                        </button>
                        <button @click="settings.diagramMode = 'uml'; isFileMenuOpen = false;" :class="['w-full text-left px-3.5 py-1.5 hover:bg-gray-50 flex items-center justify-between text-xs', settings.diagramMode === 'uml' ? 'text-blue-600 font-bold' : 'text-gray-700']">
                            <span>📦 UML Diagram</span>
                            <span v-if="settings.diagramMode === 'uml'">✓</span>
                        </button>
                        <div class="h-px bg-gray-100 my-1"></div>
                        <button @click="loadExampleMindmap(); isFileMenuOpen = false;" class="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <svg class="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                            Muat Demo Mindmap
                        </button>
                    </div>
                </div>

                <!-- Title & Breadcrumb -->
                <div class="flex flex-col justify-center">
                    <div class="flex items-center gap-1.5">
                        <input 
                            v-if="isEditingTitle" v-model="title" @blur="updateTitle" @keyup.enter="updateTitle"
                            class="font-semibold text-xs text-gray-900 border-b border-blue-500 bg-transparent px-0 py-0 outline-none ring-0 w-44"
                            autofocus
                        />
                        <span v-else @click="isEditingTitle = true" class="font-bold text-xs text-gray-800 cursor-pointer hover:text-blue-600 transition truncate max-w-[180px]">
                            {{ title || 'untitled' }}
                        </span>

                        <button @click="isFavorite = !isFavorite" class="text-gray-300 hover:text-amber-400 transition" :class="{ '!text-amber-400': isFavorite }" title="Favorite">
                            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                        </button>
                    </div>
                    <div class="flex items-center gap-1 text-[10px] text-gray-400 leading-none">
                        <Link :href="route('dashboard')" class="hover:text-gray-600">My Works</Link>
                        <span>/</span>
                        <span class="truncate max-w-[80px]">{{ saveState || 'Auto-saved' }}</span>
                    </div>
                </div>
            </div>

            <!-- Center: Floating Pill Toolbar (Xmind AI Toolbar) -->
            <div class="hidden sm:flex items-center gap-1 bg-gray-50/90 border border-gray-200/80 rounded-full px-2 py-0.5 shadow-2xs">
                <!-- Topic (Sibling) -->
                <button @click="handleAddSibling(activeNode?.id || 'root')" class="p-1.5 hover:bg-white hover:shadow-xs rounded-full text-gray-600 hover:text-blue-600 transition" title="Tambah Topik Sejajar (Enter)">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="3"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="12" y1="16" x2="12" y2="20"/></svg>
                </button>

                <!-- Subtopic (Child) -->
                <button @click="handleAddChild(activeNode?.id || 'root')" class="p-1.5 hover:bg-white hover:shadow-xs rounded-full text-gray-600 hover:text-blue-600 transition" title="Tambah Subtopik Cabang (Tab)">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="7" height="6" rx="2"/><path d="M10 12h5a3 3 0 013 3v2"/><rect x="15" y="17" width="6" height="5" rx="1.5"/></svg>
                </button>

                <!-- Relationship -->
                <button @click="applyTemplate('RADIAL', 'pill', 'bezier')" class="p-1.5 hover:bg-white hover:shadow-xs rounded-full text-gray-600 hover:text-blue-600 transition" title="Garis Relasi Bezier">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19C4 12 10 7 20 7"/><polyline points="15 3 20 7 15 11"/></svg>
                </button>

                <!-- Summary (Brace) -->
                <button @click="applyTemplate('LR', 'box', 'brace')" class="p-1.5 hover:bg-white hover:shadow-xs rounded-full text-gray-600 hover:text-blue-600 transition" title="Brace Summary {">
                    <span class="font-serif text-sm font-bold leading-none px-0.5">{ }</span>
                </button>

                <!-- Boundary / Group -->
                <button @click="onDragStart($event, 'custom', 'group')" draggable="true" class="p-1.5 hover:bg-white hover:shadow-xs rounded-full text-gray-600 hover:text-blue-600 transition cursor-grab" title="Tarik Batas / Boundary Box">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>
                </button>

                <!-- Layout Toggle (Radial vs Tree) -->
                <div class="relative">
                    <button @click="isLayoutMenuOpen = !isLayoutMenuOpen" class="p-1.5 hover:bg-white hover:shadow-xs rounded-full text-gray-600 hover:text-blue-600 transition flex items-center gap-0.5" title="Ganti Tata Letak">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M4 6h2v12H4M18 6h2v12h-2"/></svg>
                        <svg class="w-2.5 h-2.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
                    </button>
                    <div v-if="isLayoutMenuOpen" @click.outside="isLayoutMenuOpen = false" class="absolute left-1/2 -translate-x-1/2 top-9 w-40 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-50 text-xs">
                        <button @click="layoutNodes('RADIAL'); isLayoutMenuOpen = false;" class="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2">
                            <span>🧠 Radial Mindmap</span>
                        </button>
                        <button @click="layoutNodes('LR'); isLayoutMenuOpen = false;" class="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2">
                            <span>➡️ Tree (Kiri-Kanan)</span>
                        </button>
                        <button @click="layoutNodes('TB'); isLayoutMenuOpen = false;" class="w-full text-left px-3 py-1.5 hover:bg-gray-50 flex items-center gap-2">
                            <span>⬇️ Org Chart (Atas-Bawah)</span>
                        </button>
                    </div>
                </div>

                <div class="h-3.5 w-px bg-gray-200 mx-0.5"></div>

                <!-- Undo / Redo -->
                <button @click="undo" :disabled="!canUndo" :class="canUndo ? 'text-gray-700 hover:text-blue-600 hover:bg-white' : 'text-gray-300 pointer-events-none'" class="p-1.5 rounded-full transition" title="Undo (Ctrl+Z)">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/></svg>
                </button>
                <button @click="redo" :disabled="!canRedo" :class="canRedo ? 'text-gray-700 hover:text-blue-600 hover:bg-white' : 'text-gray-300 pointer-events-none'" class="p-1.5 rounded-full transition" title="Redo (Ctrl+Y)">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"/></svg>
                </button>
            </div>

            <!-- Right: Account, Share, Presentation, Export, Format Panel -->
            <div class="flex items-center gap-2">
                <!-- User Avatar Initial -->
                <div class="w-6 h-6 rounded-full bg-amber-400 text-amber-900 font-bold text-[11px] flex items-center justify-center shadow-2xs cursor-pointer" :title="$page.props.auth?.user?.name || 'User'">
                    {{ ($page.props.auth?.user?.name || 'U').charAt(0).toUpperCase() }}
                </div>

                <!-- Share Button -->
                <button v-if="props.canEdit" @click="isShareModalOpen = true" class="px-3.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-full transition flex items-center gap-1 shadow-2xs">
                    <svg class="w-3.5 h-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                    <span>Share</span>
                </button>

                <!-- Presentation Mode -->
                <button @click="toggleFullscreen" class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-blue-600 transition" title="Presentation Mode (Fullscreen)">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                </button>

                <!-- Export Dropdown -->
                <div class="relative">
                    <button @click="isExportMenuOpen = !isExportMenuOpen" class="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-blue-600 transition" title="Export File">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                    </button>
                    <div v-if="isExportMenuOpen" @click.outside="isExportMenuOpen = false" class="absolute right-0 top-9 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50 text-xs">
                        <button @click="exportToPdf(); isExportMenuOpen = false;" class="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <span class="w-2 h-2 rounded-full bg-red-500"></span>
                            Export PDF Document
                        </button>
                        <button @click="exportToPng(); isExportMenuOpen = false;" class="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            Export PNG Image
                        </button>
                        <button @click="exportToSvg(); isExportMenuOpen = false;" class="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <span class="w-2 h-2 rounded-full bg-purple-500"></span>
                            Export Animated SVG
                        </button>
                        <button @click="isVideoRecordModalOpen = true; isExportMenuOpen = false;" class="w-full text-left px-3.5 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                            Export MP4 Video (Server)
                        </button>
                    </div>
                </div>

                <!-- Format / Properties Sidebar Toggle -->
                <button @click="isRightPanelOpen = !isRightPanelOpen" :class="['p-1.5 rounded-lg transition', isRightPanelOpen ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-600']" title="Format Panel / Themes">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M15 3v18"/></svg>
                </button>
            </div>
        </header>

        <!-- MAIN WORKSPACE (Full Bleed Clean Canvas) -->
        <main class="flex-1 w-full relative overflow-hidden flex bg-white">
            <!-- SHAPE PALETTE (Collapsible drawer for Flowchart/UML) -->
            <div v-if="props.canEdit && settings.diagramMode !== 'mindmap'" class="w-24 bg-gray-50 border-r border-gray-100 flex flex-col overflow-y-auto items-stretch z-10 shadow-xs">
                <!-- Basic Category -->
                <div class="border-b border-gray-200">
                    <button @click="toggleCategory('basic')" class="w-full px-2 py-2 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Basic</span>
                        <svg :class="['w-3 h-3 text-gray-500 transition-transform', openCategories.basic ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div v-show="openCategories.basic" class="flex flex-col items-center py-3 gap-3 bg-white">
                        <div class="text-xl font-bold font-serif text-gray-700 cursor-grab hover:text-blue-500 hover:scale-110 transition-transform select-none" draggable="true" @dragstart="onDragStart($event, 'custom', 'text')" title="Teks Judul">T</div>
                        <div class="text-sm font-serif text-gray-700 cursor-grab hover:text-blue-500 hover:scale-110 transition-transform select-none" draggable="true" @dragstart="onDragStart($event, 'custom', 'paragraph')" title="Paragraf">P</div>
                        <div class="w-12 h-10 border-2 border-gray-400 border-dashed bg-gray-50 rounded cursor-grab hover:border-blue-500 hover:shadow relative flex items-center justify-center text-[10px] text-gray-400" draggable="true" @dragstart="onDragStart($event, 'custom', 'group')" title="Group / Area">Area</div>
                    </div>
                </div>

                <!-- Flow Category -->
                <div class="border-b border-gray-200">
                    <button @click="toggleCategory('flowchart')" class="w-full px-2 py-2 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Flow</span>
                        <svg :class="['w-3 h-3 text-gray-500 transition-transform', openCategories.flowchart ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div v-show="openCategories.flowchart" class="flex flex-col items-center py-3 gap-4 bg-white">
                        <div class="w-12 h-10 border-2 border-gray-400 bg-white rounded cursor-grab hover:border-blue-500 hover:shadow" draggable="true" @dragstart="onDragStart($event, 'custom', 'box')" title="Rectangle"></div>
                        <div class="w-12 h-8 border-2 border-gray-400 bg-white rounded-full cursor-grab hover:border-blue-500 hover:shadow" draggable="true" @dragstart="onDragStart($event, 'custom', 'pill')" title="Start/End (Pill)"></div>
                        <div draggable="true" @dragstart="onDragStart($event, 'custom', 'diamond')" title="Decision (Diamond)" class="cursor-grab hover:shadow rounded">
                            <svg class="w-10 h-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none"><polygon points="50,0 100,50 50,100 0,50" fill="white" stroke="#9ca3af" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            <!-- CANVAS AREA (Clean Pure White Surface) -->
            <div ref="canvasContainer" class="flex-1 h-full w-full relative overflow-hidden bg-white" @dragover.prevent @drop="onDrop" @contextmenu.prevent>
                <div ref="whiteCanvasRef" class="w-full h-full relative" 
                     :style="{ 
                         backgroundColor: settings.backgroundColor || '#ffffff',
                         aspectRatio: isRecording ? 'auto' : (settings.aspectRatio !== 'auto' ? settings.aspectRatio : 'auto'),
                         height: isRecording ? recordingHeight : '100%',
                         width: isRecording ? recordingWidth : '100%'
                     }">
                     
                    <!-- Custom SVG Markers -->
                    <svg style="position: absolute; width: 0; height: 0;">
                        <defs>
                            <template v-for="c in ['#94a3b8', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#0f172a']" :key="c">
                                <marker :id="'marker-circle-' + c.replace('#', '')" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                                    <circle cx="4" cy="4" r="3" :fill="c" />
                                </marker>
                                <marker :id="'marker-diamond-' + c.replace('#', '')" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
                                    <polygon points="0,5 5,0 10,5 5,10" :fill="c" />
                                </marker>
                                <marker :id="'marker-square-' + c.replace('#', '')" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
                                    <rect x="1" y="1" width="6" height="6" :fill="c" />
                                </marker>
                                <marker :id="'marker-arrowclosed-end-' + c.replace('#', '')" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                                    <path d="M1,1 L7,4 L1,7 Z" :fill="c" />
                                </marker>
                                <marker :id="'marker-arrowclosed-start-' + c.replace('#', '')" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
                                    <path d="M7,1 L1,4 L7,7 Z" :fill="c" />
                                </marker>
                                <marker :id="'marker-arrow-end-' + c.replace('#', '')" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                                    <path d="M1,1 L7,4 L1,7" fill="none" :stroke="c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                </marker>
                                <marker :id="'marker-arrow-start-' + c.replace('#', '')" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
                                    <path d="M7,1 L1,4 L7,7" fill="none" :stroke="c" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                                </marker>
                            </template>
                        </defs>
                    </svg>

                    <!-- Empty State / Example Loader -->
                    <div v-if="nodes.length === 0 && props.canEdit" class="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
                        <div class="pointer-events-auto bg-white p-6 rounded-2xl shadow-xl border border-gray-100 text-center max-w-sm">
                            <div class="w-14 h-14 bg-gradient-to-tr from-purple-100 to-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-purple-600">
                                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><circle cx="19" cy="7" r="2"/><circle cx="5" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><circle cx="5" cy="17" r="2"/><line x1="12" y1="9" x2="12" y2="6"/><line x1="12" y1="15" x2="12" y2="18"/></svg>
                            </div>
                            <h3 class="text-base font-bold text-gray-800 mb-1">Mulai Mindmap Baru</h3>
                            <p class="text-xs text-gray-500 mb-5">Gunakan kanvas kosong untuk menuangkan ide atau muat contoh diagram.</p>
                            <div class="flex flex-col gap-2 w-full">
                                <button @click="loadExampleMindmap" class="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition">
                                    Muat Contoh Mindmap
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- INTERACTION SHIELD FOR RECORDING -->
                    <div v-if="isRecording" class="absolute inset-0 z-50 cursor-default bg-transparent" title="Merekam video..."></div>

                    <VueFlow 
                        v-model:nodes="nodes" 
                        v-model:edges="edges"
                        @nodes-change="onNodesChange"
                        @edges-change="onEdgesChange"
                        @connect="onConnect"
                        @edge-update="onEdgeUpdate"
                        @edge-click="onEdgeClick"
                        @edge-double-click="onEdgeDoubleClick"
                        @edge-context-menu="onEdgeContextMenu"
                        class="h-full w-full select-none transition-colors duration-300"
                        :style="{ background: settings.backgroundColor || '#ffffff' }"
                        @pane-ready="onPaneReady"
                        @move-end="onMoveEnd"
                        @node-context-menu="onNodeContextMenu"
                        @node-drag-start="onNodeDragStart"
                        @node-drag="onNodeDrag"
                        @node-drag-stop="onNodeDragStop"
                        :default-zoom="1" :min-zoom="0.2" :max-zoom="4"
                        :delete-key-code="[]"
                        :nodes-draggable="props.canEdit"
                        :nodes-connectable="props.canEdit && settings.diagramMode !== 'mindmap'"
                        :elements-selectable="true"
                        :edges-focusable="settings.diagramMode !== 'mindmap'"
                        :edges-updatable="props.canEdit && settings.diagramMode !== 'mindmap'"
                        :selection-key-code="true"
                        :pan-on-drag="[1, 2]"
                        :zoom-on-scroll="true"
                        :zoom-on-pinch="true"
                        :zoom-on-double-click="false"
                        selection-mode="partial"
                        @edgeUpdateEnd="onEdgeUpdateEnd"
                    >
                        <!-- Custom Nodes -->
                        <template #node-custom="nodeProps">
                            <MindmapNode v-bind="nodeProps" :can-edit="props.canEdit" @quick-connect="onQuickConnect" @resize-end="commitHistory" @content-changed="commitHistory" />
                        </template>

                        <!-- Custom Edges -->
                        <template #edge-brace="edgeProps">
                            <BraceEdge v-bind="edgeProps" />
                        </template>
                        <template #edge-step="edgeProps">
                            <LabeledEdge v-bind="edgeProps" />
                        </template>
                        <template #edge-smoothstep="edgeProps">
                            <LabeledEdge v-bind="edgeProps" />
                        </template>
                        <template #edge-bezier="edgeProps">
                            <LabeledEdge v-bind="edgeProps" />
                        </template>
                        <template #edge-straight="edgeProps">
                            <LabeledEdge v-bind="edgeProps" />
                        </template>
                        
                        <Background :pattern-color="['#1e293b', '#0f172a', '#111827'].some(c => (settings.backgroundColor || '').includes(c)) ? '#475569' : '#e2e8f0'" 
                            :variant="settings.backgroundStyle" gap="20" size="1.5" v-if="settings.backgroundStyle && settings.backgroundStyle !== 'none'" />
                    </VueFlow>
                    
                    <!-- Context Menu -->
                    <div v-if="contextMenu.show" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" class="fixed z-[100] bg-white border border-gray-100 shadow-xl rounded-xl py-1 w-44 transform -translate-y-2 text-xs">
                        <template v-if="contextMenu.nodeId">
                            <button @click="cloneNode(contextMenu.nodeId)" class="w-full text-left px-3.5 py-2 font-medium text-gray-700 hover:bg-gray-50 flex items-center transition-colors">
                                <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                Duplikat Topik
                            </button>
                            <div class="h-px bg-gray-100 my-1"></div>
                            <button @click="handleDeleteNode(contextMenu.nodeId); closeContextMenu();" class="w-full text-left px-3.5 py-2 font-medium text-red-600 hover:bg-red-50 flex items-center transition-colors">
                                <svg class="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Hapus
                            </button>
                        </template>
                        <template v-if="contextMenu.edgeId && settings.diagramMode !== 'mindmap'">
                            <button @click="addWaypointFromContext" class="w-full text-left px-3.5 py-2 font-medium text-gray-700 hover:bg-gray-50 flex items-center transition-colors">
                                <svg class="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                Tambah Titik Belok
                            </button>
                            <div class="h-px bg-gray-100 my-1"></div>
                            <button @click="handleDeleteEdgeChain(contextMenu.edgeId); closeContextMenu();" class="w-full text-left px-3.5 py-2 font-medium text-red-600 hover:bg-red-50 flex items-center transition-colors">
                                <svg class="w-4 h-4 mr-2 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Hapus Garis
                            </button>
                        </template>
                    </div>
                </div>
            </div>

            <!-- OUTLINER SLIDE-OVER DRAWER -->
            <div v-if="isOutlinerOpen" class="w-72 bg-white border-l border-gray-100 flex flex-col z-20 shadow-lg text-xs">
                <div class="h-10 border-b border-gray-100 px-4 flex items-center justify-between font-bold text-gray-700">
                    <span>Outliner</span>
                    <button @click="isOutlinerOpen = false" class="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <div class="p-3 overflow-y-auto flex-1 space-y-1.5">
                    <div v-for="node in nodes" :key="node.id" 
                         @click="getNodes.forEach(n => n.selected = (n.id === node.id))" 
                         :class="['px-2.5 py-1.5 rounded-lg cursor-pointer transition flex items-center gap-2', node.id === activeNode?.id ? 'bg-blue-50 text-blue-700 font-bold' : 'hover:bg-gray-50 text-gray-700']"
                         :style="{ paddingLeft: (node.id === 'root' ? 8 : (node.data?.shape === 'underline' ? 24 : 14)) + 'px' }">
                        <span class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: node.data?.bgColor || node.data?.branchLineColor || '#38bdf8' }"></span>
                        <span class="truncate">{{ node.data?.label || (node.id === 'root' ? 'Central Topic' : 'Node') }}</span>
                    </div>
                </div>
            </div>

            <!-- RIGHT PROPERTIES / THEME SIDEBAR -->
            <div v-if="isRightPanelOpen && props.canEdit" class="w-72 bg-white border-l border-gray-100 flex flex-col z-20 shadow-lg">
                <!-- PANEL HEADER -->
                <div class="h-10 border-b border-gray-100 flex items-center justify-between px-4 shrink-0">
                    <h3 class="font-bold text-gray-700 text-xs flex items-center">
                        {{ activeSelectionType === 'node' && activeNode?.id === 'root' ? 'Themes & Layout' : (activeSelectionType === 'node' ? 'Topic Properties' : (activeSelectionType === 'edge' ? 'Line Properties' : 'Canvas Settings')) }}
                    </h3>
                    <button @click="isRightPanelOpen = false" class="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                </div>
                
                <div class="p-4 flex flex-col gap-4 overflow-y-auto text-xs flex-1">
                    <!-- PREMIUM THEMES & LAYOUT -->
                    <template v-if="activeSelectionType === 'node' && activeNode?.id === 'root'">
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Layout Templates</label>
                            <div v-for="category in templateCategories" :key="category.name" class="mb-3">
                                <div class="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-1.5 flex items-center">
                                    {{ category.name }}
                                </div>
                                <div class="grid grid-cols-2 gap-1.5">
                                    <button v-for="tpl in category.templates" :key="tpl.name" @click="applyTemplate(tpl.layout, tpl.shape, tpl.edge)" 
                                            class="py-1.5 px-2 bg-gray-50 hover:bg-blue-50 border border-gray-200/80 rounded-lg text-xs font-medium text-gray-700 hover:text-blue-700 transition flex items-center justify-center gap-1">
                                        <span>{{ tpl.name }}</span>
                                    </button>
                                </div>
                            </div>
                            
                            <hr class="my-4 border-gray-100" />

                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Color Themes</label>
                            <div class="grid grid-cols-2 gap-2">
                                <button v-for="(t, key) in themes" :key="key" @click="applyTheme(key)" class="group flex flex-col items-center gap-1">
                                    <div class="w-full h-10 rounded-lg border transition-transform group-hover:scale-105" :class="t.previewClass"></div>
                                    <span class="text-[10px] font-medium text-gray-600 text-center">{{ t.name }}</span>
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- NODE PROPERTIES -->
                    <template v-else-if="activeSelectionType === 'node' && activeNode">
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Shape / Gaya Topik</label>
                            <div class="grid grid-cols-2 gap-1.5 mb-3">
                                <button v-for="s in [
                                    { id: 'pill', label: 'Pill (Kapsul)' },
                                    { id: 'box', label: 'Kotak (Rounded)' },
                                    { id: 'underline', label: 'Garis (Underline)' },
                                    { id: 'transparent', label: 'Tanpa Kotak' }
                                ]" :key="s.id"
                                    @click="updateNodeProperty('shape', s.id)"
                                    class="py-1.5 px-2 text-xs font-medium border rounded-lg transition shadow-2xs text-center"
                                    :class="(activeNode.data?.shape || 'pill') === s.id ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    {{ s.label }}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Sambungan Garis</label>
                            <div class="grid grid-cols-2 gap-1.5 mb-3">
                                <button @click="updateNodeProperty('anchorPosition', 'center')" 
                                        class="py-1.5 px-2 text-xs font-medium border rounded-lg transition shadow-2xs text-center"
                                        :class="(activeNode.data?.anchorPosition || 'center') === 'center' ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Tengah (XMind)
                                </button>
                                <button @click="updateNodeProperty('anchorPosition', 'bottom')" 
                                        class="py-1.5 px-2 text-xs font-medium border rounded-lg transition shadow-2xs text-center"
                                        :class="activeNode.data?.anchorPosition === 'bottom' ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Bawah (Underline)
                                </button>
                            </div>
                        </div>

                        <div v-if="activeNode.data?.shape !== 'underline' && activeNode.data?.shape !== 'transparent'">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Background Topik</label>
                            <div class="flex flex-wrap gap-2 mb-3">
                                <button v-for="c in ['#ffffff', '#ff6b6b', '#ff9f43', '#55efc4', '#81ecec', '#74b9ff', '#a29bfe', '#fab1a0', '#fd79a8', '#dfe6e9', '#2d3436']" :key="c"
                                    @click="updateNodeProperty('bgColor', c); if(c === '#ffffff') updateNodeProperty('color', '#1e293b'); else if(['#ff6b6b','#2d3436','#74b9ff','#a29bfe'].includes(c)) updateNodeProperty('color', '#ffffff');"
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-xs"
                                    :class="(activeNode.data?.bgColor || '#ffffff') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Cabang (Branch Line)</label>
                            <div class="flex flex-wrap gap-2 mb-3">
                                <button v-for="c in ['#ff7675', '#e17055', '#fdcb6e', '#00b894', '#00cec9', '#0984e3', '#6c5ce7', '#e84393', '#636e72', '#2d3436']" :key="c"
                                    @click="updateNodeProperty('branchLineColor', c)"
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-xs"
                                    :class="(activeNode.data?.branchLineColor || '') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Teks</label>
                            <div class="flex flex-wrap gap-2 mb-3">
                                <button v-for="c in ['#111827', '#ffffff', '#374151', '#4b5563', '#6b7280', '#0284c7', '#059669', '#dc2626']" :key="'tc'+c"
                                    @click="updateNodeProperty('color', c)"
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-xs"
                                    :class="(activeNode.data?.color || '#111827') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Ukuran Teks</label>
                            <input type="range" min="10" max="32" :value="activeNode.data?.fontSize || 14" @input="updateNodeProperty('fontSize', parseInt($event.target.value))" class="w-full text-blue-500" />
                            <div class="text-right text-[10px] text-gray-400 mt-1">{{ activeNode.data?.fontSize || 14 }}px</div>
                        </div>
                    </template>

                    <!-- EDGE PROPERTIES -->
                    <template v-else-if="activeSelectionType === 'edge' && activeEdge && !activeEdgeLabel">
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Garis</label>
                            <div class="flex flex-wrap gap-2 mb-3">
                                <button v-for="c in ['#94a3b8', '#ff7675', '#e17055', '#fdcb6e', '#00b894', '#00cec9', '#0984e3', '#6c5ce7', '#e84393', '#2d3436']" 
                                    @click="updateEdgeProperty('color', c)" 
                                    class="w-6 h-6 rounded-full border transition hover:scale-110 shadow-xs"
                                    :class="activeEdge.style?.stroke === c ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-transparent'"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Ketebalan Garis</label>
                            <input type="range" min="1" max="10" :value="activeEdge.style?.strokeWidth || 2" @input="updateEdgeProperty('width', parseInt($event.target.value))" class="w-full text-blue-500" />
                            <div class="text-right text-[10px] text-gray-400 mt-1">{{ activeEdge.style?.strokeWidth || 2 }}px</div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Pola Garis</label>
                            <div class="flex gap-2 mb-3">
                                <button @click="updateEdgeProperty('pattern', 'solid')" class="flex-1 py-1.5 border rounded-lg text-xs transition shadow-2xs"
                                        :class="(activeEdge.data?.pattern || 'solid') === 'solid' ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Solid
                                </button>
                                <button @click="updateEdgeProperty('pattern', 'dashed')" class="flex-1 py-1.5 border rounded-lg text-xs transition shadow-2xs"
                                        :class="(activeEdge.data?.pattern === 'dashed') ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Dashed
                                </button>
                                <button @click="updateEdgeProperty('pattern', 'dotted')" class="flex-1 py-1.5 border rounded-lg text-xs transition shadow-2xs"
                                        :class="(activeEdge.data?.pattern === 'dotted') ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Dotted
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Jenis Garis</label>
                            <div class="grid grid-cols-2 gap-2 mb-3">
                                <button v-for="t in [
                                    {id:'bezier', label:'Melengkung (Bezier)'},
                                    {id:'smoothstep', label:'Kotak Melengkung'}, 
                                    {id:'straight', label:'Lurus (Straight)'}, 
                                    {id:'step', label:'Zigzag / Step'}
                                ]" :key="t.id"
                                    @click="updateEdgeProperty('type', t.id)"
                                    class="py-1.5 px-2 text-xs font-medium border rounded-lg transition shadow-2xs"
                                    :class="(activeEdge.type || 'bezier') === t.id ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    {{ t.label }}
                                </button>
                            </div>
                        </div>
                    </template>
                    
                    <!-- EDGE LABEL PROPERTIES -->
                    <template v-else-if="activeSelectionType === 'edge' && activeEdge && activeEdgeLabel">
                        <div class="mb-4">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Alignment (Rotasi)</label>
                            <div class="flex gap-2">
                                <button @click="updateEdgeLabelProperty('rotation', 'horizontal')" class="flex-1 py-1.5 border rounded-lg text-xs transition shadow-2xs"
                                        :class="(activeEdgeLabel.rotation || 'horizontal') === 'horizontal' ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Horizontal
                                </button>
                                <button @click="updateEdgeLabelProperty('rotation', 'follow')" class="flex-1 py-1.5 border rounded-lg text-xs transition shadow-2xs"
                                        :class="(activeEdgeLabel.rotation === 'follow') ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Follow Line
                                </button>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Visual Style (Tema)</label>
                            <div class="grid grid-cols-1 gap-2">
                                <button @click="updateEdgeLabelProperty('theme', 'pill')" class="py-2 border rounded-lg text-xs transition flex items-center justify-center shadow-2xs"
                                        :class="(!activeEdgeLabel.theme || activeEdgeLabel.theme === 'pill') ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Pill (Latar + Garis Batas)
                                </button>
                                <button @click="updateEdgeLabelProperty('theme', 'cut')" class="py-2 border rounded-lg text-xs transition flex items-center justify-center shadow-2xs"
                                        :class="(activeEdgeLabel.theme === 'cut') ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Cut-out (Memotong Garis)
                                </button>
                                <button @click="updateEdgeLabelProperty('theme', 'transparent')" class="py-2 border rounded-lg text-xs transition flex items-center justify-center shadow-2xs"
                                        :class="(activeEdgeLabel.theme === 'transparent') ? 'bg-blue-50 border-blue-400 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'">
                                    Transparan (Hanya Teks)
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Teks</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#374151', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']" :key="c"
                                    @click="updateEdgeLabelProperty('color', c)" 
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-xs"
                                    :class="(activeEdgeLabel.color || '#374151') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div class="mb-4" v-if="activeEdgeLabel.theme !== 'transparent'">
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Latar</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#ffffff', '#f3f4f6', '#fecaca', '#fde68a', '#a7f3d0', '#bfdbfe', '#e9d5ff', '#1f2937']" :key="'bg'+c"
                                    @click="updateEdgeLabelProperty('bgColor', c)" 
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-xs"
                                    :class="(activeEdgeLabel.bgColor || '#ffffff') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Ukuran Font</label>
                            <input type="range" min="10" max="24" :value="activeEdgeLabel.fontSize || 14" @input="updateEdgeLabelProperty('fontSize', parseInt($event.target.value))" class="w-full text-blue-500" />
                            <div class="text-right text-[10px] text-gray-400 mt-1">{{ activeEdgeLabel.fontSize || 14 }}px</div>
                        </div>
                    </template>

                    <!-- CANVAS PROPERTIES -->
                    <template v-else>
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Warna Background Kanvas</label>
                            <div class="flex flex-wrap gap-2 mb-4">
                                <button v-for="(c, i) in canvasBackgrounds" :key="'canvas-bg'+i"
                                    @click="updateCanvasProperty('backgroundColor', c)" 
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-xs"
                                    :class="(settings.backgroundColor || '#ffffff') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ background: c }">
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Background Pattern</label>
                            <div class="flex gap-2 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                <button @click="updateCanvasProperty('backgroundStyle', 'dots')" class="flex-1 py-1 text-xs font-medium rounded-md transition-colors shadow-2xs" :class="settings.backgroundStyle === 'dots' ? 'bg-white text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'">Dots</button>
                                <button @click="updateCanvasProperty('backgroundStyle', 'lines')" class="flex-1 py-1 text-xs font-medium rounded-md transition-colors shadow-2xs" :class="settings.backgroundStyle === 'lines' ? 'bg-white text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'">Lines</button>
                                <button @click="updateCanvasProperty('backgroundStyle', 'none')" class="flex-1 py-1 text-xs font-medium rounded-md transition-colors shadow-2xs" :class="settings.backgroundStyle === 'none' ? 'bg-white text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'">None</button>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Default Branch Style</label>
                            <div class="grid grid-cols-5 gap-1 bg-gray-50 p-1 rounded-lg border border-gray-100">
                                <button v-for="t in [{id:'bezier', i:'-~'}, {id:'brace', i:'-{'}, {id:'smoothstep', i:'-C'}, {id:'step', i:'-['}, {id:'straight', i:'--'}]" :key="t.id"
                                    @click="updateCanvasProperty('edgeStyle', t.id)"
                                    class="py-1 text-xs font-medium rounded-md transition-colors shadow-2xs flex justify-center items-center"
                                    :class="settings.edgeStyle === t.id ? 'bg-white text-blue-700 font-bold' : 'text-gray-600 hover:bg-gray-100'"
                                    :title="t.id">
                                    {{ t.i }}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Tampilan Bantuan</label>
                            <div class="flex flex-col gap-2 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <label class="flex items-center cursor-pointer group">
                                    <input type="checkbox" :checked="settings.showMinimap !== false" @change="updateCanvasProperty('showMinimap', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                    <span class="ml-2 text-xs text-gray-700 group-hover:text-gray-900 font-medium">Tampilkan MiniMap</span>
                                </label>
                                <label class="flex items-center cursor-pointer group">
                                    <input type="checkbox" :checked="settings.showControls !== false" @change="updateCanvasProperty('showControls', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                    <span class="ml-2 text-xs text-gray-700 group-hover:text-gray-900 font-medium">Tampilkan Tombol Zoom</span>
                                </label>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </main>

        <!-- Modals -->
        <DialogModal :show="isShareModalOpen" @close="isShareModalOpen = false">
            <template #title>
                Share Mindmap
            </template>
            <template #content>
                <div class="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 class="font-medium text-gray-900 mb-2 text-xs">Public Link</h4>
                    <div class="flex items-center justify-between mb-3">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" v-model="isPublic" @change="updatePublicSettings" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                            <span class="ml-2 text-xs text-gray-700">Anyone with the link can access</span>
                        </label>
                        <select v-if="isPublic" v-model="publicPermission" @change="updatePublicSettings" class="text-xs border-gray-300 rounded focus:ring-blue-500 py-1 pl-2 pr-8">
                            <option value="view">Can View</option>
                            <option value="edit">Can Edit</option>
                        </select>
                    </div>
                    <div v-if="isPublic" class="flex mt-2">
                        <input type="text" readonly :value="route('mindmaps.edit', props.mindmap.id)" class="flex-1 text-xs border-gray-300 rounded-l focus:ring-0 bg-white" />
                        <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value); this.innerText='Copied!';" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 text-xs font-medium rounded-r border border-l-0 border-gray-300 transition-colors">Copy</button>
                    </div>
                </div>

                <div class="mb-4">
                    <h4 class="font-medium text-gray-900 mb-2 text-xs">Invite Collaborators</h4>
                    <form @submit.prevent="inviteUser" class="flex gap-2">
                        <TextInput v-model="shareEmail" type="email" placeholder="Enter email address" class="flex-1 text-xs" required />
                        <select v-model="sharePermission" class="text-xs border-gray-300 rounded focus:ring-blue-500">
                            <option value="view">Can View</option>
                            <option value="edit">Can Edit</option>
                        </select>
                        <PrimaryButton type="submit">Invite</PrimaryButton>
                    </form>
                </div>

                <div v-if="props.mindmap.shares && props.mindmap.shares.length > 0">
                    <h4 class="font-medium text-gray-900 mb-2 mt-6 text-xs">People with access</h4>
                    <ul class="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                        <li v-for="share in props.mindmap.shares" :key="share.id" class="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div>
                                <p class="text-xs font-medium text-gray-900">{{ share.email }}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded">{{ share.permission === 'edit' ? 'Can Edit' : 'Can View' }}</span>
                                <button @click="removeUser(share.email)" class="text-red-500 hover:text-red-700 text-xs font-medium">Remove</button>
                            </div>
                        </li>
                    </ul>
                </div>
            </template>
            <template #footer>
                <SecondaryButton @click="isShareModalOpen = false">Done</SecondaryButton>
            </template>
        </DialogModal>

        <DialogModal :show="isVideoRecordModalOpen" @close="isVideoRecordModalOpen = false">
            <template #title>
                Rekam Video Mindmap
            </template>
            <template #content>
                <div class="mt-4">
                    <p class="text-xs text-gray-600 mb-2">Berapa detik durasi video yang ingin direkam?</p>
                    <TextInput v-model="recordDurationTemp" type="number" min="1" max="300" class="w-full text-xs" placeholder="Durasi dalam detik" @keyup.enter="startVideoRecording" autofocus />
                </div>
            </template>
            <template #footer>
                <SecondaryButton @click="isVideoRecordModalOpen = false" class="mr-2">Batal</SecondaryButton>
                <PrimaryButton @click="startVideoRecording">Mulai Rekam</PrimaryButton>
            </template>
        </DialogModal>

        <DialogModal :show="isHttpsErrorModalOpen" @close="isHttpsErrorModalOpen = false">
            <template #title>
                Fitur Diblokir Browser
            </template>
            <template #content>
                <div class="mt-4 text-xs text-gray-600 space-y-3">
                    <p>Fitur Perekaman Layar (Record Video) diblokir oleh browser karena membutuhkan koneksi aman (HTTPS).</p>
                    <p>Karena Anda mengakses aplikasi ini melalui HTTP biasa (misalnya domain lokal Laragon tanpa SSL), browser mematikan fitur ini demi keamanan.</p>
                    <p class="font-medium text-gray-800">SOLUSI: Silakan akses menggunakan http://localhost atau aktifkan sertifikat SSL (HTTPS) di Laragon Anda.</p>
                </div>
            </template>
            <template #footer>
                <PrimaryButton @click="isHttpsErrorModalOpen = false">Saya Mengerti</PrimaryButton>
            </template>
        </DialogModal>
        
        <!-- Toast Notification -->
        <Transition enter-active-class="transition ease-out duration-300" enter-from-class="transform opacity-0 translate-y-2" enter-to-class="transform opacity-100 translate-y-0" leave-active-class="transition ease-in duration-200" leave-from-class="transform opacity-100 translate-y-0" leave-to-class="transform opacity-0 translate-y-2">
            <div v-if="toast.show" class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[200] flex items-center px-4 py-2.5 rounded-lg shadow-lg border" :class="toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'">
                <svg v-if="toast.type === 'error'" class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <svg v-else class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span class="font-medium text-xs">{{ toast.message }}</span>
            </div>
        </Transition>
    </div>
</template>

<style>
.vue-flow__node-default { display: none; }
.vue-flow__edge-path { stroke-linecap: round; stroke-linejoin: round; }
.vue-flow__edge.selected .vue-flow__edge-path { 
    filter: drop-shadow(0 0 3px rgba(59, 130, 246, 0.6)) drop-shadow(0 0 6px rgba(59, 130, 246, 0.4));
}
</style>

<style>
/* Default Edge Animation for Label Cutouts */
.edge-label-cutout.animated rect.vue-flow__edge-path:not(.snake-dot) {
    stroke-dasharray: 5;
    animation: dashdraw 1s linear infinite;
}
@keyframes dashdraw {
    from { stroke-dashoffset: 10; }
    to { stroke-dashoffset: 0; }
}

/* CSS for reverse animation on edges */
.vue-flow__edge.vue-flow__edge-reverse-anim.animated path,
.edge-label-cutout.vue-flow__edge-reverse-anim.animated rect {
    animation-direction: reverse !important;
}

/* Custom Edge Animation Speeds */
.vue-flow__edge.anim-slow path.vue-flow__edge-path,
.edge-label-cutout.anim-slow rect.vue-flow__edge-path { animation-duration: 1.5s !important; }
.vue-flow__edge.anim-fast path.vue-flow__edge-path,
.edge-label-cutout.anim-fast rect.vue-flow__edge-path { animation-duration: 0.3s !important; }

/* Custom Edge Animation Styles */
.vue-flow__edge.anim-style-ants path.vue-flow__edge-path,
.edge-label-cutout.anim-style-ants rect.vue-flow__edge-path { 
    stroke-dasharray: 4, 8 !important;
    animation-name: dashdraw-ants !important;
}
@keyframes dashdraw-ants {
    from { stroke-dashoffset: 12; }
    to { stroke-dashoffset: 0; }
}
.vue-flow__edge.anim-style-snake path.snake-dot,
.edge-label-cutout.anim-style-snake rect.snake-dot { 
    stroke-dasharray: 0.1, 80 !important;
    stroke-linecap: round !important;
    animation-name: dashdraw-snake !important;
}
@keyframes dashdraw-snake {
    from { stroke-dashoffset: 80; }
    to { stroke-dashoffset: 0; }
}
.vue-flow__edge.anim-style-pulse path.vue-flow__edge-path,
.edge-label-cutout.anim-style-pulse rect.vue-flow__edge-path { 
    animation: pulse-edge 1.5s ease-in-out infinite alternate !important;
}
@keyframes pulse-edge {
    0% { opacity: 0.2; stroke-width: 1px; }
    100% { opacity: 1; stroke-width: 5px; }
}
</style>
