<?php

namespace App\Jobs;

use App\Models\Mindmap;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Illuminate\Support\Facades\Storage;

class RenderMindmapVideo implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120;
    
    protected $mindmap;
    protected $userId;
    protected $durationMs;

    public function __construct(Mindmap $mindmap, $userId, $durationMs = 5000)
    {
        $this->mindmap = $mindmap;
        $this->userId = $userId;
        $this->durationMs = $durationMs;
    }

    public function handle(): void
    {
        $fileName = 'video_' . $this->mindmap->id . '_' . time() . '.webm';
        $outputPath = storage_path('app/public/videos/' . $fileName);
        
        // Ensure directory exists
        if (!file_exists(dirname($outputPath))) {
            mkdir(dirname($outputPath), 0755, true);
        }

        // Render URL (a special view-only mode just for rendering)
        $url = route('mindmap.render_view', ['uuid' => $this->mindmap->id, 't' => time()]);

        Log::info("Starting video render for {$this->mindmap->id} at $url");
        $this->mindmap->update(['video_export_status' => 'rendering']);

        // Execute Node.js script
        $scriptPath = base_path('resources/scripts/video-renderer.js');
        $process = new Process([
            'node', 
            $scriptPath, 
            $url, 
            $outputPath, 
            $this->durationMs
        ]);
        
        $process->setTimeout(120);

        try {
            $process->mustRun();
            Log::info("Video rendered successfully: $outputPath");
            
            $this->mindmap->update([
                'video_export_status' => 'done',
                'last_video_url' => asset('storage/videos/' . $fileName)
            ]);
            
        } catch (ProcessFailedException $exception) {
            Log::error("Failed to render video: " . $exception->getMessage());
            $this->mindmap->update(['video_export_status' => 'failed']);
        }
    }
}
