import * as THREE from 'three';

// basicVertex: shared vertex shader
// whaleFrag: point lighting and contrast on whale + dithering for iron lung mode
// bufferVertex: get uv coords of the texture in the buffer we rendered to in the first pass
// basicBufferFrag: displays the base scene as if rendered using 1 pass AKA no post-processing
// ironFrag: post-processing effects for iron lung mode, treats the first render pass as a flat image and shades it accordingly
// abyssalFrag: point lighting on the floor
// causticsFrag: procedural caustics shader using Voronoi cellular noise
// furVertex: special vertex shader that creates shells for shell texturing fur
// furFrag: applies lighting to the "fur" in accordance with the layered structure

// ---------------------------------------------------
// SHARED CODE BETWEEN SHADERS
const lightStruct = `
    struct Light {
        vec3 position; // light position
        vec3 lightDir;
        vec3 viewDir;
    
        vec3 ambient;
        vec3 diffuse;
        vec3 specular;

        float constant;
        float linear;
        float quadratic;        
    };
    
    vec3 point(float scale) {
        Light light = Light(vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), vec3(0.0), 1.0, 0.0014, 0.0002);
        light.position = u_lightPos;
        light.lightDir = normalize(light.position - vViewPosition.xyz);
        light.viewDir = normalize(-vViewPosition.xyz);
        
        vec3 normal = normalize(vNormal);
        vec3 halfDir = normalize(light.position + light.viewDir);
        
        float distance = length(light.position - vViewPosition.xyz);
        distance *= scale;
        
        float attenuation = 1.0 / (light.constant + light.linear * distance + light.quadratic * (distance * distance));
        
        light.ambient = ambientColor * ambientStrength;
        light.diffuse = max(dot(normal, light.lightDir), 0.0) * diffuseStrength * lightColor;
        light.specular = pow(max(dot(normal, halfDir), 0.0), shininess) * specularStrength * lightColor;
        
        light.ambient *= attenuation;
        light.diffuse *= attenuation;
        light.specular *= attenuation;
        
        return light.ambient + light.diffuse + light.specular;
    }
    
`;

const miscConst = `
    const vec3 weight = vec3(0.2125, 0.7154, 0.0721);
    const float PI = 3.14159265359;
`;

const lightParams = `
    float ambientStrength = 0.35;
    float diffuseStrength = 0.7;
    float specularStrength = 0.5;
    float shininess = 32.0;
    float contrast = 0.86; // or 0.9
`;
// USED IN: whaleFrag, ironFrag, abyssalFrag, furFrag
// ----------------------------------------------------

const basicVertex = `
    varying vec3 vNormal;
    varying vec4 vViewPosition;
    varying vec4 vWorldPosition;
    
    void main() {
        vNormal = normalize(normalMatrix * normal);
        vWorldPosition = modelMatrix * vec4(position, 1.0);
        vViewPosition = modelViewMatrix * vec4(position, 1.0);
        
        vec4 projection = projectionMatrix * vViewPosition;
        
        gl_Position = projection;
    }
`;

