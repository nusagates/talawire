<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mindmaps', function (Blueprint $table) {
            $table->string('video_export_status')->default('idle')->after('uuid');
            $table->string('last_video_url')->nullable()->after('video_export_status');
        });
    }

    public function down(): void
    {
        Schema::table('mindmaps', function (Blueprint $table) {
            $table->dropColumn(['video_export_status', 'last_video_url']);
        });
    }
};
