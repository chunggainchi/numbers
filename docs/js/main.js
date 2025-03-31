import * as THREE from 'three';
// Import GLTFLoader for loading 3D models
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// Export interaction handlers and wall functions
export { 
    handlePointerDownInteraction, 
    handlePointerUpInteraction, 
    handleBlockClick, 
    handleDragStartInteraction, 
    handleBreakdownRequest, 
    handlePickupRequest, 
    handleDropRequest, 
    handleTransformRequest,
    initializeNetworking, 
    updateWallHole,
    updateWallAppearance,
    resetCarryState,
    playWrongMatchSound, 
    playFanfareSound, 
    startConfettiCelebration, 
    spawnNewBlockAfterCelebration, 
    handleWallClick
};

import { keyboardState, pointerState, draggedObject, setDraggedObject, setPotentialClickTarget, initControls } from './controls.js'; // Updated import
import { spawnInitialBlocks, spawnNumberBlock, removeNumberBlock, numberBlocks, COLORS, NUMBERLING_BG_COLOR, NUMBERLING_TEXT_COLOR } from './game.js'; // Updated import
import { initializeNetworking } from './network.js'; // Import networking functionality

let scene, camera, renderer;
let groundPlane;
let avatar; // Variable to hold the avatar mesh
let mirrorObject; // Variable to hold the magic mirror mesh
let trashCanObject; // Variable to hold the trash can mesh
let wallStructure; // Variable to hold the shape matching wall

// Color Palette (from Visual style and asset specs.md)
const skyColor = 0x9EDBDC; // Updated sky color
const groundColor = 0x90EE90;  // Light green
const avatarColor = 0xFFB347; // First default color: Orange

// Movement and boundary constants
const moveSpeed = 3; // Units per second (as per Game mechanics spec)
const boundaryMin = -10;
const boundaryMax = 10;
const BREAKDOWN_TARGET_DISTANCE = 3.0; // Used for both breakdown and transform
const PICKUP_DISTANCE = 2.0; // Max distance to target a block for pickup
const MIRROR_ACTIVATION_DISTANCE = 4.5; // How close avatar needs to be to mirror
const MIRROR_PROCESS_DURATION = 3000; // 3 seconds in milliseconds
const TRASH_ACTIVATION_DISTANCE = 2.0; // How close avatar needs to be to trash can
const WALL_ACTIVATION_DISTANCE = 2.5; // How close avatar needs to be to the wall for activation
// Wall position constant
const WALL_POSITION = new THREE.Vector3(0, 0, -10); // Position the wall closer to the camera and player
const clock = new THREE.Clock(); // For delta time calculation

// Dragging constants
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Plane to intersect for dragging on XZ
const dragOffset = new THREE.Vector3(); // Offset from object center to intersection point
const dragIntersection = new THREE.Vector3(); // Where the ray intersects the drag plane
const blockDragHeight = 1.0; // How high to lift the block when dragging

// Raycasting
const raycaster = new THREE.Raycaster();
const downVector = new THREE.Vector3(0, -1, 0); // For checking below dropped block

// Audio
let audioListener;
let clickSounds = {}; // Object to store number click sounds
let combineSounds = {}; // Object to store combine sounds
let splitSound; // Sound for splitting blocks apart
let breakdownSound; // Sound for breaking a block down
let pickupSound; // Sound for picking up blocks
let dropSound; // Sound for dropping blocks 
let transformSound; // Sound for transforming blocks
let mirrorProcessingSound; // Sound for mirror processing
let mirrorSuccessSound; // Sound for mirror success 
let trashDisposeSound; // Sound for trash disposal
let avatarClickSound; // Sound for clicking avatar
let mirrorClickSound; // Sound for clicking mirror
let trashCanClickSound; // Sound for clicking trash can
let wrongMatchSound; // Sound for wrong wall match
let fanfareSound; // Sound for successful wall match
let wallClickSound; // Sound for clicking on the wall

// Variables for celebration
let isCelebrating = false;
let celebrationConfetti = null;
let celebrationTimer = null;
let pendingWallUpdate = null;

// Block targeting for breakdown and pickup
let currentBreakdownTarget = null; // Currently targeted block for breakdown
let currentPickupTarget = null; // Currently targeted block for pickup
let previouslyHighlightedBlock = null; // Track which block was previously highlighted
let currentTransformTarget = null; // Currently targeted block for transformation

// Stack and Carry mechanic
let isCarrying = false; // Whether the player is carrying blocks
let carriedValue = 0; // Total value of carried blocks
let carriedShapeIndex = 0; // Shape index of carried blocks
let carriedBlocksGroup = null; // Visual representation of carried blocks

// Block transformation configurations
// Each number represents the possible partitions (stack heights) of that number
// Ordered to create a logical progression where only one cube moves at a time when possible
// Order: vertical stack → 2 stacks → 3 stacks → 4 stacks → 5 stacks (all singles)
const BLOCK_SHAPES = {
    1: [
        [1] // Single block (only one possibility)
    ],
    2: [
        [2],    // Vertical stack of 2
        [1, 1]  // Two individual blocks side by side
    ],
    3: [
        [3],      // Vertical stack of 3
        [2, 1],   // Stack of 2 + single block
        [1, 2],   // Single block + stack of 2
        [1, 1, 1] // Three individual blocks
    ],
    4: [
        [4],         // Vertical stack of 4
        [3, 1],      // Stack of 3 + single block
        [2, 2],      // Two equal stacks of 2
        [1, 3],      // Single block + stack of 3
        [2, 1, 1],   // Stack of 2 + two singles
        [1, 2, 1],   // Single + stack of 2 + single
        [1, 1, 2],   // Two singles + stack of 2
        [1, 1, 1, 1] // Four individual blocks
    ],
    5: [
        [5],            // Vertical stack of 5
        [4, 1],         // Stack of 4 + single block
        [3, 2],         // Stack of 3 + stack of 2
        [2, 3],         // Stack of 2 + stack of 3
        [1, 4],         // Single block + stack of 4
        
        [3, 1, 1],      // Stack of 3 + two singles
        [2, 2, 1],      // Two stacks of 2 + single
        [2, 1, 2],      // Stack of 2 + single + stack of 2
        [1, 2, 2],      // Single + two stacks of 2
        
        [2, 1, 1, 1],   // Stack of 2 + three singles
        [1, 2, 1, 1],   // Single + stack of 2 + two singles
        [1, 1, 2, 1],   // Two singles + stack of 2 + single
        [1, 1, 1, 2],   // Three singles + stack of 2
        
        [1, 1, 1, 1, 1] // Five individual blocks
    ]
};

// Add a debug toggle to control logging
const DEBUG = {
    targeting: false,  // Set to true for detailed targeting logs
    transform: false   // Keep transform logs off
};

// Mirror state
let mirrorIsBusy = false;
let isNearMirror = false;
let canUseMirror = false;

// Trash can state
let isNearTrashCan = false;

// Wall state
let isNearWall = false;
let wasWallHighlighted = false;
const wallActivationCenter = new THREE.Vector3(0, 2, -8.5); // Slightly in front of the wall
let currentWallTargetVisual = null; // Reference to the current target visual object

// Wall canvas and texture variables
let wallCanvas = null;
let wallContext = null;
let wallTexture = null;
const wallBlockWidth = 11; // Wall's width in blocks
const wallBlockHeight = 6; // Wall's height in blocks
const WALL_COLOR_HEX = 0xA9A9A9; // The wall's grey color

// Helper function to calculate cube index from x,y coordinates
function getCubeIndex(x, y) {
    // x: 0 to width-1, counting from left
    // y: 0 to height-1, counting from bottom
    return x + (y * wallBlockWidth);
}

// Function to update wall appearance with target shape cutout
function updateWallAppearance(targetShapeNumber) {
    if (!wallContext || !wallCanvas) return; // Safety check
    
    // Draw solid background
    wallContext.fillStyle = '#' + WALL_COLOR_HEX.toString(16).padStart(6, '0');
    wallContext.fillRect(0, 0, wallCanvas.width, wallCanvas.height);
    
    // Add shape cutout if valid target number
    if (targetShapeNumber >= 1 && targetShapeNumber <= 5) {
        const canvasWidth = wallCanvas.width;
        const canvasHeight = wallCanvas.height;
        
        // Calculate block dimensions in pixels
        const blockPixelWidth = canvasWidth / wallBlockWidth;
        const blockPixelHeight = canvasHeight / wallBlockHeight;
        
        const shapeWidthBlocks = 1; // Numberblocks are 1 block wide
        const shapeHeightBlocks = targetShapeNumber;
        
        // Calculate center position for the cutout
        const cutoutCenterX = canvasWidth / 2;
        const cutoutCenterY = canvasHeight / 2;
        const cutoutStartX = cutoutCenterX - (shapeWidthBlocks * blockPixelWidth / 2);
        const cutoutStartY = cutoutCenterY - (shapeHeightBlocks * blockPixelHeight / 2);
        
        // Create transparent cutout
        wallContext.clearRect(
            cutoutStartX,
            cutoutStartY,
            shapeWidthBlocks * blockPixelWidth,
            shapeHeightBlocks * blockPixelHeight
        );
    }
    // If targetShapeNumber is 0 or invalid, we just leave the solid wall with no cutout
    
    // Update texture if it exists
    if (wallTexture) {
        wallTexture.needsUpdate = true;
    }
}

// Function to initialize wall canvas and texture
function initializeWallCanvas() {
    // Create the canvas element
    wallCanvas = document.createElement('canvas');
    
    // Set its size based on the wall's aspect ratio (using power of 2)
    wallCanvas.width = 512;
    wallCanvas.height = Math.floor(wallCanvas.width * (wallBlockHeight / wallBlockWidth));
    
    // Get the 2D context
    wallContext = wallCanvas.getContext('2d');
    
    // Create the texture
    wallTexture = new THREE.CanvasTexture(wallCanvas);
    
    // Draw initial background with no cutout
    updateWallAppearance(0);
}

// Function to update wall hole based on target shape
function updateWallHole(targetShape, shapeIndex = 0) {
    console.log(`Updating wall hole for shape ${targetShape} with configuration ${shapeIndex}`);
    
    // If a celebration is in progress, queue this update to happen after
    if (isCelebrating) {
        console.log("Celebration in progress, queuing wall update");
        pendingWallUpdate = { targetShape, shapeIndex };
        return;
    }
    
    // Get the shape configuration
    const shape = BLOCK_SHAPES[targetShape][shapeIndex];
    if (!shape) {
        console.error(`Invalid shape configuration: ${targetShape}, ${shapeIndex}`);
        return;
    }
    
    // Middle column (6th column in an 11-wide wall)
    const middleColumn = 5; // zero-indexed
    
    // Calculate how many stacks we have
    const numStacks = shape.length;
    const startColumn = middleColumn - Math.floor((numStacks - 1) / 2);
    
    // Reset all wall blocks to visible
    for (let i = 0; i < wallStructure.children.length; i++) {
        if (wallStructure.children[i]) {
            wallStructure.children[i].visible = true;
        }
    }
    
    // For each stack in the shape
    for (let stackIndex = 0; stackIndex < numStacks; stackIndex++) {
        const stackHeight = shape[stackIndex];
        const currentColumn = startColumn + stackIndex;
        
        // Remove cubes for this stack from bottom up
        for (let y = 0; y < stackHeight; y++) {
            const index = getCubeIndex(currentColumn, y);
            if (wallStructure.children[index]) {
                wallStructure.children[index].visible = false;
            }
        }
    }
    
    console.log(`Updated wall hole for shape ${targetShape} with configuration ${shapeIndex}`);
}

// Function to build a block structure (wall, platform, etc)
function buildBlockStructure(config) {
    // Default configuration values
    const {
        baseWidth = 4,
        baseDepth = 4,
        height = 4,
        position = new THREE.Vector3(0, 0, 0),
        color = 0xA9A9A9, // Default grey color
        hollow = false
    } = config;
    
    // Create the main group that will hold all cubes
    const structureGroup = new THREE.Group();
    
    // Set userData to track structure type
    structureGroup.userData = { 
        type: 'structure',
        structureType: 'wall'
    };
    
    // Create material for the structure
    const structureMaterial = new THREE.MeshStandardMaterial({
        color: color,
        roughness: 0.8,
        metalness: 0.1
    });
    
    // Create the block geometry once and reuse it
    const blockGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.98); // Slightly smaller for shadow gaps
    
    // Build the wall one cube at a time
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < baseWidth; x++) {
            // Create cube
            const cube = new THREE.Mesh(blockGeometry, structureMaterial);
            
            // Position cube
            cube.position.set(
                x - (baseWidth / 2) + 0.5,  // Center horizontally
                y + 0.5,                    // Stack vertically from ground
                0                           // Single depth for wall
            );
            
            // Add cube to group
            structureGroup.add(cube);
            
            // Store position information in cube's userData
            cube.userData = {
                gridX: x,
                gridY: y
            };
        }
    }
    
    // Position the entire structure
    structureGroup.position.copy(position);
    
    return structureGroup;
}

