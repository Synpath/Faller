import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {whaleShader, ironShader, basicBufferShader, causticsShader} from './shaders.js';
import {furShader} from './shaders.js';
import {LSystem} from './L-system.js';

// GLOBAL SCENE VARIABLEs
let scene, camera, controls, renderer;
let postScene, renderTarget, postCam, postBuffGeom, quad;
let sun, sunWorldPos, floor, floorGeom;
let loader;
const clock = new THREE.Clock();

// GLOBAL SCENE VARS: MODES
let lung = false;
// let lung = true;

let shallows = false;
// let shallows = true;

// let abyssal = false;
let abyssal = true;

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
    camera.position.set(50, 30, 0);

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
    createFur();

    if (lung) {
        quad = new THREE.Mesh(postBuffGeom, ironShader);
        whaleShader.uniforms.mode.value = 1;
        ironShader.uniforms.t_Diffuse.value = renderTarget.texture;
        ironShader.uniforms.u_Resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);

        postScene.add(quad);
    } else if (shallows) {
        scene.background = new THREE.Color(0x6b87bf);

        floor.material = causticsShader;
        causticsShader.uniforms.u_Resolution.value = new THREE.Vector2(floorGeom.parameters.width, floorGeom.parameters.height);

        quad = new THREE.Mesh(postBuffGeom, basicBufferShader);
        basicBufferShader.uniforms.t_Diffuse.value = renderTarget.texture;
        postScene.add(quad);
    } else if (abyssal) {
        quad = new THREE.Mesh(postBuffGeom, basicBufferShader);
        basicBufferShader.uniforms.t_Diffuse.value = renderTarget.texture;
        postScene.add(quad);
    }

    animate();

} //initScene

function loadModel() {
    // Load model
    loader = new GLTFLoader();
    loader.load('./low_poly_whale_bones/scene.gltf', function(gltf) {
        const root = gltf.scene;
        root.scale.multiplyScalar(0.3);

        root.traverse((child, i) => {
            if (child.isMesh) {
                child.material.side = THREE.DoubleSide;

                if (lung) {
                    child.material = whaleShader;
                } else if (shallows) {
                    child.material = causticsShader;
                }

                // set these uniforms here because they do basic shading
                whaleShader.uniforms.u_lightPos.value = sunWorldPos.clone().applyMatrix4(camera.matrixWorldInverse);
                whaleShader.uniforms.u_Resolution.value = new THREE.Vector2(window.innerWidth, window.innerHeight);
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

function createFur() {
    let radius = 4;
    let shellCount = 32;
    let shellGeom =[];
    let shells = [];
    let temp;

    furShader.uniforms.u_shellCount.value = shellCount;

    for (let i = 0; i < shellCount; i++) {
        let sphereGeom = new THREE.SphereGeometry(radius + (0 * i)); //0.05
        shellGeom[i] = sphereGeom;
    }
    temp = shellGeom[0];

    let baseMat = new THREE.MeshBasicMaterial({color: 0xff0000});
    shells[0] = new THREE.Mesh(shellGeom[0], baseMat);

    temp = new THREE.Mesh(temp, baseMat);

    let tempFur = new THREE.MeshBasicMaterial({color: 0x00ff00});

    for (let i = 0; i < shellCount; i++) {
        shells[i] = new THREE.Mesh(shellGeom[i], furShader.clone());
        shells[i].renderOrder = i;
        shells[i].material.uniforms.u_shellIndex.value = i;

        if (i > 0) {
            shells[0].add(shells[i]);
        }
    }

    temp.position.set(-10, 80, 40);
    shells[0].position.set(-10, 80, 20);
    scene.add(shells[0]);
    scene.add(temp);
}

function createFloor() {
    floorGeom = new THREE.PlaneGeometry(1000, 1000);
    let floorMat = new THREE.MeshBasicMaterial({color: '#aba79d', side: THREE.DoubleSide});
    floor = new THREE.Mesh(floorGeom, floorMat);

    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 11;
    scene.add(floor);
}

function animate() {
    const time = clock.getElapsedTime();

    ironShader.uniforms.u_Time.value = time;
    causticsShader.uniforms.u_Time.value = time;

    controls.update();

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

