<script setup>
import { Head, Link } from '@inertiajs/vue3';

defineProps({
    canLogin: {
        type: Boolean,
    },
    canRegister: {
        type: Boolean,
    },
    laravelVersion: {
        type: String,
        required: true,
    },
    phpVersion: {
        type: String,
        required: true,
    },
});
</script>

<template>
    <Head title="Welcome" />
    <div class="min-h-screen bg-white text-gray-900 font-sans selection:bg-blue-100 selection:text-blue-900">
        <!-- Header -->
        <header class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded bg-blue-600 flex items-center justify-center">
                    <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                    </svg>
                </div>
                <span class="font-semibold text-xl tracking-tight text-gray-800">{{ $page.props.appName }}</span>
            </div>
            
            <nav v-if="canLogin" class="flex items-center gap-3">
                <a
                    href="https://chat.kravti.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md transition-colors"
                >
                    Chat Kravti
                </a>
                <Link
                    :href="route('terms.show')"
                    class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md transition-colors"
                >
                    Terms
                </Link>
                <Link
                    :href="route('policy.show')"
                    class="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-md transition-colors"
                >
                    Privacy
                </Link>

                <Link
                    v-if="$page.props.auth.user"
                    :href="route('dashboard')"
                    class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                >
                    Dashboard
                </Link>

                <template v-else>
                    <Link
                        :href="route('login')"
                        class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-md transition-colors"
                    >
                        Log in
                    </Link>

                    <Link
                        v-if="canRegister"
                        :href="route('register')"
                        class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                    >
                        Register
                    </Link>
                </template>
            </nav>
        </header>

        <!-- Hero Section -->
        <main class="flex flex-col items-center justify-center text-center px-6 pt-32 pb-24">
            <h1 class="text-5xl md:text-6xl font-bold tracking-tight text-gray-900 mb-6">
                Organize your thoughts.
            </h1>
            
            <p class="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                {{ $page.props.appName }} is a clean, collaborative workspace for your organization's mindmaps. Built for speed, simplicity, and teamwork.
            </p>
            
            <div class="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                    :href="route('register')"
                    class="w-full sm:w-auto px-6 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-sm transition-colors"
                >
                    Get Started for Free
                </Link>
                <a
                    href="#features"
                    class="w-full sm:w-auto px-6 py-3 text-base font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                >
                    Learn More
                </a>
            </div>
        </main>

        <!-- Footer -->
        <footer class="py-8 text-sm text-gray-500 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between px-6 gap-4">
            <div>
                {{ $page.props.appName }} &copy; 2026. Built with Laravel v{{ laravelVersion }}.
            </div>
            <div class="flex gap-4 text-xs text-gray-500">
                <a href="https://chat.kravti.com" target="_blank" rel="noopener noreferrer" class="hover:underline">Chat Kravti</a>
                <Link :href="route('terms.show')" class="hover:underline">Terms of Service</Link>
                <Link :href="route('policy.show')" class="hover:underline">Privacy Policy</Link>
            </div>
        </footer>
    </div>
</template>