// Initialize the scene
function init() {
    // FR1.1: Initialize a Three.js scene.
    scene = new THREE.Scene();
    
    // Load and set the background image
    setBackgroundImage();
    
    // Create and add the game logo to the top left of the viewport
    addGameLogo();

    // FR1.2: Create the ground plane - make it completely transparent
    const groundGeometry = new THREE.PlaneGeometry(100, 100); // Large plane
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: groundColor, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0, // Completely transparent
        depthWrite: false // Prevent depth writing to avoid z-fighting
    });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2; // Rotate it to be flat on the XZ plane
    groundPlane.position.y = -0.01; // Position it slightly below ground level
    groundPlane.receiveShadow = false; // No need to receive shadows if transparent
    scene.add(groundPlane);

    // FR1.1: Create PerspectiveCamera
    // Position the camera to look more upward at the scene
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10); // Higher and further back position
    camera.lookAt(0, 5, 0); // Look at a point slightly above the ground

    // FR1.1: Create WebGLRenderer with enhanced settings
    renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        powerPreference: "high-performance",
        alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio); // Match device pixel ratio
    renderer.outputEncoding = THREE.sRGBEncoding; // Improved color display
    renderer.gammaFactor = 2.2; // Standard gamma correction for more accurate colors
    
    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadow edges

    // Add the renderer's canvas to the HTML body
    document.body.appendChild(renderer.domElement);

    // Enhanced lighting setup for better color display
    // 1. Brighter ambient light for better overall illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); 
    scene.add(ambientLight);

    // 2. Main directional light (sun-like)
    const mainLight = new THREE.DirectionalLight(0xffffff, 1.0);
    mainLight.position.set(5, 10, 5); 
    mainLight.castShadow = true;
    // Configure shadow properties
    mainLight.shadow.mapSize.width = 1024;
    mainLight.shadow.mapSize.height = 1024;
    mainLight.shadow.camera.near = 0.5;
    mainLight.shadow.camera.far = 50;
    mainLight.shadow.camera.left = -15;
    mainLight.shadow.camera.right = 15;
    mainLight.shadow.camera.top = 15;
    mainLight.shadow.camera.bottom = -15;
    scene.add(mainLight);
    
    // 3. Secondary fill light from opposite direction
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
    fillLight.position.set(-5, 8, -5);
    scene.add(fillLight);

    // Load avatar model
    loadAvatarModel();
    
    // Load mirror model
    loadMirrorModel();
    
    // Load trash can model
    loadTrashCanModel();
    
    // Create and add the shape matching wall
    wallStructure = buildBlockStructure({
        baseWidth: 11, // Changed from 10 to 11
        baseDepth: 1,
        height: 6,
        position: WALL_POSITION,
        color: 0xA9A9A9, // Grey color
        hollow: false
    });
    scene.add(wallStructure);
    console.log('Shape matching wall created successfully');
    console.log(`Wall position: X=${WALL_POSITION.x}, Y=${WALL_POSITION.y}, Z=${WALL_POSITION.z}`);
    console.log(`Wall structure contains ${wallStructure.children.length} blocks`);

    // Spawn a single block of value 1
    spawnNumberBlock(scene, 1, new THREE.Vector3(-2, 0, -3)); // Position it slightly in front of the player

    // Initialize all audio elements
    initializeAudio();

    // Initialize ALL Controls (Keyboard and Pointer)
    initControls(); 

    // Handle window resize
    window.addEventListener('resize', onWindowResize, false);

    // Start the render loop
    animate();
    
    // Initialize networking (connect to server)
    initializeNetworking();
}

// Function to set the background image
function setBackgroundImage() {
    // Load the background image
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
        'assets/models/background.webp',
        function(texture) {
            // On successful load, set as scene background
            scene.background = texture;
            console.log('Background image loaded successfully');
        },
        undefined, // onProgress callback not needed
        function(error) {
            // On error, fall back to solid color
            console.error('Error loading background image:', error);
            scene.background = new THREE.Color(0x9EDBDC); // Fallback to solid color
        }
    );
}

// Function to add the game logo to the top left corner
function addGameLogo() {
    // Create a div to hold the logo
    const logoContainer = document.createElement('div');
    logoContainer.id = 'game-logo-container';
    logoContainer.style.position = 'fixed';
    logoContainer.style.top = '10px';
    logoContainer.style.left = '10px';
    logoContainer.style.zIndex = '1000';
    logoContainer.style.pointerEvents = 'none'; // Don't interfere with user interactions
    
    // Create the logo image
    const logoImage = document.createElement('img');
    logoImage.src = 'assets/models/Logo.png';
    logoImage.style.width = '120px'; // Adjust size as needed
    logoImage.style.height = 'auto';
    logoImage.style.filter = 'drop-shadow(2px 2px 2px rgba(0,0,0,0.3))'; // Add subtle shadow
    
    // Add the image to the container
    logoContainer.appendChild(logoImage);
    
    // Add the container to the document body
    document.body.appendChild(logoContainer);
    
    console.log('Game logo added to top left corner');
}

// Function to load the Boo avatar model
function loadAvatarModel() {
    const loader = new GLTFLoader();
    loader.load(
        // Path to the model (relative to the HTML file)
        'assets/models/boo_avatar.glb',
        // Called when the resource is loaded
        function (gltf) {
            avatar = gltf.scene;
            
            // Get the bounding box to help with positioning
            const boundingBox = new THREE.Box3().setFromObject(avatar);
            const height = boundingBox.max.y - boundingBox.min.y;
            
            // Scale and position the model - INCREASED SCALE
            avatar.scale.set(1.5, 1.5, 1.5); // Larger scale for better visibility
            
            // Position at origin - ensure full model is visible
            // Use bounding box to correctly position after scaling
            // Recompute bounding box after scaling
            const scaledBoundingBox = new THREE.Box3().setFromObject(avatar);
            
            // Position the avatar so it sits on the ground with proper spacing
            // This will ensure hands aren't clipped by adjusting height properly
            avatar.position.set(0, Math.abs(scaledBoundingBox.min.y) + 0.1, 0);
            
            // Enable shadows for all meshes in the avatar
            avatar.traverse(function(child) {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = false; // The avatar doesn't need to receive shadows
                }
            });
            
            scene.add(avatar);
            console.log('Boo avatar loaded successfully');
        },
        // Called while loading is progressing
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        // Called when loading has errors
        function (error) {
            console.error('Error loading avatar model:', error);
            
            // Fallback to capsule geometry if model fails to load
            console.log('Using fallback avatar geometry');
            const avatarRadius = 0.4;
            const avatarLength = 0.7; // Height of the cylinder part
            const avatarGeometry = new THREE.CapsuleGeometry(avatarRadius, avatarLength, 8, 16);
            const avatarMaterial = new THREE.MeshStandardMaterial({ color: avatarColor });
            avatar = new THREE.Mesh(avatarGeometry, avatarMaterial);
            
            // Position the fallback avatar
            const avatarCenterY = (avatarLength / 2) + avatarRadius;
            avatar.position.set(0, avatarCenterY, 0);
            
            // Enable shadows for fallback avatar
            avatar.castShadow = true;
            avatar.receiveShadow = false;
            
            scene.add(avatar);
        }
    );
}

