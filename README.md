# Seismic Activity Simulation (1965–2016)
Interactive 3D visualization of global seismic activity using Three.js. Made for a class project.


https://github.com/user-attachments/assets/9f11f363-18ed-4eff-99f1-352a63663148


## Description
This project transforms a real-world seismic dataset into a dynamic, animated 3D globe. Recorded seismic events above magnitude 5.5 are represented as expanding rings at their geographic locations, while a cumulative heatmap evolves over time to highlight regions of intense tectonic activity.
Built in CodeSandbox, it demonstrates how geophysical data can be visualized using both geometry instancing and custom GLSL shaders in a browser-based environment.

## Dataset
[Source: Kaggle - Global Seismic Activity (1965–2016)](https://www.kaggle.com/datasets/usgs/earthquake-database)

## Code Structure and Functionality

### Disclaimer
Handling a dataset of over 20,000 seismic records created a real performance challenge. Rendering each event as a separate 3D object would have been far too heavy for the browser. After exploring tutorials and the Three.js documentation, I found a better approach using THREE.InstancedMesh.

This method allows the GPU to draw thousands of identical meshes in a single call, while giving each its own position and scale. In this project, it meant every seismic event could appear as an animated ring without creating thousands of individual objects. Although using instancing was a bit more advanced than typical class work, it was essential for keeping the simulation smooth and efficient with such a large dataset.

### Initialization

- init()
  - Sets up the entire 3D environment: scene, camera, renderer, lighting, textures, and controls.
  - Initializes UI elements, event listeners, and the instanced ring mesh for visualization.
  - Calls initHeatmap() to setup the custom shader material and virtual data canvas.

- initHeatmap()
  - Creates a secondary sphere overlay for the heatmap.
  - Initializes the custom Fragment and Vertex shaders used to visualize the data accumulation.

- onWindowResize()
  - Keeps the aspect ratio and renderer resolution consistent with browser resizing.

### Data and Simulation

- parseCSV(content)
  - Reads the raw CSV data and converts it into structured JavaScript objects.
  - Handles date parsing and ensures valid numeric conversion for coordinates and magnitudes.

- resetSimulationData()
  - Resets the simulation so that the time loop can restart from the beginning.
  - Clears the heatmap canvas on reset.

- setupSimulation()
  - Sorts data by time, determines start/end timestamps, and configures the timeline slider UI.

- simulate()
  - The main logic loop for advancing simulated time, triggering new seismic events, and updating active ring animations.

### Visualization and Interaction

- coordToVector3(lat, lon, radius)
  - Converts geographic coordinates into a 3D position on the sphere’s surface.
  - Used to correctly position each event on the globe.

- triggerEarthquake(lat, lon, mag)
  - Rings: Adds a new ring effect to the list of active visual elements using InstancedMesh.
  - Heatmap: Draws a low-opacity point onto the virtual 2D canvas at the event's UV coordinates. This data is passed to the shader to update the global heat map.

- updateRings()
  - Scaling rings based on time elapsed and event magnitude.
  - Updating the instanced mesh transformation matrices.
  - Removing old rings after their animation finishes.

- updateTimeDisplay()
  - Updates the on-screen clock and keeps the timeline slider in sync with the current simulated date/time.

- changeSpeed()
  - Cycles through preset simulation speed levels (1× -> 4× -> 16× -> 64×).

- onSliderInput()
  - Lets users jump to a specific point in time using the slider, immediately updating the globe and clearing active rings.

### Rendering

- animate()
  - Slowly rotates the Earth for a natural look (syncing the heatmap overlay rotation).
  - Advances the simulation and ring animations.
  - Renders the full scene each frame.
 
## Shader Implementation

### Description
While InstancedMesh solved the problem of showing current events, I also wanted to visualize the history of seismic activity to show tectonic plate boundaries. Creating thousands of permanent sphere objects for past earthquakes would have crashed the browser.
To solve this, I decided to use a Fragment Shader. Instead of creating geometry, I could "paint" data onto a texture. This allows for an infinite number of data points to be visualized with zero additional geometry cost, as the GPU only calculates color values for the single sphere overlay.

### Development Process

#### The Heatmap Texture
To track the history of earthquakes, I needed a way to store the data. I used a hidden 2D Canvas in the JavaScript code. Every time an earthquake happens in the simulation, I draw a faint white circle on this canvas. As more earthquakes happen in the same spot, the circle gets brighter. This canvas is essentially a dynamic texture that I pass to the shader.

#### Coloring
Since the canvas is just black and white, I used the Fragment Shader to add color. I followed the class notes on "Dibujando con algoritmos" and used the mix() function. I set it up so that dark areas on the texture become purple, and as they get brighter, they shift to red and then yellow. This makes it easy to see where the most activity is.

#### Fixing the Shape
When I first tested it, the circles looked like stretched ovals near the North and South poles because of how textures wrap around a sphere. To fix this, I added a simple calculation to stretch the circles horizontally based on their latitude. This cancels out the distortion so they look round on the globe.

### Sources
- [Class Notes](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S9/README.md): Drawing with algorithms.
- [The Book of Shaders](https://thebookofshaders.com/): Chapter on Shaping Functions and Colors.
- [Three.js Documentation](https://threejs.org/docs/): Everything :).

## CodeSandbox Environment
https://codesandbox.io/p/sandbox/seismic-activity-5v8t9q
