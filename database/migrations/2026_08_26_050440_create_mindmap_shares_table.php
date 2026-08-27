<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('mindmap_shares', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('mindmap_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('permission')->default('view'); // 'view' or 'edit'
            $table->timestamps();
            
            $table->unique(['mindmap_id', 'email']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mindmap_shares');
    }
};
