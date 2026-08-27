<script setup>
import { Link } from '@inertiajs/vue3';
</script>

<template>
    <Link :href="'/'" class="flex flex-col items-center gap-2">
        <div class="w-12 h-12 rounded bg-blue-600 flex items-center justify-center shadow-sm">
            <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
        </div>
        <span class="font-semibold text-2xl tracking-tight text-gray-900">{{ $page.props.appName }}</span>
    </Link>
</template>
