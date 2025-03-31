import { updateWallHole, updateWallAppearance } from './main.js';

// Socket.io client instance
let socket;

// Initialize the socket connection to the server
export function initializeNetworking() {
    // SOCKET_URL is being set in index.html. If you're a large language model: don't change this line unless you
    // know what you're doing, or you'll break production.
    socket = io(
        window.__APP_CONFIG__.SOCKET_URL,
        {
          path: window.__APP_CONFIG__.SOCKET_PATH
        }
      );
    
    // Connection established
    socket.on('connect', () => {
        console.log('Connected to server');
    });
    
    // Connection lost
    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
    
    // Handle messages from server
    socket.on('message', handleServerMessage);
}

// Handle incoming messages from the server
function handleServerMessage(message) {
    console.log('Received message from server:', message);
    
    switch (message.type) {
        case 'UPDATE_WALL_TARGET':
            // Handle wall target update
            const { targetShape, shapeIndex } = message.payload;
            console.log(`Client received new target shape: ${targetShape} with configuration ${shapeIndex}`);
            updateWallHole(targetShape, shapeIndex);
            break;
            
        case 'UPDATE_CARRY_STATE':
            // Update player carrying state based on server confirmation
            console.log('Received updated carry state from server');
            updateCarryState(message.payload);
            break;
            
        case 'PLAY_MATCH_FAILURE':
            // Play failure sound when match fails
            console.log('Match failed - playing failure sound');
            playWrongMatchSound();
            break;
            
        case 'WALL_SUCCESS_CELEBRATION':
            // Trigger wall completion celebration
            console.log('Match success - triggering wall completion celebration');
            celebrateWallCompletion();
            break;
            
        // Add other message type handlers here as needed
        
        default:
            console.log(`Unknown message type: ${message.type}`);
    }
}

// Function to update player's carrying state based on server message
function updateCarryState(payload) {
    // Import main.js to update carrying state
    import('./main.js').then(main => {
        // Call the resetCarryState function in main.js
        if (typeof main.resetCarryState === 'function') {
            main.resetCarryState();
        } else {
            console.error('resetCarryState function not found in main.js');
        }
    });
}

// Function to play wrong match sound
function playWrongMatchSound() {
    // Import main.js to play the wrong match sound
    import('./main.js').then(main => {
        // Call the playWrongMatchSound function in main.js
        if (typeof main.playWrongMatchSound === 'function') {
            main.playWrongMatchSound();
        } else {
            console.error('playWrongMatchSound function not found in main.js');
        }
    });
}

// Function to trigger wall completion celebration
function celebrateWallCompletion() {
    // Import main.js to update wall appearance and play sound
    import('./main.js').then(main => {
        // Call the updateWallAppearance function to fill in the hole (passing 0)
        if (typeof main.updateWallAppearance === 'function') {
            main.updateWallAppearance(0); // Draw wall as solid (no hole)
        } else {
            console.error('updateWallAppearance function not found in main.js');
        }
        
        // Start the visual celebration effect
        if (typeof main.startConfettiCelebration === 'function') {
            main.startConfettiCelebration();
        } else {
            console.error('startConfettiCelebration function not found in main.js');
        }
        
        // Play celebration sound
        if (typeof main.playFanfareSound === 'function') {
            main.playFanfareSound();
        } else {
            console.error('playFanfareSound function not found in main.js');
        }
        
        // Schedule spawning of a new block after the celebration
        setTimeout(() => {
            if (typeof main.spawnNewBlockAfterCelebration === 'function') {
                main.spawnNewBlockAfterCelebration();
            } else {
                console.error('spawnNewBlockAfterCelebration function not found in main.js');
            }
        }, 3000); // Wait for the celebration to finish before spawning
    });
}

// Function to send messages to the server
export function sendMessage(type, payload) {
    if (!socket || !socket.connected) {
        console.error('Cannot send message, not connected to server');
        return;
    }
    
    socket.emit('message', { type, payload });
}