const whaleFrag = `
    varying vec3 vNormal;
    varying vec4 vViewPosition;
    
    uniform vec3 u_lightPos;
    uniform vec2 u_Resolution;
    uniform int mode;  //0: basic lighting, 1: iron lung, 2: shallows, 3: abyssal
    
    ${miscConst}
    ${lightParams}
    
    vec3 lightColor = vec3(1.0, 1.0, 1.0);
    vec3 ambientColor = vec3(0.019, 0.23, 0.22);
    ${lightStruct}
    
    float noise(vec2 uv) {
        return (fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 2.0 * 3.2;
    }
    
    void main() {
    
        vec2 uv = gl_FragCoord.xy / u_Resolution; // normalize uv coords
        vec3 viewDir;
        
        float scale = mode == 3 ? 0.8 : 1.0;     
        vec3 result = point(scale);
        
        // CONTRAST FILTER
        float luminance = dot(result, weight); 
        
        if (mode == 1) { // ONLY APPLY DITHERING AND CONTRAST FOR IRON LUNG MODE
            // CONTRAST FILTER
            if (luminance < 0.0) {
                result = result * (1.0 + luminance);
             } else {
                result = result + ((vec3(1.0) - result) * luminance);
             }        
            result = (result - vec3(0.5)) * (tan((contrast + 1.0) * (PI / 4.0))) + vec3(0.5); // from "image editing" on wikipedia
            luminance = dot(result, weight); // recompute luminance bc result changed
        
            // DITHERING
            luminance += noise(uv) * 2.2;
        } else if (mode == 3) {
              vec3 contrast;

              if (luminance < 0.0) {
                 contrast = result * (1.0 + luminance);
              } else {
                contrast = result + ((vec3(1.0) - result) * luminance);
              }

            contrast = (contrast - vec3(0.5)) * (tan((contrast + 1.0) * (PI / 4.0))) + vec3(0.5); // from "image editing" on wikipedia 
            luminance = dot(contrast, weight);
        }
        result += vec3(luminance) * 0.3;
        
        gl_FragColor = vec4(result * lightColor, 1.0);
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
    
    ${miscConst}

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
        // float intensity = sin(uv * resolution * PI * 2.5); // 2.0 is the wavelength
        float intensity = sin(uv * resolution * PI * 0.1);

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
        
        // FILM GRAIN
        float g = grain(uv) - 0.5;
        luminance = dot(color, weight);
        luminance += g * grainStrength;

        color = vec3(luminance);

        // CRT SCANLINE EFFECT + VIGNETTE
        color *= vignetteIntensity(vUv, u_Resolution, 0.6, vignetteRoundness);                
        color /= scanLineIntensity(vUv.x, u_Resolution.x, 0.4); //0.2 is opacity
        
        // TINTING
        color.z *= 3.5;
        color.y *= 1.3;
        color *= 1.5; //1.5?
        gl_FragColor = vec4(color, 1.0);
    }
`;

const abyssalFrag = `
    varying vec3 vNormal;
    varying vec4 vViewPosition;
    
    uniform vec3 u_lightPos;
    uniform vec3 u_color;
    
    ${miscConst}
    ${lightParams}
    
    vec3 lightColor;
    vec3 ambientColor;
    ${lightStruct}
    
    // LIGHT
    void main() {
        
        diffuseStrength = 0.5;
        lightColor = vec3(1.0, 1.0, 1.0);
        ambientColor = u_color;
        
        vec3 result = point(1.0);
        
        gl_FragColor = vec4(result, 1.0); 
    }
`;

const causticsFrag = `
    uniform vec2 u_Resolution;
    uniform float u_Time;
    uniform vec3 u_ObjectColor;
    varying vec4 vWorldPosition;

    vec2 random2(vec2 p) {
        return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453);
    }
    
    float voronoiCaustic(vec2 st) {
        
        st += 0.15 * vec2(sin(st.y * 0.8 + u_Time * 0.04), cos(st.x * 3.0 + u_Time * 0.8));
        st *= 8.0;
        vec2 i_st = floor(st);
        vec2 f_st = fract(st);
        float m_dist = 1.0; //minimum distance from the chosen point
        float m_dist2 = 0.7;
        
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 neighbor = vec2(float(x), float(y));
                vec2 point = random2(i_st + neighbor);
                
                point = 0.5 + 0.5 * sin(u_Time + 6.2831 * point);
                vec2 diff = neighbor + point - f_st; // vector between the pixel and the point
                float dist = length(diff);  // distance to the point
                
                if (dist < m_dist) {
                    m_dist2 = m_dist;
                    m_dist = dist;
                } else if (dist < m_dist2) {
                    m_dist2 = dist;
                }                
            }
        }
        float edge = m_dist2 - m_dist;
        float caustic = 1.0 - smoothstep(0.0, 0.08, edge);
        caustic = pow(caustic, 2.0);
        
        return caustic;
    }
    
    void main() {
        
        vec2 st = vWorldPosition.xz / u_Resolution.xy;
        vec3 color = u_ObjectColor;
        
        vec2 aberration = 0.01 * vec2(
            sin(u_Time * 0.5),
            cos(u_Time * 0.2)
        );
        aberration.x = clamp(0.002, 0.015, aberration.x);
        aberration.y = clamp(0.002, 0.015, aberration.y);
        
        float c1 = voronoiCaustic(st - aberration);
        
        vec2 st2 = st;
        float c2 = voronoiCaustic(st2);
        
        vec2 st3 = st + aberration;
        float c3 = voronoiCaustic(st3);
               
        vec3 finalCaustic = vec3(c1, c2, c3);
        vec3 waterTint = vec3(0.0, 0.4, 0.7);
        
        color += finalCaustic * (waterTint * 1.2);
       
        gl_FragColor = vec4(color, 1.0);
    }
`;