// Function to load the Magical Mirror model
function loadMirrorModel() {
    const loader = new GLTFLoader();
    loader.load(
        // Path to the mirror model
        'assets/models/mirror.glb',
        // Called when the resource is loaded
        function (gltf) {
            mirrorObject = gltf.scene;
            
            // Scale the mirror to be larger and more prominent
            mirrorObject.scale.set(2.5, 2.5, 2.5); // Increased scale significantly
            
            // Position the mirror more prominently in the world
            mirrorObject.position.set(8, 1, -7); // Place in a corner of the play area
            
            // Make sure the mirror is facing toward the center of the scene
            mirrorObject.rotation.y = Math.PI / 1; // Adjusted to 30 degrees for better visibility
            
            // Enable shadows for all meshes in the mirror
            mirrorObject.traverse(child => {
                if (child.isMesh) {
                    // Store the original material for later reference
                    child.userData.originalMaterial = child.material.clone();
                    
                    // Make sure material can use emissive property for highlighting
                    if (!child.material.emissive) {
                        child.material = new THREE.MeshStandardMaterial({
                            map: child.material.map,
                            color: child.material.color,
                            emissive: new THREE.Color(0x000000)
                        });
                    }
                    
                    // Enable shadows
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // Add the mirror to the scene
            scene.add(mirrorObject);
            
            console.log('Magic Mirror loaded successfully');
        },
        // Called while loading is progressing
        function (xhr) {
            console.log('Mirror: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
        },
        // Called when loading has errors
        function (error) {
            console.error('Error loading mirror model:', error);
            
            // Create a fallback mirror if the model fails to load
            console.log('Using fallback mirror geometry');
            
            // Create a larger, more prominent fallback mirror
            const mirrorGeometry = new THREE.BoxGeometry(3, 6, 0.3);
            const mirrorMaterial = new THREE.MeshStandardMaterial({ 
                color: 0xaaaaff,
                metalness: 0.8,
                roughness: 0.2,
                emissive: 0x000000
            });
            
            const frameGeometry = new THREE.BoxGeometry(4, 7, 0.5);
            const frameMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x6b4226, // Brown wooden frame
                metalness: 0.1,
                roughness: 0.8
            });
            
            const frame = new THREE.Mesh(frameGeometry, frameMaterial);
            const mirror = new THREE.Mesh(mirrorGeometry, mirrorMaterial);
            mirror.position.z = 0.15; // Position slightly in front of the frame
            
            // Enable shadows for fallback mirror
            frame.castShadow = true;
            frame.receiveShadow = true;
            mirror.castShadow = true;
            mirror.receiveShadow = true;
            
            // Create a group to hold the parts
            mirrorObject = new THREE.Group();
            mirrorObject.add(frame);
            mirrorObject.add(mirror);
            
            // Position the fallback mirror
            mirrorObject.position.set(7, 3.5, -7); // Adjusted position for prominence
            mirrorObject.rotation.y = Math.PI / 6; // 30 degrees for better visibility
            
            scene.add(mirrorObject);
        }
    );
}

// Function to load the trash can model
function loadTrashCanModel() {
    const loader = new GLTFLoader();
    loader.load(
        // Path to the trash can model
        'assets/models/trashcan.glb',
        // Called when the resource is loaded
        function (gltf) {
            trashCanObject = gltf.scene;
            
            // Scale the trash can appropriately
            trashCanObject.scale.set(1.5, 1.5, 1.5);
            
            // Position the trash can in a visible location that's not directly in front of the camera
            trashCanObject.position.set(-10, 1, -7); // Move further to the side of the field
            
            // Rotate the trash can to face the center
            trashCanObject.rotation.y = Math.PI / 4; // 45 degrees
            
            // Make sure the trash can is usable and casts shadows
            trashCanObject.traverse(child => {
                if (child.isMesh) {
                    // Store the original material for later reference
                    child.userData.originalMaterial = child.material.clone();
                    
                    // Make sure material can use emissive property for highlighting
                    if (!child.material.emissive) {
                        child.material = new THREE.MeshStandardMaterial({
                            map: child.material.map,
                            color: child.material.color,
                            emissive: new THREE.Color(0x000000)
                        });
                    }
                    
                    // Enable shadows
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            // Add the trash can to the scene
            scene.add(trashCanObject);
            
            console.log('Trash can loaded successfully');
        },
        // Called while loading is progressing
        function (xhr) {
            console.log('Trash can: ' + (xhr.loaded / xhr.total * 100) + '% loaded');
        },
        // Called when loading has errors
        function (error) {
            console.error('Error loading trash can model:', error);
            
            // Create a fallback trash can if the model fails to load
            console.log('Using fallback trash can geometry');
            
            // Create a simple trash can
            const baseGeometry = new THREE.CylinderGeometry(1, 0.8, 2, 16);
            const baseMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x444444, // Dark gray
                metalness: 0.8,
                roughness: 0.2
            });
            
            // Create the trash can
            trashCanObject = new THREE.Group();
            const base = new THREE.Mesh(baseGeometry, baseMaterial);
            
            // Enable shadows for fallback trash can
            base.castShadow = true;
            base.receiveShadow = true;
            
            // Add the base to the group
            trashCanObject.add(base);
            
            // Position the fallback trash can to match main trash can
            trashCanObject.position.set(-8, 1, 3);
            trashCanObject.rotation.y = Math.PI / 4; // 45 degrees
            
            // Add to scene
            scene.add(trashCanObject);
        }
    );
}

// Find the parent Group that represents the Numberblock
function findNumberBlockGroup(object) {
    let current = object;
    while (current) {
        if (current.userData && current.userData.type === 'numberBlock') {
            return current; // Found the group
        }
        if (!current.parent || current === scene) { // Stop if we hit the scene or no parent
             break;
        }
        current = current.parent;
    }
    return null; // Didn't find a Numberblock group
}

// Updated interaction handler
function handlePointerDownInteraction() {
    // Set up raycaster with current pointer position
    raycaster.setFromCamera(pointerState.pointer, camera);
    
    // First, check if the avatar was clicked
    if (avatar) {
        const avatarIntersects = raycaster.intersectObject(avatar, true); // Check recursively
        if (avatarIntersects.length > 0) {
            // The avatar was clicked
            handleAvatarClick();
            return false; // Stop processing further interactions
        }
    }
    
    // Check if the wall was clicked
    if (wallStructure) {
        const wallIntersects = raycaster.intersectObject(wallStructure, true); // Check recursively
        if (wallIntersects.length > 0) {
            // The wall was clicked
            handleWallClick();
            return false; // Stop processing further interactions
        }
    }
    
    // Check if the mirror was clicked
    if (mirrorObject) {
        const mirrorIntersects = raycaster.intersectObject(mirrorObject, true); // Check recursively
        if (mirrorIntersects.length > 0) {
            // The mirror was clicked
            handleMirrorClick();
            return false; // Stop processing further interactions
        }
    }
    
    // Check if the trash can was clicked
    if (trashCanObject) {
        const trashCanIntersects = raycaster.intersectObject(trashCanObject, true); // Check recursively
        if (trashCanIntersects.length > 0) {
            // The trash can was clicked
            handleTrashCanClick();
            return false; // Stop processing further interactions
        }
    }
    
    // Prevent starting drag if player is carrying blocks
    if (isCarrying) {
        console.log("Cannot drag blocks while carrying. Drop your blocks first (W key).");
        return false;
    }

    // Intersect the whole array of block groups, check recursively
    const intersects = raycaster.intersectObjects(numberBlocks, true); 
    let foundBlockGroup = null;

    if (intersects.length > 0) {
        // Find the parent group of the first intersected object
        foundBlockGroup = findNumberBlockGroup(intersects[0].object);
    }

    if (foundBlockGroup) {
        setPotentialClickTarget(foundBlockGroup);
        return true; 
    } else {
        setPotentialClickTarget(null); 
        return false; 
    }
}

// New function to handle visuals/offset when drag *actually* starts (on move)
function handleDragStartInteraction(blockGroup) {
    if (!blockGroup) return;
    console.log("Started dragging block group:", blockGroup.userData.numberValue);
    raycaster.setFromCamera(pointerState.pointer, camera);
    if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
        dragOffset.copy(dragIntersection).sub(blockGroup.position);
    }
    // Lift the block group visually (maybe slightly less than before?)
    blockGroup.position.y = blockDragHeight * 0.5; // Lift the whole group
}

// Updated drop handler for Groups
function handlePointerUpInteraction() {
     if (!draggedObject) return; // draggedObject is now the GROUP

     let droppedOnTargetGroup = null;
     const dropPosition = draggedObject.position.clone();
     // Raycast down from the base of the dragged group 
     dropPosition.y = blockDragHeight; // Start raycast from where it's held

     raycaster.set(dropPosition, downVector);
     // Intersect potential targets (other block groups)
     const otherBlocks = numberBlocks.filter(b => b !== draggedObject);
     const intersects = raycaster.intersectObjects(otherBlocks, true); // Check children recursively

     if (intersects.length > 0) {
        // Find the parent group of the first intersected object underneath
        droppedOnTargetGroup = findNumberBlockGroup(intersects[0].object);
        // Optional: Add distance check if needed
     }

     // Combination Logic (using Groups)
     if (droppedOnTargetGroup) {
         const valA = draggedObject.userData.numberValue;
         const valB = droppedOnTargetGroup.userData.numberValue;
         const result = valA + valB;

         console.log(`Checking combination: ${valA} + ${valB} = ${result}`);

         if (result <= 5) {
             console.log(`Valid combination! Removing ${valA} and ${valB}, spawning ${result}.`);
             // Spawn position: Midpoint between the groups' base positions
             const combinationPos = droppedOnTargetGroup.position.clone().lerp(draggedObject.position, 0.5);
             combinationPos.y = 0; // Place result group base on ground (y=0)

             removeNumberBlock(scene, draggedObject);
             removeNumberBlock(scene, droppedOnTargetGroup);
             
             // Create the new block
             const newBlock = spawnNumberBlock(scene, result, combinationPos);

             // Play sound
             const soundName = `combine_${valA}_${valB}`;
             const sound = combineSounds[soundName];
             if (sound && !sound.isPlaying) { sound.play(); }
             else { console.warn(`Combine sound ${soundName} not found or already playing.`); }
             
             // Special handling for number 5 blocks - celebration and breakdown
             if (result === 5) {
                 // Store the position for later use when splitting
                 const fiveBlockPosition = combinationPos.clone();
                 
                 // Trigger celebration animation for the block
                 celebrateNumberFiveBlock(newBlock);
                 
                 // After delay, remove the 5 block and spawn five 1 blocks
                 setTimeout(() => {
                     // Remove the 5 block
                     removeNumberBlock(scene, newBlock);
                     
                     // Spawn five 1 blocks in a small circle pattern
                     const radius = 1; // How far from center to place blocks
                     for (let i = 0; i < 5; i++) {
                         // Calculate position in a circle
                         const angle = (i / 5) * Math.PI * 2; // Full circle divided into 5 positions
                         const x = fiveBlockPosition.x + Math.cos(angle) * radius;
                         const z = fiveBlockPosition.z + Math.sin(angle) * radius;
                         const pos = new THREE.Vector3(x, 0, z);
                         
                         // Spawn the 1 block
                         spawnNumberBlock(scene, 1, pos);
                     }
                     
                     // Play split sound effect
                     if (splitSound && !splitSound.isPlaying) {
                         splitSound.play();
                     } else {
                         console.warn("Split sound not loaded or already playing");
                     }
                     
                     console.log("Five block split into five 1 blocks!");
                 }, 1500); // 1.5 second delay
             }
             
             return; // Combination handled
         }
     }
     
     // Invalid Combination or Dropped on Ground
     console.log("Invalid combination or dropped on ground. Placing block group.");
     draggedObject.position.y = 0; // Place group base at y=0
}

// Updated click handler for Groups
function handleBlockClick(blockGroup) {
    if (!blockGroup || !blockGroup.userData || blockGroup.userData.type !== 'numberBlock') return;
    const numValue = blockGroup.userData.numberValue;
    console.log(`Clicked Block ${numValue} Group`);
    const sound = clickSounds[numValue];
    if (sound && !sound.isPlaying) {
        sound.play();
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta();

    // --- Dragging Logic (for Groups) ---
    if (pointerState.isDragging && draggedObject) {
        raycaster.setFromCamera(pointerState.pointer, camera);
        if (raycaster.ray.intersectPlane(dragPlane, dragIntersection)) {
            // Move the object group on the XZ plane
            draggedObject.position.x = dragIntersection.x - dragOffset.x;
            draggedObject.position.z = dragIntersection.z - dragOffset.z;
            // Keep it elevated
            draggedObject.position.y = blockDragHeight * 0.5; // Keep group lifted
            
             // Constrain dragged block group position
             draggedObject.position.x = Math.max(boundaryMin, Math.min(boundaryMax, draggedObject.position.x));
             draggedObject.position.z = Math.max(boundaryMin, Math.min(boundaryMax, draggedObject.position.z));
        }
    }
    // --- End Dragging Logic ---

    // Update avatar position based on keyboard input
    if (avatar) { // Ensure avatar is loaded
        const moveDistance = moveSpeed * deltaTime;
        let deltaX = 0;
        let deltaZ = 0;

        if (keyboardState.ArrowUp) {
            deltaZ -= moveDistance;
        }
        if (keyboardState.ArrowDown) {
            deltaZ += moveDistance;
        }
        if (keyboardState.ArrowLeft) {
            deltaX -= moveDistance;
        }
        if (keyboardState.ArrowRight) {
            deltaX += moveDistance;
        }

        // Apply movement
        avatar.position.x += deltaX;
        avatar.position.z += deltaZ;

        // Rotate the avatar to face the direction it's moving
        if (deltaX !== 0 || deltaZ !== 0) {
            // Calculate the angle based on movement direction
            const angle = Math.atan2(deltaX, deltaZ);
            // Apply smooth rotation
            avatar.rotation.y = angle;
        }

        // FR2.4: Constrain avatar movement within boundaries
        avatar.position.x = Math.max(boundaryMin, Math.min(boundaryMax, avatar.position.x));
        avatar.position.z = Math.max(boundaryMin, Math.min(boundaryMax, avatar.position.z));
        
        // --- Block Targeting for Breakdown and Pickup ---
        // Skip targeting if player is carrying blocks (cannot break down while carrying)
        if (!isCarrying) {
            // Find potential block to break down based on proximity
            const maxDistanceSq = BREAKDOWN_TARGET_DISTANCE * BREAKDOWN_TARGET_DISTANCE;
            let closestDistanceSq = maxDistanceSq;
            let potentialBreakdownTarget = null;
            let potentialPickupTarget = null; 
            let potentialTransformTarget = null;
            
            // Loop through all number blocks
            numberBlocks.forEach(block => {
                // Calculate squared distance to avatar
                const distanceSq = avatar.position.distanceToSquared(block.position);
                
                // Check if close enough for any interaction
                if (distanceSq < maxDistanceSq) {
                    // For pickup, ANY block can be targeted
                    if (distanceSq < closestDistanceSq) {
                        potentialPickupTarget = block;
                        closestDistanceSq = distanceSq;
                    }
                    
                    // For breakdown and transform, only target blocks with value >= 2
                    if (block.userData && block.userData.numberValue >= 2 && distanceSq < maxDistanceSq) {
                        potentialBreakdownTarget = block;
                        potentialTransformTarget = block;
                    }
                }
            });
            
            // Update targets
            currentBreakdownTarget = potentialBreakdownTarget;
            currentPickupTarget = potentialPickupTarget;
            currentTransformTarget = potentialBreakdownTarget;
        } else {
            // When carrying, we can still target blocks for additional pickup if capacity allows
            const maxDistanceSq = BREAKDOWN_TARGET_DISTANCE * BREAKDOWN_TARGET_DISTANCE;
            let closestDistanceSq = maxDistanceSq;
            let potentialPickupTarget = null;
            
            // Only search for pickup targets when not exceeding max capacity
            numberBlocks.forEach(block => {
                // Calculate squared distance to avatar
                const distanceSq = avatar.position.distanceToSquared(block.position);
                
                // Check if close enough for pickup and won't exceed capacity
                if (distanceSq < maxDistanceSq && carriedValue + block.userData.numberValue <= 5) {
                    if (distanceSq < closestDistanceSq) {
                        potentialPickupTarget = block;
                        closestDistanceSq = distanceSq;
                    }
                }
            });
            
            // Update only the pickup target, others remain null while carrying
            currentBreakdownTarget = null;
            currentPickupTarget = potentialPickupTarget;
            currentTransformTarget = null;
        }
        // --- End Block Targeting ---

        // Current highlighted target - any of the targets can be highlighted
        const currentTarget = currentBreakdownTarget || currentPickupTarget || currentTransformTarget;

        // Visual feedback for targeting
        if (currentTarget !== previouslyHighlightedBlock) {
            // Remove highlight from previous block
            if (previouslyHighlightedBlock) {
                previouslyHighlightedBlock.traverse(child => {
                    if (child.isMesh) {
                        child.material.emissive.setHex(0x000000);
                    }
                });
            }
            
            // Add highlight to new target
            if (currentTarget) {
                currentTarget.traverse(child => {
                    if (child.isMesh) {
                        child.material.emissive.setHex(0xFFFF00); // Yellow highlight
                    }
                });
                
                // Determine which action would be triggered
                let action = "unknown";
                if (isCarrying) {
                    // When carrying, only pickup for stacking is possible
                    action = "pickup for stacking";
                } else {
                    // Not carrying - use priority order
                    action = currentBreakdownTarget ? 'breakdown' : 
                             currentPickupTarget ? 'pickup' : 
                             'transform';
                }
                
                console.log(`Targeting block ${currentTarget.userData.numberValue} for ${action}`);
            }
            
            // Update previously highlighted block
            previouslyHighlightedBlock = currentTarget;
        }
    }

    // --- Mirror Proximity Check ---
    if (avatar && mirrorObject) {
        // Check distance between avatar and mirror
        const distanceToMirror = avatar.position.distanceToSquared(mirrorObject.position);
        const maxDistanceSq = MIRROR_ACTIVATION_DISTANCE * MIRROR_ACTIVATION_DISTANCE;
        
        // Update proximity state
        isNearMirror = distanceToMirror < maxDistanceSq;
        
        // Check if carrying eligible blocks (1-5)
        canUseMirror = isCarrying && (carriedValue >= 1 && carriedValue <= 5) && !mirrorIsBusy;
        
        // Highlight mirror when player is near and can use it
        if (isNearMirror && canUseMirror) {
            // Apply more pronounced glow/highlight to mirror
            mirrorObject.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0x4444ff); // Brighter blue glow
                    child.material.emissiveIntensity = 0.7; // Increase intensity 
                    
                    // Add a subtle pulsing effect
                    const pulseSpeed = 1.5;
                    const time = Date.now() * 0.001;
                    const pulse = 0.5 + 0.3 * Math.sin(time * pulseSpeed);
                    child.material.emissiveIntensity = pulse;
                }
            });
        } else if (isNearMirror) {
            // Player is near but can't use mirror (not carrying 1 or 2 blocks)
            // Apply a softer glow to indicate proximity only
            mirrorObject.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0x2222aa); // Soft blue glow
                    child.material.emissiveIntensity = 0.3; // Lower intensity
                }
            });
        } else {
            // Remove highlight when conditions aren't met
            mirrorObject.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0x000000); // No glow
                    child.material.emissiveIntensity = 0; // Reset intensity
                }
            });
        }
    }
    // --- End Mirror Proximity Check ---

    // --- Trash Can Proximity Check ---
    if (avatar && trashCanObject) {
        // Check distance between avatar and trash can
        const distanceToTrashCan = avatar.position.distanceToSquared(trashCanObject.position);
        const maxTrashDistanceSq = TRASH_ACTIVATION_DISTANCE * TRASH_ACTIVATION_DISTANCE;
        
        // Update proximity state
        isNearTrashCan = distanceToTrashCan < maxTrashDistanceSq;
        
        // Highlight trash can when player is near and carrying blocks
        if (isNearTrashCan && isCarrying) {
            // Apply pronounced highlight to trash can
            trashCanObject.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0xFFA500); // Orange glow
                    child.material.emissiveIntensity = 0.5;
                }
            });
        } else {
            // Remove highlight when conditions aren't met
            trashCanObject.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0x000000); // No glow
                    child.material.emissiveIntensity = 0;
                }
            });
        }
    }
    // --- End Trash Can Proximity Check ---
    
    // --- Wall Proximity Check ---
    if (avatar && wallStructure) {
        // Check distance between avatar and wall activation center
        const distanceToWall = avatar.position.distanceToSquared(wallActivationCenter);
        const maxWallDistanceSq = WALL_ACTIVATION_DISTANCE * WALL_ACTIVATION_DISTANCE;
        
        // Update proximity state
        isNearWall = distanceToWall < maxWallDistanceSq;
        
        // Apply or remove highlight based on proximity
        if (isNearWall && !wasWallHighlighted) {
            // Apply highlight to wall
            wallStructure.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0xFFFF00); // Yellow glow
                    child.material.emissiveIntensity = 0.5;
                }
            });
            wasWallHighlighted = true;
            console.log("Wall highlighted - player is near");
        } else if (!isNearWall && wasWallHighlighted) {
            // Remove highlight from wall
            wallStructure.traverse(child => {
                if (child.isMesh) {
                    child.material.emissive.setHex(0x000000); // No glow
                    child.material.emissiveIntensity = 0;
                }
            });
            wasWallHighlighted = false;
            console.log("Wall highlight removed - player moved away");
        }
    }
    // --- End Wall Proximity Check ---

    renderer.render(scene, camera);
}

