<template>
    <div class="min-h-screen flex flex-col justify-center items-center pt-6 sm:pt-0 bg-gray-50 font-sans">
        <div>
            <slot name="logo" />
        </div>

        <div class="w-full sm:max-w-md mt-8 px-8 py-8 bg-white border border-gray-200 shadow-sm overflow-hidden rounded-lg">
            <slot />
        </div>
    </div>
</template>
