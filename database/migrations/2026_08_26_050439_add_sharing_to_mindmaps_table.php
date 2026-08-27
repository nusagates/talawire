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
        Schema::table('mindmaps', function (Blueprint $table) {
            $table->boolean('is_public')->default(false);
            $table->string('public_permission')->default('view'); // 'view' or 'edit'
        });
    }

    public function down(): void
    {
        Schema::table('mindmaps', function (Blueprint $table) {
            $table->dropColumn(['is_public', 'public_permission']);
        });
    }
};
