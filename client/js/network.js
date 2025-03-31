import { updateWallHole, updateWallAppearance } from './main.js';

// Socket.io client instance
let socket;

// Diagnostics helper for troubleshooting
export function diagnoseConnection() {
    console.log('=== SOCKET.IO CONNECTION DIAGNOSTICS ===');
    
    // Check if Socket.io is loaded
    console.log('1. Socket.io loaded:', typeof io !== 'undefined' ? 'YES' : 'NO');
    
    // Check socket instance
    console.log('2. Socket instance created:', socket ? 'YES' : 'NO');
    
    // Check connection state
    if (socket) {
        console.log('3. Socket connected:', socket.connected ? 'YES' : 'NO');
        console.log('   Socket ID:', socket.id || 'none');
        console.log('   Current transport:', socket.io?.engine?.transport?.name || 'unknown');
        console.log('   Available transports:', socket.io?.engine?.transports || 'unknown');
    } else {
        console.log('3. Socket connection: SOCKET NOT INITIALIZED');
    }
    
    // Check config
    console.log('4. Connection configuration:');
    console.log('   URL:', window.__APP_CONFIG__?.SOCKET_URL || 'not set');
    console.log('   Path:', window.__APP_CONFIG__?.SOCKET_PATH || 'not set');
    
    // Check for errors
    if (socket) {
        const hasErrors = socket._callbacks && socket._callbacks.$connect_error;
        console.log('5. Connection errors:', hasErrors ? 'YES' : 'NONE');
    } else {
        console.log('5. Connection errors: UNKNOWN (socket not initialized)');
    }
    
    // Check wall initialization
    console.log('6. Wall initialization:');
    console.log('   Initial wall target received:', document.initialWallReceived ? 'YES' : 'NO');
    
    console.log('=== DIAGNOSTICS COMPLETE ===');
    console.log('To fix connection issues, try:');
    console.log('1. Check that the server is running');
    console.log('2. Verify proxy configuration supports WebSockets');
    console.log('3. Try reconnecting manually with: window.reconnectSocket()');

    return {
        socketExists: !!socket,
        isConnected: socket?.connected || false,
        config: window.__APP_CONFIG__,
        initialWallReceived: document.initialWallReceived || false
    };
}

// Manual reconnection helper
window.reconnectSocket = function() {
    if (!socket) {
        console.log('Socket not initialized yet, initializing now...');
        initializeNetworking();
        return;
    }
    
    if (socket.connected) {
        console.log('Already connected, disconnecting first...');
        socket.disconnect();
    }
    
    console.log('Attempting to reconnect...');
    socket.connect();
    
    setTimeout(() => {
        console.log('Reconnection attempt result:', socket.connected ? 'SUCCESS' : 'FAILED');
        if (socket.connected) {
            console.log('Requesting wall target...');
            sendMessage('REQUEST_WALL_TARGET', {});
        }
    }, 2000);
};

// Make diagnostic functions available in console
window.diagnoseSocketConnection = diagnoseConnection;

// Initialize the socket connection to the server
export function initializeNetworking() {
    console.log('Initializing networking with config:', window.__APP_CONFIG__);
    
    // Improved Socket.io configuration
    const socketOptions = {
        path: window.__APP_CONFIG__.SOCKET_PATH,
        transports: ['websocket'], 
        reconnectionAttempts: 5,              // Try to reconnect 5 times
        reconnectionDelay: 1000,              // Start with 1s delay
        reconnectionDelayMax: 5000,           // Maximum 5s delay
        timeout: 20000,                       // Increase connection timeout
        forceNew: true                        // Create a new connection
    };
    
    // Create the socket with enhanced options
    try {
        socket = io(window.__APP_CONFIG__.SOCKET_URL, socketOptions);
        
        // Connection established
        socket.on('connect', () => {
            console.log('Connected to server successfully. Socket ID:', socket.id);
            console.log('Transport method:', socket.io.engine.transport.name);
            
            // Request initial wall target if not received
            setTimeout(() => {
                if (!document.initialWallReceived) {
                    console.log('No initial wall target received yet. Requesting one...');
                    sendMessage('REQUEST_WALL_TARGET', {});
                }
            }, 2000);
        });
        
        // Connection lost
        socket.on('disconnect', (reason) => {
            console.log('Disconnected from server. Reason:', reason);
            if (reason === 'io server disconnect') {
                // The server has forcefully disconnected us
                console.log('Server initiated disconnect, attempting to reconnect...');
                socket.connect();
            }
        });
        
        // Connection error with detailed logging
        socket.on('connect_error', (error) => {
            console.error('Socket.io connection error:', error.message);
            console.error('Full error details:', error);
            console.log('Current configuration:', {
                url: window.__APP_CONFIG__.SOCKET_URL,
                path: window.__APP_CONFIG__.SOCKET_PATH,
                transport: socket.io?.engine?.transport?.name || 'unknown'
            });
        });

        // Handle reconnection attempts
        socket.io.on('reconnect_attempt', (attemptNumber) => {
            console.log(`Reconnection attempt ${attemptNumber}...`);
        });

        socket.io.on('reconnect', (attemptNumber) => {
            console.log(`Reconnected to server after ${attemptNumber} attempts`);
        });

        socket.io.on('reconnect_error', (error) => {
            console.error('Error while reconnecting:', error);
        });

        socket.io.on('reconnect_failed', () => {
            console.error('Failed to reconnect after maximum attempts');
        });
        
        // Handle messages from server
        socket.on('message', handleServerMessage);
    } catch (error) {
        console.error('Error creating Socket.io instance:', error);
    }
}

// Handle incoming messages from the server
function handleServerMessage(message) {
    console.log('Received message from server:', message);
    
    switch (message.type) {
        case 'UPDATE_WALL_TARGET':
            // Handle wall target update
            const { targetShape, shapeIndex } = message.payload;
            console.log(`Client received new target shape: ${targetShape} with configuration ${shapeIndex}`);
            document.initialWallReceived = true;
            
            // Actually update the wall hole
            try {
                if (typeof updateWallHole !== 'function') {
                    console.error('updateWallHole is not a function. Current value:', updateWallHole);
                    // Try to dynamically import
                    import('./main.js').then(main => {
                        if (typeof main.updateWallHole === 'function') {
                            console.log('Found updateWallHole via dynamic import');
                            main.updateWallHole(targetShape, shapeIndex);
                        } else {
                            console.error('updateWallHole not found in main.js after dynamic import');
                        }
                    }).catch(err => {
                        console.error('Error importing main.js:', err);
                    });
                } else {
                    updateWallHole(targetShape, shapeIndex);
                }
            } catch (error) {
                console.error('Error updating wall hole:', error);
            }
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
    if (!socket) {
        console.error('Cannot send message, socket not initialized');
        return false;
    }
    
    if (!socket.connected) {
        console.error('Cannot send message, not connected to server');
        return false;
    }
    
    try {
        socket.emit('message', { type, payload });
        return true;
    } catch (error) {
        console.error('Error sending message:', error);
        return false;
    }
}
