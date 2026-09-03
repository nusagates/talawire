import puppeteer from 'puppeteer';
import { getStream } from 'puppeteer-stream';
import fs from 'fs';
async function renderVideo(url, outputPath, durationMs = 5000) {
    const puppeteerOptions = {
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-dev-shm-usage',
            '--window-size=1920,1080'
        ],
        defaultViewport: {
            width: 1920,
            height: 1080
        }
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH || fs.existsSync('/usr/bin/chromium')) {
        puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
    }

    const browser = await puppeteer.launch(puppeteerOptions);

    const page = await browser.newPage();
    
    // Navigate to the render view
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Give Vue and the Mindmap component a moment to mount and animate
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get the stream
    const stream = await getStream(page, { audio: false, video: true, frameSize: 60 });
    
    console.log(`Starting recording for ${durationMs}ms...`);
    const file = fs.createWriteStream(outputPath);
    stream.pipe(file);

    // Wait for the duration
    await new Promise(resolve => setTimeout(resolve, durationMs));

    // Stop recording and close browser
    await stream.destroy();
    file.close();
    
    console.log(`Recording finished, closing browser...`);
    await browser.close();
    
    console.log(`Video saved to ${outputPath}`);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error('Usage: node video-renderer.js <url> <outputPath> [durationMs]');
    process.exit(1);
}

const url = args[0];
const outputPath = args[1];
const durationMs = args[2] ? parseInt(args[2]) : 5000;

renderVideo(url, outputPath, durationMs).catch(err => {
    console.error('Error rendering video:', err);
    process.exit(1);
});