// Function to celebrate number 5 block with animation before breakdown
function celebrateNumberFiveBlock(blockGroup) {
    if (!blockGroup) return;
    
    // Start values for animation
    const initialY = blockGroup.position.y;
    const initialScale = { value: 1.0 };
    const startTime = Date.now();
    const duration = 1500; // 1.5 seconds
    
    // Create particles for sparkle effect
    const particleCount = 30;
    const particles = [];
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFD700, // Gold color for sparkles
        emissive: 0xFFD700,
        emissiveIntensity: 1
    });
    
    // Create particles and add to scene
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        // Random starting position within the block bounds
        particle.position.copy(blockGroup.position);
        particle.position.y += Math.random() * 2; // Distribute vertically through the block
        
        // Add to scene and track
        scene.add(particle);
        particles.push({
            mesh: particle,
            // Random velocity for particle movement
            velocity: new THREE.Vector3(
                (Math.random() - 0.5) * 0.05,
                Math.random() * 0.1,
                (Math.random() - 0.5) * 0.05
            )
        });
    }
    
    // Animation function
    function animateCelebration() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Bounce and spin animation for the block
        if (blockGroup.parent) { // Check if still in scene
            // Bounce effect - using sine wave
            const bounceHeight = 0.3 * Math.sin(progress * Math.PI * 4);
            blockGroup.position.y = initialY + bounceHeight;
            
            // Spin effect
            blockGroup.rotation.y = progress * Math.PI * 4; // Two full rotations
            
            // Scale pulse effect
            const scaleFactor = 1 + 0.1 * Math.sin(progress * Math.PI * 6);
            blockGroup.scale.set(scaleFactor, scaleFactor, scaleFactor);
        }
        
        // Update particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            p.mesh.position.add(p.velocity);
            
            // Fade out particles as animation progresses
            if (progress > 0.7) {
                const fadeProgress = (progress - 0.7) / 0.3; // 0-1 during fade portion
                p.mesh.material.opacity = 1 - fadeProgress;
                p.mesh.material.transparent = true;
            }
        }
        
        // Continue animation if not complete
        if (progress < 1) {
            requestAnimationFrame(animateCelebration);
        } else {
            // Clean up particles at end of animation
            particles.forEach(p => {
                scene.remove(p.mesh);
            });
            
            // Reset block rotation and scale
            if (blockGroup.parent) {
                blockGroup.rotation.y = 0;
                blockGroup.scale.set(1, 1, 1);
            }
        }
    }
    
    // Start the celebration animation
    animateCelebration();
    console.log("Number 5 celebration animation started");
}

// Fallback function to create a split sound if the audio file is missing
function createFallbackSplitSound() {
    // Create a simple audio buffer with popping sounds
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.5; // Half-second buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a series of "pops" - quick amplitude changes
    for (let i = 0; i < 5; i++) {
        const startSample = Math.floor(bufferLength * (i / 5));
        const popLength = Math.floor(audioContext.sampleRate * 0.02); // 20ms pop
        
        for (let j = 0; j < popLength; j++) {
            const sample = startSample + j;
            if (sample < bufferLength) {
                // Simple decay envelope for each pop
                data[sample] = Math.sin(j / popLength * Math.PI) * 0.5;
            }
        }
    }
    
    // Create sound from buffer
    splitSound = new THREE.Audio(audioListener);
    splitSound.setBuffer(buffer);
    splitSound.setVolume(0.7);
    console.log("Created fallback split sound");
}

// Function to handle the breakdown request when 'K' is pressed
function handleBreakdownRequest() {
    // Prevent breakdown if player is carrying blocks
    if (isCarrying) {
        console.log("Cannot break down blocks while carrying. Drop your blocks first (W key).");
        return;
    }

    if (!currentBreakdownTarget) {
        // No valid target in range
        return;
    }
    
    console.log(`Breaking down block ${currentBreakdownTarget.userData.numberValue}`);
    
    // Get the target block's properties
    const targetValue = currentBreakdownTarget.userData.numberValue;
    const targetPosition = currentBreakdownTarget.position.clone();
    
    // Quick visual feedback that button press was registered
    flashHighlight(currentBreakdownTarget);
    
    // Perform breakdown (implemented client-side for now)
    performBreakdown(currentBreakdownTarget);
}

// Flash the highlight color briefly to show button press registered
function flashHighlight(block, flashColor = 0xFF4500) { // Default to orange-red flash
    if (!block) return;
    
    const originalEmissive = 0xFFFF00; // Yellow (already highlighted)
    
    // Flash the color
    block.traverse(child => {
        if (child.isMesh) {
            child.material.emissive.setHex(flashColor);
            
            // Reset to original highlight after brief delay
            setTimeout(() => {
                if (child.parent) { // Check if still in scene
                    child.material.emissive.setHex(originalEmissive);
                }
            }, 150); // Short flash duration
        }
    });
}

// Perform the actual breakdown
function performBreakdown(blockGroup) {
    if (!blockGroup) return;
    
    const numberValue = blockGroup.userData.numberValue;
    const position = blockGroup.position.clone();
    
    // Remove the original block
    removeNumberBlock(scene, blockGroup);
    
    // Spawn 'numberValue' individual '1' blocks in a circle pattern
    const radius = 0.8; // Smaller radius than the 5-block celebration
    for (let i = 0; i < numberValue; i++) {
        // Calculate position in a circle
        const angle = (i / numberValue) * Math.PI * 2; // Full circle divided into positions
        const x = position.x + Math.cos(angle) * radius;
        const z = position.z + Math.sin(angle) * radius;
        const pos = new THREE.Vector3(x, 0, z);
        
        // Spawn the 1 block
        spawnNumberBlock(scene, 1, pos);
    }
    
    // Play split sound effect (not breakdown sound)
    if (splitSound && !splitSound.isPlaying) {
        splitSound.play();
    } else {
        console.warn("Split sound not loaded or already playing");
    }
    
    // Reset targeting variables
    previouslyHighlightedBlock = null;
    currentBreakdownTarget = null;
    
    console.log(`Block ${numberValue} broken down into ${numberValue} '1' blocks`);
}

// Function to handle pickup request when 'A' is pressed
function handlePickupRequest() {
    console.log("Pickup requested - checking for valid target");
    
    // First check if we have a valid pickup target
    if (!currentPickupTarget) {
        console.log("No valid target in range for pickup");
        return;
    }
    
    const targetValue = currentPickupTarget.userData.numberValue;
    console.log(`Found target block with value ${targetValue}`);
    
    // Check if picking up would exceed maximum capacity (5)
    if (isCarrying && carriedValue + targetValue > 5) {
        console.log(`Cannot pick up - would exceed max capacity: ${carriedValue} + ${targetValue} > 5`);
        // Visual feedback that pickup failed
        flashHighlight(currentPickupTarget, 0xFF0000); // Red flash for failure
        return;
    }
    
    console.log(`Picking up block ${targetValue}`);
    
    // Flash block for success feedback
    flashHighlight(currentPickupTarget);
    
    // Perform pickup
    performPickup(currentPickupTarget);
}

// Function to handle drop request when 'W' is pressed
function handleDropRequest() {
    // Check if player is carrying anything
    if (!isCarrying || carriedValue <= 0) {
        return;
    }
    
    // Check if near wall - attempt wall matching
    if (isNearWall) {
        console.log(`Attempting to match carried blocks (${carriedValue}) with wall target`);
        
        // Send wall match attempt to server
        import('./network.js').then(network => {
            network.sendMessage('ATTEMPT_WALL_MATCH', { 
                carriedValue: carriedValue,
                carriedShapeIndex: carriedShapeIndex
            });
        });
        
        // Note: Do NOT reset client state yet - wait for server confirmation
        return;
    }
    
    // Check if near mirror and can use it
    if (isNearMirror && canUseMirror) {
        console.log(`Using mirror to duplicate carried blocks with value ${carriedValue}`);
        
        // Trigger mirror duplication
        requestMirrorDuplication();
    }
    // Check if near trash can
    else if (isNearTrashCan) {
        console.log(`Disposing carried blocks with value ${carriedValue} in trash`);
        
        // Trigger trash disposal
        disposeInTrashCan();
    }
    // Default: normal drop
    else {
        // Normal drop functionality
        console.log(`Dropping carried blocks with total value ${carriedValue}`);
        
        // Perform drop
        performDrop();
    }
}

// Perform the actual pickup
function performPickup(blockGroup) {
    if (!blockGroup) return;
    
    const blockValue = blockGroup.userData.numberValue;
    console.log(`Performing pickup for block with value ${blockValue}`);
    
    // Safety check: ensure we don't exceed maximum carry capacity
    if (isCarrying && (carriedValue + blockValue > 5)) {
        console.error(`Cannot pick up - would exceed max capacity: ${carriedValue} + ${blockValue} > 5`);
        return;
    }
    
    // Get shape index from the block being picked up
    const blockShapeIndex = blockGroup.userData.shapeIndex || 0;
    
    // Remove the block from the scene
    removeNumberBlock(scene, blockGroup);
    
    // Update carried state
    if (!isCarrying) {
        console.log(`First block picked up, setting carried value to ${blockValue} with shape index ${blockShapeIndex}`);
        isCarrying = true;
        carriedValue = blockValue;
        carriedShapeIndex = blockShapeIndex; // Store the shape index
    } else {
        const newValue = carriedValue + blockValue;
        console.log(`Adding to carried blocks: ${carriedValue} + ${blockValue} = ${newValue} (reverting to default shape)`);
        carriedValue = newValue;
        carriedShapeIndex = 0; // When combining blocks, revert to default shape
    }
    
    // Update visual representation
    updateCarriedVisual();
    
    // Play pickup sound
    if (pickupSound && !pickupSound.isPlaying) {
        pickupSound.play();
    } else {
        console.warn("Pickup sound not loaded or already playing");
    }
    
    // Reset targeting
    previouslyHighlightedBlock = null;
    
    // Important: Do NOT null out currentPickupTarget when carrying
    // This allows the player to continue targeting blocks for pickup
    if (!isCarrying) {
        currentPickupTarget = null;
    }
    
    console.log(`Now carrying blocks with total value ${carriedValue}, shape index ${carriedShapeIndex}`);
}

// Perform the actual drop
function performDrop() {
    if (!isCarrying || carriedValue <= 0) return;
    
    // Calculate drop position in front of avatar
    const dropPosition = new THREE.Vector3();
    
    // Use avatar's forward direction
    const forwardVector = new THREE.Vector3(0, 0, -1);
    forwardVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), avatar.rotation.y);
    forwardVector.multiplyScalar(1.5); // Distance in front of avatar
    
    // Add to avatar position
    dropPosition.copy(avatar.position).add(forwardVector);
    dropPosition.y = 0; // Place at ground level
    
    // Create a new block with the carried shape
    const droppedBlock = createTransformedBlock(carriedValue, carriedShapeIndex, dropPosition);
    
    // Add to scene and tracking array
    scene.add(droppedBlock);
    numberBlocks.push(droppedBlock);
    
    console.log(`Dropped block ${carriedValue} with shape index ${carriedShapeIndex} at position ${dropPosition.x.toFixed(2)}, ${dropPosition.z.toFixed(2)}`);
    
    // Reset carried state
    isCarrying = false;
    const droppedValue = carriedValue;
    carriedValue = 0;
    carriedShapeIndex = 0; // Reset shape index too
    
    // Update visual representation
    updateCarriedVisual();
    
    // Play drop sound
    if (dropSound && !dropSound.isPlaying) {
        dropSound.play();
    } else {
        console.warn("Drop sound not loaded or already playing");
    }
    
    console.log(`Dropped block with value ${droppedValue}`);
}

