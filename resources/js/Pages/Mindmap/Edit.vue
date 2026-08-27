<script setup>
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
import { router } from '@inertiajs/vue3';
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
    canEdit: Boolean
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


const { findNode, addNodes, addEdges, getNodes, getEdges, onConnect, getSelectedEdges, getSelectedNodes, fitView } = useVueFlow();

// --- EXPORT TO PDF ---
const isExporting = ref(false);
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
        alert("Gagal mengekspor PDF.");
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
    } catch (e) {
        console.error("Export failed", e);
        alert("Gagal mengekspor animasi SVG.");
    } finally {
        // Restore selection
        selectedNodes.forEach(n => n.selected = true);
        selectedEdges.forEach(e => e.selected = true);
        isExporting.value = false;
    }
};

// --- EXPORT TO VIDEO (HD) ---
const isRecording = ref(false);
let mediaRecorder = null;
let recordedChunks = [];

const startVideoRecording = async () => {
    try {
        const durationStr = prompt("Berapa detik durasi video yang ingin direkam?", "10");
        if (!durationStr) return;
        const durationSec = parseInt(durationStr);
        if (isNaN(durationSec) || durationSec < 1) return;

        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
            alert("Fitur Perekaman Layar (Record Video) diblokir oleh browser karena membutuhkan koneksi aman (HTTPS).\n\nKarena Anda mengakses aplikasi ini melalui HTTP biasa (misalnya domain lokal Laragon tanpa SSL), browser mematikan fitur ini demi keamanan.\n\nSOLUSI: Silakan akses menggunakan http://localhost atau aktifkan sertifikat SSL (HTTPS) di Laragon Anda.");
            return;
        }

        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { 
                displaySurface: "browser", 
                frameRate: { ideal: 60 },
                cursor: "never"
            },
            preferCurrentTab: true,
            audio: false
        });
        
        isRecording.value = true;
        recordedChunks = [];
        
        // Hide selection boxes visually for a clean recording
        const selectedNodes = getSelectedNodes.value;
        const selectedEdges = getSelectedEdges.value;
        selectedNodes.forEach(n => n.selected = false);
        selectedEdges.forEach(e => e.selected = false);
        
        // Freeze canvas dimensions in pixels so the Chrome Share Banner doesn't shrink it
        recordingWidth.value = whiteCanvasRef.value.offsetWidth + 'px';
        recordingHeight.value = whiteCanvasRef.value.offsetHeight + 'px';
        await nextTick();
        
        // Auto-center the diagram so nothing is cut off by the edges
        fitView({ padding: 0.2, duration: 300 });
        await new Promise(r => setTimeout(r, 400));
        
        // Setup hidden video element to process the raw stream
        const videoElement = document.createElement('video');
        videoElement.srcObject = stream;
        videoElement.muted = true;
        await new Promise(resolve => {
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                resolve();
            };
        });
            
        const initialRect = whiteCanvasRef.value.getBoundingClientRect();
        const initialScaleX = videoElement.videoWidth / window.innerWidth;
        const initialScaleY = videoElement.videoHeight / window.innerHeight;
        
        // Create an off-screen canvas matched EXACTLY to the physical pixel size of the captured region
        // This prevents blurry upscaling or detail-destroying downscaling.
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = Math.round(initialRect.width * initialScaleX);
        cropCanvas.height = Math.round(initialRect.height * initialScaleY);
        
        const ctx = cropCanvas.getContext('2d', { alpha: false });
        
        let isDrawing = true;
        const drawLoop = () => {
            if (!isDrawing) return;
            
            // Dynamically track the DOM coordinates every frame to counter browser UI shifts
            const currentRect = whiteCanvasRef.value.getBoundingClientRect();
            // Revert to window.innerWidth/innerHeight for exact 1:1 mapping with the video stream
            const scaleX = videoElement.videoWidth / window.innerWidth;
            const scaleY = videoElement.videoHeight / window.innerHeight;
            
            // Draw only the specific region (the white paper) onto our cropCanvas
            ctx.drawImage(
                videoElement, 
                currentRect.left * scaleX, 
                currentRect.top * scaleY, 
                currentRect.width * scaleX, 
                currentRect.height * scaleY, 
                0, 
                0, 
                cropCanvas.width, 
                cropCanvas.height
            );
            requestAnimationFrame(drawLoop);
        };
        drawLoop();
        
        // Extract the cropped video stream
        const croppedStream = cropCanvas.captureStream(60);

        // Select best supported mimeType - Prioritize native mp4 for WhatsApp compatibility
        const mimeTypes = [
            'video/mp4;codecs=avc1',
            'video/mp4',
            'video/webm;codecs=h264',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        // Prioritize high bitrate for crisp text (12 Mbps)
        let options = { 
            mimeType: 'video/webm',
            videoBitsPerSecond: 12000000 
        };
        for (let type of mimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                options.mimeType = type;
                break;
            }
        }
        
        mediaRecorder = new MediaRecorder(croppedStream, options);
        
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                recordedChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            
            // Strictly assign extension based on the actual container type.
            // Renaming a webm container to .mp4 will break WhatsApp Android's native player.
            let extension = 'webm';
            if (mediaRecorder.mimeType.includes('mp4')) {
                extension = 'mp4';
            }
            
            a.download = `${title.value || 'Video'}.${extension}`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            
            // Cleanup
            isRecording.value = false;
            isDrawing = false;
            videoElement.pause();
            videoElement.srcObject = null;
            stream.getTracks().forEach(track => track.stop());
            croppedStream.getTracks().forEach(track => track.stop());
            
            // Unfreeze dimensions
            recordingWidth.value = null;
            recordingHeight.value = null;
            
            // Restore selection
            selectedNodes.forEach(n => n.selected = true);
            selectedEdges.forEach(e => e.selected = true);
        };
        
        
        // Anti-freeze logic: force browser to capture 60fps by slightly jiggling the DOM
        let jiggleId;
        let jiggleState = false;
        const antiFreezeJiggle = () => {
            if (!isRecording.value) return;
            if (canvasContainer.value) {
                canvasContainer.value.style.transform = `translateZ(${jiggleState ? '0.001px' : '0px'})`;
                jiggleState = !jiggleState;
            }
            jiggleId = requestAnimationFrame(antiFreezeJiggle);
        };
        antiFreezeJiggle();

        mediaRecorder.start(100);
        
        // Stop automatically after duration
        setTimeout(() => {
            if (isRecording.value) {
                stopVideoRecording();
            }
        }, durationSec * 1000);
        
    } catch (err) {
        console.error("Gagal memulai perekaman:", err);
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

watch([getSelectedNodes, getSelectedEdges], ([nodes, selectedEdgesList]) => {
    selectedNodeIds.value = nodes.map(n => n.id);
    const newSelectedEdgeIds = selectedEdgesList.map(e => e.id);
    selectedEdgeIds.value = newSelectedEdgeIds;
    
    // Auto-clear label selections for any unselected edges (e.g., clicking canvas)
    const selectedEdgesSet = new Set(newSelectedEdgeIds);
    getEdges.value.forEach(e => {
        if (!selectedEdgesSet.has(e.id) && e.data?.selectedLabelId) {
            e.data.selectedLabelId = null;
        }
    });
}, { deep: true });

const activeSelectionType = computed(() => {
    if (getSelectedNodes.value.length > 0) return 'node';
    if (getSelectedEdges.value.length > 0) return 'edge';
    return 'none';
});
const activeNode = computed(() => getSelectedNodes.value[0]);
const activeEdge = computed(() => getSelectedEdges.value[0]);
const activeEdgeLabelId = computed(() => activeEdge.value?.data?.selectedLabelId);
const activeEdgeLabel = computed(() => {
    if (!activeEdge.value || !activeEdgeLabelId.value) return null;
    return activeEdge.value.data?.labels?.find(l => l.id === activeEdgeLabelId.value);
});

// --- CONTEXT MENU ---
const contextMenu = ref({ show: false, x: 0, y: 0, nodeId: null, edgeId: null, clickEvent: null });
const onNodeContextMenu = (event) => {
    if (!props.canEdit) return;
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
    if (!props.canEdit) return;
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

const handleAddChild = (parentId) => {
    const parent = findNode(parentId);
    if (!parent) return;
    const newId = `node-${Date.now()}`;
    const childNodes = getNodes.value.filter(n => props.mindmap.edges?.some(e => e.source === parentId && e.target === n.id));
    const yOffset = (childNodes.length * 80) || 0;
    
    addNodes([{
        id: newId, type: 'custom',
        position: { x: parent.position.x + 250, y: parent.position.y + yOffset },
        data: { label: '', isNew: true, bgColor: '#ffffff', textColor: '#111827', fontSize: 14, onAddChild: handleAddChild, onAddSibling: handleAddSibling }
    }]);

    addEdges([{
        id: `edge-${parentId}-${newId}`, source: parentId, target: newId,
        type: settings.value.edgeStyle, style: { stroke: settings.value.edgeColor, strokeWidth: 2 }
    }]);
    commitHistory();
};

const cloneNode = (nodeId) => {
    const nodeToClone = findNode(nodeId);
    if (!nodeToClone) return;
    
    const newId = 'n_' + Math.random().toString(36).substr(2, 9);
    const newNode = {
        id: newId,
        type: nodeToClone.type,
        position: { x: nodeToClone.position.x + 30, y: nodeToClone.position.y + 30 },
        data: JSON.parse(JSON.stringify(nodeToClone.data)), // Deep copy data
        style: nodeToClone.style ? JSON.parse(JSON.stringify(nodeToClone.style)) : undefined,
    };
    
    // Wire up functions
    newNode.data.onAddChild = handleAddChild;
    newNode.data.onAddSibling = handleAddSibling;
    newNode.data.isNew = true; // Auto-focus text editing
    
    addNodes([newNode]);
    
    commitHistory();
};

const handleAddSibling = (nodeId) => {
    if (nodeId === 'root') return;
    const node = findNode(nodeId);
    if (!node) return;
    const parentEdge = props.mindmap.edges?.find(e => e.target === nodeId) || edges.value.find(e => e.target === nodeId);
    const parentId = parentEdge ? parentEdge.source : null;
    const newId = `node-${Date.now()}`;
    
    addNodes([{
        id: newId, type: 'custom',
        position: { x: node.position.x, y: node.position.y + 80 },
        data: { label: '', isNew: true, bgColor: '#ffffff', textColor: '#111827', fontSize: 14, onAddChild: handleAddChild, onAddSibling: handleAddSibling }
    }]);

    if (parentId) {
        addEdges([{
            id: `edge-${parentId}-${newId}`, source: parentId, target: newId,
            type: settings.value.edgeStyle, style: { stroke: settings.value.edgeColor, strokeWidth: 2 }
        }]);
    }
    commitHistory();
};

const mapNodes = (rawNodes) => {
    let nodesArray = rawNodes || [];
    if (nodesArray.length === 0 && settings.value.diagramMode === 'mindmap') {
        nodesArray = [{ id: 'root', type: 'custom', position: { x: 250, y: 250 }, data: { label: 'Central Idea', bgColor: '#ffffff', textColor: '#111827', fontSize: 14 } }];
    }
    return nodesArray.map(n => ({ ...n, data: { ...n.data, onAddChild: handleAddChild, onAddSibling: handleAddSibling } }));
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

const loadExampleFlowchart = () => {
    const exNodes = [
        { id: 'start', type: 'custom', position: { x: 300, y: 50 }, data: { label: 'Mulai', shape: 'pill', bgColor: '#10b981', textColor: '#ffffff' } },
        { id: 'decision', type: 'custom', position: { x: 300, y: 180 }, data: { label: 'Kondisi Valid?', shape: 'diamond', bgColor: '#f59e0b', textColor: '#ffffff' } },
        { id: 'process1', type: 'custom', position: { x: 100, y: 300 }, data: { label: 'Proses Invalid', shape: 'box', bgColor: '#ef4444', textColor: '#ffffff' } },
        { id: 'process2', type: 'custom', position: { x: 500, y: 300 }, data: { label: 'Proses Lanjut', shape: 'box', bgColor: '#3b82f6', textColor: '#ffffff' } },
        { id: 'end', type: 'custom', position: { x: 300, y: 450 }, data: { label: 'Selesai', shape: 'pill', bgColor: '#10b981', textColor: '#ffffff' } },
    ];
    
    const exEdges = [
        { id: 'e1', source: 'start', target: 'decision', type: 'smoothstep', animated: true, data: { arrow: 'forward' } },
        { id: 'e2', source: 'decision', target: 'process1', sourceHandle: 'source-left', targetHandle: 'target-top', type: 'step', data: { label: 'Tidak', arrow: 'forward', arrowModel: 'arrow' } },
        { id: 'e3', source: 'decision', target: 'process2', sourceHandle: 'source-right', targetHandle: 'target-top', type: 'step', data: { label: 'Ya', arrow: 'forward' } },
        { id: 'e4', source: 'process1', target: 'end', sourceHandle: 'source-bottom', targetHandle: 'target-left', type: 'smoothstep', data: { arrow: 'forward' } },
        { id: 'e5', source: 'process2', target: 'end', sourceHandle: 'source-bottom', targetHandle: 'target-right', type: 'smoothstep', data: { arrow: 'forward' } }
    ];
    
    nodes.value = mapNodes(exNodes);
    edges.value = exEdges;
    settings.value.diagramMode = 'flowchart';
    settings.value.edgeStyle = 'step';
    
    setTimeout(() => {
        fitView({ padding: 0.2, duration: 800 });
        commitHistory();
    }, 100);
};

onConnect((params) => {
    addEdges([{...params, type: settings.value.edgeStyle, style: { stroke: settings.value.edgeColor, strokeWidth: 2 }}]);
    commitHistory();
});

const onQuickConnect = ({ id, direction }) => {
    const parentNode = nodes.value.find(n => n.id === id);
    if (!parentNode) return;
    
    const newId = 'n-' + Date.now();
    let offsetX = 0;
    let offsetY = 0;
    const distance = 150;
    
    if (direction === 'right') offsetX = distance;
    if (direction === 'left') offsetX = -distance;
    if (direction === 'bottom') offsetY = distance;
    if (direction === 'top') offsetY = -distance;
    
    const newNode = {
        id: newId,
        type: 'custom',
        position: { x: parentNode.position.x + offsetX, y: parentNode.position.y + offsetY },
        data: { ...parentNode.data, label: 'Ide Baru', isNew: true }
    };
    
    nodes.value.push(newNode);
    
    // Choose handle based on direction
    let sourceHandle = 'source-right';
    let targetHandle = 'target-left';
    
    if (direction === 'right') { sourceHandle = 'source-right'; targetHandle = 'target-left'; }
    if (direction === 'left') { sourceHandle = 'source-left'; targetHandle = 'target-right'; }
    if (direction === 'bottom') { sourceHandle = 'source-bottom'; targetHandle = 'target-top'; }
    if (direction === 'top') { sourceHandle = 'source-top'; targetHandle = 'target-bottom'; }

    addEdges([{
        id: `edge-${id}-${newId}`,
        source: id,
        target: newId,
        sourceHandle,
        targetHandle,
        type: settings.value.edgeStyle,
        style: { stroke: settings.value.edgeColor, strokeWidth: 2 }
    }]);
    
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

// --- DAGRE AUTO-LAYOUT ---
const layoutNodes = (direction = 'LR') => {
    
    // Helper to run dagre on a set of nodes/edges
    const runDagre = (dir, nodesToLayout, edgesToLayout) => {
        const g = new dagre.graphlib.Graph();
        g.setGraph({ rankdir: dir, nodesep: 50, ranksep: 100 });
        g.setDefaultEdgeLabel(() => ({}));

        nodesToLayout.forEach(node => {
            const width = Math.max(150, (node.data.label?.length || 10) * 8);
            g.setNode(node.id, { width, height: 60 });
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
                    x: nodeWithPosition.x - nodeWithPosition.width / 2,
                    y: nodeWithPosition.y - nodeWithPosition.height / 2
                }
            };
        });
    };

    let leftTreeIds = [];
    let rightTreeIds = [];

    if (direction === 'RADIAL') {
        // Special Mindmap Layout (Root in center, branches split left and right)
        const rootEdges = edges.value.filter(e => e.source === 'root');
        
        // Split children half left, half right
        const rightChildIds = rootEdges.filter((e, i) => i % 2 === 0).map(e => e.target);
        const leftChildIds = rootEdges.filter((e, i) => i % 2 !== 0).map(e => e.target);

        // Helper to find all descendants
        const getDescendants = (startIds) => {
            let desc = [...startIds];
            let added = true;
            while(added) {
                added = false;
                const newChildren = edges.value.filter(e => desc.includes(e.source) && !desc.includes(e.target)).map(e => e.target);
                if (newChildren.length > 0) {
                    desc.push(...newChildren);
                    added = true;
                }
            }
            return desc;
        };

        rightTreeIds = ['root', ...getDescendants(rightChildIds)];
        leftTreeIds = ['root', ...getDescendants(leftChildIds)];

        const rightNodes = nodes.value.filter(n => rightTreeIds.includes(n.id));
        const leftNodes = nodes.value.filter(n => leftTreeIds.includes(n.id));

        const rightEdges = edges.value.filter(e => rightTreeIds.includes(e.source) && rightTreeIds.includes(e.target));
        const leftEdges = edges.value.filter(e => leftTreeIds.includes(e.source) && leftTreeIds.includes(e.target));

        const gRight = runDagre('LR', rightNodes, rightEdges);
        const gLeft = runDagre('RL', leftNodes, leftEdges);

        // Align left tree to match right tree's root Y position
        const rightRoot = gRight.node('root');
        const leftRoot = gLeft.node('root');
        const yOffset = rightRoot.y - leftRoot.y;
        
        const positionedRight = applyPositions(rightNodes, gRight);
        const positionedLeft = applyPositions(leftNodes, gLeft).map(n => {
            if (n.id === 'root') return n; // Keep right root
            return {
                ...n,
                position: {
                    x: n.position.x - leftRoot.x - rightRoot.width, // shift to left of root
                    y: n.position.y + yOffset
                }
            };
        });

        // Merge arrays without duplicating root
        const mergedNodes = positionedRight.concat(positionedLeft.filter(n => n.id !== 'root'));
        
        // Any unconnected nodes just keep them as is
        const connectedIds = [...rightTreeIds, ...leftTreeIds];
        const unconnected = nodes.value.filter(n => !connectedIds.includes(n.id));
        
        nodes.value = [...mergedNodes, ...unconnected];

    } else {
        // Standard Tree Layout
        const g = runDagre(direction, nodes.value, edges.value);
        nodes.value = applyPositions(nodes.value, g);
    }

    // UPDATE ALL EDGE HANDLES TO FIX ROUTING
    edges.value.forEach(edge => {
        let sHandle = 'source-right';
        let tHandle = 'target-left';
        
        if (direction === 'RADIAL') {
            if (leftTreeIds.includes(edge.target)) {
                sHandle = 'source-left';
                tHandle = 'target-right';
            }
        } else if (direction === 'RL') {
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

const toast = ref({ show: false, message: '', type: 'success' });
const showToast = (message, type = 'success') => {
    toast.value = { show: true, message, type };
    setTimeout(() => { toast.value.show = false; }, 3000);
};

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

const handleDeleteNode = (nodeId) => {
    const node = getNodes.value.find(n => n.id === nodeId);
    if (node && node.data?.shape === 'waypoint') {
        const inEdge = getEdges.value.find(edg => edg.target === nodeId);
        const outEdge = getEdges.value.find(edg => edg.source === nodeId);
        
        let newEdges = edges.value.filter(edg => edg.source !== nodeId && edg.target !== nodeId);
        
        if (inEdge && outEdge) {
            newEdges.push({
                id: `edge_${Date.now()}`,
                source: inEdge.source,
                target: outEdge.target,
                sourceHandle: inEdge.sourceHandle,
                targetHandle: outEdge.targetHandle,
                type: inEdge.type,
                animated: inEdge.animated,
                class: inEdge.class,
                style: { ...inEdge.style },
                markerEnd: outEdge.markerEnd,
                data: { 
                    ...inEdge.data,
                    arrow: outEdge.data?.arrow || inEdge.data?.arrow
                }
            });
        }
        edges.value = newEdges;
        nodes.value = nodes.value.filter(n => n.id !== nodeId);
    } else {
        removeNodes([nodeId]);
    }
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
        } else if (activeNode.value) {
            e.preventDefault();
            handleDeleteNode(activeNode.value.id);
        } else if (activeEdge.value) {
            e.preventDefault();
            handleDeleteEdgeChain(activeEdge.value.id);
        }
    }
};

onMounted(() => {
    window.addEventListener('mindmap-edge-mutated', handleEdgeMutated);
    window.addEventListener('keydown', handleGlobalKeyDown);
    
    // Set up auto-save interval (every 60 seconds)
    autoSaveInterval = setInterval(() => {
        detectChanges();
    }, 60000);
});

onUnmounted(() => {
    window.removeEventListener('mindmap-edge-mutated', handleEdgeMutated);
    window.removeEventListener('keydown', handleGlobalKeyDown);
    if (autoSaveInterval) clearInterval(autoSaveInterval);
});
</script>

<template>
    <AppLayout :title="title">
        <template #header>
            <div class="flex items-center justify-between w-full">
                <div class="flex items-center">
                    <input 
                        v-if="isEditingTitle" v-model="title" @blur="updateTitle" @keyup.enter="updateTitle"
                        class="font-semibold text-xl text-gray-800 border-b-2 border-blue-500 bg-transparent px-1 py-0 w-64 outline-none ring-0"
                        autofocus
                    />
                    <h2 v-else @click="isEditingTitle = true" class="font-semibold text-xl text-gray-800 cursor-pointer hover:bg-gray-100 px-1 rounded transition-colors">
                        {{ title }}
                    </h2>
                    
                    <span class="ml-4 text-xs transition-opacity duration-300" :class="{
                        'text-gray-400': saveState === '',
                        'text-gray-500 italic': saveState === 'Unsaved changes',
                        'text-blue-500 font-semibold animate-pulse': saveState === 'Saving...',
                        'text-green-500 font-semibold': saveState === 'Saved',
                        'text-red-500 font-semibold': saveState === 'Error saving'
                    }">
                        {{ saveState || 'Auto-saved' }}
                    </span>
                    
                    <div class="ml-6 border-l pl-6 border-gray-300 flex items-center gap-2">
                        <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mode</label>
                        <select v-model="settings.diagramMode" class="text-sm bg-white border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-medium py-1">
                            <option value="mindmap">🧠 Mindmap</option>
                            <option value="flowchart">🔀 Flowchart</option>
                            <option value="uml">📦 UML</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex gap-2 text-sm">
                    <button @click="undo" :disabled="!canUndo" :class="canUndo ? 'text-gray-700 hover:text-blue-600' : 'text-gray-300'" title="Undo (Ctrl+Z)">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                    </button>
                    <button @click="redo" :disabled="!canRedo" :class="canRedo ? 'text-gray-700 hover:text-blue-600' : 'text-gray-300'" title="Redo (Ctrl+Y)">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6"></path></svg>
                    </button>
                    
                    <button @click="exportToPdf" :disabled="isExporting" class="ml-2 px-4 py-1.5 bg-gray-600 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition shadow-sm flex items-center disabled:opacity-50">
                        <svg v-if="isExporting" class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <svg v-else class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                        {{ isExporting ? 'Exporting...' : 'Export PDF' }}
                    </button>
                    
                    <button @click="exportToSvg" :disabled="isExporting" class="ml-2 px-4 py-1.5 bg-purple-600 text-white text-sm font-medium rounded-md hover:bg-purple-700 transition shadow-sm flex items-center disabled:opacity-50">
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        Export Anim
                    </button>

                    <button @click="startVideoRecording" :disabled="isRecording || isExporting" class="ml-2 px-4 py-1.5 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition shadow-sm flex items-center disabled:opacity-50" title="Rekam Layar menjadi Video">
                        <svg class="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-4-8c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4-4-1.79-4-4z"/></svg>
                        Record Video (HD)
                    </button>
                    
                    <button v-if="props.canEdit" @click="isShareModalOpen = true" class="ml-2 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition shadow-sm flex items-center">
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        Share
                    </button>
                </div>
            </div>
        </template>

        <div class="flex w-full border-t border-gray-200 bg-gray-200 h-[calc(100vh-130px)]">
            <!-- SHAPE PALETTE (Only for Flowchart/UML) -->
            <div v-if="props.canEdit && settings.diagramMode !== 'mindmap'" class="w-24 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto items-stretch z-10 shadow-sm">
                <!-- Basic Category -->
                <div class="border-b border-gray-200">
                    <button @click="toggleCategory('basic')" class="w-full px-2 py-2 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Basic</span>
                        <svg :class="['w-3 h-3 text-gray-500 transition-transform', openCategories.basic ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div v-show="openCategories.basic" class="flex flex-col items-center py-3 gap-3 bg-white">
                        <!-- Text -->
                        <div class="text-xl font-bold font-serif text-gray-700 cursor-grab hover:text-blue-500 hover:scale-110 transition-transform select-none" draggable="true" @dragstart="onDragStart($event, 'custom', 'text')" title="Teks Judul Singkat">T</div>
                        <!-- Paragraph -->
                        <div class="text-sm font-serif text-gray-700 cursor-grab hover:text-blue-500 hover:scale-110 transition-transform select-none" draggable="true" @dragstart="onDragStart($event, 'custom', 'paragraph')" title="Paragraf Panjang">P</div>
                        <!-- Group / Area -->
                        <div class="w-12 h-10 border-2 border-gray-400 border-dashed bg-gray-50 rounded cursor-grab hover:border-blue-500 hover:shadow relative flex items-center justify-center text-[10px] text-gray-400" draggable="true" @dragstart="onDragStart($event, 'custom', 'group')" title="Group / Background Area">Area</div>
                        <!-- Callout -->
                        <div draggable="true" @dragstart="onDragStart($event, 'custom', 'callout')" title="Callout / Speech Bubble" class="cursor-grab hover:shadow rounded">
                            <svg class="w-12 h-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <path d="M 5,5 L 95,5 L 95,75 L 60,75 L 40,95 L 40,75 L 5,75 Z" fill="white" stroke="#9ca3af" stroke-width="2" vector-effect="non-scaling-stroke" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Flowchart Category -->
                <div class="border-b border-gray-200">
                    <button @click="toggleCategory('flowchart')" class="w-full px-2 py-2 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Flow</span>
                        <svg :class="['w-3 h-3 text-gray-500 transition-transform', openCategories.flowchart ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div v-show="openCategories.flowchart" class="flex flex-col items-center py-3 gap-4 bg-white">
                        <!-- Box -->
                        <div class="w-12 h-10 border-2 border-gray-400 bg-white rounded cursor-grab hover:border-blue-500 hover:shadow" draggable="true" @dragstart="onDragStart($event, 'custom', 'box')" title="Rectangle"></div>
                        <!-- Pill -->
                        <div class="w-12 h-8 border-2 border-gray-400 bg-white rounded-full cursor-grab hover:border-blue-500 hover:shadow" draggable="true" @dragstart="onDragStart($event, 'custom', 'pill')" title="Start/End (Pill)"></div>
                        <!-- Diamond -->
                        <div draggable="true" @dragstart="onDragStart($event, 'custom', 'diamond')" title="Decision (Diamond)" class="cursor-grab hover:shadow rounded">
                            <svg class="w-10 h-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polygon points="50,0 100,50 50,100 0,50" fill="white" stroke="#9ca3af" stroke-width="2" vector-effect="non-scaling-stroke" />
                            </svg>
                        </div>
                        <!-- Parallelogram -->
                        <div draggable="true" @dragstart="onDragStart($event, 'custom', 'parallelogram')" title="Data (Parallelogram)" class="cursor-grab hover:shadow rounded">
                            <svg class="w-12 h-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polygon points="15,0 100,0 85,100 0,100" fill="white" stroke="#9ca3af" stroke-width="2" vector-effect="non-scaling-stroke" />
                            </svg>
                        </div>
                        <!-- Hexagon -->
                        <div draggable="true" @dragstart="onDragStart($event, 'custom', 'hexagon')" title="Preparation (Hexagon)" class="cursor-grab hover:shadow rounded">
                            <svg class="w-12 h-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" fill="white" stroke="#9ca3af" stroke-width="2" vector-effect="non-scaling-stroke" />
                            </svg>
                        </div>
                        <!-- Cylinder -->
                        <div class="w-10 h-12 border-2 border-gray-400 bg-white cursor-grab hover:border-blue-500 hover:shadow" style="border-radius: 50% / 15%;" draggable="true" @dragstart="onDragStart($event, 'custom', 'cylinder')" title="Database"></div>
                        <!-- Document -->
                        <div draggable="true" @dragstart="onDragStart($event, 'custom', 'document')" title="Document" class="cursor-grab hover:shadow rounded">
                            <svg class="w-12 h-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <polygon points="0,0 100,0 100,85 85,100 50,85 15,100 0,85" fill="white" stroke="#9ca3af" stroke-width="2" vector-effect="non-scaling-stroke" />
                            </svg>
                        </div>
                    </div>
                </div>

                <!-- Media Category -->
                <div>
                    <button @click="toggleCategory('media')" class="w-full px-2 py-2 flex items-center justify-between bg-gray-100 hover:bg-gray-200 transition-colors">
                        <span class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Media</span>
                        <svg :class="['w-3 h-3 text-gray-500 transition-transform', openCategories.media ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    <div v-show="openCategories.media" class="flex flex-col items-center py-3 gap-4 bg-white">
                        <!-- Emoji -->
                        <div class="text-3xl cursor-grab hover:scale-110 transition-transform flex items-center justify-center w-12 h-12 bg-gray-50 border border-gray-200 rounded" draggable="true" @dragstart="onDragStart($event, 'custom', 'emoji', '😀')" title="Tarik untuk membuat node Emoji" v-html="defaultEmojiIcon"></div>
                        
                        <!-- Image Upload -->
                        <div class="relative w-12 h-12 border-2 border-gray-400 border-dashed bg-white rounded cursor-pointer hover:border-blue-500 hover:bg-blue-50 flex items-center justify-center text-gray-400 hover:text-blue-500" title="Upload Image">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                            <input type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer" @change="uploadImageNode" />
                        </div>
                    </div>
                </div>
            </div>

            <!-- CANVAS AREA -->
            <div ref="canvasContainer" class="flex-grow relative overflow-hidden flex items-center justify-center bg-gray-200" @dragover.prevent @drop="onDrop" @contextmenu.prevent>
                <div ref="whiteCanvasRef" :class="['relative overflow-hidden shadow-xl ring-1 ring-gray-900/5', settings.aspectRatio === 'auto' ? 'w-full h-full' : 'max-w-full max-h-full']" 
                     :style="{ 
                         backgroundColor: settings.backgroundColor,
                         aspectRatio: isRecording ? 'auto' : (settings.aspectRatio !== 'auto' ? settings.aspectRatio : 'auto'),
                         height: isRecording ? recordingHeight : (settings.aspectRatio !== 'auto' ? '95%' : '100%'),
                         width: isRecording ? recordingWidth : (settings.aspectRatio !== 'auto' ? 'auto' : '100%')
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
                        <div class="pointer-events-auto bg-white p-6 rounded-xl shadow-lg border border-gray-100 text-center max-w-sm">
                            <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500">
                                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                            </div>
                            <h3 class="text-lg font-bold text-gray-800 mb-2">Kanvas Masih Kosong</h3>
                            <p class="text-sm text-gray-500 mb-6">Tarik bentuk dari menu sebelah kiri untuk memulai, atau muat diagram contoh untuk mencoba fitur-fiturnya.</p>
                            <button @click="loadExampleFlowchart" class="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-md text-sm font-semibold shadow-md hover:shadow-lg transition">
                                Muat Contoh Flowchart
                            </button>
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
                        class="h-full select-none transition-colors duration-300"
                        :style="{ background: settings.backgroundColor || '#ffffff' }"
                        @pane-ready="onPaneReady"
                        @move-end="onMoveEnd"
                        @node-context-menu="onNodeContextMenu"
                        :default-zoom="1" :min-zoom="0.2" :max-zoom="4"
                        :delete-key-code="[]"
                        :nodes-draggable="props.canEdit"
                        :nodes-connectable="props.canEdit"
                        :elements-selectable="true"
                        :selection-key-code="true"
                        :pan-on-drag="true"
                        :zoom-on-scroll="true"
                        :zoom-on-pinch="true"
                        :zoom-on-double-click="false"
                        selection-mode="partial"
                        @nodeDragStop="commitHistory"
                        :edges-updatable="props.canEdit"
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
                    
                    <Background :pattern-color="['#1e293b', '#0f172a', '#111827'].some(c => (settings.backgroundColor || '').includes(c)) || (settings.backgroundColor || '').includes('1e3c72') ? '#475569' : '#cbd5e1'" 
                        :variant="settings.backgroundStyle" gap="20" size="1.5" v-if="settings.backgroundStyle !== 'none'" />
                    <Controls position="bottom-left" v-if="settings.showControls !== false" />
                    <MiniMap position="bottom-right" class="!mb-0" v-if="settings.showMinimap !== false" />
                </VueFlow>
                
                <!-- Context Menu -->
                <div v-if="contextMenu.show" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }" class="fixed z-[100] bg-white border border-gray-200 shadow-xl rounded-md py-1 w-48 transform -translate-y-2">
                    <template v-if="contextMenu.nodeId">
                        <button @click="cloneNode(contextMenu.nodeId)" class="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center transition-colors">
                            <svg class="w-4 h-4 mr-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                            Duplikat (Clone)
                        </button>
                        <div class="h-px bg-gray-200 my-1"></div>
                        <button @click="handleDeleteNode(contextMenu.nodeId); closeContextMenu();" class="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center transition-colors">
                            <svg class="w-4 h-4 mr-2.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Hapus Node
                        </button>
                    </template>
                    <template v-if="contextMenu.edgeId">
                        <button @click="addWaypointFromContext" class="w-full text-left px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 flex items-center transition-colors">
                            <svg class="w-4 h-4 mr-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                            Tambah Titik Belok
                        </button>
                        <div class="h-px bg-gray-200 my-1"></div>
                        <button @click="handleDeleteEdgeChain(contextMenu.edgeId); closeContextMenu();" class="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 flex items-center transition-colors">
                            <svg class="w-4 h-4 mr-2.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Hapus Garis
                        </button>
                    </template>
                </div>
                </div>
            </div>

            <!-- RIGHT PROPERTIES SIDEBAR -->
            <div class="w-72 bg-gray-50 border-l flex flex-col shadow-inner z-10 hidden md:flex">
                <!-- PANEL HEADER -->
                <div class="h-14 border-b bg-white flex items-center px-4 shrink-0 shadow-sm">
                    <h3 class="font-bold text-gray-700 tracking-wide text-sm flex items-center">
                        <svg v-if="activeSelectionType === 'none'" class="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                        <svg v-else class="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                        {{ activeSelectionType === 'node' && activeNode?.id === 'root' ? 'Premium Themes' : (activeSelectionType === 'node' ? 'Node Properties' : (activeSelectionType === 'edge' ? (activeEdgeLabelId ? 'Text Properties' : 'Line Properties') : 'Canvas Settings')) }}
                    </h3>
                </div>
                
                <div class="p-4 flex flex-col gap-6 overflow-y-auto">
                    
                    <!-- PREMIUM THEMES & LAYOUT (ONLY VISIBLE ON ROOT NODE) -->
                    <template v-if="activeSelectionType === 'node' && activeNode?.id === 'root'">
                        <div>
                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Layout Templates</label>
                            
                            <div v-for="category in templateCategories" :key="category.name" class="mb-4">
                                <div class="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center">
                                    <span class="mr-1">▼</span> {{ category.name }}
                                </div>
                                <div class="grid grid-cols-2 gap-2">
                                    <button v-for="tpl in category.templates" :key="tpl.name" @click="applyTemplate(tpl.layout, tpl.shape, tpl.edge)" 
                                            class="py-2 px-2 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 shadow-sm flex items-center justify-center gap-1 transition-all">
                                        <span class="text-gray-400 text-lg leading-none" v-if="tpl.icon !== 'M'">{{ tpl.icon }}</span>
                                        <svg v-if="tpl.icon === 'M'" class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M14 16l-2-1m0 0l-2 1m2-1v2.5"></path></svg>
                                        {{ tpl.name }}
                                    </button>
                                </div>
                            </div>
                            
                            <hr class="my-5 border-gray-200" />

                            <label class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 block">Node & Line Themes</label>
                            <div class="grid grid-cols-2 gap-3">
                                <button v-for="(t, key) in themes" :key="key" @click="applyTheme(key)" class="group flex flex-col items-center gap-2">
                                    <div class="w-full h-16 rounded-md border-2 transition-transform transform group-hover:scale-105" :class="t.previewClass"></div>
                                    <span class="text-[10px] font-bold text-gray-600 uppercase tracking-wide text-center leading-tight">{{ t.name }}</span>
                                </button>
                            </div>
                        </div>
                    </template>

                    <!-- NODE PROPERTIES -->
                    <template v-else-if="activeSelectionType === 'node' && activeNode">
                        <div class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Layer Order</label>
                            <div class="flex gap-2">
                                <button @click="updateNodeZIndex(1)" class="flex-1 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-1" title="Bring to Front">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 11l7-7 7 7M5 19l7-7 7 7"></path></svg>
                                    Front
                                </button>
                                <button @click="updateNodeZIndex(-1)" class="flex-1 py-1.5 bg-white border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50 transition shadow-sm flex items-center justify-center gap-1" title="Send to Back">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 13l-7 7-7-7m14-8l-7 7-7-7"></path></svg>
                                    Back
                                </button>
                            </div>
                        </div>

                        <div v-if="activeNode.data.shape === 'group'" class="mb-4 bg-gray-100 p-3 rounded-md">
                            <label class="flex items-center cursor-pointer">
                                <input type="checkbox" :checked="activeNode.data.isBorderOnly" @change="updateNodeProperty('isBorderOnly', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300 mr-2" />
                                <span class="text-sm text-gray-700 font-medium">Border Only (Transparent)</span>
                            </label>
                        </div>
                        <div v-if="activeNode.data.shape === 'text' || activeNode.data.shape === 'group'">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Font Family</label>
                            <select :value="activeNode.data.fontFamily || 'Inter'" @change="updateNodeProperty('fontFamily', $event.target.value)" class="w-full text-sm bg-white border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 mb-4">
                                <option value="Inter">Inter (Sans)</option>
                                <option value="serif">Serif</option>
                                <option value="monospace">Monospace</option>
                                <option value="'Comic Sans MS', cursive">Comic Sans</option>
                                <option value="Impact, sans-serif">Impact</option>
                            </select>
                        </div>
                        <div v-if="activeNode.data.shape !== 'text' && !(activeNode.data.shape === 'group' && activeNode.data.isBorderOnly)">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Background Color</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#ffffff', '#fef2f2', '#fffbeb', '#f0fdf4', '#eff6ff', '#f3e8ff', '#f1f5f9']" 
                                    @click="updateNodeProperty('bgColor', c)" 
                                    class="w-8 h-8 rounded border transition hover:scale-110 shadow-sm"
                                    :class="activeNode.data.bgColor === c ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-gray-200'"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <!-- BORDER SETTINGS -->
                        <div v-if="activeNode.data.shape !== 'text' && activeNode.data.shape !== 'image' && activeNode.data.shape !== 'emoji'">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Border Properties</label>
                            
                            <div class="flex gap-2 mb-3">
                                <button @click="updateNodeProperty('borderStyle', 'solid')" class="flex-1 py-1.5 border rounded text-xs transition shadow-sm"
                                        :class="(activeNode.data.borderStyle === 'solid' || !activeNode.data.borderStyle) ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Solid
                                </button>
                                <button @click="updateNodeProperty('borderStyle', 'dashed')" class="flex-1 py-1.5 border rounded text-xs transition shadow-sm"
                                        :class="(activeNode.data.borderStyle === 'dashed') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Dashed
                                </button>
                                <button @click="updateNodeProperty('borderStyle', 'dotted')" class="flex-1 py-1.5 border rounded text-xs transition shadow-sm"
                                        :class="(activeNode.data.borderStyle === 'dotted') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Dotted
                                </button>
                                <button @click="updateNodeProperty('borderWidth', 0)" class="flex-1 py-1.5 border rounded text-xs transition shadow-sm"
                                        :class="(activeNode.data.borderWidth === 0) ? 'bg-red-50 border-red-400 text-red-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    None
                                </button>
                            </div>
                            
                            <div class="mb-3" v-if="activeNode.data.borderWidth !== 0">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Thickness</span>
                                    <span class="text-xs text-gray-500">{{ activeNode.data.borderWidth !== undefined ? activeNode.data.borderWidth : 2 }}px</span>
                                </div>
                                <input type="range" min="1" max="10" :value="activeNode.data.borderWidth !== undefined ? activeNode.data.borderWidth : 2" @input="updateNodeProperty('borderWidth', parseInt($event.target.value))" class="w-full text-blue-500 h-1" />
                            </div>

                            <div class="mb-3" v-if="activeNode.data.borderWidth !== 0">
                                <span class="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Border Color</span>
                                <div class="flex flex-wrap gap-2">
                                    <button v-for="c in ['#e5e7eb', '#94a3b8', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#0f172a']" 
                                        @click="updateNodeProperty('borderColor', c)" 
                                        class="w-5 h-5 rounded border border-gray-200 transition hover:scale-125 shadow-sm"
                                        :class="activeNode.data.borderColor === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                        :style="{ backgroundColor: c }">
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- NODE ANIMATION -->
                        <div v-if="activeNode.data.shape !== 'emoji'" class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Animasi (Animate.css)</label>
                            <select :value="activeNode.data.animation || ''" @change="updateNodeProperty('animation', $event.target.value)" class="w-full text-sm bg-white border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                                <option value="">Tidak ada (None)</option>
                                <option value="bounce">Bounce</option>
                                <option value="flash">Flash</option>
                                <option value="pulse">Pulse</option>
                                <option value="rubberBand">RubberBand</option>
                                <option value="shakeX">Shake X</option>
                                <option value="shakeY">Shake Y</option>
                                <option value="headShake">HeadShake</option>
                                <option value="swing">Swing</option>
                                <option value="tada">Tada</option>
                                <option value="wobble">Wobble</option>
                                <option value="jello">Jello</option>
                                <option value="heartBeat">HeartBeat</option>
                            </select>
                        </div>

                        <!-- EMOJI PICKER IN NODE SETTINGS -->
                        <div v-if="activeNode.data.shape === 'emoji'" class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Pilih Emoji</label>
                            <EmojiPicker :native="false" @select="updateNodeProperty('emoji', $event.i)" class="max-w-full" />
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Text Color</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#111827', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#64748b']" 
                                    @click="updateNodeProperty('textColor', c)" 
                                    class="w-6 h-6 rounded-full border border-transparent transition hover:scale-110 shadow-sm"
                                    :class="activeNode.data.textColor === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Text Size</label>
                            <input type="range" min="10" max="32" :value="activeNode.data.fontSize || 14" @input="updateNodeProperty('fontSize', parseInt($event.target.value))" class="w-full text-blue-500" />
                            <div class="text-right text-xs text-gray-500 mt-1">{{ activeNode.data.fontSize || 14 }}px</div>
                        </div>
                    </template>

                    <!-- EDGE PROPERTIES -->
                    <template v-else-if="activeSelectionType === 'edge' && activeEdge && !activeEdgeLabelId">
                        <div class="mb-4 flex gap-2">
                            <button @click="addEdgeLabel" class="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-lg shadow-sm border border-blue-200 transition-colors flex items-center justify-center">
                                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                                Tambah Teks
                            </button>
                        </div>
                        <div class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Text Style</label>
                            <div class="flex gap-2">
                                <button @click="updateEdgeProperty('labelRotation', 'horizontal')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdge.data?.labelRotation !== 'follow') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Horizontal
                                </button>
                                <button @click="updateEdgeProperty('labelRotation', 'follow')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdge.data?.labelRotation === 'follow') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Follow Line
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Line Color</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#94a3b8', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#0f172a']" 
                                    @click="updateEdgeProperty('color', c)" 
                                    class="w-6 h-6 rounded-full border transition hover:scale-110 shadow-sm"
                                    :class="activeEdge.style?.stroke === c ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-transparent'"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Ketebalan Garis (Width)</label>
                            <input type="range" min="1" max="10" :value="activeEdge.style?.strokeWidth || 2" @input="updateEdgeProperty('width', parseInt($event.target.value))" class="w-full text-blue-500" />
                            <div class="text-right text-xs text-gray-500 mt-1">{{ activeEdge.style?.strokeWidth || 2 }}px</div>
                        </div>

                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Pola Garis (Pattern)</label>
                            <div class="flex gap-2">
                                <button @click="updateEdgeProperty('pattern', 'solid')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdge.data?.pattern || 'solid') === 'solid' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Solid
                                </button>
                                <button @click="updateEdgeProperty('pattern', 'dashed')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdge.data?.pattern === 'dashed') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Dashed
                                </button>
                                <button @click="updateEdgeProperty('pattern', 'dotted')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdge.data?.pattern === 'dotted') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Dotted
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Jenis Garis</label>
                            <div class="grid grid-cols-2 gap-2">
                                <button v-for="t in [
                                    {id:'straight', label:'Lurus'}, 
                                    {id:'smoothstep', label:'Kotak Melengkung'}, 
                                    {id:'step', label:'Zigzag / Patah'}, 
                                    {id:'bezier', label:'Melengkung Bebas'}
                                ]" :key="t.id"
                                    @click="updateEdgeProperty('type', t.id)"
                                    class="py-2 px-2 text-xs font-medium border rounded transition shadow-sm"
                                    :class="(activeEdge.type || 'smoothstep') === t.id ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    {{ t.label }}
                                </button>
                            </div>
                            <p class="text-[10px] text-gray-400 mt-2 leading-tight">
                                *Tips: Untuk membelokkan garis secara custom dengan mouse, buat node baru di tengah, ubah gayanya jadi Transparan, lalu jadikan node tersebut sebagai titik belok.
                            </p>
                        </div>
                        <div>
                            <label class="flex items-center cursor-pointer group mb-2">
                                <input type="checkbox" :checked="activeEdge.animated" @change="updateEdgeProperty('animated', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900 font-medium">Animated (Flowing)</span>
                            </label>
                            
                            <div v-if="activeEdge.animated" class="pl-6 border-l-2 border-blue-100 ml-1">
                                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block mt-2">Gaya Animasi</label>
                                <div class="flex gap-1 bg-blue-50 p-1 rounded-md mb-2">
                                    <button @click="updateEdgeProperty('animStyle', 'flow')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="(activeEdge.data?.animStyle || 'flow') === 'flow' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Flow</button>
                                    <button @click="updateEdgeProperty('animStyle', 'ants')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdge.data?.animStyle === 'ants' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Ants</button>
                                    <button @click="updateEdgeProperty('animStyle', 'pulse')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdge.data?.animStyle === 'pulse' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Pulse</button>
                                    <button @click="updateEdgeProperty('animStyle', 'snake')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdge.data?.animStyle === 'snake' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Snake</button>
                                </div>
                                
                                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Kecepatan</label>
                                <div class="flex gap-1 bg-blue-50 p-1 rounded-md mb-2">
                                    <button @click="updateEdgeProperty('animSpeed', 'slow')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdge.data?.animSpeed === 'slow' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Slow</button>
                                    <button @click="updateEdgeProperty('animSpeed', 'normal')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="(activeEdge.data?.animSpeed || 'normal') === 'normal' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Normal</button>
                                    <button @click="updateEdgeProperty('animSpeed', 'fast')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdge.data?.animSpeed === 'fast' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Fast</button>
                                </div>

                                <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Arah Aliran</label>
                                <div class="flex gap-1 bg-blue-50 p-1 rounded-md">
                                    <button @click="updateEdgeProperty('animDirection', 'normal')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="(activeEdge.data?.animDirection || 'normal') === 'normal' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Maju</button>
                                    <button @click="updateEdgeProperty('animDirection', 'reverse')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdge.data?.animDirection === 'reverse' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-100'">Mundur</button>
                                </div>
                            </div>
                        </div>
                        
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Ukuran Panah (Marker Size)</label>
                            <input type="range" min="10" max="40" :value="activeEdge.data?.arrowSize || 20" @input="updateEdgeProperty('arrowSize', parseInt($event.target.value))" class="w-full text-blue-500 mb-2" />
                            
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Model Panah</label>
                            <div class="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-md mb-3">
                                <button v-for="m in [{id:'arrowclosed', i:'▲'}, {id:'arrow', i:'^'}, {id:'circle', i:'●'}, {id:'diamond', i:'◆'}, {id:'square', i:'■'}]" :key="m.id"
                                    @click="updateEdgeProperty('arrowModel', m.id)"
                                    class="py-1 text-xs font-medium rounded transition-colors shadow-sm flex justify-center items-center"
                                    :class="(activeEdge.data?.arrowModel || 'arrowclosed') === m.id ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-gray-200'"
                                    :title="m.id">
                                    {{ m.i }}
                                </button>
                            </div>
                            
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Arah Panah</label>
                            <div class="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-md">
                                <button v-for="d in [{id:'none', i:'--'}, {id:'forward', i:'->'}, {id:'backward', i:'<-'}, {id:'both', i:'<->'}]" :key="d.id"
                                    @click="updateEdgeProperty('arrow', d.id)"
                                    class="py-1 text-xs font-medium rounded transition-colors shadow-sm flex justify-center items-center tracking-tighter"
                                    :class="(activeEdge.data?.arrow || 'none') === d.id ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-gray-200'"
                                    :title="d.id">
                                    {{ d.i }}
                                </button>
                            </div>
                        </div>
                    </template>
                    
                    <!-- EDGE LABEL PROPERTIES -->
                    <template v-else-if="activeSelectionType === 'edge' && activeEdge && activeEdgeLabel">
                        <div class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Alignment (Rotasi)</label>
                            <div class="flex gap-2">
                                <button @click="updateEdgeLabelProperty('rotation', 'horizontal')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdgeLabel.rotation || 'horizontal') === 'horizontal' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Horizontal
                                </button>
                                <button @click="updateEdgeLabelProperty('rotation', 'follow')" class="flex-1 py-1.5 border rounded text-sm transition shadow-sm"
                                        :class="(activeEdgeLabel.rotation === 'follow') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Follow Line
                                </button>
                            </div>
                        </div>

                        <div class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Visual Style (Tema)</label>
                            <div class="grid grid-cols-1 gap-2">
                                <button @click="updateEdgeLabelProperty('theme', 'pill')" class="py-2 border rounded text-sm transition flex items-center justify-center shadow-sm"
                                        :class="(!activeEdgeLabel.theme || activeEdgeLabel.theme === 'pill') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Pill (Latar + Garis Batas)
                                </button>
                                <button @click="updateEdgeLabelProperty('theme', 'cut')" class="py-2 border rounded text-sm transition flex items-center justify-center shadow-sm"
                                        :class="(activeEdgeLabel.theme === 'cut') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Cut-out (Memotong Garis)
                                </button>
                                
                                <div v-if="activeEdgeLabel.theme === 'cut'" class="bg-gray-50 border border-gray-200 rounded p-3 mt-1">
                                    <label class="flex items-center cursor-pointer group mb-2">
                                        <input type="checkbox" :checked="activeEdgeLabel.animated" @change="updateEdgeLabelProperty('animated', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                        <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900 font-medium">Animasi Border</span>
                                    </label>
                                    
                                    <div v-if="activeEdgeLabel.animated" class="pl-6 border-l-2 border-blue-100 ml-1">
                                        <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block mt-2">Gaya Animasi</label>
                                        <div class="flex gap-1 bg-white p-1 rounded border border-gray-100 mb-2">
                                            <button @click="updateEdgeLabelProperty('animStyle', 'flow')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="(activeEdgeLabel.animStyle || 'flow') === 'flow' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Flow</button>
                                            <button @click="updateEdgeLabelProperty('animStyle', 'ants')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdgeLabel.animStyle === 'ants' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Ants</button>
                                            <button @click="updateEdgeLabelProperty('animStyle', 'pulse')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdgeLabel.animStyle === 'pulse' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Pulse</button>
                                            <button @click="updateEdgeLabelProperty('animStyle', 'snake')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdgeLabel.animStyle === 'snake' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Snake</button>
                                        </div>
                                        
                                        <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Kecepatan</label>
                                        <div class="flex gap-1 bg-white p-1 rounded border border-gray-100 mb-2">
                                            <button @click="updateEdgeLabelProperty('animSpeed', 'slow')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdgeLabel.animSpeed === 'slow' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Slow</button>
                                            <button @click="updateEdgeLabelProperty('animSpeed', 'normal')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="(activeEdgeLabel.animSpeed || 'normal') === 'normal' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Normal</button>
                                            <button @click="updateEdgeLabelProperty('animSpeed', 'fast')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdgeLabel.animSpeed === 'fast' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Fast</button>
                                        </div>

                                        <label class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Arah Aliran</label>
                                        <div class="flex gap-1 bg-white p-1 rounded border border-gray-100">
                                            <button @click="updateEdgeLabelProperty('animDirection', 'normal')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="(activeEdgeLabel.animDirection || 'normal') === 'normal' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Maju</button>
                                            <button @click="updateEdgeLabelProperty('animDirection', 'reverse')" class="flex-1 py-1 text-xs font-medium rounded transition-colors" :class="activeEdgeLabel.animDirection === 'reverse' ? 'bg-blue-500 text-white shadow-sm' : 'text-blue-700 hover:bg-blue-50'">Mundur</button>
                                        </div>
                                    </div>
                                </div>
                                <button @click="updateEdgeLabelProperty('theme', 'transparent')" class="py-2 border rounded text-sm transition flex items-center justify-center shadow-sm"
                                        :class="(activeEdgeLabel.theme === 'transparent') ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'">
                                    Transparan (Hanya Teks)
                                </button>
                            </div>
                        </div>
                        
                        <div class="mb-4">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Warna Teks</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#374151', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#ffffff']" :key="c"
                                    @click="updateEdgeLabelProperty('color', c)" 
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-sm"
                                    :class="(activeEdgeLabel.color || '#374151') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div class="mb-4" v-if="activeEdgeLabel.theme !== 'transparent'">
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Warna Latar</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#ffffff', '#f3f4f6', '#fecaca', '#fde68a', '#a7f3d0', '#bfdbfe', '#e9d5ff', '#1f2937']" :key="'bg'+c"
                                    @click="updateEdgeLabelProperty('bgColor', c)" 
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-sm"
                                    :class="(activeEdgeLabel.bgColor || '#ffffff') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Ukuran Font</label>
                            <input type="range" min="10" max="24" :value="activeEdgeLabel.fontSize || 14" @input="updateEdgeLabelProperty('fontSize', parseInt($event.target.value))" class="w-full text-blue-500" />
                            <div class="text-right text-xs text-gray-500 mt-1">{{ activeEdgeLabel.fontSize || 14 }}px</div>
                        </div>
                    </template>

                    <!-- CANVAS PROPERTIES -->
                    <template v-else>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Warna Background Kanvas</label>
                            <div class="flex flex-wrap gap-2 mb-4">
                                <button v-for="(c, i) in canvasBackgrounds" :key="'canvas-bg'+i"
                                    @click="updateCanvasProperty('backgroundColor', c)" 
                                    class="w-6 h-6 rounded-full border border-gray-200 transition hover:scale-110 shadow-sm"
                                    :class="(settings.backgroundColor || '#ffffff') === c ? 'ring-2 ring-offset-1 ring-blue-500' : ''"
                                    :style="{ background: c }">
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Background Pattern</label>
                            <div class="flex gap-2 bg-gray-100 p-1 rounded-md">
                                <button @click="updateCanvasProperty('backgroundStyle', 'dots')" class="flex-1 py-1.5 text-xs font-medium rounded transition-colors shadow-sm" :class="settings.backgroundStyle === 'dots' ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-gray-200'">Dots</button>
                                <button @click="updateCanvasProperty('backgroundStyle', 'lines')" class="flex-1 py-1.5 text-xs font-medium rounded transition-colors shadow-sm" :class="settings.backgroundStyle === 'lines' ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-gray-200'">Lines</button>
                                <button @click="updateCanvasProperty('backgroundStyle', 'none')" class="flex-1 py-1.5 text-xs font-medium rounded transition-colors shadow-sm" :class="settings.backgroundStyle === 'none' ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-gray-200'">None</button>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Default Branch Style</label>
                            <div class="grid grid-cols-5 gap-1 bg-gray-100 p-1 rounded-md">
                                <button v-for="t in [{id:'brace', i:'-{'}, {id:'step', i:'-['}, {id:'smoothstep', i:'-C'}, {id:'bezier', i:'-~'}, {id:'straight', i:'--'}]" :key="t.id"
                                    @click="updateCanvasProperty('edgeStyle', t.id)"
                                    class="py-1 text-sm font-medium rounded transition-colors shadow-sm flex justify-center items-center"
                                    :class="settings.edgeStyle === t.id ? 'bg-white text-blue-700' : 'text-gray-600 hover:bg-gray-200'"
                                    :title="t.id">
                                    {{ t.i }}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Aspect Ratio (Export Size)</label>
                            <select :value="settings.aspectRatio" @change="updateCanvasProperty('aspectRatio', $event.target.value)" class="w-full text-sm border-gray-300 rounded focus:ring-blue-500 p-2 shadow-sm">
                                <option value="auto">Auto (Full Screen)</option>
                                <option value="16/9">16:9 Landscape (YouTube/Presentations)</option>
                                <option value="9/16">9:16 Portrait (TikTok/Reels/Shorts)</option>
                                <option value="1/1">1:1 Square (Instagram/Post)</option>
                            </select>
                        </div>
                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Default Line Color</label>
                            <div class="flex flex-wrap gap-2">
                                <button v-for="c in ['#94a3b8', '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#0f172a']" 
                                    @click="updateCanvasProperty('edgeColor', c)" 
                                    class="w-6 h-6 rounded-full border transition hover:scale-110 shadow-sm"
                                    :class="settings.edgeColor === c ? 'ring-2 ring-offset-1 ring-blue-500' : 'border-transparent'"
                                    :style="{ backgroundColor: c }">
                                </button>
                            </div>
                        </div>

                        <div>
                            <label class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">Tampilan Bantuan</label>
                            <div class="flex flex-col gap-2 bg-gray-100 p-2 rounded-md">
                                <label class="flex items-center cursor-pointer group">
                                    <input type="checkbox" :checked="settings.showMinimap !== false" @change="updateCanvasProperty('showMinimap', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                    <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900 font-medium">Tampilkan MiniMap</span>
                                </label>
                                <label class="flex items-center cursor-pointer group">
                                    <input type="checkbox" :checked="settings.showControls !== false" @change="updateCanvasProperty('showControls', $event.target.checked)" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                                    <span class="ml-2 text-sm text-gray-700 group-hover:text-gray-900 font-medium">Tampilkan Tombol Zoom</span>
                                </label>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </div>

        <DialogModal :show="isShareModalOpen" @close="isShareModalOpen = false">
            <template #title>
                Share Mindmap
            </template>
            <template #content>
                <div class="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <h4 class="font-medium text-gray-900 mb-2">Public Link</h4>
                    <div class="flex items-center justify-between mb-3">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" v-model="isPublic" @change="updatePublicSettings" class="rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                            <span class="ml-2 text-sm text-gray-700">Anyone with the link can access</span>
                        </label>
                        <select v-if="isPublic" v-model="publicPermission" @change="updatePublicSettings" class="text-sm border-gray-300 rounded focus:ring-blue-500 py-1 pl-2 pr-8">
                            <option value="view">Can View</option>
                            <option value="edit">Can Edit</option>
                        </select>
                    </div>
                    <div v-if="isPublic" class="flex mt-2">
                        <input type="text" readonly :value="route('mindmaps.edit', props.mindmap.id)" class="flex-1 text-sm border-gray-300 rounded-l focus:ring-0 bg-white" />
                        <button onclick="navigator.clipboard.writeText(this.previousElementSibling.value); this.innerText='Copied!';" class="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 text-sm font-medium rounded-r border border-l-0 border-gray-300 transition-colors">Copy</button>
                    </div>
                </div>

                <div class="mb-4">
                    <h4 class="font-medium text-gray-900 mb-2">Invite Collaborators</h4>
                    <form @submit.prevent="inviteUser" class="flex gap-2">
                        <TextInput v-model="shareEmail" type="email" placeholder="Enter email address" class="flex-1" required />
                        <select v-model="sharePermission" class="text-sm border-gray-300 rounded focus:ring-blue-500">
                            <option value="view">Can View</option>
                            <option value="edit">Can Edit</option>
                        </select>
                        <PrimaryButton type="submit">Invite</PrimaryButton>
                    </form>
                </div>

                <div v-if="props.mindmap.shares && props.mindmap.shares.length > 0">
                    <h4 class="font-medium text-gray-900 mb-2 mt-6">People with access</h4>
                    <ul class="divide-y divide-gray-100 border border-gray-100 rounded-lg">
                        <li v-for="share in props.mindmap.shares" :key="share.id" class="p-3 flex items-center justify-between hover:bg-gray-50">
                            <div>
                                <p class="text-sm font-medium text-gray-900">{{ share.email }}</p>
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">{{ share.permission === 'edit' ? 'Can Edit' : 'Can View' }}</span>
                                <button @click="removeUser(share.email)" class="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                            </div>
                        </li>
                    </ul>
                </div>
            </template>
            <template #footer>
                <SecondaryButton @click="isShareModalOpen = false">Done</SecondaryButton>
            </template>
        </DialogModal>
        
        <!-- Toast Notification -->
        <Transition enter-active-class="transition ease-out duration-300" enter-from-class="transform opacity-0 translate-y-2" enter-to-class="transform opacity-100 translate-y-0" leave-active-class="transition ease-in duration-200" leave-from-class="transform opacity-100 translate-y-0" leave-to-class="transform opacity-0 translate-y-2">
            <div v-if="toast.show" class="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-[200] flex items-center px-4 py-3 rounded-lg shadow-lg border" :class="toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'">
                <svg v-if="toast.type === 'error'" class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <svg v-else class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span class="font-medium text-sm">{{ toast.message }}</span>
            </div>
        </Transition>
    </AppLayout>
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
