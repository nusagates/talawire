<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Concerns\HasUuids;

class Mindmap extends Model
{
    use HasFactory, HasUuids;

    protected $fillable = [
        'project_id',
        'name',
        'nodes',
        'edges',
        'settings',
        'is_public',
        'public_permission',
        'video_export_status',
        'last_video_url'
    ];

    protected $casts = [
        'nodes' => 'array',
        'edges' => 'array',
        'settings' => 'array',
        'is_public' => 'boolean'
    ];

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function shares()
    {
        return $this->hasMany(MindmapShare::class);
    }
}
