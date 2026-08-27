<?php

use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

Route::middleware([
    'auth:sanctum',
    config('jetstream.auth_session'),
    'verified',
])->group(function () {
    Route::get('/dashboard', function () {
        $team = auth()->user()->currentTeam;
        $projects = [];
        if ($team) {
            $projects = $team->projects()->with('mindmaps')->get();
        }
        return Inertia::render('Dashboard', [
            'projects' => $projects
        ]);
    })->name('dashboard');

    Route::post('/mindmaps', [\App\Http\Controllers\MindmapController::class, 'store'])->name('mindmaps.store');
    Route::delete('/mindmaps/{mindmap}', [\App\Http\Controllers\MindmapController::class, 'destroy'])->name('mindmaps.destroy');
    
    // Sharing endpoints
    Route::post('/mindmaps/{mindmap}/share', [\App\Http\Controllers\MindmapController::class, 'addShare'])->name('mindmaps.share.add');
    Route::delete('/mindmaps/{mindmap}/share/{email}', [\App\Http\Controllers\MindmapController::class, 'removeShare'])->name('mindmaps.share.remove');
    Route::put('/mindmaps/{mindmap}/public', [\App\Http\Controllers\MindmapController::class, 'updatePublicSetting'])->name('mindmaps.public.update');
});

// Move edit and update outside auth to allow public access, but we'll manually check auth inside the controller
Route::get('/mindmaps/{mindmap}', [\App\Http\Controllers\MindmapController::class, 'edit'])->name('mindmaps.edit');
Route::put('/mindmaps/{mindmap}', [\App\Http\Controllers\MindmapController::class, 'update'])->name('mindmaps.update');
