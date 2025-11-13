# Seismic Activity Simulation (1965–2016)
Interactive 3D visualization of global seismic activity using Three.js. Made for a class project.

## Video
https://github.com/user-attachments/assets/086f3ebc-a684-41bd-b035-7819e4b240b3
## Description
This project transforms a real-world seismic dataset into a dynamic, animated 3D globe where recorded seismic events above magnitude 5.5 are represented as expanding rings at their geographic locations.
Built on CodeSandbox, it demonstrates how geophysical data can be visualized over time in an interactive, browser-based environment.

## Dataset
[Source: Kaggle — Global Seismic Activity (1965–2016)](https://www.kaggle.com/datasets/usgs/earthquake-database)

## Code Structure and Functionality

### Disclaimer
Handling a dataset of over 20,000 seismic records created a real performance challenge. Rendering each event as a separate 3D object would have been far too heavy for the browser. After exploring tutorials and the Three.js documentation, I found a better approach using THREE.InstancedMesh.

This method allows the GPU to draw thousands of identical meshes in a single call, while giving each its own position and scale. In this project, it meant every seismic event could appear as an animated ring without creating thousands of individual objects. Although using instancing was a bit more advanced than typical class work, it was essential for keeping the simulation smooth and efficient with such a large dataset.

### Initialization

- init()
  - Sets up the entire 3D environment: scene, camera, renderer, lighting, textures, and controls.
  - Initializes UI elements, event listeners, and the instanced ring mesh for visualization.

- onWindowResize()
  - Keeps the aspect ratio and renderer resolution consistent with browser resizing.

### Data and Simulation

- parseCSV(content)
  - Reads the raw CSV data and converts it into structured JavaScript objects.
  - Handles date parsing and ensures valid numeric conversion for coordinates and magnitudes.

- resetSimulationData()
  - Resets the simulation so that the time loop can restart from the beginning.

- setupSimulation()
  - Sorts data by time, determines start/end timestamps, and configures the timeline slider UI.

- simulate()
  - The main logic loop for advancing simulated time, triggering new seismic events, and updating active ring animations.

### Visualization and Interaction

- coordToVector3(lat, lon, radius)
  - Converts geographic coordinates into a 3D position on the sphere’s surface.
  - Used to correctly position each event on the globe.

- triggerEarthquake(lat, lon, mag)
  - Adds a new ring effect to the list of active visual elements.
  - Each ring carries position, magnitude, and start time information.

- updateRings()
  - Scaling rings based on time elapsed and event magnitude.
  - Updating the instanced mesh transformation matrices.
  - Removing old rings after their animation finishes.

- updateTimeDisplay()
  - Updates the on-screen clock and keeps the timeline slider in sync with the current simulated date/time.

- changeSpeed()
  - Cycles through preset simulation speed levels (1× → 4× → 16× → 64×).

- onSliderInput()
  - Lets users jump to a specific point in time using the slider, immediately updating the globe and clearing active rings.

### Rendering

- animate()
  - Slowly rotates the Earth for a natural look.
  - Advances the simulation and ring animations.
  - Renders the full scene each frame.

## CodeSandbox Environment
https://codesandbox.io/p/sandbox/seismic-activity-5v8t9q
