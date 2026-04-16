import * as THREE from 'three';

// whaleVertex: projects model into screenspace
// whaleFrag: basic lighting on whale + dithering/contrast for iron lung mode
// bufferVertex: get uv coords of the texture in the buffer we rendered to in the first pass
// basicBufferFrag: only to keep 2-pass pipeline consistent with all modes, displays the base scene as if rendered using 1 pass
// ironFrag: post-processing effects for iron lung mode, treats the first render pass as a flat image and shades it accordingly

const whaleVertex = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    void main() {
    
        vNormal = normalize(normalMatrix * normal);
        
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0); 
        vViewPosition = viewPos.xyz;
        vec4 projection = projectionMatrix * viewPos;
        
        gl_Position = projection; 
    } //main
`;

const whaleFrag = `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    
    uniform vec3 lightPos;
    uniform vec2 u_Resolution;
    uniform int mode;  //0: basic lighting, 1: iron lung, 2: shallows, 3: abyssal
    
    const vec3 weight = vec3(0.2125, 0.7154, 0.0721);
    
    vec3 lightColor = vec3(1.0, 1.0, 1.0);
    // vec3 lightColor = vec3(0.41, 0.63, 0.33);
    vec3 ambientColor = vec3(0.019, 0.23, 0.22);
    
    const float PI = 3.14159265359;
    float ambientStrength = 0.35;
    float diffuseStrength = 0.4;
    float specularStrength = 0.5;
    float shininess = 32.0;
    float contrast = 0.86; //0.9 i like this one
    
    float noise(vec2 uv) {
        return (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 2.0 * 3.2;
    }
    
    void main() {
    
        vec2 uv = gl_FragCoord.xy / u_Resolution; // normalize uv coords
        
        vec3 normal = normalize(vNormal);
        vec3 lightDir;
        vec3 viewDir;
        
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;
        
        // LIGHTING: DIFFUSE + AMBIENT
        ambient = ambientColor * ambientStrength;
        
        lightDir = normalize(lightPos - vViewPosition);
        diffuse = max(dot(normal, lightDir), 0.0) * diffuseStrength * lightColor;
        
        vec3 result = (ambient + diffuse) * lightColor;
        
        if (mode == 1) { // ONLY APPLY DITHERING AND CONTRAST FOR IRON LUNG MODE
            // CONTRAST FILTER
            float luminance = dot(result, weight);

            if (luminance < 0.0) {
                result = result * (1.0 + luminance);
            } else {
                result = result + ((vec3(1.0) - result) * luminance);
            }

            result = (result - vec3(0.5)) * (tan((contrast + 1.0) * (PI / 4.0))) + vec3(0.5); // from "image editing" on wikipedia 
        
            luminance = dot(result, weight); // recompute luminance bc result changed
        
            // DITHERING
            luminance += noise(uv) * 2.2;
            result += vec3(luminance) * 0.3;
        }
        
        gl_FragColor = vec4(result, 1.0);
    }
`;

const bufferVertex = `
    varying vec2 vUv;
    
    void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
    }
`;

const basicBufferFrag = `
    uniform sampler2D t_Diffuse;
    
    varying vec2 vUv;
    
    void main() {
        vec3 color = texture2D(t_Diffuse, vUv).rgb;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

const ironFrag = `
    uniform sampler2D t_Diffuse;
    uniform float u_Time;
    uniform vec2 u_Resolution;
    
    varying vec2 vUv;
    
    const vec3 weight = vec3(0.2125, 0.7154, 0.0721);
    const float PI = 3.14159265359;

    float grainStrength = 0.3;
    float vignetteRoundness = 5.5;
    
    float noise(vec2 uv) {
        return (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 2.0;
    }
   
    float grain(vec2 uv) {
        float n = noise(uv + u_Time * 0.05);
        n += noise(uv * 2.0) * 0.8;
        n += noise(uv * 4.0) * 0.25;
        return n / 1.75;
    }
    
    vec3 scanLineIntensity(float uv, float resolution, float opacity)
    {
        // float intensity = sin(uv * resolution * PI * 2.0); // 2.0 is the wavelength
        float intensity = sin(uv * resolution * PI * 0.17);

        intensity = ((0.5 * intensity) + 0.5) * 0.9 + 0.1;
        return vec3(vec2(pow(intensity, opacity)), 1.0);
    }
    
    vec3 vignetteIntensity(vec2 uv, vec2 resolution, float opacity, float roundness) {
        float intensity = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        return vec3(vec2(clamp(pow((resolution.x / roundness) * intensity, opacity), 0.0, 1.0)), 1.0);
    }
   
    void main() {
        vec3 color = texture2D(t_Diffuse, vUv).rgb;
        vec2 uv = gl_FragCoord.xy / u_Resolution; // normalize uv coords
        float luminance = 0.0;
        
        // CRT SCANLINE EFFECT + VIGNETTE
        color *= vignetteIntensity(vUv, u_Resolution, 0.4, vignetteRoundness);
        color *= scanLineIntensity(vUv.x, u_Resolution.x, 0.2); //0.1 is opacity
        
        // FILM GRAIN
        float g = grain(uv) - 0.5;
        luminance = dot(color, weight);
        luminance += g * grainStrength;

        color = vec3(luminance);
        
        // TINTING
        color.z *= 3.5;
        color.y *= 1.3;
        color *= 1.5;
        
        gl_FragColor = vec4(color, 1.0);
    }
`;

// SHADER FOR BASIC LIGHTING ON THE WHALE SKELETON + DITHERING/CONTRAST FOR IRON LUNG MODE
const whaleShader = new THREE.ShaderMaterial({
    uniforms: {
        u_lightPos: {value: new THREE.Vector3(50, 5, 10)},
        u_Resolution: { value: new THREE.Vector2() },
        mode: { value: 0},
    },
    vertexShader: whaleVertex,
    fragmentShader: whaleFrag,
});

// SHADER FOR POST-PROCESSING EFFECTS FOR IRON LUNG MODE
const ironShader = new THREE.ShaderMaterial({
    uniforms: {
      t_Diffuse: { value: null },
      u_Time: { value: 0 },
      u_Resolution: { value: new THREE.Vector2() },
    },
    vertexShader: bufferVertex,
    fragmentShader: ironFrag
});

// BASIC SHADER SO MODES WITHOUT POST-PROCESSING CAN BE RENDERED USING 2 RENDER PASSES
const basicBufferShader = new THREE.ShaderMaterial({
   uniforms: {
       t_Diffuse: { value: null},
   },
    vertexShader: bufferVertex,
    fragmentShader: basicBufferFrag
});

export {whaleShader, ironShader, basicBufferShader}