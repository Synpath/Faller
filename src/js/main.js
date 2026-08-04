import * as THREE from 'three'
import GUI from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {whaleShader, ironShader, basicBufferShader, causticsShader} from './shaders.js';
import {furShader, abyssalFloor, rockShader} from './shaders.js';
import {LSystem} from './L-system.js';

// --------------------------------------------------------------
// GLOBAL SCENE VARIABLEs
// --------------------------------------------------------------
let scene, camera, controls, renderer;
let postScene, renderTarget, postCam, postBuffGeom;
let sunWorldPos, floor, floorGeom;
let loader, root;
let gui;
const clock = new THREE.Clock();

let quads = {};
let plants = [];
let worms = [];

const globalUniforms = {
    u_Time: {value: 0},
    u_Resolution: {value: null},
    u_lightPos: {value: new THREE.Vector3()},
    mode: {value: 0},
};
const MODES = {
    LUNG: 'Iron Lung',
    SHALLOWS: 'Shallow Water',
    ABYSSAL: 'Abyssal Zone',
};
let currentMode = MODES.LUNG;
// ------------------------------------------------------------

function initScene() {
    // SCENE -----------
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // CAMERA for main scene--------------
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        2000
    );
    camera.position.set(100, 30, 0);

    // RENDERER (main scene) --------------------
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // 2-PASS PIPELINE ------------------------
    postScene = new THREE.Scene();
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
    postBuffGeom = new THREE.PlaneGeometry(2, 2, 10, 10);

    // Orbit Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // Axes Helper (keep for now, X and Z are oriented weirdly with the whale skeleton so helpful to keep around)
    // const axesHelper = new THREE.AxesHelper(30);
    // scene.add(axesHelper);

    // Handle Resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderTarget.setSize(window.innerWidth, window.innerHeight);
    });

    createFloor();
    loadModel();
    initPost();
    initExtra();
    setupGUI();
    updateMode();

    animate();

} //initScene

function initPost() {
    quads.lung = new THREE.Mesh(postBuffGeom, ironShader);
    quads.shallow = new THREE.Mesh(postBuffGeom, basicBufferShader);
    quads.abyssal = new THREE.Mesh(postBuffGeom, basicBufferShader);

    // pass in rendertarget texture
    ironShader.uniforms.t_Diffuse.value = renderTarget.texture;
    basicBufferShader.uniforms.t_Diffuse.value = renderTarget.texture;

    ironShader.uniforms.u_Resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);

    Object.values(quads).forEach(v => {
        v.visible = false;
        postScene.add(v);
    });
}

function initExtra() {
    worms[0] = createFur(0xfce9b3, 33, 37, 10);
    worms[1] = createFur(0x816b8f, 29, 30, -20);
    worms[2] = createFur(0xa6877e, 56, 10, -8);
    worms[3] = createFur(0xfca097, 56, 13, -60);

    worms.forEach(s => {
        s.shells.forEach(q => {
            q.visible = false;
        })
    });

    let system;

    system = new LSystem("F");
    system.addRule("F", "F[+F]F[-F]F");
    plants[0] = createLSystem(system, 4, 0.6, 22.5, 10, 10, 26, 0xeb2f5e);

    system.resetSystem("X");
    system.addRule("F", "FF");
    system.addRule("X", "F[+X]F[-X]+X");
    plants[1] = createLSystem(system, 5, 0.4, 15.0, 40, 10, -38, 0xe67a27);

    system.resetSystem("F");
    system.addRule("F", "F+[-F]+F-F[-FF]F+F");
    plants[2] = createLSystem(system, 4, 0.6, 65.0, 25, 15, -85, 0xbe46e0);

    system.resetSystem("F");
    system.addRule("F", "F+[+F]-F-F+FF[+F]");
    plants[3] = createLSystem(system, 3, 0.3, 14.8, 36, 10, 80, 0x6d9e5a);

    plants.forEach(p => {
        p.visible = false;
    })

    let geometry = new THREE.DodecahedronGeometry(21);

    rockShader.uniforms.u_color.value = new THREE.Color(0x8c817a);
    rockShader.uniforms.u_lightPos = globalUniforms.u_lightPos;
    rockShader.uniforms.u_Resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    rockShader.uniforms.mode = globalUniforms.mode;
    const rock = new THREE.Mesh( geometry, rockShader );
    scene.add( rock );
    rock.position.set(27, 20, 60);
}

// ---------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------
function loadModel() {
    // Load model
    loader = new GLTFLoader();
    loader.load('src/assets/low_poly_whale_bones/scene.gltf', function(gltf) {
        root = gltf.scene;
        root.scale.multiplyScalar(0.3);

        root.traverse((child, i) => {
            if (child.isMesh) {
                child.material.side = THREE.DoubleSide;

                updateModel();
            }
        });

        scene.add(root);
    }, undefined, function(error) {
        console.error(error);
    });
}

function createLSystem(system, iterations, length, angle, x, y, z, color) {
    system.produce(iterations);
    let tree = system.draw(length, angle, color);
    tree.position.set(x, y, z);
    scene.add(tree);
    return tree;
}

