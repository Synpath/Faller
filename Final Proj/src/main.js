import * as THREE from 'three'
import GUI from 'lil-gui';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {whaleShader, ironShader, basicBufferShader, causticsShader} from './shaders.js';
import {furShader, abyssalFloor} from './shaders.js';
import {LSystem} from './L-system.js';

// --------------------------------------------------------------
// GLOBAL SCENE VARIABLEs
// --------------------------------------------------------------
let scene, camera, controls, renderer;
let postScene, renderTarget, postCam, postBuffGeom;
let sun, sunWorldPos, floor, floorGeom, defaultFloor;
let loader, root;
let gui;

let quads = {};
let plants = [];
let worms = [];

let shells = [];

const globalUniforms = {
    u_Time: {value: 0},
    u_Resolution: {value: null},
    u_lightPos: {value: new THREE.Vector3()},
};

const clock = new THREE.Clock();
const MODES = {
    LUNG: 'Iron Lung',
    SHALLOWS: 'Shallow Water',
    ABYSSAL: 'Abyssal Zone',
};
let currentMode = MODES.ABYSSAL;
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
    // controls.maxPolarAngle = 1.4963;

    // Axes Helper (remove or toggle off when done debugging)
    const axesHelper = new THREE.AxesHelper(30);
    scene.add(axesHelper);

    // Handle Resizing
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderTarget.setSize(window.innerWidth, window.innerHeight);
    });

    createSun();
    createFloor();
    loadModel();
    initPost();
    setupGUI();
    updateMode();

    animate();

} //initScene

// ---------------------------------------------------------------------
// HELPER FUNCTIONS
// ---------------------------------------------------------------------

function loadModel() {
    // Load model
    loader = new GLTFLoader();
    loader.load('./low_poly_whale_bones/scene.gltf', function(gltf) {
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

function createSun() {
    const sunGeom = new THREE.SphereGeometry(2, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: '#ffd129'});
    sun = new THREE.Mesh(sunGeom, sunMat);

    // sun.position.set(50, 5, 10);
    // sunWorldPos = new THREE.Vector3(50, 5, 10);
    sun.position.set(0, 50, 10);
    sunWorldPos = new THREE.Vector3(0, 50, 10);
    scene.add(sun);
}

function createLSystem() {
    let system;
    system = new LSystem("F");
    system.addRule("F", "F[+F]F[-F]F");
    system.produce(4);
    let tree = system.draw(0.6, 22.5);
    tree.position.set(25, 10, 20);
    scene.add(tree);
}

function createFur(color, x, y, z) {
    let radius = 4;
    let shellCount = 32;
    let shellGeom =[];

    furShader.uniforms.u_shellCount.value = shellCount;
    furShader.uniforms.u_lightPos = globalUniforms.u_lightPos;
    furShader.uniforms.u_color.value = new THREE.Color(color);

    for (let i = 0; i < shellCount; i++) {
        let sphereGeom = new THREE.SphereGeometry(radius + (0 * i)); //0.05
        shellGeom[i] = sphereGeom;
    }

    let baseMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    shells[0] = new THREE.Mesh(shellGeom[0], baseMat);

    for (let i = 0; i < shellCount; i++) {
        shells[i] = new THREE.Mesh(shellGeom[i], furShader.clone());
        shells[i].material.uniforms.u_shellIndex.value = i;
        shells[i].material.renderOrder = i;

        if (i > 0) {
            shells[0].add(shells[i]);
        }
    }

    shells[0].position.set(x, y, z);
    // shells[0].position.set(-10, 80, 20);
    scene.add(shells[0]);
}

function createFloor() {
    floorGeom = new THREE.PlaneGeometry(1000, 1000);
    // let floorMat = new THREE.MeshBasicMaterial({color: '#aba79d', side: THREE.DoubleSide});
    let floorMat = new THREE.MeshBasicMaterial({ color: '#694637', side: THREE.DoubleSide});
    defaultFloor = floorMat;
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

    switch (currentMode) {
        case MODES.LUNG:
            floor.material = abyssalFloor;
            quads.lung.visible = true;
            whaleShader.uniforms.mode.value = 1;
            scene.background = new THREE.Color(0x1b2743);
            break;

        case MODES.SHALLOWS:
            quads.shallow.visible = true;
            floor.material = createCaustics(0x694637);
            scene.background = new THREE.Color(0x6b87bf);
            break;

        case MODES.ABYSSAL:
            scene.background = new THREE.Color(0x000000);
            floor.material = abyssalFloor;
            whaleShader.uniforms.mode.value = 3;

            createFur(0xfcba03, 33, 37, 10);

            quads.abyssal.visible = true;
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
                child.material = createCaustics(0xffefee);
                break;
            case MODES.ABYSSAL:
                child.material = whaleShader;
                break;
        }

    });

    // set these uniforms here because they do basic shading
    whaleShader.uniforms.u_Resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
}

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

    shells.forEach(s => {
        // s.material.uniforms.u_lightPos.value =  sunWorldPos.clone().applyMatrix4(camera.matrixWorldInverse);
    });

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

