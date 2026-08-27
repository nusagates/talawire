<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mindmaps', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->json('nodes')->nullable(); // React Flow nodes
            $table->json('edges')->nullable(); // React Flow edges
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mindmaps');
    }
};
