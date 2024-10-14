import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { leaderboard } from './leaderboard.js';

let scene, camera, renderer, controls;
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, canJump = false;
let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let player, playerHeight = 1.8;
let isPaused = false;

let thirdPersonCamera;
let isThirdPerson = false;
const cameraOffset = new THREE.Vector3(0, 2, 5);
let currentLevel = 0;

const levels = [
    { name: "Easy", maze: 'maze_easy.gltf' },
    { name: "Medium", maze: 'maze_medium.gltf' },
    { name: "Hard", maze: 'maze_hard.gltf' }
];

let startTime, elapsedTime;
let isGameActive = false;
let gameState = 'mainMenu';

function init() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.y = playerHeight;
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    
    const geometry = new THREE.SphereGeometry(0.5, 32, 32);
    const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    player = new THREE.Mesh(geometry, material);
    player.position.y = playerHeight / 2;
    player.name = 'player';
    scene.add(player);

    controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    thirdPersonCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    thirdPersonCamera.position.set(0, playerHeight + cameraOffset.y, cameraOffset.z);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(10, 10, 10);
    scene.add(directionalLight);

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onWindowResize, false);

    showMainMenu();
}

function loadMaze(mazePath) {
    const loader = new GLTFLoader();
    loader.load(
        mazePath,
        (gltf) => {
            scene.add(gltf.scene);
            player.position.set(0, playerHeight / 2, 0);
            controls.getObject().position.set(0, playerHeight, 0);
            startGame();
        },
        (xhr) => {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        (error) => {
            console.error('An error happened', error);
        }
    );
}

function startGame() {
    gameState = 'playing';
    isGameActive = true;
    isPaused = false;
    startTime = performance.now();
    updateLevelInfo();
    document.getElementById('mainMenu').style.display = 'none';
    controls.lock();
}

function endGame() {
    isGameActive = false;
    elapsedTime = (performance.now() - startTime) / 1000;
    console.log(`Level ${currentLevel + 1} completed in ${elapsedTime.toFixed(2)} seconds`);
    updateLeaderboard(elapsedTime);
    nextLevel();
}

function nextLevel() {
    currentLevel++;
    if (currentLevel >= levels.length) {
        console.log("Game Completed!");
        showGameCompletionScreen();
        return;
    }
    scene.remove(scene.getObjectByName('maze'));
    loadMaze(levels[currentLevel].maze);
}

function updateLeaderboard(time) {
    leaderboard.addScore(levels[currentLevel].name, time);
    leaderboard.displayLeaderboard();
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    if (!isPaused && controls.isLocked === true && gameState === 'playing') {
        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta;

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize();

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        const collision = checkCollisions(controls.getObject().position, velocity, delta);

        if (!collision) {
            controls.moveRight(-velocity.x * delta);
            controls.moveForward(-velocity.z * delta);
        }

        controls.getObject().position.y += (velocity.y * delta);
       
        if (isThirdPerson) {
            thirdPersonCamera.position.copy(player.position).add(cameraOffset);
            thirdPersonCamera.lookAt(player.position);
        }

        if (controls.getObject().position.y < playerHeight) {
            velocity.y = 0;
            controls.getObject().position.y = playerHeight;
            canJump = true;
        }

        player.position.x = controls.getObject().position.x;
        player.position.z = controls.getObject().position.z;
        player.position.y = controls.getObject().position.y - (playerHeight / 2);

        if (checkMazeCompletion()) {
            endGame();
        }
    }

    prevTime = time;

    if (isGameActive && !isPaused) {
        updateTimer();
    }

    renderer.render(scene, isThirdPerson ? thirdPersonCamera : camera);
}

function checkCollisions(position, velocity, delta) {
    const nextPosition = new THREE.Vector3(
        position.x - velocity.x * delta,
        position.y,
        position.z - velocity.z * delta
    );
    
    const raycaster = new THREE.Raycaster();
    const directions = [
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(0, 0, -1)
    ];

    const collisionDistance = 0.5; // Adjust this value as needed

    for (let direction of directions) {
        raycaster.set(nextPosition, direction);
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        for (let intersect of intersects) {
            if (intersect.object.name === 'mazeWalls' && intersect.distance < collisionDistance) {
                // Collision detected, adjust velocity
                if (direction.x !== 0) velocity.x = 0;
                if (direction.z !== 0) velocity.z = 0;
                return true;
            }
        }
    }
    
    return false;
}

function checkMazeCompletion() {
    const mazeExit = scene.getObjectByName('mazeExit');
    if (!mazeExit) return false;

    const distanceToExit = player.position.distanceTo(mazeExit.position);
    return distanceToExit < 1.5;
}

function updateTimer() {
    const currentTime = performance.now();
    elapsedTime = (currentTime - startTime) / 1000;
    document.getElementById('timer').textContent = `Time: ${elapsedTime.toFixed(2)}`;
}

function updateLevelInfo() {
    document.getElementById('levelInfo').textContent = `Level: ${currentLevel + 1} - ${levels[currentLevel].name}`;
}

function showGameCompletionScreen() {
    gameState = 'completed';
    const completionScreen = document.createElement('div');
    completionScreen.id = 'completionScreen';
    completionScreen.innerHTML = `
        <h1>Congratulations!</h1>
        <p>You've completed all levels!</p>
        <button id="restartButton">Play Again</button>
    `;
    document.body.appendChild(completionScreen);
    document.getElementById('restartButton').addEventListener('click', restartGame);
}

function restartGame() {
    currentLevel = 0;
    document.body.removeChild(document.getElementById('completionScreen'));
    loadMaze(levels[currentLevel].maze);
}

function showMainMenu() {
    gameState = 'mainMenu';
    document.getElementById('mainMenu').innerHTML = `
        <h1>Maze Runner</h1>
        <button id="startGameButton">Start Game</button>
        <button id="resumeGameButton" style="display: none;">Resume Game</button>
        <button id="optionsButton">Options</button>
        <button id="exitGameButton">Exit Game</button>
    `;
    document.getElementById('mainMenu').style.display = 'block';

    document.getElementById('startGameButton').addEventListener('click', () => loadMaze(levels[currentLevel].maze));
    document.getElementById('resumeGameButton').addEventListener('click', resumeGame);
    document.getElementById('optionsButton').addEventListener('click', showOptions);
    document.getElementById('exitGameButton').addEventListener('click', exitGame);
}

function resumeGame() {
    if (gameState === 'playing') {
        isPaused = false;
        controls.lock();
        document.getElementById('mainMenu').style.display = 'none';
    }
}

function showOptions() {
    // Implement options menu
    console.log('Options menu not implemented yet');
}

function exitGame() {
    // Implement exit game functionality
    console.log('Exit game not implemented yet');
}

function onKeyDown(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = true;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = true;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = true;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = true;
            break;
        case 'Space':
            if (canJump === true) velocity.y += 350;
            canJump = false;
            break;
        case 'KeyV':
            isThirdPerson = !isThirdPerson;
            break;
        case 'Escape':
            if (gameState === 'playing') {
                isPaused = true;
                controls.unlock();
                document.getElementById('resumeGameButton').style.display = 'block';
                showMainMenu();
            }
            break;
    }
}

function onKeyUp(event) {
    switch (event.code) {
        case 'ArrowUp':
        case 'KeyW':
            moveForward = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            moveLeft = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            moveBackward = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            moveRight = false;
            break;
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    thirdPersonCamera.aspect = window.innerWidth / window.innerHeight;
    thirdPersonCamera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

init();
animate();