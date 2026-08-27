<script setup>
import ApplicationLogo from '@/Components/ApplicationLogo.vue';
</script>

<template>
    <div>
        <div class="p-6 lg:p-8 bg-white border-b border-gray-200">
            <ApplicationLogo class="block h-12 w-auto" />

            <h1 class="mt-8 text-2xl font-medium text-gray-900">
                Welcome to your Talawire workspace!
            </h1>

            <p class="mt-4 text-gray-500 leading-relaxed">
                Start by creating a new Project for your organization, then you can build collaborative mindmaps inside it. 
                Use the top navigation menu to manage your Teams or Profile settings.
            </p>
        </div>

        <div class="bg-gray-50 bg-opacity-25 grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 p-6 lg:p-8">
            <div class="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" class="w-6 h-6 stroke-blue-600 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <div class="ml-4">
                    <h2 class="text-lg font-medium text-gray-900">Projects</h2>
                    <p class="mt-2 text-sm text-gray-500 text-left">
                        Organize your mindmaps into specific projects. Each project belongs to a Team (Organization) and can be accessed by its members.
                    </p>
                </div>
            </div>

            <div class="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" class="w-6 h-6 stroke-blue-600 shrink-0">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
                <div class="ml-4">
                    <h2 class="text-lg font-medium text-gray-900">Mindmaps</h2>
                    <p class="mt-2 text-sm text-gray-500 text-left">
                        Interactive nodes and edges that you can drag and drop. Collaborate and visualize ideas seamlessly using our built-in React Flow editor.
                    </p>
                </div>
            </div>
        </div>
    </div>
</template>
