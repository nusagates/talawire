<script setup>
import AppLayout from '@/Layouts/AppLayout.vue';
import { Link, router } from '@inertiajs/vue3';
import { ref } from 'vue';
import ConfirmationModal from '@/Components/ConfirmationModal.vue';
import SecondaryButton from '@/Components/SecondaryButton.vue';
import DangerButton from '@/Components/DangerButton.vue';

defineProps({
    projects: {
        type: Array,
        default: () => [],
    }
});

const mindmapToDelete = ref(null);

const deleteMindmap = () => {
    if (mindmapToDelete.value) {
        router.delete(route('mindmaps.destroy', mindmapToDelete.value.id), {
            onFinish: () => mindmapToDelete.value = null,
        });
    }
};
</script>

<template>
    <AppLayout title="Dashboard">
        <template #header>
            <div class="flex items-center justify-between">
                <h2 class="font-semibold text-xl text-gray-800 leading-tight">
                    Dashboard
                </h2>
                <!-- Create Mindmap Button Placeholder -->
                <Link :href="route('mindmaps.store')" method="post" as="button" class="inline-flex items-center px-4 py-2 bg-blue-600 border border-transparent rounded-md font-medium text-sm text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors">
                    + New Mindmap
                </Link>
            </div>
        </template>

        <div class="py-12">
            <div class="max-w-7xl mx-auto sm:px-6 lg:px-8">
                <!-- Mindmaps List -->
                <div>
                    <h3 class="text-lg font-medium text-gray-900 mb-4 px-4 sm:px-0">Your Mindmaps</h3>
                    
                    <div v-if="projects.length === 0 || !projects.some(p => p.mindmaps.length > 0)" class="bg-white border border-gray-200 shadow-sm sm:rounded-md p-12 text-center">
                        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <h3 class="mt-2 text-sm font-medium text-gray-900">No mindmaps</h3>
                        <p class="mt-1 text-sm text-gray-500">Get started by creating a new mindmap in your organization.</p>
                        <div class="mt-6">
                            <Link :href="route('mindmaps.store')" method="post" as="button" class="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                                <svg class="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" />
                                </svg>
                                New Mindmap
                            </Link>
                        </div>
                    </div>
                    
                    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        <template v-for="project in projects" :key="project.id">
                            <div v-for="mindmap in project.mindmaps" :key="mindmap.id" class="relative rounded-lg border border-gray-300 bg-white px-6 py-5 shadow-sm flex flex-col justify-between hover:border-gray-400 focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 transition-colors">
                                <div class="flex items-center space-x-3 mb-4">
                                    <div class="flex-shrink-0">
                                        <div class="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            <svg class="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                            </svg>
                                        </div>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <Link :href="route('mindmaps.edit', mindmap.id)" class="focus:outline-none">
                                            <span class="absolute inset-0 z-10" aria-hidden="true"></span>
                                            <p class="text-sm font-medium text-gray-900 truncate">
                                                {{ mindmap.name }}
                                            </p>
                                            <p class="text-sm text-gray-500 truncate">
                                                Project: {{ project.name }}
                                            </p>
                                        </Link>
                                    </div>
                                </div>
                                <div class="flex justify-end border-t border-gray-100 pt-3 relative z-20">
                                    <button @click.prevent="mindmapToDelete = mindmap" class="text-xs font-medium text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">
                                        Hapus
                                    </button>
                                </div>
                            </div>
                        </template>
                    </div>
                </div>
            </div>
        </div>


        <ConfirmationModal :show="mindmapToDelete !== null" @close="mindmapToDelete = null">
            <template #title>
                Hapus Mindmap
            </template>
            <template #content>
                Apakah Anda yakin ingin menghapus mindmap <strong>{{ mindmapToDelete?.title || 'Untitled' }}</strong>? Data yang sudah dihapus tidak dapat dikembalikan.
            </template>
            <template #footer>
                <SecondaryButton @click="mindmapToDelete = null" class="mr-2">Batal</SecondaryButton>
                <DangerButton @click="deleteMindmap">Hapus</DangerButton>
            </template>
        </ConfirmationModal>
    </AppLayout>
</template>
