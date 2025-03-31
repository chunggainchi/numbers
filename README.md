# Number Buddies Playground

A fun, interactive 3D game to help children learn basic mathematics through combining, breaking down, and transforming number blocks.

## Overview

Number Buddies Playground is an educational game where players can pick up, combine, and transform blocks with different numeric values. The game includes special objects like a magical mirror that duplicates blocks, a trash can for disposing blocks, and a wall with shapes to match.

## Features

- Interactive 3D environment with intuitive controls
- Combine blocks to create numbers up to 5
- Transform blocks into different shape configurations
- Break down larger blocks into individual units
- Match block configurations with the wall target
- Educational audio feedback and visual effects

## Requirements

- Node.js (v14 or higher)
- Modern web browser with WebGL support (Chrome, Firefox, Safari, Edge)

## Installation

1. Clone the repository:
```
git clone <repository-url>
cd number-buddies-playground
```

2. Install dependencies for the server:
```
cd server
npm install
cd ..
```

## Running the Game

The game consists of a server component and a client interface. You can either run it locally for development or deploy it publicly.

### Development Mode (Local)

1. Navigate to the server directory:
```
cd number-buddies-playground/server
```

2. Start the server:
```
node server.js
```

3. Open a web browser and navigate to:
```
http://localhost:8080
```

### Production Deployment

For public-facing deployment where clients connect to your server from different locations:

1. **Configure the server**:
   
   The server is already set up to handle CORS and work in a production environment. Check these environment variables:
   
   ```
   PORT=3001 # Server port (default is 3001)
   CLIENT_ORIGIN=https://yourdomain.com # Allow connections from your frontend domain
   NODE_ENV=production # Set to production
   ```

2. **Configure the client**:
   
   The client uses a configuration object in `index.html` to determine the Socket.io connection:
   
   ```javascript
   window.__APP_CONFIG__ = {
       SOCKET_URL: location.hostname === "localhost" 
           ? "http://localhost:3001" 
           : "/projects/numbers/api",
       SOCKET_PATH: location.hostname === "localhost"
           ? "/socket.io"
           : "/projects/numbers/api/socket.io"
   };
   ```
   
   Update this configuration to match your deployment setup:
   
   - For direct connection: Set `SOCKET_URL` to your server's URL (e.g., "https://api.yourdomain.com")
   - For reverse proxy: Keep the relative path but update it to match your API endpoint

3. **Typical deployment architecture**:
   
   - Frontend: Served by a web server (Nginx, Apache, or a static hosting service)
   - Backend: Runs on your server (could be behind a reverse proxy)
   - Connection: Client connects to backend via Socket.io

4. **Reverse proxy configuration (Nginx example)**:
   
   ```
   location /projects/numbers/api/ {
       proxy_pass http://localhost:3001/;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
   }
   ```

> **Important Note**: The wall hole functionality requires a Socket.io connection to the server. If this connection fails, the wall will appear without holes.

## Game Controls

- **Arrow Keys**: Move the avatar
- **A Key**: Pick up blocks (when nearby)
- **W Key**: Drop carried blocks
- **T Key**: Transform block shapes (works while carrying too)
- **K Key**: Break down blocks into smaller units
- **Mouse/Pointer**: Drag and drop blocks to combine them
- **Click**: Interact with objects (mirror, trash can, wall)

## Troubleshooting

- **Game doesn't load**: Make sure the server is running and check browser console for errors
- **No sounds**: Some browsers require user interaction before playing audio
- **Performance issues**: Reduce browser tabs/applications running in the background
- **Wall holes don't appear**: 
  - Check that the Socket.io connection is established (look for "Connected to server" in console)
  - Make sure your server is running and accessible from the client
  - Check for CORS issues if your client and server are on different domains
  - Check the network tab in browser dev tools for failed Socket.io connections
  - Verify that `window.__APP_CONFIG__` in the HTML is correctly configured for your deployment

## Frontend/Backend Responsibilities

The game's functionality is distributed between the frontend (client) and backend (server):

### Server-Side (Backend) Responsibilities:
- **Wall Target Management**: The server generates and controls the random wall target shapes and configurations
- **Match Validation**: The server validates if a carried block matches the wall target
- **State Synchronization**: The server ensures all connected clients see the same wall target
- **Success/Failure Handling**: The server determines success/failure for wall matches and broadcasts to clients

### Client-Side (Frontend) Responsibilities:
- **Block Manipulation**: All block movement, combination, transformation, and breakdown
- **User Interface**: Rendering the game scene, objects, and visual effects
- **Avatar Control**: Handling player movement and interactions
- **Audio Feedback**: Playing sounds for different interactions
- **Wall Rendering**: Displaying the wall and updating its appearance based on server data

### Important Dependencies:
- **Wall Holes**: Wall holes are ONLY created when a server connection is established and target data is received
- **Block Transformation**: Block shape transformations are handled entirely client-side
- **Mirror & Trash Can**: These features function independently from the server
- **Number Blocks**: Basic number block functionality works without a server connection

### Fallback Behavior:
- If the server connection fails, the wall will appear as a solid structure without holes
- No explicit fallback is implemented to ensure server-dependent features don't work without a connection

## Shutting Down

To stop the server, press `Ctrl+C` in the terminal/command prompt where the server is running.

## Technologies Used

- Three.js for 3D rendering
- Socket.io for client-server communication
- Express for the web server framework

## Asset Credits

The game uses various 3D models and audio assets:
- Character avatar (Boo)
- Magical mirror
- Trash can
- Audio effects for interactions

---

Enjoy playing and learning with Number Buddies Playground!