function createFur(color, x, y, z) {
    let radius = 4;
    let shellCount = 32;
    let shellGeom =[];

    let fur = {
        shells: [],
    }

    furShader.uniforms.u_shellCount.value = shellCount;
    furShader.uniforms.u_lightPos = globalUniforms.u_lightPos;
    furShader.uniforms.u_color.value = new THREE.Color(color);

    for (let i = 0; i < shellCount; i++) {
        let sphereGeom = new THREE.SphereGeometry(radius);
        shellGeom[i] = sphereGeom;
    }

    for (let i = 0; i < shellCount; i++) {
        fur.shells[i] = new THREE.Mesh(shellGeom[i], furShader.clone());
        fur.shells[i].material.uniforms.u_shellIndex.value = i;
        fur.shells[i].material.renderOrder = i;

        if (i > 0) {
            fur.shells[0].add(fur.shells[i]);
        }
    }

    fur.shells[0].position.set(x, y, z);
    scene.add(fur.shells[0]);
    return fur;
}

function createFloor() {
    floorGeom = new THREE.PlaneGeometry(1000, 1000, 200, 200);
    let floorMat = new THREE.MeshBasicMaterial({ color: '#694637', side: THREE.DoubleSide});
    floor = new THREE.Mesh(floorGeom, floorMat);
    globalUniforms.u_Resolution.value = new THREE.Vector2(floorGeom.parameters.width, floorGeom.parameters.height);
    abyssalFloor.uniforms.u_color.value = new THREE.Color(0x694637);

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 11;
    scene.add(floor);
}

function setupGUI() {
    gui = new GUI({ container: document.getElementById('gui-container') });

    gui.add({mode: currentMode}, 'mode', Object.values(MODES))
        .name('Mode Selector').onChange(v => {
            currentMode = v;
            updateMode();
            updateModel();
    });
}

function updateMode() {
    Object.values(quads).forEach(q => q.visible = false);

    worms.forEach(s => {
        s.shells.forEach(q => {
            q.visible = false;
        })
    });

    plants.forEach(p => {
        p.visible = false;
    });

    switch (currentMode) {
        case MODES.LUNG:
            scene.background = new THREE.Color(0x1b2743);
            quads.lung.visible = true;

            floor.material = abyssalFloor;
            globalUniforms.mode.value = 1;
            break;

        case MODES.SHALLOWS:
            scene.background = new THREE.Color(0x6b87bf);
            quads.shallow.visible = true;

            globalUniforms.mode.value = 2;
            floor.material = createCaustics(0x694637);
            plants.forEach(p => {
                p.visible = true;
            });
            break;

        case MODES.ABYSSAL:
            scene.background = new THREE.Color(0x1a294d);
            quads.abyssal.visible = true;

            floor.material = abyssalFloor;
            floor.material.side = THREE.DoubleSide;
            globalUniforms.mode.value = 3;
            worms.forEach(s => {
                s.shells.forEach(q => {
                    q.visible = true;
                })
            });
            plants.forEach(p => {
                p.visible = true;
            });
            break;
    }
}

function updateModel() {
    if (!root) return;

    root.traverse((child) => {
        if (!child.isMesh) return;

        switch(currentMode) {
            case MODES.LUNG:
                child.material = whaleShader;
                break;
            case MODES.SHALLOWS:
                child.material = createCaustics(0xe3d7d1);
                break;
            case MODES.ABYSSAL:
                child.material = whaleShader;
                break;
        }

    });

    // set these uniforms here because they do basic shading
    whaleShader.uniforms.u_Resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
    whaleShader.uniforms.mode = globalUniforms.mode;
}

function createCaustics(color) {
    const uniforms = {
        u_Time: globalUniforms.u_Time,
        u_Resolution: globalUniforms.u_Resolution,
        u_ObjectColor: {value: new THREE.Color(color)}
    };

    const mat = new THREE.ShaderMaterial({
        vertexShader: causticsShader.vertexShader,
        fragmentShader: causticsShader.fragmentShader,
        uniforms: uniforms
    });
    return mat;
}

// -----------------------------------------------------------------
// ANIMATION LOOP
// -----------------------------------------------------------------
function animate() {
    const time = clock.getElapsedTime();

    ironShader.uniforms.u_Time.value = time;
    causticsShader.uniforms.u_Time.value = time;
    globalUniforms.u_Time.value = time;

    controls.update();
    sunWorldPos = new THREE.Vector3(camera.position.x, camera.position.y + 10, camera.position.z - 5);
    globalUniforms.u_lightPos.value = sunWorldPos.clone().applyMatrix4(camera.matrixWorldInverse);
    whaleShader.uniforms.u_lightPos = globalUniforms.u_lightPos;
    abyssalFloor.uniforms.u_lightPos = globalUniforms.u_lightPos;

    // 2-PASS RENDER PIPELINE TO ACCOMODATE POST-PROCESSING
    // 1. render to a target
    // 2. make a plane geometry and set the texture as the texture you get from the rendertarget
    // 3. apply shader to the plane, add plane to postscene, render the post scene
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);

    requestAnimationFrame(animate);
}

initScene();

