// Import interaction handlers from main.js
import { handlePointerDownInteraction, handlePointerUpInteraction, handleBlockClick, handleDragStartInteraction, handleBreakdownRequest, handlePickupRequest, handleDropRequest, handleTransformRequest } from './main.js';

const keyboardState = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    k: false,  // Track the 'k' key state for breakdown
    a: false,  // Track the 'a' key state for pickup
    w: false,  // Track the 'w' key state for drop
    t: false   // Track the 't' key state for transformation
};

// Drag & Drop State
const pointerState = {
    isDown: false,
    isDragging: false,
    pointer: { x: 0, y: 0 }, // Normalized device coordinates
    startPosition: { x: 0, y: 0 } // For detecting click vs drag (optional)
};

let draggedObject = null; // Reference to the object being dragged
let wasDragging = false; // Flag to differentiate click from drag-release
let potentialClickTarget = null; // Added: Store potential click target from pointer down

function handleKeyDown(event) {
    if (event.key in keyboardState) {
        keyboardState[event.key] = true;
    }
    
    // Debug log for T key press
    if (event.key.toLowerCase() === 't') {
        console.log("T KEY PRESSED - Debug: Transform action triggered");
    }
    
    // Special key bindings for actions
    switch (event.key.toLowerCase()) {
        case 'k':
            // Breakdown action - break a block into individual '1' blocks
            handleBreakdownRequest();
            break;
        
        case 'a':
            // Pickup action - pick up a block and carry it on avatar's head
            handlePickupRequest();
            break;
            
        case 'w':
            // Drop action - drop carried blocks onto the ground
            handleDropRequest();
            break;
            
        case 't':
            // Transform action - change the shape of a block
            handleTransformRequest();
            break;
    }
}

function handleKeyUp(event) {
    if (event.key in keyboardState) {
        keyboardState[event.key] = false;
    }
}

// --- Pointer Events for Drag --- 
function handlePointerDown(event) {
    pointerState.isDown = true;
    wasDragging = false; // Reset drag flag
    potentialClickTarget = null; // Clear previous target
    pointerState.startPosition.x = event.clientX;
    pointerState.startPosition.y = event.clientY;
    updatePointerPosition(event);
    
    // Call main.js to find target under pointer
    handlePointerDownInteraction(); // This now only calls setPotentialClickTarget
}

function handlePointerMove(event) {
    updatePointerPosition(event);
    if (pointerState.isDown && potentialClickTarget && !wasDragging) {
        // Pointer is down, we had a target, and we haven't started dragging yet
        // --> INITIATE DRAG
        wasDragging = true; 
        pointerState.isDragging = true;
        setDraggedObject(potentialClickTarget); // Set the object being dragged
        handleDragStartInteraction(potentialClickTarget); // Lift block, calc offset in main.js
    }
    // Add threshold logic here if needed later
}

function handlePointerUp(event) {
    if (wasDragging && draggedObject) { // Check wasDragging flag
        handlePointerUpInteraction(); // Handle drop
    } else if (!wasDragging && potentialClickTarget) {
        // If pointer was down, no drag occurred, AND we had a target block
        handleBlockClick(potentialClickTarget); // Trigger click action
    } else {
        // Clicked empty space or non-interactive object
        console.log("Clicked empty space or non-draggable object.");
    }

    // Reset state
    pointerState.isDown = false;
    pointerState.isDragging = false;
    wasDragging = false; 
    potentialClickTarget = null; // Clear target
    setDraggedObject(null); // Use the setter to ensure state consistency
}

function updatePointerPosition(event) {
    pointerState.pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointerState.pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

// --- End Pointer Events --- 

function initControls() {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    console.log("Keyboard and Pointer controls initialized.");
}

// Setter ensures isDragging state is consistent with draggedObject
function setDraggedObject(object) {
    draggedObject = object;
    pointerState.isDragging = (object !== null);
}

// Added: Setter for the potential click target
function setPotentialClickTarget(object) {
    potentialClickTarget = object;
}

// Export the state and the initialization function
export { keyboardState, pointerState, draggedObject, setDraggedObject, setPotentialClickTarget, initControls };