// Update visual representation of carried blocks
function updateCarriedVisual() {
    // Remove existing carried blocks visual if any
    if (carriedBlocksGroup) {
        if (avatar) {
            avatar.remove(carriedBlocksGroup);
        }
        carriedBlocksGroup = null;
    }
    
    // If not carrying, we're done
    if (!isCarrying || carriedValue <= 0 || !avatar) {
        return;
    }
    
    console.log(`Creating visual for carried blocks with value ${carriedValue}, shape index ${carriedShapeIndex}`);
    
    // Create new visual group
    carriedBlocksGroup = new THREE.Group();
    
    // Calculate appropriate scale for carried blocks
    // Should be smaller than regular blocks
    const scale = 0.4;
    
    // Safely get color with fallback
    const fallbackColors = {
        1: '#FF0E17', // Red
        2: '#FF8202', // Orange
        3: '#EFD901', // Yellow 
        4: '#05BE08', // Green
        5: '#00D0EA'  // Blue
    };
    
    // Get color based on total carried value
    const blockColor = (typeof COLORS !== 'undefined' && COLORS[carriedValue]) 
        ? COLORS[carriedValue] 
        : (fallbackColors[carriedValue] || '#FFFFFF');
    
    // Generate blocks just like regular number blocks but with custom scale
    // Enhanced material for better color display
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(blockColor),
        roughness: 0.0,  // Reduced roughness for more vibrant colors
        metalness: 0.0,  // No metalness to prevent color distortion
        emissive: new THREE.Color(blockColor).multiplyScalar(0.2), // Slight emissive glow
        emissiveIntensity: 0.2  // Subtle emission to enhance colors
    });
    
    // Get shape configuration if available
    let shape = [carriedValue]; // Default to vertical stack
    if (BLOCK_SHAPES[carriedValue] && BLOCK_SHAPES[carriedValue][carriedShapeIndex]) {
        shape = BLOCK_SHAPES[carriedValue][carriedShapeIndex];
    }
    
    // Create blocks based on the shape
    const numStacks = shape.length;
    const centerOffsetX = (numStacks - 1) / 2;
    
    // For each stack in the shape
    for (let stackIndex = 0; stackIndex < numStacks; stackIndex++) {
        const stackHeight = shape[stackIndex];
        
        // Create each cube in this stack
        for (let cubeIndex = 0; cubeIndex < stackHeight; cubeIndex++) {
            const cubeMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.98, 0.98, 0.98), // Slightly smaller for shadow gaps
                blockMaterial
            );
            
            // Position horizontally based on stack index, centered
            const x = (stackIndex - centerOffsetX) * scale;
            
            // Position vertically based on cube position in stack
            const y = cubeIndex * scale + scale/2;
            
            cubeMesh.position.set(x, y, 0);
            cubeMesh.scale.set(scale, scale, scale);
            
            // Enable shadows
            cubeMesh.castShadow = true;
            cubeMesh.receiveShadow = true; // Let cubes receive shadows
            
            // Add the cube mesh to the main group
            carriedBlocksGroup.add(cubeMesh);
        }
    }
    
    // Create number sprite
    const spriteMaterial = createLocalNumberlingSprite(
        String(carriedValue),
        NUMBERLING_BG_COLOR,
        NUMBERLING_TEXT_COLOR
    );
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Find the highest stack for sprite positioning
    const maxStackHeight = Math.max(...shape);
    
    // Position sprite above the tallest stack
    sprite.position.set(0, maxStackHeight * scale + scale * 0.7, 0);
    sprite.scale.set(scale * 0.7, scale * 0.7, 1);
    carriedBlocksGroup.add(sprite);
    
    // Position the carried blocks on avatar's head
    // Get avatar height for proper positioning
    let avatarHeight = 1.5; // Default fallback height
    
    // Try to calculate actual height from bounding box
    const boundingBox = new THREE.Box3().setFromObject(avatar);
    if (boundingBox.max.y > boundingBox.min.y) {
        avatarHeight = boundingBox.max.y - boundingBox.min.y;
    }
    
    // Position carriedBlocksGroup on avatar's head - with adjusted position
    // Place blocks directly on top of the head with a slight forward offset
    const heightOffset = -1.8; // Use previous value to position blocks closer to the avatar's head
    const forwardOffset = 0.2; // Small offset to position blocks slightly forward on the head
    carriedBlocksGroup.position.set(0, avatarHeight + heightOffset, forwardOffset);
    
    // Add to avatar and store for later removal
    avatar.add(carriedBlocksGroup);
    avatar.carriedBlocksGroup = carriedBlocksGroup;
    
    console.log(`Carried visual updated - blocks in shape ${carriedShapeIndex} now visible on avatar's head`);
}

// Fallback function to create a pickup sound
function createFallbackPickupSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.3; // 300ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create an ascending tone
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        const frequency = 440 + 440 * t; // 440Hz to 880Hz sweep
        data[i] = 0.5 * Math.sin(frequency * 2 * Math.PI * t) * (1 - t); // Fade out
    }
    
    pickupSound = new THREE.Audio(audioListener);
    pickupSound.setBuffer(buffer);
    pickupSound.setVolume(0.6);
    console.log("Created fallback pickup sound");
}

// Fallback function to create a drop sound
function createFallbackDropSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.3; // 300ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a descending tone
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        const frequency = 880 - 440 * t; // 880Hz to 440Hz sweep
        data[i] = 0.5 * Math.sin(frequency * 2 * Math.PI * t) * (1 - t); // Fade out
    }
    
    dropSound = new THREE.Audio(audioListener);
    dropSound.setBuffer(buffer);
    dropSound.setVolume(0.6);
    console.log("Created fallback drop sound");
}

// Function to handle transform request when 'T' is pressed
function handleTransformRequest() {
    console.log("T KEY PRESSED - Debug: Transform action triggered");
    
    // Check if player is carrying blocks and transform them if so
    if (isCarrying && carriedValue > 0) {
        console.log(`Transforming carried block with value ${carriedValue}`);
        
        // Get the current shape index
        let currentShapeIndex = carriedShapeIndex || 0;
        
        // Calculate the next shape index
        const shapes = BLOCK_SHAPES[carriedValue];
        if (!shapes || shapes.length <= 1) {
            console.log(`Block ${carriedValue} has only one shape, cannot transform.`);
            return;
        }
        
        // Calculate next shape index
        const nextShapeIndex = (currentShapeIndex + 1) % shapes.length;
        
        // Update the carried shape index
        carriedShapeIndex = nextShapeIndex;
        
        // Update the visual of the carried block
        updateCarriedVisual();
        
        // Play transform sound
        if (transformSound && !transformSound.isPlaying) {
            transformSound.play();
        } else {
            console.warn("Transform sound not loaded or already playing");
        }
        
        console.log(`Carried block ${carriedValue} transformed to shape ${nextShapeIndex+1}/${shapes.length}`);
        
        return;
    }

    // Original logic for transforming blocks on the ground
    if (!currentTransformTarget) {
        // No valid target in range
        return;
    }
    
    const blockValue = currentTransformTarget.userData.numberValue;
    console.log(`Transforming block ${blockValue}`);
    
    // Get the current shape index if it exists
    let currentShapeIndex = currentTransformTarget.userData.shapeIndex || 0;
    
    // Calculate the next shape index
    const shapes = BLOCK_SHAPES[blockValue];
    if (!shapes || shapes.length <= 1) {
        console.log(`Block ${blockValue} has only one shape, cannot transform.`);
        return;
    }
    
    const nextShapeIndex = (currentShapeIndex + 1) % shapes.length;
    
    // Quick visual feedback that button press was registered
    flashHighlight(currentTransformTarget);
    
    // Perform transformation
    transformBlock(currentTransformTarget, nextShapeIndex);
}

// Transform a block to a different shape configuration
function transformBlock(blockGroup, newShapeIndex) {
    if (!blockGroup) return;
    
    const blockValue = blockGroup.userData.numberValue;
    const position = blockGroup.position.clone();
    
    // Get the shape configuration for this value
    const shapes = BLOCK_SHAPES[blockValue];
    if (!shapes || newShapeIndex >= shapes.length) {
        console.error(`Invalid shape index ${newShapeIndex} for block value ${blockValue}`);
        return;
    }
    
    // Reset targeting - essential to prevent infinite loop
    previouslyHighlightedBlock = null;
    currentBreakdownTarget = null;
    currentPickupTarget = null;
    currentTransformTarget = null;
    
    // Remove the original block
    removeNumberBlock(scene, blockGroup);
    
    // Create a new block with the transformed shape
    const newBlock = createTransformedBlock(blockValue, newShapeIndex, position);
    
    // Add to scene
    scene.add(newBlock);
    numberBlocks.push(newBlock);
    
    // Play transform sound
    if (transformSound && !transformSound.isPlaying) {
        transformSound.play();
    } else {
        console.warn("Transform sound not loaded or already playing");
    }
    
    console.log(`Block ${blockValue} transformed to shape ${newShapeIndex+1}/${shapes.length}`);
}

// Create a block with a specific shape configuration
function createTransformedBlock(numberValue, shapeIndex, position) {
    // Create the main group that will hold all cubes
    const group = new THREE.Group();
    
    // Set userData to track number value and shape index
    group.userData = { 
        numberValue: numberValue, 
        type: 'numberBlock',
        shapeIndex: shapeIndex
    };
    
    // Get shape configuration - array of stack heights
    const shapes = BLOCK_SHAPES[numberValue];
    const shape = shapes[shapeIndex];
    
    // Fallback color map in case COLORS is not accessible
    const fallbackColors = {
        1: '#DC143C', // Crimson (Red)
        2: '#FFA500', // Orange
        3: '#FFD700', // Gold (Yellow)
        4: '#32CD32', // LimeGreen
        5: '#00BFFF'  // DeepSkyBlue
    };
    
    // Safely get color, with fallback options
    const blockColor = (typeof COLORS !== 'undefined' && COLORS[numberValue]) 
        ? COLORS[numberValue] 
        : (fallbackColors[numberValue] || '#FFFFFF');
    
    // Create the block material based on number value
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: blockColor,
        roughness: 0.8,
        metalness: 0.1
    });
    
    // Create stacks according to the shape array
    // shape[i] represents the height of stack i
    const numStacks = shape.length;
    
    // Center the stacks horizontally
    const centerOffsetX = (numStacks - 1) / 2;
    
    // For each stack in the shape
    for (let stackIndex = 0; stackIndex < numStacks; stackIndex++) {
        const stackHeight = shape[stackIndex];
        
        // Create each cube in this stack
        for (let cubeIndex = 0; cubeIndex < stackHeight; cubeIndex++) {
            const cubeMesh = new THREE.Mesh(
                new THREE.BoxGeometry(0.98, 0.98, 0.98), // Slightly smaller for shadow gaps
                blockMaterial
            );
            
            // Position horizontally based on stack index, centered
            const x = stackIndex - centerOffsetX;
            
            // Position vertically based on cube position in stack
            const y = cubeIndex + 0.5; // +0.5 to center cube on its vertical position
            
            cubeMesh.position.set(x, y, 0);
            
            // Enable shadows
            cubeMesh.castShadow = true;
            cubeMesh.receiveShadow = true; // Let cubes receive shadows
            
            // Add the cube mesh to the main group
            group.add(cubeMesh);
        }
    }
    
    // Similar fallback for sprite background/text colors
    const bgColor = (typeof NUMBERLING_BG_COLOR !== 'undefined') ? NUMBERLING_BG_COLOR : '#FFFFFF';
    const textColor = (typeof NUMBERLING_TEXT_COLOR !== 'undefined') ? NUMBERLING_TEXT_COLOR : '#000000';
    
    // Create sprite material using local function
    const spriteMaterial = createLocalNumberlingSprite(
        String(numberValue),
        bgColor,
        textColor
    );
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Find the highest stack for sprite positioning
    const maxStackHeight = Math.max(...shape);
    
    // Position sprite above the tallest stack
    sprite.position.set(0, maxStackHeight + 0.3, 0);
    sprite.scale.set(0.7, 0.7, 1);
    group.add(sprite);
    
    // Position group at the provided location
    if (position) {
        group.position.copy(position);
    }
    
    return group;
}

