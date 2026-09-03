<?php

namespace App\Http\Controllers;

use App\Models\Mindmap;
use Illuminate\Http\Request;
use Inertia\Inertia;

class MindmapController extends Controller
{
    public function store(Request $request)
    {
        $team = auth()->user()->currentTeam;
        
        if (!$team) {
            abort(403, 'You must be in a team to create a mindmap.');
        }

        // Find or create a default project for the team
        $project = $team->projects()->firstOrCreate([
            'name' => 'Default Project'
        ]);

        $mindmap = $project->mindmaps()->create([
            'name' => 'Untitled Mindmap',
            'nodes' => [],
            'edges' => [],
        ]);

        return redirect()->route('mindmaps.edit', $mindmap);
    }

    public function destroy(Mindmap $mindmap)
    {
        if (!$this->checkAccess($mindmap, 'edit')) {
            abort(403, 'Unauthorized action.');
        }

        $mindmap->delete();

        return redirect()->route('dashboard');
    }

    private function checkAccess(Mindmap $mindmap, $action = 'view')
    {
        $user = auth()->user();

        // If user is owner/team member
        if ($user && $mindmap->project->team_id === $user->current_team_id) {
            return true;
        }

        // If invited via email
        if ($user) {
            $share = $mindmap->shares()->where('email', $user->email)->first();
            if ($share) {
                if ($action === 'view') return true;
                if ($action === 'edit' && $share->permission === 'edit') return true;
            }
        }

        // If public link
        if ($mindmap->is_public) {
            if ($action === 'view') return true;
            if ($action === 'edit' && $mindmap->public_permission === 'edit') return true;
        }

        return false;
    }

    public function edit(Request $request, Mindmap $mindmap)
    {
        if (!$this->checkAccess($mindmap, 'view')) {
            abort(403, 'You do not have access to this mindmap.');
        }

        $canEdit = $this->checkAccess($mindmap, 'edit');

        // Basic mobile detection
        $userAgent = $request->header('User-Agent');
        $isMobile = preg_match('/(android|avantgo|blackberry|bolt|boost|cricket|docomo|fone|hiptop|mini|mobi|palm|phone|pie|tablet|up\.browser|up\.link|webos|wos)/i', $userAgent);

        $view = $isMobile ? 'Mindmap/MobileEdit' : 'Mindmap/Edit';

        return Inertia::render($view, [
            'mindmap' => $mindmap->load('shares'),
            'canEdit' => $canEdit
        ]);
    }

    public function update(Request $request, Mindmap $mindmap)
    {
        if (!$this->checkAccess($mindmap, 'edit')) {
            abort(403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|nullable|string|max:255',
            'nodes' => 'sometimes|nullable|array',
            'edges' => 'sometimes|nullable|array',
            'settings' => 'sometimes|nullable|array',
        ]);

        $mindmap->update($validated);

        return response()->json(['success' => true]);
    }

    public function addShare(Request $request, Mindmap $mindmap)
    {
        if (!$this->checkAccess($mindmap, 'edit')) abort(403);

        $validated = $request->validate([
            'email' => 'required|email',
            'permission' => 'required|in:view,edit'
        ]);

        $mindmap->shares()->updateOrCreate(
            ['email' => $validated['email']],
            ['permission' => $validated['permission']]
        );

        return back();
    }

    public function removeShare(Mindmap $mindmap, $email)
    {
        if (!$this->checkAccess($mindmap, 'edit')) abort(403);

        $mindmap->shares()->where('email', $email)->delete();

        return back();
    }

    public function updatePublicSetting(Request $request, Mindmap $mindmap)
    {
        if (!$this->checkAccess($mindmap, 'edit')) abort(403);

        $validated = $request->validate([
            'is_public' => 'required|boolean',
            'public_permission' => 'required|in:view,edit'
        ]);

        $mindmap->update($validated);
        return back();
    }

    public function exportVideo(Request $request, Mindmap $mindmap)
    {
        $durationMs = $request->input('duration', 5000);
        $mindmap->update(['video_export_status' => 'queued', 'last_video_url' => null]);
        
        \App\Jobs\RenderMindmapVideo::dispatch($mindmap, auth()->id(), $durationMs);

        return response()->json(['message' => 'Video export started', 'status' => 'queued']);
    }

    public function videoStatus(Mindmap $mindmap)
    {
        return response()->json([
            'status' => $mindmap->video_export_status,
            'url' => $mindmap->last_video_url
        ]);
    }

    public function renderView($uuid)
    {
        $mindmap = Mindmap::where('uuid', $uuid)->firstOrFail();
        // Return a raw Inertia view with canEdit=false for rendering
        return \Inertia\Inertia::render('Mindmap/Edit', [
            'mindmap' => $mindmap,
            'canEdit' => false,
            'isRenderView' => true,
        ]);
    }
}
