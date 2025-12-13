# Flight Log Visualization (Celebi Log Viewer)

A comprehensive web-based tool for visualizing drone and aircraft telemetry data in both 2D (Leaflet) and 3D (CesiumJS) environments.

## Features

- **Dual Visualization Modes**:
  - **2D Map**: Satellite view using Google Hybrid imagery with path tracking and real-time telemetry HUD.
  - **3D Viewer**: Realistic 3D replay using CesiumJS with modeled aircraft orientation and terrain context.

- **Playback Controls**:
  - continuous timeline scrubbing.
  - Variable playback speed (0.1x to 10x).
  - Play/Pause toggle.

- **Multi-Plane Comparison**:
  - Compare two flight paths simultaneously.
  - Synchronized playback for analyzing relative positions and maneuvers.
  - Distance metrics between aircraft.

- **Customization**:
  - Configurable UI settings (plane colors, path colors, boundary styles).
  - Settings persisted via local storage.

- **Data Handling**:
  - Python-based backend to parse and serve JSON telemetry logs.
  - Support for custom flight boundaries and target markers.

## Installation

1. Clone or download the repository.
2. Ensure you have the data file `cleaned_data.json` in the root directory.

## Usage

1. **Start the local server**:
   ```bash
   python log_viewer.py
   ```

2. **Access the application**:
   Open a browser and navigate to `http://localhost:9999`.

3. **Navigation**:
   - Use the **Sidebar** to select a plane ID.
   - Toggle **2D/3D** modes using the button in the sidebar.
   - Open **Settings** to customize colors and visuals.
   - Use the **Compare Mode** button to select a second plane for comparison.

## Project Structure

- `log_viewer.py`: Data processing and HTTP server.
- `public/`: Frontend assets.
  - `app.js`: 2D Map logic.
  - `app3d.js`: 3D Viewer logic.
  - `style.css`: Application styling.
  - `index.html`: 2D View entry point.
  - `viewer3d.html`: 3D View entry point.

## Dependencies

- [Leaflet](https://leafletjs.com/)
- [CesiumJS](https://cesium.com/platform/cesiumjs/)
- [Phosphor Icons](https://phosphoricons.com/)

## License

This project is licensed under the MIT License.
