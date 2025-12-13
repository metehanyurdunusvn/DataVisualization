class Settings {
    constructor() {
        this.defaults = {
            primaryPlaneColor: '#ff0000', // Red
            secondaryPlaneColor: '#faa200', // Orange/Gold
            primaryPathColor: '#00f2ff', // Cyan (Default)
            secondaryPathColor: '#00ff00', // Green (Default)
            boundaryColor: '#ff0000', // Red
            boundaryFillColor: '#3700ff', // Blue-ish
            boundaryFillOpacity: 0.2
        };
        this.settings = this.loadSettings();
    }

    loadSettings() {
        const stored = localStorage.getItem('logViewerSettings');
        return stored ? { ...this.defaults, ...JSON.parse(stored) } : { ...this.defaults };
    }

    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('logViewerSettings', JSON.stringify(this.settings));
        this.applySettings();
    }

    get(key) {
        return this.settings[key];
    }

    // Event listener for updates (simple callback system)
    onUpdate(callback) {
        this.updateCallback = callback;
    }

    applySettings() {
        if (this.updateCallback) {
            this.updateCallback(this.settings);
        }
    }
}

const appSettings = new Settings();