const furVertex = `
    uniform float u_shellIndex;
    uniform float u_shellCount;
    varying float normShellHeight;
    varying vec2 vUV;
    varying vec3 vNormal;
    varying vec4 vViewPosition;
    
    void main() {
    
        vNormal = normalize(normalMatrix * normal);
        vec4 pos = vec4(position, 1.0);
         
        normShellHeight = u_shellIndex / u_shellCount;
        float height = pow(normShellHeight, 1.0);

        pos.xyz += vNormal * 1.5 * height;
        
        vec4 worldPos = modelMatrix * pos; 
        vViewPosition = modelViewMatrix * pos;       
        vec4 projection = projectionMatrix * viewMatrix * worldPos;
        
        vUV = uv;
        gl_Position = projection;
    }
`;

const furFrag = `
    varying vec2 vUV;
    varying float normShellHeight;
    varying vec3 vNormal;
    varying vec4 vViewPosition;
    
    uniform float u_shellIndex;
    uniform vec3 u_lightPos;
    uniform vec3 u_color;
    ivec2 tid;
    
    ${lightParams}
    vec3 ambientColor = vec3(1.0, 1.0, 1.0);
    vec3 lightColor = vec3(1.0, 1.0, 1.0);
    ${lightStruct}
    
    float hash(int n) {
        // integer hash copied from Hugo Elias
        n = (n << 13) ^ n;
        n = n * (n * n * int(15731u + 0x789221u)) + int(0x131258u);
        return float(n & int(0x7fffffu)) / float(0x7fffff);
    }
    
    void main() {
        vec3 color = u_color;
    
        vec2 newUV = vUV * 201.0;
        vec2 localUV = fract(newUV) * 2.0 - 1.0;
        float localDistFromCenter = length(localUV);
        
        tid.x = int(newUV.x);
        tid.y = int(newUV.y);
        int seed = tid.x + 100 * tid.y * 100 * 10;
        float rand = mix(0.0, 2.0, hash(seed));
        float outsideThickness = 0.0;
        
        if (localDistFromCenter > (1.0 * (rand - normShellHeight))) {
            outsideThickness = 1.0;
        }

        if (outsideThickness > 0.0 && u_shellIndex > 0.0) {
            discard;
        }
        
        //lighting
        diffuseStrength = 1.2;
        vec3 point = point(0.7);
        float ambientOcclusion = pow(normShellHeight, 4.0);
        ambientOcclusion += 0.2;
        ambientOcclusion = clamp(0.0, 1.0, ambientOcclusion);
        
        color *= point * ambientOcclusion;
        gl_FragColor = vec4(color, 1.0);
    }
`;

// ---------------------------------------------------------------------------------------
// SHADER FOR BASIC LIGHTING ON THE WHALE SKELETON + DITHERING/CONTRAST FOR IRON LUNG MODE
const whaleShader = new THREE.ShaderMaterial({
    uniforms: {
        u_lightPos: {value: new THREE.Vector3(50, 5, 10)},
        u_Resolution: { value: new THREE.Vector2() },
        mode: { value: 0},
    },
    vertexShader: basicVertex,
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

const causticsShader = new THREE.ShaderMaterial({
    uniforms: {
        u_Resolution: { value: null },
        u_Time: { value: 0 },
        u_ObjectColor: { value: null },
    },
    vertexShader: basicVertex,
    fragmentShader: causticsFrag
})

const furShader = new THREE.ShaderMaterial({
    uniforms: {
        u_shellIndex: { value: 0.0 },
        u_shellCount: { value: 0.0},
        u_lightPos: {value: null},
        u_color: {value: null}
    },
    vertexShader: furVertex,
    fragmentShader: furFrag,
    side: THREE.DoubleSide,
    transparent: true,
})

const abyssalFloor = new THREE.ShaderMaterial({
    uniforms: {
        u_lightPos: {value: null},
        u_color: {value: null}
    },
    vertexShader: basicVertex,
    fragmentShader: abyssalFrag,
});

export {whaleShader, ironShader, basicBufferShader, causticsShader}
export {furShader, abyssalFloor}