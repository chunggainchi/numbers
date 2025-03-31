import * as THREE from 'three';

const numberBlocks = []; // Array to hold spawned blocks

// Boundaries and spawning config
const boundaryMin = -10;
const boundaryMax = 10;
const blockSize = 1.0; // Use a standard size for the cube base

// --- Color Definitions (From User Prompt) ---
const COLORS = {
    1: '#FF0E17', // Red
    2: '#FF8202', // Orange
    3: '#EFD901', // Yellow
    4: '#05BE08', // Green
    5: '#00D0EA'  // Blue
};
const NUMBERLING_BG_COLOR = '#FFFFFF';
const NUMBERLING_TEXT_COLOR = '#000000';
// ---

// --- Canvas Sprite Number Creation --- 
function createNumberlingSpriteMaterial(text, bgColor = '#FFFFFF', textColor = '#000000', size = 64) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');

    // Clear background (transparent)
    context.clearRect(0, 0, size, size);
    
    // Text - larger and bolder
    context.fillStyle = textColor; 
    context.font = `900 ${size * 0.8}px Arial, sans-serif`; // Adjusted size to 0.8 for better proportion
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

    // Material using the texture
    return new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
}
// --- End Canvas Sprite --- 

// Slightly smaller cube to allow for shadow gaps
const blockGeometry = new THREE.BoxGeometry(0.98, 0.98, 0.98);

// Spawns a Numberblock character as a Group
function spawnNumberBlock(scene, numberValue, position = null) {
    // Main container group
    const group = new THREE.Group();
    
    // Set basic user data
    group.userData = { 
        numberValue: numberValue, 
        type: 'numberBlock',
        shapeIndex: 0 // Default shape (vertical stack)
    };
    
    // Get the color for this number value
    const colorHex = COLORS[numberValue] || '#FFFFFF';
    
    // Create material with enhanced properties for better color display
    const blockMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.3, // Reduced roughness for more vibrant colors
        metalness: 0.0, // No metalness to prevent color distortion
        emissive: new THREE.Color(colorHex).multiplyScalar(0.2), // Slight emissive glow
        emissiveIntensity: 0.2 // Subtle emission to enhance colors
    });

    // Stack individual 1x1x1 cubes
    for (let i = 0; i < numberValue; i++) {
        // Create a standard 1x1x1 cube mesh
        const cubeMesh = new THREE.Mesh(blockGeometry, blockMaterial);
        
        // Position in stack: first cube center at y=0.5, second at y=1.5, etc.
        cubeMesh.position.set(0, i + 0.5, 0);
        
        // Enable shadows
        cubeMesh.castShadow = true;
        cubeMesh.receiveShadow = true; // Let cubes receive shadows from blocks above
        
        // Add cube to the group
        group.add(cubeMesh);
    }

    // Create Numberling Sprite
    const spriteMaterial = createNumberlingSpriteMaterial(String(numberValue), NUMBERLING_BG_COLOR, NUMBERLING_TEXT_COLOR);
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // Position sprite above the top cube
    sprite.position.set(0, numberValue + 0.3, 0);
    sprite.scale.set(0.7, 0.7, 1);
    group.add(sprite);

    // Position the entire group
    if (position) {
        group.position.copy(position);
        group.position.y = 0; // Ensure base is at ground level
    } else {
        const randomX = THREE.MathUtils.randFloat(boundaryMin, boundaryMax);
        const randomZ = THREE.MathUtils.randFloat(boundaryMin, boundaryMax);
        group.position.set(randomX, 0, randomZ);
    }

    scene.add(group);
    numberBlocks.push(group);
    console.log(`Spawned block ${numberValue} character at ${group.position.x.toFixed(2)}, ${group.position.z.toFixed(2)}`);
    return group;
}

// Function to remove a block (group) visually and from tracking array
function removeNumberBlock(scene, blockGroupToRemove) {
    if (!blockGroupToRemove || blockGroupToRemove.type !== 'Group') return;
    
    const index = numberBlocks.indexOf(blockGroupToRemove);
    if (index > -1) {
        numberBlocks.splice(index, 1);
    }
    scene.remove(blockGroupToRemove);

    // Basic console log, proper disposal might be needed later
    console.log(`Removed block ${blockGroupToRemove.userData.numberValue}`);
}

// Function to spawn initial blocks
function spawnInitialBlocks(scene, count = 5) { // Default to 5
    // Calculate spacing for blocks in a row
    const spacing = 2.5; // Distance between block centers
    const startX = -((count - 1) * spacing) / 2; // Start from the left side
    const zPosition = -3; // Position blocks in the middle of the field, away from camera
    
    // Spawn one of each block (1-5) in order from left to right
    for (let i = 1; i <= count; i++) {
        // Make sure we don't try to spawn more than 5 unique blocks if count > 5
        if (i > 5) break; 
        
        // Calculate position in row
        const position = new THREE.Vector3(
            startX + (i-1) * spacing, // Increment X position for each block
            0,                       // At ground level
            zPosition                // Fixed distance from camera
        );
        
        // Spawn block with specific position
        spawnNumberBlock(scene, i, position);
    }
    
    console.log(`Spawned ${count} number blocks in a row formation`);
}

// Export needed items (blockSpawnHeight is no longer defined here)
export { spawnInitialBlocks, spawnNumberBlock, removeNumberBlock, numberBlocks, COLORS, NUMBERLING_BG_COLOR, NUMBERLING_TEXT_COLOR }; 
