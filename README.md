This Canvas provides a single-page web application designed to test internet download speed with a distinctive DOS-like terminal interface. It leverages HTML for structure, custom CSS for styling, and JavaScript with the D3.js library for functionality and real-time data visualization.

Here's a breakdown of the approach and techniques used:

Summary of the Code
Overall Structure:

The application is contained within a single index.html file.
Styling (<style>) and JavaScript logic (<script>) are embedded directly within the HTML, making it self-contained.
It imports Tailwind CSS for basic utilities and D3.js for advanced charting capabilities.
DOS Terminal User Interface (UI) Design:

Theme: The CSS is meticulously crafted to mimic an old-school DOS terminal. This includes:
A dark, plain #0d1117 or #000000 background.
Monospace font ('Roboto Mono').
Prominent "Matrix green" (#00ff00) for text, labels, and borders.
Sharp, unrounded corners on all elements (e.g., border-radius: 0;).
Subtle scanline overlay (::before pseudo-element on .container) to simulate a CRT monitor.
Layout: Instead of traditional UI elements like buttons and input fields, information is presented in div elements styled to look like command-line output lines (.result-line).
Interactive "Button": The "INITIATE_TEST" is a <button> element, but it's styled to appear as part of the terminal text, complete with a PROMPT> prefix and a blinking _ cursor (::after pseudo-element) when active, reinforcing the command-line interaction. It changes color on hover and disables/enables based on test status.
No Glow/Shadows: All box-shadow and text-shadow effects are removed to achieve a flat, non-glowing aesthetic, consistent with a plain DOS terminal.
Speed Test Methodology:

Latency Test (Ping):
A quick HEAD request is sent to https://cloudflare.com/cdn-cgi/trace to measure the Round-Trip Time (RTT) in milliseconds.
A 5-second timeout is applied using AbortController to prevent indefinite hanging.
Download Speed Test (Core):
Target: The test aims to download 1GB (DOWNLOAD_FILE_SIZE_BYTES) of dummy data from Cloudflare's speed test endpoint.
Parallel Connections: To maximize throughput and simulate real-world browser behavior, the test initiates 8 (NUM_PARALLEL_CONNECTIONS) simultaneous fetch requests. Each connection downloads a portion of the total 1GB file.
Real-time Cumulative Average Speed Calculation:
The fetch API's response.body.getReader() is used to read the incoming data stream in chunks.
A requestAnimationFrame loop continuously monitors the totalBytesDownloaded and elapsedTimeFromStart.
The DL_SPEED display is updated in real-time by calculating the average speed from the start of the test up to the current moment ((totalBytesDownloaded * 8) / elapsedTimeFromStart).
Graphing with D3.js (Real-time & Animated):
The D3.js library is used to render a line graph (<svg> element) within the terminal UI.
Data points (cumulative average speed vs. time) are collected every 200ms (GRAPH_SAMPLE_INTERVAL_MS).
The graph's line (.line path) and axes (.axis) are smoothly animated using D3's transition() methods, ensuring a fluid and continuous visualization of the speed trend.
The X-axis (time) and Y-axis (speed) domains dynamically adjust as more data is collected.
Test Timeout: A crucial AbortController and setTimeout mechanism is implemented to stop the download test automatically after 10 seconds (TEST_TIMEOUT_SECONDS). If the test isn't completed naturally, it will terminate, and results will reflect the data downloaded within that timeframe.
Error Handling: try/catch blocks are used to manage network errors or aborted fetches, displaying appropriate messages in the STATUS line and custom alert boxes.
UI State Management:

The startButton is disabled and its blinking cursor hidden when the test starts.
A loadingSpinner is displayed during the test.
Upon test completion (or timeout/error), the startButton is re-enabled, the cursor reappears, and the statusMessage updates, signaling that the system is ready for re-testing.
In essence, the application provides a robust download speed test wrapped in a meticulously crafted retro DOS terminal aesthetic, complete with dynamic real-time feedback and a smoothly animating graph.



<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NETWORK DIAGNOSTIC V2.4</title>
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- Using a common monospace font for terminal feel -->
    <link href="https://fonts.googleapis.com/css2?family=Roboto+Mono:wght@400;700&display=swap" rel="stylesheet">
    <!-- D3.js CDN for graphing -->
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        /* Global Terminal Theme Styles */
        body {
            font-family: 'Roboto Mono', monospace; /* Monospace font for terminal feel */
            background-color: #0d1117; /* Dark charcoal/black background */
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 1rem;
            box-sizing: border-box;
            color: #00ff00; /* Matrix green text */
            overflow: hidden; /* Prevent body scroll if content slightly overflows */
        }
        .container {
            background-color: #000000; /* Pure black for the terminal screen */
            border: 2px solid #00ff00; /* Matrix green border */
            border-radius: 0; /* Sharp corners */
            padding: 2rem;
            max-width: 42rem; /* Wider for better content flow */
            width: 100%;
            text-align: left; /* Align text like a real terminal */
            position: relative; /* For scanline effect */
            line-height: 1.5; /* Better readability */
            font-size: 1.1rem; /* Base font size for terminal text */
            overflow: hidden; /* Hide potential scrollbars inside */
        }

        /* Scanline overlay effect for the entire terminal screen */
        .container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: repeating-linear-gradient(
                #000000,
                #000000 1px,
                rgba(0, 255, 0, 0.04) 1px,
                rgba(0, 255, 0, 0.04) 2px
            );
            pointer-events: none; /* Allows clicks/interactions beneath it */
            opacity: 0.15; /* More visible scanlines */
            z-index: 1; /* Above background, below text */
        }

        /* Result lines - no more boxes */
        .result-line {
            margin-bottom: 0.5rem; /* Space between lines */
            color: #00ff00;
            padding-left: 0.5rem; /* Indent slightly like a prompt */
            display: flex; /* Use flexbox for aligned label and value */
        }
        .result-label {
            flex-shrink: 0; /* Prevent label from shrinking */
            width: 8rem; /* Fixed width for alignment */
            color: #00cc00; /* Slightly dimmer green for labels */
        }
        .result-value {
            font-weight: bold;
            color: #00ff00;
            flex-grow: 1; /* Allow value to take remaining space */
        }

        .loading-spinner {
            border: 0.25rem solid rgba(0, 255, 0, 0.3); /* Green translucent */
            border-top: 0.25rem solid #00ff00; /* Bright green */
            border-radius: 50%;
            width: 2.5rem;
            height: 2.5rem;
            animation: spin 1s linear infinite;
            display: none;
            margin: 1rem auto; /* Center spinner */
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Command-line button - styled to be inline with other text */
        #startButton {
            background: none; /* No background */
            border: none; /* No border */
            color: #00ff00; /* Green text */
            font-size: 1.1rem; /* Same font size as container/result-line */
            font-weight: bold;
            cursor: pointer;
            padding: 0; /* Remove padding */
            margin: 0; /* Remove margin */
            display: inline-block; /* Make it flow inline with text */
            text-align: left;
            user-select: none; /* Prevent text selection */
            transition: color 0.1s ease-in-out; /* Smooth color change on hover */
            position: relative; /* For pseudo-elements */
            z-index: 2; /* Above scanlines */
            white-space: nowrap; /* Prevent wrapping */
            line-height: inherit; /* Inherit line height from parent */
        }
        #startButton:hover {
            color: #00e600; /* Slightly darker green on hover */
            transform: none; /* Remove any transform */
        }
        #startButton:active {
            color: #00cc00;
        }
        #startButton:disabled {
            color: #006600; /* Dimmer green when disabled */
            cursor: not-allowed;
        }
        /* Blinking cursor for the button, only visible when NOT disabled */
        #startButton:not(:disabled)::after {
            content: '_'; /* Blinking cursor */
            animation: blink-caret 1s step-end infinite;
            margin-left: 0.2em; /* Use em for relative spacing */
        }
        /* Hide cursor when disabled */
        #startButton:disabled::after {
            content: ''; /* Hide cursor by removing content */
        }
        @keyframes blink-caret {
            from, to { visibility: hidden; }
            50% { visibility: visible; }
        }


        #statusMessage {
            color: #00ff00; /* Matrix green */
            font-size: 1.1rem; /* Same font size as container/result-line */
            padding-left: 0; /* No extra padding, handled by result-line */
        }

        /* Graph container styling */
        #speedGraph {
            margin-top: 2rem;
            background-color: #000000; /* Pure black for graph area */
            border: 1px solid #00cc00; /* Green border */
            border-radius: 0; /* Sharp corners */
            padding: 1rem;
            width: 100%;
            overflow: hidden;
            position: relative; /* For background patterns */
            z-index: 2; /* Above scanlines */
        }

        /* Optional: Add a subtle grid/pattern to the graph background */
        #speedGraph::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-image:
                linear-gradient(to right, rgba(0, 255, 0, 0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 255, 0, 0.05) 1px, transparent 1px);
            background-size: 20px 20px; /* Adjust grid size */
            pointer-events: none;
            opacity: 0.3;
            z-index: 1;
        }

        /* Style for SVG paths and axes (D3.js) */
        .line {
            fill: none;
            stroke: #00ff00; /* Bright green line */
            stroke-width: 2px;
            transition: d; /* Animate path changes */
        }
        .axis text {
            font-family: 'Roboto Mono', monospace;
            font-size: 0.75rem;
            fill: #00cc00; /* Slightly darker green for axis text */
        }
        .axis path, .axis line {
            stroke: #006600; /* Darker green for axis lines */
        }
        .axis-label {
            font-family: 'Roboto Mono', monospace;
            fill: #00ff00;
        }

        /* Mobile adjustments */
        @media (max-width: 640px) {
            .container {
                padding: 1rem;
                max-width: 100%;
                font-size: 0.9rem;
            }
            #startButton {
                font-size: 0.9rem; /* Match new container font size */
            }
            .result-line {
                padding-left: 0.2rem;
            }
            .result-label {
                width: 5rem; /* Adjust width for smaller screens */
            }
            .result-value {
                font-size: 1.4rem; /* Smaller value font */
            }
            #statusMessage {
                font-size: 0.9rem;
            }
            #speedGraph {
                padding: 0.5rem;
            }
            .axis text {
                font-size: 0.65rem;
            }
        }
    </style>