// Local function to create number sprite material
function createLocalNumberlingSprite(text, bgColor = '#FFFFFF', textColor = '#000000', size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Clear background (transparent)
    context.clearRect(0, 0, size, size);
    
    // Text - larger and bolder
    context.fillStyle = textColor; 
    context.font = `900 ${size * 0.8}px Arial, sans-serif`; // Increased weight (900) and size (0.8)
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    
    // Add stroke for better visibility against any background
    context.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    context.lineWidth = size * 0.08;
    context.strokeText(text, size / 2, size / 2);
    
    // Fill text
    context.fillText(text, size / 2, size / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    return new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
}

// Initialize all audio elements
function initializeAudio() {
    // Audio Listener (FR4.2 / FR9)
    audioListener = new THREE.AudioListener();
    camera.add(audioListener); // Attach listener to camera

    // Load Click Sounds (FR4.2 / FR9.1)
    const audioLoader = new THREE.AudioLoader();
    for (let i = 1; i <= 5; i++) {
        audioLoader.load(`assets/audio/click_${i}.mp3`, function(buffer) {
            const sound = new THREE.Audio(audioListener);
            sound.setBuffer(buffer);
            sound.setVolume(0.5); // Adjust volume as needed
            clickSounds[i] = sound; // Store sound keyed by number
            console.log(`Click ${i} sound loaded.`);
        }, undefined, (error) => {
             console.error(`Error loading click_${i}.mp3:`, error);
        });
    }

    // Load Combine Sounds (add all combinations needed up to 5)
    // Example for 1+1 and 1+2
    const combinations = [ [1,1], [1,2], [2,1], [1,3], [3,1], [2,2], [1,4], [4,1], [2,3], [3,2] ];
    for (const combo of combinations) {
        const name = `combine_${combo[0]}_${combo[1]}`;
        audioLoader.load(`assets/audio/${name}.mp3`, function(buffer) {
            const sound = new THREE.Audio(audioListener);
            sound.setBuffer(buffer);
            sound.setVolume(0.6); // Slightly louder?
            combineSounds[name] = sound;
            console.log(`${name} sound loaded.`);
        }, undefined, (error) => { console.error(`Error loading ${name}.mp3:`, error); });
    }
    
    // Load the split sound effect for 5-block breakdown
    audioLoader.load(`assets/audio/split_apart.mp3`, function(buffer) {
        splitSound = new THREE.Audio(audioListener);
        splitSound.setBuffer(buffer);
        splitSound.setVolume(0.7); // Slightly louder for impact
        console.log("Split sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading split_apart.mp3:", error);
        // Create a fallback sound using AudioContext if loading fails
        createFallbackSplitSound();
    });
    
    // Load the breakdown sound effect
    audioLoader.load(`assets/audio/breakdown.mp3`, function(buffer) {
        breakdownSound = new THREE.Audio(audioListener);
        breakdownSound.setBuffer(buffer);
        breakdownSound.setVolume(0.7);
        console.log("Breakdown sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading breakdown.mp3:", error);
        // Use the same fallback as split sound if needed
        if (!splitSound) {
            createFallbackSplitSound();
            breakdownSound = splitSound;
        } else {
            // Clone the split sound for breakdown if it exists
            breakdownSound = splitSound.clone();
        }
    });
    
    // Load the transform sound effect
    audioLoader.load(`assets/audio/transform.mp3`, function(buffer) {
        transformSound = new THREE.Audio(audioListener);
        transformSound.setBuffer(buffer);
        transformSound.setVolume(0.7);
        console.log("Transform sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading transform.mp3:", error);
        // Create a fallback transform sound
        createFallbackTransformSound();
    });
    
    // Load the pickup and drop sounds
    audioLoader.load(`assets/audio/pickup.mp3`, function(buffer) {
        pickupSound = new THREE.Audio(audioListener);
        pickupSound.setBuffer(buffer);
        pickupSound.setVolume(0.6);
        console.log("Pickup sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading pickup.mp3:", error);
        // Use a simple tone for fallback
        createFallbackPickupSound();
    });
    
    audioLoader.load(`assets/audio/drop.mp3`, function(buffer) {
        dropSound = new THREE.Audio(audioListener);
        dropSound.setBuffer(buffer);
        dropSound.setVolume(0.6);
        console.log("Drop sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading drop.mp3:", error);
        // Use a simple tone for fallback
        if (pickupSound) {
            // Clone pickup sound but lower pitch for drop
            dropSound = pickupSound.clone();
            // This is a simple approximation - actual pitch adjustment would require AudioContext
        } else {
            createFallbackDropSound();
        }
    });
    
    // Load mirror sounds
    audioLoader.load(`assets/audio/mirror_processing.mp3`, function(buffer) {
        mirrorProcessingSound = new THREE.Audio(audioListener);
        mirrorProcessingSound.setBuffer(buffer);
        mirrorProcessingSound.setVolume(0.7);
        mirrorProcessingSound.setLoop(true); // This sound needs to loop during processing
        console.log("Mirror processing sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading mirror_processing.mp3:", error);
        createFallbackMirrorProcessingSound();
    });
    
    audioLoader.load(`assets/audio/mirror_success.mp3`, function(buffer) {
        mirrorSuccessSound = new THREE.Audio(audioListener);
        mirrorSuccessSound.setBuffer(buffer);
        mirrorSuccessSound.setVolume(0.7);
        console.log("Mirror success sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading mirror_success.mp3:", error);
        createFallbackMirrorSuccessSound();
    });
    
    // Load trash can sounds
    audioLoader.load(`assets/audio/trash_dispose.mp3`, function(buffer) {
        trashDisposeSound = new THREE.Audio(audioListener);
        trashDisposeSound.setBuffer(buffer);
        trashDisposeSound.setVolume(0.7);
        console.log("Trash dispose sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading trash_dispose.mp3:", error);
        createFallbackTrashDisposeSound();
    });
    
    // Load wrong match sound
    audioLoader.load(`assets/audio/wrong_match.mp3`, function(buffer) {
        wrongMatchSound = new THREE.Audio(audioListener);
        wrongMatchSound.setBuffer(buffer);
        wrongMatchSound.setVolume(0.8); // Slightly louder for emphasis
        console.log("Wrong match sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading wrong_match.mp3:", error);
        // Create a fallback sound if loading fails
        createFallbackWrongMatchSound();
    });
    
    // Load wall click sound
    audioLoader.load(`assets/audio/mauer.mp3`, function(buffer) {
        wallClickSound = new THREE.Audio(audioListener);
        wallClickSound.setBuffer(buffer);
        wallClickSound.setVolume(0.7);
        console.log("Wall click sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading mauer.mp3:", error);
        // Use a similar click sound as fallback if needed
        if (clickSounds[1]) {
            wallClickSound = clickSounds[1].clone();
        }
    });
    
    // Load avatar click sound
    audioLoader.load(`assets/audio/click_avatar.mp3`, function(buffer) {
        avatarClickSound = new THREE.Audio(audioListener);
        avatarClickSound.setBuffer(buffer);
        avatarClickSound.setVolume(0.7);
        console.log("Avatar click sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading click_avatar.mp3:", error);
        createFallbackAvatarClickSound();
    });
    
    // Load mirror click sound
    audioLoader.load(`assets/audio/spiegel.mp3`, function(buffer) {
        mirrorClickSound = new THREE.Audio(audioListener);
        mirrorClickSound.setBuffer(buffer);
        mirrorClickSound.setVolume(0.7);
        console.log("Mirror click sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading spiegel.mp3:", error);
        // Use a fallback sound if loading fails
        if (avatarClickSound) {
            mirrorClickSound = avatarClickSound.clone();
        } else {
            createFallbackMirrorClickSound();
        }
    });
    
    // Load trash can click sound
    audioLoader.load(`assets/audio/mülltonne.mp3`, function(buffer) {
        trashCanClickSound = new THREE.Audio(audioListener);
        trashCanClickSound.setBuffer(buffer);
        trashCanClickSound.setVolume(0.7);
        console.log("Trash can click sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading mülltonne.mp3:", error);
        // Use a fallback sound if loading fails
        if (avatarClickSound) {
            trashCanClickSound = avatarClickSound.clone();
        } else {
            createFallbackTrashCanClickSound();
        }
    });
    
    // Load fanfare sound for wall completion
    audioLoader.load(`assets/audio/fanfare.mp3`, function(buffer) {
        fanfareSound = new THREE.Audio(audioListener);
        fanfareSound.setBuffer(buffer);
        fanfareSound.setVolume(0.8); // Slightly louder for celebration
        console.log("Fanfare sound loaded successfully");
    }, undefined, (error) => {
        console.error("Error loading fanfare.mp3:", error);
        // Create a fallback sound if loading fails
        createFallbackFanfareSound();
    });
}

// Create fallback sounds for mirror effects
function createFallbackMirrorProcessingSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 1.0; // 1 second buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a magical humming sound
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        // Combine multiple frequencies for a magical shimmer effect
        const frequency1 = 440 + 220 * Math.sin(t * Math.PI * 2 * 0.5);
        const frequency2 = 880 + 110 * Math.sin(t * Math.PI * 2 * 0.3);
        data[i] = 0.2 * Math.sin(frequency1 * 2 * Math.PI * t) + 
                 0.1 * Math.sin(frequency2 * 2 * Math.PI * t);
    }
    
    mirrorProcessingSound = new THREE.Audio(audioListener);
    mirrorProcessingSound.setBuffer(buffer);
    mirrorProcessingSound.setVolume(0.6);
    mirrorProcessingSound.setLoop(true);
    console.log("Created fallback mirror processing sound");
}

function createFallbackMirrorSuccessSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.5; // Half second buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create an ascending chime sound
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        // Ascending frequencies for magical chime
        const frequency = 440 + 880 * t;
        // Amplitude envelope for clean fadeout
        const amplitude = 0.5 * (1 - t) * Math.sin(t * Math.PI * 10); 
        data[i] = amplitude * Math.sin(frequency * 2 * Math.PI * t);
    }
    
    mirrorSuccessSound = new THREE.Audio(audioListener);
    mirrorSuccessSound.setBuffer(buffer);
    mirrorSuccessSound.setVolume(0.7);
    console.log("Created fallback mirror success sound");
}

// Create fallback trash dispose sound
function createFallbackTrashDisposeSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.6; // 600ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a 'trash' sound - rustling with some low frequency components
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        
        // Mix of noise and low frequency tone
        const noise = (Math.random() * 2 - 1) * 0.3 * (1 - t);
        const lowTone = Math.sin(120 * Math.PI * t) * 0.4 * (0.1 + 0.9 * (1 - t*t));
        
        // Add a 'thud' sound at the end
        const thud = (t > 0.7) ? Math.sin(80 * Math.PI * t) * 0.5 * Math.pow((t - 0.7) / 0.3, 0.5) * (1 - Math.pow((t - 0.7) / 0.3, 2)) : 0;
        
        data[i] = noise + lowTone + thud;
    }
    
    trashDisposeSound = new THREE.Audio(audioListener);
    trashDisposeSound.setBuffer(buffer);
    trashDisposeSound.setVolume(0.7);
    console.log("Created fallback trash dispose sound");
}

// Create fallback transform sound
function createFallbackTransformSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.5; // 500ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a 'transform' sound - a morphing sweep with some sparkle
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        
        // Sweeping frequency from low to high and back
        const sweepFreq = 200 + 400 * Math.sin(t * Math.PI); 
        const sweep = Math.sin(sweepFreq * t * Math.PI * 2) * 0.3 * (1 - 0.7 * t);
        
        // Add some randomness for sparkle effect
        const sparkle = (Math.random() * 2 - 1) * 0.1 * t * (1 - t);
        
        // Combine the sounds
        data[i] = sweep + sparkle;
    }
    
    transformSound = new THREE.Audio(audioListener);
    transformSound.setBuffer(buffer);
    transformSound.setVolume(0.7);
    console.log("Created fallback transform sound");
}

// Create fallback avatar click sound
function createFallbackAvatarClickSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.3; // 300ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a fun 'boing' sound for avatar
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        
        // Start with higher frequency and decrease
        const freq = 500 - 300 * t;
        const amplitude = 0.7 * (1 - t); // Fade out
        
        // Create a funny sound
        data[i] = amplitude * Math.sin(freq * t * Math.PI * 2);
        
        // Add some randomness for texture
        if (t > 0.1) {
            data[i] += (Math.random() * 2 - 1) * 0.05 * (1 - t);
        }
    }
    
    avatarClickSound = new THREE.Audio(audioListener);
    avatarClickSound.setBuffer(buffer);
    avatarClickSound.setVolume(0.7);
    console.log("Created fallback avatar click sound");
}

// Request mirror duplication and start effects
function requestMirrorDuplication() {
    if (!mirrorObject || !isCarrying || mirrorIsBusy) {
        return;
    }
    
    // Get the current carried value for duplication
    const valueToDuplicate = carriedValue;
    const shapeToDuplicate = carriedShapeIndex;
    
    // Validate that we're duplicating a valid block (1-5)
    if (valueToDuplicate < 1 || valueToDuplicate > 5) {
        console.log("Mirror can only duplicate blocks with values 1 through 5");
        return;
    }
    
    // Set mirror as busy
    mirrorIsBusy = true;
    
    // Clear the carried blocks (immediate feedback)
    isCarrying = false;
    carriedValue = 0;
    carriedShapeIndex = 0;
    updateCarriedVisual();
    
    // Start mirror processing effect
    startMirrorEffect();
    
    // Schedule mirror completion after processing duration
    setTimeout(() => {
        completeMirrorDuplication(valueToDuplicate, shapeToDuplicate);
    }, MIRROR_PROCESS_DURATION);
}

// Start mirror visual and audio effects
function startMirrorEffect() {
    console.log("Starting mirror effect");
    
    // Play processing sound
    if (mirrorProcessingSound && !mirrorProcessingSound.isPlaying) {
        mirrorProcessingSound.play();
    }
    
    // Setup visual effect - pulsing glow
    setupMirrorGlowEffect();
}

