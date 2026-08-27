<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MindmapShare extends Model
{
    use HasFactory;

    protected $fillable = [
        'mindmap_id',
        'email',
        'permission'
    ];

    public function mindmap()
    {
        return $this->belongsTo(Mindmap::class);
    }
}