</head>
<body class="antialiased">
    <div class="container">
        <!-- Removed H1 Header -->

        <div class="result-line">
            <span class="result-label" style="width: auto;">PROMPT></span><button id="startButton">INITIATE_TEST</button>
        </div>

        <div class="result-line">
            <span class="result-label">STATUS></span><span id="statusMessage">SYSTEM_READY</span>
        </div>

        <div class="result-line">
            <span class="result-label">PING></span><span id="latencyResult">- MS</span>
        </div>

        <div class="result-line">
            <span class="result-label">DL_SPEED></span><span id="downloadResult">- MBPS</span>
        </div>

        <div id="loadingSpinner" class="loading-spinner"></div>

        <!-- Graph Container -->
        <div id="speedGraph">
            <!-- D3.js will render the SVG graph here -->
        </div>
    </div>

    <script>
        // DOM Elements
        const startButton = document.getElementById('startButton');
        const loadingSpinner = document.getElementById('loadingSpinner');
        const statusMessage = document.getElementById('statusMessage');
        const latencyResult = document.getElementById('latencyResult');
        const downloadResult = document.getElementById('downloadResult');
        const speedGraphContainer = document.getElementById('speedGraph');

        // Test parameters
        const DOWNLOAD_FILE_SIZE_BYTES = 1000 * 1024 * 1024; // 1 GB (target, may not fully download due to timeout)
        const DOWNLOAD_TEST_URL_BASE = `https://speed.cloudflare.com/__down`; // Cloudflare endpoint allows specifying exact bytes
        const NUM_PARALLEL_CONNECTIONS = 8; // Number of parallel connections for download test
        const GRAPH_SAMPLE_INTERVAL_MS = 200; // How often to collect data and update the graph (in milliseconds)
        const TEST_TIMEOUT_SECONDS = 20; // Maximum duration for the download test

        let downloadSpeedSamples = []; // Stores data points for the graph (cumulative average speed)
        let animationFrameId = null; // To manage requestAnimationFrame for UI/graph updates
        let abortController = null; // To cancel fetch requests on timeout

        // D3.js graph variables (initialized once after first setup)
        let svg, xScale, yScale, linePath, xAxisG, yAxisG;
        const margin = { top: 20, right: 30, bottom: 40, left: 60 };
        let graphWidth, graphHeight;

        // Function to show a custom message box (terminal style) instead of alert()
        function showMessageBox(message) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-black p-8 border border-green-500 rounded-none text-center max-w-sm mx-auto text-green-500 font-mono">
                    <p class="text-lg font-semibold mb-4">${message}</p>
                    <button class="bg-green-500 text-black px-6 py-2 border border-green-500 hover:bg-green-700 transition" onclick="this.parentNode.parentNode.remove()">ACKNOWLEDGE</button>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Helper to clear results and messages, and graph
        function clearResults() {
            latencyResult.textContent = '- MS';
            downloadResult.textContent = '- MBPS';
            statusMessage.textContent = 'SYSTEM_READY';
            
            // Clear graph and reset D3 elements
            d3.select("#speedGraph svg").remove();
            svg = null;
            xScale = null;
            yScale = null;
            linePath = null;
            xAxisG = null;
            yAxisG = null;

            downloadSpeedSamples = []; // Clear old samples
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }
        }

        // --- Latency Test ---
        async function runLatencyTest() {
            statusMessage.textContent = 'EXECUTING_LATENCY_TEST...';
            latencyResult.textContent = '... MS';
            const startTime = performance.now();
            try {
                // Using Cloudflare's trace endpoint for a more reliable latency test
                // Added a new AbortController just for latency test for better isolation
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 sec timeout for latency

                await fetch('https://cloudflare.com/cdn-cgi/trace', { method: 'HEAD', cache: 'no-store', signal: controller.signal });
                const endTime = performance.now();
                clearTimeout(timeoutId); // Clear timeout if fetch completes in time

                const latency = (endTime - startTime).toFixed(2);
                latencyResult.textContent = `${latency} MS`;
                return parseFloat(latency);
            } catch (error) {
                console.error("Latency test failed:", error);
                if (error.name === 'AbortError') {
                    latencyResult.textContent = 'TIMEOUT';
                    showMessageBox('LATENCY_TEST_TIMED_OUT. CHECK_NETWORK_CONNECTION.');
                } else {
                    latencyResult.textContent = 'ERROR';
                    showMessageBox('LATENCY_TEST_FAILED. CHECK_NETWORK_CONNECTION_OR_CONSOLE_LOG.');
                }
                return null;
            }
        }

        // --- Download Speed Test (with parallel connections, real-time average updates and animated graph) ---
        async function runDownloadTest() {
            statusMessage.textContent = `INITIATING_DOWNLOAD_SEQUENCE_[1GB]_[${NUM_PARALLEL_CONNECTIONS}_THREADS]...`;
            downloadResult.textContent = '0.00 MBPS (AVG)';

            totalBytesDownloaded = 0; // Reset for new test
            const overallStartTime = performance.now();

            // Variables for graph data collection
            let lastGraphUpdateTime = overallStartTime; // For throttling graph updates

            const downloadPromises = [];

            // Setup AbortController for the download test
            abortController = new AbortController();
            const signal = abortController.signal;

            // Set up the overall test timeout
            const testTimeoutId = setTimeout(() => {
                if (!signal.aborted) { // Only abort if not already aborted by successful completion
                    console.warn(`Test timed out after ${TEST_TIMEOUT_SECONDS} seconds.`);
                    abortController.abort();
                    statusMessage.textContent = `TEST_ABORTED: MAX_TIME_REACHED (${TEST_TIMEOUT_SECONDS}s).`;
                }
            }, TEST_TIMEOUT_SECONDS * 1000);

            // Function to update UI and graph (called via requestAnimationFrame)
            function updateUIAndGraph() {
                const currentTime = performance.now();
                const elapsedTimeFromStart = (currentTime - overallStartTime) / 1000; // Total elapsed time in seconds

                // Update real-time CUMULATIVE AVERAGE speed display
                if (elapsedTimeFromStart > 0) { // Avoid division by zero at the very start
                    const currentOverallAvgSpeedMbps = (totalBytesDownloaded * 8) / elapsedTimeFromStart / (1024 * 1024);
                    downloadResult.textContent = `${currentOverallAvgSpeedMbps.toFixed(2)} MBPS (AVG)`;
                } else {
                    downloadResult.textContent = '0.00 MBPS (AVG)';
                }

                // Collect data for graph (cumulative average speed) and redraw if enough time has passed
                if (currentTime - lastGraphUpdateTime >= GRAPH_SAMPLE_INTERVAL_MS) {
                    const currentOverallAvgSpeedMbps = (totalBytesDownloaded * 8) / elapsedTimeFromStart / (1024 * 1024);
                    downloadSpeedSamples.push({
                        time: elapsedTimeFromStart,
                        speed: currentOverallAvgSpeedMbps
                    });
                    
                    // Draw graph with smooth transition
                    drawSpeedGraph(downloadSpeedSamples, elapsedTimeFromStart, true); // Pass true for animation
                    lastGraphUpdateTime = currentTime;
                }

                statusMessage.textContent = `DOWNLOAD_PROGRESS: ${((totalBytesDownloaded / DOWNLOAD_FILE_SIZE_BYTES) * 100).toFixed(1)}%`;

                // Continue animation loop if test is not yet complete AND not aborted
                if (totalBytesDownloaded < DOWNLOAD_FILE_SIZE_BYTES && !signal.aborted) {
                    animationFrameId = requestAnimationFrame(updateUIAndGraph);
                } else {
                    // If test completed or aborted, ensure final graph draw and cleanup
                    if (animationFrameId) {
                        cancelAnimationFrame(animationFrameId);
                        animationFrameId = null;
                    }
                    if (!signal.aborted) { // Only clear timeout if test finished naturally
                         clearTimeout(testTimeoutId);
                    }
                }
            }

            // Start the initial graph setup
            initializeGraph();
            // Start the animation frame loop
            animationFrameId = requestAnimationFrame(updateUIAndGraph);

            // Calculate bytes per connection, ensuring even distribution
            const bytesPerConnection = Math.floor(DOWNLOAD_FILE_SIZE_BYTES / NUM_PARALLEL_CONNECTIONS);
            let remainingBytes = DOWNLOAD_FILE_SIZE_BYTES % NUM_PARALLEL_CONNECTIONS;

            for (let i = 0; i < NUM_PARALLEL_CONNECTIONS; i++) {
                const currentConnectionBytes = bytesPerConnection + (remainingBytes-- > 0 ? 1 : 0);
                // Add random parameter to URL to prevent caching across connections and ensure fresh download
                const url = `${DOWNLOAD_TEST_URL_BASE}?bytes=${currentConnectionBytes}&_t=${Date.now()}_${i}`;

                downloadPromises.push(
                    (async () => {
                        try {
                            const response = await fetch(url, { cache: 'no-store', signal: signal });
                            if (!response.ok) {
                                throw new Error(`HTTP_ERROR!_STATUS:_${response.status}_FROM_CONNECTION_${i+1}`);
                            }

                            const reader = response.body.getReader();
                            while (true) {
                                // Check if aborted before reading next chunk
                                if (signal.aborted) {
                                    reader.cancel(); // Cancel the reader if the test was aborted externally
                                    break;
                                }
                                const { done, value } = await reader.read();
                                if (done) break;

                                // Atomically update shared total bytes downloaded
                                totalBytesDownloaded += value.length;
                            }
                        } catch (error) {
                            if (error.name === 'AbortError') {
                                console.warn(`Download connection ${i+1} aborted.`);
                                // Do not re-throw AbortError as it's a controlled stop
                            } else {
                                console.error(`Download_CONNECTION_${i+1}_FAILED:`, error);
                                throw error; // Re-throw other errors
                            }
                        }
                    })()
                );
            }

            try {
                // Wait for all parallel download promises to resolve (or reject due to error/abort)
                await Promise.all(downloadPromises);

                // Ensure cleanup of timeout if Promise.all completes before timeout triggers
                clearTimeout(testTimeoutId); 
                
                // Final calculation and display
                const overallEndTime = performance.now();
                const overallDurationSeconds = (overallEndTime - overallStartTime) / 1000;
                
                // Calculate final speed based on actual elapsed time and downloaded bytes
                const finalElapsedTime = (overallEndTime - overallStartTime) / 1000;
                let finalOverallAvgSpeedMbps = 0;
                if (finalElapsedTime > 0) {
                     finalOverallAvgSpeedMbps = (totalBytesDownloaded * 8) / finalElapsedTime / (1024 * 1024);
                }

                // Add a final point for the graph representing the final overall average
                downloadSpeedSamples.push({ time: finalElapsedTime, speed: finalOverallAvgSpeedMbps });

                // Handle case where duration is effectively zero or no data (very fast connections or test issues)
                if (overallDurationSeconds === 0 || totalBytesDownloaded === 0) {
                     downloadResult.textContent = 'ERROR';
                     if (!signal.aborted) { // If not aborted by timeout, it's a real error
                        showMessageBox('DOWNLOAD_TEST_COMPLETED_TOO_QUICKLY_OR_NO_DATA_RECEIVED. RETRY_TEST.');
                     }
                     return null;
                }

                // Display final overall average speed
                downloadResult.textContent = `${finalOverallAvgSpeedMbps.toFixed(2)} MBPS (AVG_FINAL)`;
                console.log(`DOWNLOAD_TEST_SUCCESS: ${finalOverallAvgSpeedMbps.toFixed(2)} MBPS (OVERALL_AVG)`);

                // Final draw of the graph to ensure it's complete and scaled correctly (with animation)
                drawSpeedGraph(downloadSpeedSamples, overallDurationSeconds, true);
                return finalOverallAvgSpeedMbps;

            } catch (error) {
                // This catch handles errors from Promise.all, which means one or more connections failed (not just aborted)
                if (error.name !== 'AbortError') { // Don't show error box for intentional aborts
                    console.error("OVERALL_DOWNLOAD_TEST_FAILED_CATCH:", error);
                    downloadResult.textContent = 'ERROR';
                    showMessageBox('DOWNLOAD_TEST_FAILED_DUE_TO_CONNECTION_FAILURE. CHECK_CONSOLE_FOR_DETAILS.');
                }
                clearTimeout(testTimeoutId); // Ensure timeout is cleared even on other errors
                return null;
            } finally {
                // Final cleanup for animation frame and timeout, handled by updateUIAndGraph loop
                // if animationFrameId is still active, it will be cleared there.
                // If the test finished successfully, testTimeoutId would have been cleared.
            }
        }

        // --- Graph Initialization (run once at the start of a test) ---
        function initializeGraph() {
            speedGraphContainer.innerHTML = ''; // Clear existing graph SVG

            const containerWidth = speedGraphContainer.clientWidth;
            const containerHeight = 300;
            graphWidth = containerWidth - margin.left - margin.right;
            graphHeight = containerHeight - margin.top - margin.bottom;

            svg = d3.select("#speedGraph")
                .append("svg")
                .attr("width", containerWidth)
                .attr("height", containerHeight)
                .append("g")
                .attr("transform", `translate(${margin.left},${margin.top})`);

            // Initial scales (domains will be updated dynamically)
            xScale = d3.scaleLinear().range([0, graphWidth]);
            yScale = d3.scaleLinear().range([graphHeight, 0]);

            // Add X-axis group
            xAxisG = svg.append("g")
                .attr("transform", `translate(0,${graphHeight})`)
                .attr("class", "axis");

            // Add Y-axis group
            yAxisG = svg.append("g")
                .attr("class", "axis");

            // Add X-axis label
            svg.append("text")
                .attr("class", "axis-label")
                .attr("x", graphWidth / 2)
                .attr("y", graphHeight + margin.bottom - 5)
                .attr("text-anchor", "middle")
                .text("TIME (SECONDS)");

            // Add Y-axis label
            svg.append("text")
                .attr("class", "axis-label")
                .attr("transform", "rotate(-90)")
                .attr("y", -margin.left + 15)
                .attr("x", -graphHeight / 2)
                .attr("text-anchor", "middle")
                .text("SPEED (MBPS)");

            // Add the line path (initially empty)
            linePath = svg.append("path")
                .attr("class", "line");
        }

        // --- Graph Drawing/Updating Function using D3.js ---
        function drawSpeedGraph(data, currentMaxTime, animate = false) {
            if (!svg || data.length === 0) {
                // If SVG not initialized or no data, do nothing or show message
                if (data.length === 0) {
                    speedGraphContainer.innerHTML = '<p class="text-green-500">NO_DATA_TO_DISPLAY_FOR_GRAPH.</p>';
                }
                return;
            }

            // Update scales domains
            xScale.domain([0, currentMaxTime || d3.max(data, d => d.time) * 1.05]);
            yScale.domain([0, (d3.max(data, d => d.speed) || 0) * 1.2]); // 20% buffer for max speed

            // Define the line generator
            const lineGenerator = d3.line()
                .x(d => xScale(d.time))
                .y(d => yScale(d.speed));

            // Update the line path
            let pathSelection = linePath.datum(data);

            if (animate) {
                pathSelection = pathSelection.transition()
                    .duration(GRAPH_SAMPLE_INTERVAL_MS * 0.8) // Smooth transition based on sample interval
                    .ease(d3.easeLinear); // Linear ease for consistent speed
            }
            pathSelection.attr("d", lineGenerator);

            // Update axes with transitions
            let xAxisTransition = xAxisG;
            let yAxisTransition = yAxisG;
            if (animate) {
                xAxisTransition = xAxisG.transition()
                    .duration(GRAPH_SAMPLE_INTERVAL_MS * 0.8)
                    .ease(d3.easeLinear);
                yAxisTransition = yAxisG.transition()
                    .duration(GRAPH_SAMPLE_INTERVAL_MS * 0.8)
                    .ease(d3.easeLinear);
            }

            xAxisTransition.call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `${d.toFixed(0)}s`));
            yAxisTransition.call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d.toFixed(0)} MBPS`));
        }

        // --- Main Test Execution ---
        async function startSpeedTest() {
            clearResults(); // Clear previous results and messages and graph

            startButton.disabled = true; // Disable button during test
            // The ::after pseudo-element (blinking cursor) is automatically hidden by CSS when disabled

            loadingSpinner.style.display = 'block'; // Show spinner

            try {
                // Run tests sequentially for clear progress
                await runLatencyTest();
                await runDownloadTest();
            } finally {
                loadingSpinner.style.display = 'none'; // Hide spinner
                startButton.disabled = false; // Re-enable button
                statusMessage.textContent = 'TEST_COMPLETE. PRESS_INITIATE_TO_RETEST.';
            }
        }

        // Event listener for the start button
        startButton.addEventListener('click', startSpeedTest);

        // Responsive graph resizing
        window.addEventListener('resize', () => {
            // Only redraw graph if data exists (test has run at least once)
            // and if it's not currently in the middle of a test (startButton.disabled is false)
            if (downloadSpeedSamples.length > 0 && !startButton.disabled) {
                // Recalculate dimensions
                const containerWidth = speedGraphContainer.clientWidth;
                graphWidth = containerWidth - margin.left - margin.right;
                
                // Update SVG and g dimensions
                d3.select("#speedGraph svg")
                    .attr("width", containerWidth);
                if (svg) { // Ensure svg is initialized
                    svg.attr("transform", `translate(${margin.left},${margin.top})`);
                }

                // Update scales with new range
                xScale.range([0, graphWidth]);
                yScale.range([graphHeight, 0]); // Height remains fixed for now

                // Redraw with current data and updated scales, no animation for resize
                const lastDataPointTime = downloadSpeedSamples.length > 0 ? downloadSpeedSamples[downloadSpeedSamples.length - 1].time : 0;
                drawSpeedGraph(downloadSpeedSamples, lastDataPointTime, false);

                // Update axis labels positions
                if (svg) { // Ensure svg is initialized
                    svg.select(".axis-label[text='TIME (SECONDS)']")
                        .attr("x", graphWidth / 2);
                    svg.select(".axis-label[text='SPEED (MBPS)']")
                        .attr("y", -margin.left + 15) // Re-adjust if margin changes
                        .attr("x", -graphHeight / 2);
                }
            }
        });

        // Initial status message on load
        clearResults();
    </script>
</body>
</html>