// Stop mirror visual and audio effects
function stopMirrorEffect() {
    console.log("Stopping mirror effect");
    
    // Stop processing sound
    if (mirrorProcessingSound && mirrorProcessingSound.isPlaying) {
        mirrorProcessingSound.stop();
    }
    
    // Reset mirror visuals
    mirrorObject.traverse(child => {
        if (child.isMesh) {
            child.material.emissive.setHex(0x000000);
        }
    });
    
    // Clear any animation timers
    if (window.mirrorAnimationId) {
        cancelAnimationFrame(window.mirrorAnimationId);
        window.mirrorAnimationId = null;
    }
}

// Setup the mirror visual glow effect
function setupMirrorGlowEffect() {
    const startTime = Date.now();
    
    // Animation function for pulsing glow
    function animateMirrorGlow() {
        // Check if mirror is still busy
        if (!mirrorIsBusy) return;
        
        const elapsed = Date.now() - startTime;
        const progress = elapsed / MIRROR_PROCESS_DURATION;
        
        // Enhanced pulsing magical glow effect
        mirrorObject.traverse(child => {
            if (child.isMesh) {
                // More dynamic color changes based on progress
                const phase = progress * Math.PI * 15; // Faster oscillation
                
                // Create shifting color effect (blue to purple to cyan)
                const r = 0.1 + 0.2 * Math.sin(phase + 2);
                const g = 0.1 + 0.1 * Math.sin(phase + 4);
                const b = 0.5 + 0.4 * Math.sin(phase);
                
                const color = new THREE.Color(r, g, b);
                child.material.emissive.copy(color);
                
                // Increase intensity as process continues
                const baseIntensity = 0.6 + progress * 0.4; // Gradually gets more intense
                child.material.emissiveIntensity = baseIntensity + 0.2 * Math.sin(phase * 2);
            }
        });
        
        // Continue animation if still processing
        if (progress < 1.0) {
            window.mirrorAnimationId = requestAnimationFrame(animateMirrorGlow);
        }
    }
    
    // Start animation
    animateMirrorGlow();
}

// Complete the mirror duplication
function completeMirrorDuplication(valueToDuplicate, shapeToDuplicate) {
    // Free up the mirror
    mirrorIsBusy = false;
    
    // Stop effects
    stopMirrorEffect();
    
    // Play success sound
    if (mirrorSuccessSound && !mirrorSuccessSound.isPlaying) {
        mirrorSuccessSound.play();
    } else {
        console.warn("Mirror success sound not loaded or already playing");
    }
    
    // Calculate two spawn positions (left and right of mirror)
    const spawnPositions = [
        calculateSpawnPositionNearMirror(mirrorObject.position, 1, valueToDuplicate),
        calculateSpawnPositionNearMirror(mirrorObject.position, 2, valueToDuplicate)
    ];
    
    // Create duplicated blocks
    spawnPositions.forEach((position, index) => {
        // Create a block with the same shape as the original
        const duplicatedBlock = createTransformedBlock(valueToDuplicate, shapeToDuplicate, position);
        
        // Add to scene and tracking array
        scene.add(duplicatedBlock);
        numberBlocks.push(duplicatedBlock);
        
        // Apply spawn animation and effects
        createMirrorSuccessParticles(position);
        applySpawnEffect(duplicatedBlock);
        
        console.log(`Created duplicate ${index+1} at position ${position.x.toFixed(2)}, ${position.z.toFixed(2)}`);
    });
    
    console.log(`Mirror successfully duplicated a block with value ${valueToDuplicate} and shape ${shapeToDuplicate}`);
}

// Create magical particles burst effect when mirror duplication succeeds
function createMirrorSuccessParticles(position) {
    const particleCount = 50;
    const particles = [];
    
    // Various colors for magical effect
    const colors = [
        0x4444ff, // Blue
        0x8844ff, // Purple
        0x44ffff, // Cyan
        0xffffff  // White
    ];
    
    // Create particle geometries of different sizes
    const particleGeometries = [
        new THREE.SphereGeometry(0.08, 8, 8),
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.SphereGeometry(0.03, 8, 8)
    ];
    
    // Create particles and add to scene
    for (let i = 0; i < particleCount; i++) {
        // Randomly select geometry and color
        const geomIndex = Math.floor(Math.random() * particleGeometries.length);
        const colorIndex = Math.floor(Math.random() * colors.length);
        
        const particleMaterial = new THREE.MeshBasicMaterial({ 
            color: colors[colorIndex],
            emissive: colors[colorIndex],
            emissiveIntensity: 1,
            transparent: true,
            opacity: 0.8
        });
        
        const particle = new THREE.Mesh(particleGeometries[geomIndex], particleMaterial);
        
        // Position at mirror with slight offset
        particle.position.copy(position);
        particle.position.y += 2 + Math.random() * 2; // Higher up for better visibility
        
        // Random velocity in all directions (burst pattern)
        const speed = 0.03 + Math.random() * 0.07;
        const angle = Math.random() * Math.PI * 2;
        const elevation = (Math.random() - 0.5) * Math.PI;
        
        const velocity = new THREE.Vector3(
            Math.cos(angle) * Math.cos(elevation) * speed,
            Math.sin(elevation) * speed + 0.02, // Bias upward
            Math.sin(angle) * Math.cos(elevation) * speed
        );
        
        // Add to scene and track
        scene.add(particle);
        particles.push({
            mesh: particle,
            velocity: velocity,
            life: 1.0  // Full life to start
        });
    }
    
    // Animation function for particles
    function animateParticles() {
        let anyAlive = false;
        
        // Update each particle
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Decrease life
            p.life -= 0.015;
            
            if (p.life > 0) {
                anyAlive = true;
                
                // Update position
                p.mesh.position.add(p.velocity);
                
                // Update opacity based on life
                p.mesh.material.opacity = p.life * 0.8;
                
                // Add gravity effect
                p.velocity.y -= 0.001;
            } else {
                // Remove dead particles
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
            }
        }
        
        // Continue animation if any particles still alive
        if (anyAlive) {
            requestAnimationFrame(animateParticles);
        }
    }
    
    // Start animation
    animateParticles();
}

// Apply a special spawn effect to newly created blocks
function applySpawnEffect(block) {
    if (!block) return;
    
    // Start with scaled down and expand
    block.scale.set(0.01, 0.01, 0.01);
    
    // Store original position for bounce effect
    const originalY = block.position.y;
    
    // Animation variables
    const duration = 800; // ms
    const startTime = Date.now();
    
    function animateSpawn() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1.0);
        
        if (progress < 1.0) {
            // Scale up with easing
            const scale = easeOutBack(progress);
            block.scale.set(scale, scale, scale);
            
            // Add a small bounce
            const bounce = Math.sin(progress * Math.PI * 2) * 0.2 * (1 - progress);
            block.position.y = originalY + bounce;
            
            // Continue animation
            requestAnimationFrame(animateSpawn);
        } else {
            // Ensure final state is correct
            block.scale.set(1, 1, 1);
            block.position.y = originalY;
        }
    }
    
    // Start animation
    animateSpawn();
}

// Custom easing function for animations
function easeOutBack(x) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

// Calculate spawn position near mirror
function calculateSpawnPositionNearMirror(mirrorPos, index, blockValue = 1) {
    // Get mirror's forward direction (assuming it faces along negative Z)
    const mirrorForward = new THREE.Vector3(0, 0, -1);
    mirrorForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), mirrorObject.rotation.y);
    
    // Get mirror's right direction (perpendicular to forward)
    const mirrorRight = new THREE.Vector3(1, 0, 0);
    mirrorRight.applyAxisAngle(new THREE.Vector3(0, 1, 0), mirrorObject.rotation.y);
    
    const spawnPos = mirrorPos.clone();
    
    // Adjust spacing based on block value - larger blocks need more space
    // Use smaller offsets to keep blocks within boundaries
    const sideOffset = 2.0 + (blockValue * 0.25); // Reduced spacing
    const forwardOffset = 1.5 + (blockValue * 0.2); // Slightly reduced forward offset
    
    if (index === 1) {
        // Position on the right side of the mirror
        spawnPos.add(mirrorRight.clone().multiplyScalar(sideOffset));
        // Slightly forward of the mirror
        spawnPos.add(mirrorForward.clone().multiplyScalar(forwardOffset));
    } else {
        // Position on the left side of the mirror
        spawnPos.add(mirrorRight.clone().multiplyScalar(-sideOffset));
        // Slightly forward of the mirror
        spawnPos.add(mirrorForward.clone().multiplyScalar(forwardOffset));
    }
    
    // Ensure y-position is at ground level
    spawnPos.y = 0;
    
    // Ensure the spawn position is always within boundaries
    spawnPos.x = Math.max(boundaryMin + 1, Math.min(boundaryMax - 1, spawnPos.x));
    spawnPos.z = Math.max(boundaryMin + 1, Math.min(boundaryMax - 1, spawnPos.z));
    
    return spawnPos;
}

// Dispose blocks in the trash can
function disposeInTrashCan() {
    if (!isCarrying || carriedValue <= 0) return;
    
    // Store the value being disposed for logging
    const disposedValue = carriedValue;
    const disposedShape = carriedShapeIndex;
    
    // Create a copy of the carried blocks for the animation
    const disposalGroup = new THREE.Group();
    scene.add(disposalGroup);
    
    // Clone the appearance of carried blocks
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(COLORS[carriedValue] || '#FFFFFF'),
        roughness: 0.8,
        metalness: 0.1
    });
    
    // Get shape configuration if available
    let shape = [carriedValue]; // Default to vertical stack
    if (BLOCK_SHAPES[carriedValue] && BLOCK_SHAPES[carriedValue][carriedShapeIndex]) {
        shape = BLOCK_SHAPES[carriedValue][carriedShapeIndex];
    }
    
    // Create blocks based on the shape
    const numStacks = shape.length;
    const centerOffsetX = (numStacks - 1) / 2;
    const cubeSize = 0.48; // Slightly smaller for shadow gaps (already at 0.5 scale)
    
    // For each stack in the shape
    for (let stackIndex = 0; stackIndex < numStacks; stackIndex++) {
        const stackHeight = shape[stackIndex];
        
        // Create each cube in this stack
        for (let cubeIndex = 0; cubeIndex < stackHeight; cubeIndex++) {
            const cubeMesh = new THREE.Mesh(
                new THREE.BoxGeometry(cubeSize, cubeSize, cubeSize),
                blockMaterial
            );
            
            // Position horizontally based on stack index, centered
            const x = (stackIndex - centerOffsetX) * cubeSize;
            
            // Position vertically based on cube position in stack
            const y = cubeIndex * cubeSize + cubeSize/2;
            
            cubeMesh.position.set(x, y, 0);
            
            // Enable shadows
            cubeMesh.castShadow = true;
            cubeMesh.receiveShadow = true;
            
            // Add the cube mesh to the main group
            disposalGroup.add(cubeMesh);
        }
    }
    
    // Position the disposal group above the trash can
    disposalGroup.position.copy(trashCanObject.position);
    disposalGroup.position.y = 2.5; // Start above the trash can
    
    // Reset carried state
    isCarrying = false;
    carriedValue = 0;
    carriedShapeIndex = 0;
    
    // Update visual representation (removes blocks from avatar's head)
    updateCarriedVisual();
    
    // Animate the blocks falling into the trash
    const startTime = Date.now();
    const animationDuration = 500; // ms
    
    function animateDisposal() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / animationDuration, 1.0);
        
        if (progress < 1.0) {
            // Fall and rotate
            disposalGroup.position.y = 2.5 - (2.5 * progress);
            disposalGroup.rotation.z = progress * Math.PI * 0.5; // Rotate as it falls
            
            requestAnimationFrame(animateDisposal);
        } else {
            // Animation complete, play sound and show effect
            if (trashDisposeSound && !trashDisposeSound.isPlaying) {
                trashDisposeSound.play();
            } else {
                console.warn("Trash dispose sound not loaded or already playing");
            }
            
            // Create visual effect
            createTrashDisposeEffect(trashCanObject.position.clone());
            
            // Remove the disposal group
            scene.remove(disposalGroup);
            
            console.log(`Disposed of block with value ${disposedValue} and shape ${disposedShape} in the trash can`);
        }
    }
    
    // Start the animation
    animateDisposal();
}

// Create a visual effect when blocks are disposed of in the trash can
function createTrashDisposeEffect(position) {
    // Create a small dust cloud effect
    const particleCount = 20;
    const particles = [];
    
    // Create particle geometries
    const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xCCCCCC, // Gray dust
        transparent: true,
        opacity: 0.6
    });
    
    // Create particles and add to scene
    for (let i = 0; i < particleCount; i++) {
        const particle = new THREE.Mesh(particleGeometry, particleMaterial);
        
        // Position at the top of the trash can
        particle.position.copy(position);
        particle.position.y += 1.5; // Position at top of trash can
        
        // Random velocity upward and outward
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.01 + Math.random() * 0.02;
        const velocity = new THREE.Vector3(
            Math.cos(angle) * speed,
            0.02 + Math.random() * 0.02, // Upward
            Math.sin(angle) * speed
        );
        
        // Add to scene and track
        scene.add(particle);
        particles.push({
            mesh: particle,
            velocity: velocity,
            life: 1.0 // Full life to start
        });
    }
    
    // Animation function for particles
    function animateParticles() {
        let anyAlive = false;
        
        // Update each particle
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Decrease life
            p.life -= 0.025;
            
            if (p.life > 0) {
                anyAlive = true;
                
                // Update position
                p.mesh.position.add(p.velocity);
                
                // Update opacity based on life
                p.mesh.material.opacity = p.life * 0.6;
                
                // Add gravity effect
                p.velocity.y -= 0.001;
            } else {
                // Remove dead particles
                scene.remove(p.mesh);
                p.mesh.geometry.dispose();
                p.mesh.material.dispose();
            }
        }
        
        // Continue animation if any particles still alive
        if (anyAlive) {
            requestAnimationFrame(animateParticles);
        }
    }
    
    // Start animation
    animateParticles();
}

