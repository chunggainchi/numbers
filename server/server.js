const http = require('http');
const express = require('express');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');


// Game configuration
const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:8000";
const SOCKET_PATH = process.env.SOCKET_PATH || '/socket.io';

// Enhanced CORS options
const corsOptions = {
  origin: CLIENT_ORIGIN,
  methods: ["GET", "POST", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};

// Initialize Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Enhanced Socket.io configuration
const io = socketIO(server, { 
  cors: corsOptions,
  path: SOCKET_PATH,
  transports: ['websocket', 'polling'], // Try WebSocket first, fall back to polling
  allowEIO3: true,                      // Enable compatibility with older clients
  pingTimeout: 60000,                   // Increase ping timeout for stability
  pingInterval: 25000,                  // More frequent pings
  upgradeTimeout: 30000,                // Allow more time for WebSocket upgrades
  maxHttpBufferSize: 1e6                // 1MB max message size
});

// Monitor socket.io connection issues
io.engine.on("connection_error", (err) => {
  console.error("Connection error:", err.req.url, err.code, err.message, err.context);
});

// Block shape configurations
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

// Use CORS middleware for Express
app.use(cors(corsOptions));

// Dev mode only: Serve static files from the client directory
// in production frontend/nginx will serve files separately
if (process.env.NODE_ENV !== 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
}

// Game state
let connectedClients = 0;

// Shape Matching Wall - Server-side state
let currentWallTargetShape = {
    value: 1,    // The number (1-5)
    shapeIndex: 0  // Which configuration of that number
};

// Function to pick a new random target shape (1-5) and configuration
function pickNewWallTarget() {
    // Pick a random number 1-5, ensure it's different from current if possible
    let value;
    do {
        value = Math.floor(Math.random() * 5) + 1;
    } while (value === currentWallTargetShape.value && Math.random() < 0.8); // 80% chance to try again if same value
    
    // Get all possible shapes for this number
    const possibleShapes = BLOCK_SHAPES[value];
    
    // Pick a random shape configuration, ensure it's different if possible
    let shapeIndex;
    do {
        shapeIndex = Math.floor(Math.random() * possibleShapes.length);
    } while (
        value === currentWallTargetShape.value && 
        shapeIndex === currentWallTargetShape.shapeIndex && 
        possibleShapes.length > 1 && 
        Math.random() < 0.8
    ); // 80% chance to try again if same config (only if there are multiple options)
    
    // Update current target
    currentWallTargetShape = {
        value: value,
        shapeIndex: shapeIndex
    };
    
    console.log(`Server: New Wall Target Shape is ${value} with configuration ${shapeIndex + 1}/${possibleShapes.length}`);
    
    // Broadcast the new target shape to all connected clients
    io.emit('message', {
        type: 'UPDATE_WALL_TARGET',
        payload: { 
            targetShape: value,
            shapeIndex: shapeIndex
        }
    });
}

// Socket.io connection handling
io.on('connection', (socket) => {
    connectedClients++;
    console.log(`Client connected. Total clients: ${connectedClients}, Socket ID: ${socket.id}`);
    
    // Instead of generating a new target, just send the current one to the new client
    socket.emit('message', {
        type: 'UPDATE_WALL_TARGET',
        payload: { 
            targetShape: currentWallTargetShape.value,
            shapeIndex: currentWallTargetShape.shapeIndex
        }
    });
    console.log(`Sent current wall target ${currentWallTargetShape.value} (shape ${currentWallTargetShape.shapeIndex + 1}) to new client ${socket.id}`);
    
    // Message handler for all game actions
    socket.on('message', (message) => {
        console.log(`Received message from client ${socket.id}: ${message.type}`);
        
        switch (message.type) {
            case 'ATTEMPT_WALL_MATCH':
                handleWallMatchAttempt(socket, message.payload);
                break;
                
            case 'REQUEST_WALL_TARGET':
                // Client is explicitly requesting the current wall target
                console.log(`Client ${socket.id} requested current wall target`);
                socket.emit('message', {
                    type: 'UPDATE_WALL_TARGET',
                    payload: { 
                        targetShape: currentWallTargetShape.value,
                        shapeIndex: currentWallTargetShape.shapeIndex
                    }
                });
                console.log(`Re-sent current wall target ${currentWallTargetShape.value} (shape ${currentWallTargetShape.shapeIndex + 1}) to client ${socket.id}`);
                break;
                
            // Add other message type handlers here
                
            default:
                console.log(`Unknown message type from client ${socket.id}: ${message.type}`);
        }
    });
    
    // Disconnect handling
    socket.on('disconnect', () => {
        connectedClients--;
        console.log(`Client disconnected. Total clients: ${connectedClients}`);
    });
});

// Function to handle wall match attempts
function handleWallMatchAttempt(socket, payload) {
    console.log('Processing wall match attempt');
    
    // Extract carried block information from payload
    const { carriedValue, carriedShapeIndex } = payload;
    
    // Validate payload
    if (carriedValue === undefined) {
        console.error('Invalid wall match attempt: missing carriedValue');
        return;
    }
    
    console.log(`Player attempting to match carried value ${carriedValue} (shape ${carriedShapeIndex}) with target value ${currentWallTargetShape.value} (shape ${currentWallTargetShape.shapeIndex})`);
    
    // Get the shape configurations for comparison
    const targetValue = currentWallTargetShape.value;
    const targetShapeIndex = currentWallTargetShape.shapeIndex;
    
    // First check if values match - a basic requirement
    if (carriedValue !== targetValue) {
        console.log('MATCH FAILED: Carried block does not match wall target');
        console.log('  - Value mismatch: ' + carriedValue + ' vs ' + targetValue);
        
        // Play failure sound but don't change player state
        socket.emit('message', {
            type: 'PLAY_MATCH_FAILURE',
            payload: {}
        });
        return;
    }
    
    // Get the shape arrays for both target and carried blocks
    const targetShape = BLOCK_SHAPES[targetValue][targetShapeIndex];
    const carriedShape = BLOCK_SHAPES[carriedValue][carriedShapeIndex];
    
    // Check for direct match (same shape index)
    const directMatch = carriedShapeIndex === targetShapeIndex;
    
    // Check for horizontally mirrored match (reversed array)
    let mirroredMatch = false;
    if (targetShape.length === carriedShape.length) {
        // Clone and reverse the carried shape array to check for mirror match
        const reversedCarriedShape = [...carriedShape].reverse();
        mirroredMatch = reversedCarriedShape.every((height, index) => height === targetShape[index]);
        
        // Add logging to help debugging
        if (mirroredMatch) {
            console.log('Found mirrored match: original shape', carriedShape, 'mirrors target', targetShape);
        }
    }
    
    // If either direct match or mirrored match is found, consider it a success
    if (directMatch || mirroredMatch) {
        console.log('MATCH SUCCESS! Carried block matches wall target shape (direct or mirrored)');
        
        // Reset player's carrying state
        socket.emit('message', {
            type: 'UPDATE_CARRY_STATE',
            payload: {
                isCarrying: false,
                carriedValue: 0,
                carriedShapeIndex: 0
            }
        });
        
        // Broadcast wall success celebration to all clients
        io.emit('message', {
            type: 'WALL_SUCCESS_CELEBRATION',
            payload: {}
        });
        
        // Generate a new wall target for all players
        pickNewWallTarget();
    } else {
        console.log('MATCH FAILED: Carried block does not match wall target shape (neither direct nor mirrored)');
        console.log('  - Shape mismatch: carried shape index ' + carriedShapeIndex + ' vs target index ' + targetShapeIndex);
        console.log('  - Carried shape:', carriedShape);
        console.log('  - Target shape:', targetShape);
        
        // Play failure sound but don't change player state
        socket.emit('message', {
            type: 'PLAY_MATCH_FAILURE',
            payload: {}
        });
    }
}

// Start the server
// don't expose backend publically, only allow requests from frontend client
server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Set initial random target for the Shape Matching Wall
    pickNewWallTarget();
});
