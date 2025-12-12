# Data Visualization - Log Viewer

A web-based visualization tool for flight log data.

## Features
- **Replay**: Playback flight telemetry (Altitude, Speed, Heading, etc.)
- **Interactive Map**: 2D path visualization using Leaflet.js
- **Compare Mode**: Compare two flight paths simultaneously.
- **Speed Control**: Variable playback speeds (0.2x to 10x).

## Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/metehanyurdunusvn/DataVisualization.git
    cd DataVisualization
    ```

## Usage

1.  **Start the Backend:**
    ```bash
    python log_viewer.py
    ```
2.  **View in Browser:**
    Open `http://localhost:9999`

## Structure
- `log_viewer.py`: Python-based HTTP server and API.
- `public/`: Frontend assets (HTML, CSS, JS).
