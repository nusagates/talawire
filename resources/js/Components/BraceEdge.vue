<script setup>
import { computed } from 'vue';
import { BaseEdge } from '@vue-flow/core';

const props = defineProps({
  id: String,
  sourceX: Number,
  sourceY: Number,
  targetX: Number,
  targetY: Number,
  sourcePosition: String,
  targetPosition: String,
  sourceHandleId: String,
  targetHandleId: String,
  style: Object,
  markerEnd: String,
  animated: Boolean,
});

// Calculate a curly brace path
const path = computed(() => {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, sourceHandleId } = props;
  
  // Determine if it's horizontal or vertical based on sourceHandleId or sourcePosition
  const isHorizontal = !sourceHandleId ? (sourcePosition === 'left' || sourcePosition === 'right') : (sourceHandleId === 'source-left' || sourceHandleId === 'source-right');
  
  if (isHorizontal) {
    const midX = sourceX + (targetX - sourceX) * 0.5;
    const curveSize = Math.min(Math.abs(targetY - sourceY) / 2, 10);
    const yDir = targetY > sourceY ? 1 : -1;
    
    if (Math.abs(targetY - sourceY) < 5) {
        return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    }

    // Draw curly brace for each edge
    return `M ${sourceX} ${sourceY} 
            L ${midX - 10} ${sourceY} 
            Q ${midX} ${sourceY} ${midX} ${sourceY + curveSize * yDir}
            L ${midX} ${targetY - curveSize * yDir}
            Q ${midX} ${targetY} ${midX + 10} ${targetY}
            L ${targetX} ${targetY}`;
  } else {
    // Vertical tree (top/down)
    const midY = sourceY + (targetY - sourceY) * 0.5;
    const curveSize = Math.min(Math.abs(targetX - sourceX) / 2, 10);
    const xDir = targetX > sourceX ? 1 : -1;
    
    if (Math.abs(targetX - sourceX) < 5) {
        return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
    }

    return `M ${sourceX} ${sourceY} 
            L ${sourceX} ${midY - 10} 
            Q ${sourceX} ${midY} ${sourceX + curveSize * xDir} ${midY}
            L ${targetX - curveSize * xDir} ${midY}
            Q ${targetX} ${midY} ${targetX} ${midY + 10}
            L ${targetX} ${targetY}`;
  }
});
</script>

<template>
  <BaseEdge
    :id="id"
    :path="path"
    :style="style"
    :marker-end="markerEnd"
    :class="animated ? 'animated' : ''"
  />
</template>

<style scoped>
.animated {
  stroke-dasharray: 5;
  animation: dashdraw 0.5s linear infinite;
}
@keyframes dashdraw {
  from { stroke-dashoffset: 10; }
}
</style>
