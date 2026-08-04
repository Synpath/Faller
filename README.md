# Faller
A computer graphics project created using Three.js as a final project for CSCI 4810: Computer Graphics

---
### Project Description:
This project renders a scene of a whale fall on the seafloor in three different and 
distinct visual styles.   
1. Iron Lung
2. Shallow Water
3. Abyssal   

The first style is inspired from x-ray photographs created for the movie, "Iron Lung". The second
is meant to replicate the lighting effects present on objects located in shallow water close to the sun.
The third replicates the lighting of a deep sea environment where whale falls are typically located.   

This project allowed me to learn and explore various graphics-related techniques, including but not limited to:  
- **Post Processing Shaders:** CRT Scanlines, Film Grain, Vignette, Dithering, Greyscale, Contrast
- **Procedural Generation:** Voronoi Cellular Noise, L-Systems
- Shell Texturing for fur
- Point Lighting
---

### Resources and References:
- [CRT Scanline Shader](https://babylonjs.medium.com/retro-crt-shader-a-post-processing-effect-study-1cb3f783afbc)
- [Film Grain Shader](https://godotshaders.com/shader/film-grain-shader/)
- [Voronoi Cellular Noise](https://thebookofshaders.com/12/)
- [Making Water Caustics with Procedural Noise](https://www.youtube.com/watch?v=gHpbeOozn9k&t=28s)
- [L-Systems](https://blog.rabidgremlin.com/2014/12/09/procedural-content-generation-l-systems/?ref=codeandwhimsy.com)
- [Point Lighting](https://learnopengl.com/Lighting/Light-casters)
- [Shell Texturing](https://learnopengl.com/Lighting/Light-casters)
- [Whale Skeleton Model](https://sketchfab.com/3d-models/low-poly-whale-bones-3f7eb8f492fd4be19796a18c27113653)
---
### Future Work:
Currently, development of this project is on-hold as I work on deepening my understanding of the 
computer graphics field, however, I do have features I would like to implement when I decide to come back to this.
- Creating true water caustics rather than mimicking them with procedural noise
- Fixing a rendering issue with the shell textured fur balls
- Adding noise to the mesh of the floor in order to mimic the random patterns in the sand on the ocean floor
- Creating a shader that replicates the way light reflects and shines through foggy or cloudy water