// Handle avatar click
function handleAvatarClick() {
    console.log('Avatar clicked!');
    
    // Play avatar click sound
    if (avatarClickSound && !avatarClickSound.isPlaying) {
        avatarClickSound.play();
    } else {
        console.warn("Avatar click sound not loaded or already playing");
    }
}

// Create fallback mirror click sound
function createFallbackMirrorClickSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.3; // 300ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a magical shimmer sound
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        
        // High-pitched sound with some sparkle
        const baseFreq = 800 + 400 * Math.sin(t * Math.PI * 6);
        const shimmer = Math.sin(baseFreq * t * Math.PI * 2) * 0.5 * (1 - t);
        
        // Add a bit of randomness for texture
        const sparkle = (Math.random() * 2 - 1) * 0.1 * Math.sin(t * Math.PI);
        
        data[i] = shimmer + sparkle;
    }
    
    mirrorClickSound = new THREE.Audio(audioListener);
    mirrorClickSound.setBuffer(buffer);
    mirrorClickSound.setVolume(0.7);
    console.log("Created fallback mirror click sound");
}

// Create fallback trash can click sound
function createFallbackTrashCanClickSound() {
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.3; // 300ms buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a hollow "clunk" sound for trash can
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        
        // Low frequency "clunk"
        const baseFreq = 150;
        const clunk = Math.sin(baseFreq * t * Math.PI * 2) * 0.6 * Math.exp(-10 * t);
        
        // Add a bit of metal resonance
        const resonance = Math.sin(baseFreq * 3 * t * Math.PI * 2) * 0.2 * Math.exp(-5 * t);
        
        data[i] = clunk + resonance;
    }
    
    trashCanClickSound = new THREE.Audio(audioListener);
    trashCanClickSound.setBuffer(buffer);
    trashCanClickSound.setVolume(0.7);
    console.log("Created fallback trash can click sound");
}

// Handle mirror click
function handleMirrorClick() {
    console.log('Mirror clicked!');
    
    // Play mirror click sound
    if (mirrorClickSound && !mirrorClickSound.isPlaying) {
        mirrorClickSound.play();
    } else {
        console.warn("Mirror click sound not loaded or already playing");
    }
}

// Handle trash can click
function handleTrashCanClick() {
    console.log('Trash can clicked!');
    
    // Play trash can click sound
    if (trashCanClickSound && !trashCanClickSound.isPlaying) {
        trashCanClickSound.play();
    } else {
        console.warn("Trash can click sound not loaded or already playing");
    }
}

// Function to reset player's carry state (called when server confirms match success)
function resetCarryState() {
    console.log('Resetting carry state based on server confirmation');
    
    // Reset carried state
    isCarrying = false;
    carriedValue = 0;
    carriedShapeIndex = 0;
    
    // Update visual representation
    updateCarriedVisual();
    
    // Play drop sound for audio feedback
    if (dropSound && !dropSound.isPlaying) {
        dropSound.play();
    }
}

// Function to play wrong match sound
function playWrongMatchSound() {
    console.log('Playing wrong match sound');
    
    if (wrongMatchSound && !wrongMatchSound.isPlaying) {
        wrongMatchSound.play();
    } else {
        console.warn('Wrong match sound not loaded or already playing');
        // Only create fallback if the sound wasn't loaded correctly
        if (!wrongMatchSound) {
            createFallbackWrongMatchSound();
            if (wrongMatchSound) wrongMatchSound.play();
        }
    }
}

// Function to create a fallback wrong match sound
function createFallbackWrongMatchSound() {
    // Create a simple audio buffer with error sound
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 0.5; // Half-second buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a descending error tone
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        const freq = 440 * (1 - t); // Descending pitch
        data[i] = 0.5 * Math.sin(freq * 2 * Math.PI * t * 10) * (1 - t);
    }
    
    // Create sound from buffer
    wrongMatchSound = new THREE.Audio(audioListener);
    wrongMatchSound.setBuffer(buffer);
    wrongMatchSound.setVolume(0.7);
    console.log("Created fallback wrong match sound");
}

// Function to play fanfare sound for successful wall match
function playFanfareSound() {
    console.log('Playing fanfare celebration sound');
    
    if (fanfareSound && !fanfareSound.isPlaying) {
        fanfareSound.play();
    } else {
        console.warn('Fanfare sound not loaded or already playing');
        // Create fallback sound if needed
        createFallbackFanfareSound();
        if (fanfareSound) fanfareSound.play();
    }
}

// Function to create a fallback fanfare sound
function createFallbackFanfareSound() {
    // Create a simple audio buffer with celebratory sound
    const audioContext = audioListener.context;
    const bufferLength = audioContext.sampleRate * 1.0; // One second buffer
    const buffer = audioContext.createBuffer(1, bufferLength, audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Create a triumphant rising tone
    for (let i = 0; i < bufferLength; i++) {
        const t = i / bufferLength;
        
        // Rising frequency for fanfare effect
        const freq = 220 + 440 * t; // Rising pitch
        
        // Add some modulation for a more interesting sound
        const vibrato = Math.sin(t * 2 * Math.PI * 10) * 0.1;
        const amplitude = 0.5 * (1 - Math.pow(t - 0.5, 2) * 4); // Envelope shape
        
        data[i] = amplitude * Math.sin((freq + vibrato) * 2 * Math.PI * t);
    }
    
    // Create sound from buffer
    fanfareSound = new THREE.Audio(audioListener);
    fanfareSound.setBuffer(buffer);
    fanfareSound.setVolume(0.8);
    console.log("Created fallback fanfare sound");
}

// Confetti celebration for successful wall match
function startConfettiCelebration() {
    // Set the celebration flag
    isCelebrating = true;
    
    // Create a canvas for the confetti if it doesn't exist
    if (!celebrationConfetti) {
        celebrationConfetti = document.createElement('canvas');
        celebrationConfetti.id = 'celebration-canvas';
        celebrationConfetti.style.position = 'fixed';
        celebrationConfetti.style.top = '0';
        celebrationConfetti.style.left = '0';
        celebrationConfetti.style.width = '100%';
        celebrationConfetti.style.height = '100%';
        celebrationConfetti.style.pointerEvents = 'none'; // Don't interfere with user interactions
        celebrationConfetti.style.zIndex = '1000';
        document.body.appendChild(celebrationConfetti);
        
        // Set canvas size
        celebrationConfetti.width = window.innerWidth;
        celebrationConfetti.height = window.innerHeight;
    } else {
        // Reset and show the canvas
        celebrationConfetti.style.display = 'block';
    }
    
    // Draw the wall as solid (no hole)
    updateWallAppearance(0);
    
    // Start flashing the wall (alternating between normal and highlighted)
    let isWallHighlighted = false;
    const flashInterval = setInterval(() => {
        if (!isCelebrating) {
            clearInterval(flashInterval);
            return;
        }
        
        // Make the wall flash by toggling its emissive property
        if (wallStructure) {
            wallStructure.traverse(child => {
                if (child.isMesh && child.material) {
                    if (isWallHighlighted) {
                        // Return to normal color
                        child.material.emissive.setHex(0x000000);
                        child.material.emissiveIntensity = 0;
                    } else {
                        // Set to highlight color
                        child.material.emissive.setHex(0x33FF33); // Bright green glow
                        child.material.emissiveIntensity = 0.7;
                    }
                }
            });
        }
        
        isWallHighlighted = !isWallHighlighted;
    }, 300); // Flash every 300ms for a good visual effect
    
    // Start the confetti animation
    startConfetti();
    
    // Schedule the end of the celebration
    if (celebrationTimer) clearTimeout(celebrationTimer);
    celebrationTimer = setTimeout(() => {
        clearInterval(flashInterval); // Make sure to clear the flashing interval
        endCelebration();
    }, 3000); // 3 second celebration
}

// End the celebration and apply any pending updates
function endCelebration() {
    // Stop the confetti
    stopConfetti();
    
    // Hide the canvas
    if (celebrationConfetti) {
        celebrationConfetti.style.display = 'none';
    }
    
    // Reset the wall's appearance - return to normal non-glowing state
    if (wallStructure) {
        wallStructure.traverse(child => {
            if (child.isMesh && child.material) {
                child.material.emissive.setHex(0x000000);
                child.material.emissiveIntensity = 0;
            }
        });
    }
    
    // Reset the celebration flag
    isCelebrating = false;
    
    // Apply any pending wall update
    if (pendingWallUpdate) {
        const { targetShape, shapeIndex } = pendingWallUpdate;
        pendingWallUpdate = null;
        
        // Apply the update after a small delay to ensure smooth transition
        setTimeout(() => {
            updateWallHole(targetShape, shapeIndex);
        }, 100);
    }
}

// Simple confetti implementation
let confettiContext;
let confettiParticles = [];
let confettiAnimationId;

function startConfetti() {
    if (!celebrationConfetti) return;
    
    // Get the context and clear it
    confettiContext = celebrationConfetti.getContext('2d');
    confettiContext.clearRect(0, 0, celebrationConfetti.width, celebrationConfetti.height);
    
    // Create particles
    confettiParticles = [];
    for (let i = 0; i < 150; i++) {
        confettiParticles.push({
            x: Math.random() * celebrationConfetti.width,
            y: Math.random() * -celebrationConfetti.height,
            size: Math.random() * 10 + 5,
            color: `rgb(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255})`,
            speed: Math.random() * 3 + 2
        });
    }
    
    // Start animation
    animateConfetti();
}

function animateConfetti() {
    if (!confettiContext || !celebrationConfetti) return;
    
    // Clear canvas
    confettiContext.clearRect(0, 0, celebrationConfetti.width, celebrationConfetti.height);
    
    // Update and draw particles
    for (let i = 0; i < confettiParticles.length; i++) {
        const p = confettiParticles[i];
        
        // Move particle
        p.y += p.speed;
        
        // Recycle particles that are off-screen
        if (p.y > celebrationConfetti.height) {
            confettiParticles[i].y = Math.random() * -celebrationConfetti.height;
            confettiParticles[i].x = Math.random() * celebrationConfetti.width;
        }
        
        // Draw particle
        confettiContext.beginPath();
        confettiContext.fillStyle = p.color;
        confettiContext.rect(p.x, p.y, p.size, p.size);
        confettiContext.fill();
    }
    
    // Continue animation loop
    confettiAnimationId = requestAnimationFrame(animateConfetti);
}

function stopConfetti() {
    if (confettiAnimationId) {
        cancelAnimationFrame(confettiAnimationId);
        confettiAnimationId = null;
    }
    
    if (confettiContext && celebrationConfetti) {
        confettiContext.clearRect(0, 0, celebrationConfetti.width, celebrationConfetti.height);
    }
}

// Handle window resize for confetti canvas
window.addEventListener('resize', () => {
    if (celebrationConfetti) {
        celebrationConfetti.width = window.innerWidth;
        celebrationConfetti.height = window.innerHeight;
    }
});

// Function to spawn a new block of value 1 after a successful wall match
function spawnNewBlockAfterCelebration() {
    console.log('Spawning new block after celebration');
    
    // Calculate a position in front of the player
    let spawnPosition;
    
    if (avatar) {
        // Calculate position in front of the avatar
        const forwardVector = new THREE.Vector3(0, 0, -1);
        forwardVector.applyAxisAngle(new THREE.Vector3(0, 1, 0), avatar.rotation.y);
        forwardVector.multiplyScalar(2); // 2 units in front of avatar
        
        spawnPosition = new THREE.Vector3();
        spawnPosition.copy(avatar.position).add(forwardVector);
        spawnPosition.y = 0; // At ground level
    } else {
        // Use default position if avatar not available
        spawnPosition = new THREE.Vector3(-2, 0, -3);
    }
    
    // Apply a small random offset to avoid overlapping with other blocks
    spawnPosition.x += (Math.random() - 0.5) * 0.5;
    spawnPosition.z += (Math.random() - 0.5) * 0.5;
    
    // Create and add a new block with value 1
    const newBlock = createTransformedBlock(1, 0, spawnPosition);
    scene.add(newBlock);
    numberBlocks.push(newBlock);
    
    // Apply spawn effect for visual feedback
    applySpawnEffect(newBlock);
    
    console.log(`New block of value 1 spawned at position ${spawnPosition.x.toFixed(2)}, ${spawnPosition.z.toFixed(2)}`);
}

// Function to handle wall click
function handleWallClick() {
    console.log('Wall clicked');
    
    // Play wall click sound
    if (wallClickSound && !wallClickSound.isPlaying) {
        wallClickSound.play();
    } else {
        console.warn('Wall click sound not loaded or already playing');
    }
}

// Initialize the scene
init();
