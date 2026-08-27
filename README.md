# Talawire (Mindmap & Flowchart Tool)

Talawire is a comprehensive web-based tool for creating Mindmaps, Flowcharts, and UML diagrams. Built with Laravel, Vue.js (Inertia), and Vue Flow, it provides a seamless and interactive experience for diagramming and brainstorming.

## 🚀 Key Features

*   **Versatile Diagramming:** Create Mindmaps (auto-layout), Flowcharts, and generic node-based diagrams.
*   **📱 Mobile Responsive:** Features a dedicated, fully responsive mobile view (`MobileEdit.vue`) for editing on smartphones and tablets.
    *   Tap-to-add shape creation.
    *   Bottom sheet property and shape palette drawers.
    *   Floating Action Buttons (FABs) for easy access.
*   **Export Options:** Export your diagrams to multiple formats:
    *   **PDF:** High-quality vector export.
    *   **SVG (Animated):** Export animated diagrams with Animate.css effects.
    *   **Video (MP4/WebM):** Built-in screen recording feature to capture your animated flowcharts directly from the browser.
*   **Team Collaboration:** Share your mindmaps via email or public links with view/edit permissions.
*   **Rich Customization:**
    *   Custom nodes (shapes, text, emojis, image uploads).
    *   Edge routing (bezier, step, straight).
    *   Edge animations and markers.
    *   Customizable themes and templates.
*   **State Management:** Robust Undo/Redo functionality and auto-saving mechanisms.

## 🛠️ Technology Stack

*   **Backend:** Laravel 11
*   **Frontend:** Vue.js 3, Inertia.js, Tailwind CSS
*   **Diagram Engine:** Vue Flow (`@vue-flow/core`)
*   **State History:** VueUse (`useManualRefHistory`)
*   **Layout Algorithm:** Dagre (for automatic mindmap layouts)
*   **Video Processing:** MediaRecorder API
*   **PDF Generation:** `jspdf` & `html2canvas`

## ⚙️ Installation & Setup (Docker)

The easiest way to get Talawire up and running is by using the included Docker configuration. This setup includes PHP 8.3, Nginx, PostgreSQL, and Node.js. Database data and uploaded files are automatically persisted.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/nusagates/talawire.git
    cd talawire
    ```

2.  **Environment Setup:**
    ```bash
    cp .env.example .env
    ```
    *Open your `.env` file and update the database host to use the Docker container:*
    ```env
    DB_CONNECTION=pgsql
    DB_HOST=db
    DB_PORT=5432
    DB_DATABASE=talawire
    DB_USERNAME=postgres
    DB_PASSWORD=root
    ```

3.  **Build and Start Containers:**
    ```bash
    docker-compose up -d --build
    ```

4.  **Install Dependencies & Run Migrations (First Time Only):**
    ```bash
    # Install PHP dependencies
    docker-compose exec app composer install

    # Generate App Key
    docker-compose exec app php artisan key:generate

    # Install Node.js dependencies and build frontend assets
    docker-compose exec app npm install
    docker-compose exec app npm run build

    # Run database migrations
    docker-compose exec app php artisan migrate
    ```

5.  **Access the Application:**
    Open your browser and navigate to: **http://localhost:8095**

## 📱 Accessing Mobile View

The application automatically detects mobile devices via the User-Agent header and serves a touch-optimized UI. 
To test this on a desktop browser:
1. Open Developer Tools (F12).
2. Toggle the Device Toolbar (Ctrl+Shift+M).
3. Select a mobile device profile and refresh the page.

*Note: The Video Recording feature requires a secure context (HTTPS) or `localhost` to function properly due to browser security restrictions on the MediaDevices API.*

## 📄 License

The Laravel framework is open-sourced software licensed under the [MIT license](https://opensource.org/licenses/MIT).
