# Number Buddies Game

A interactive 3D game built with Three.js and Node.js.

## Prerequisites

- Node.js (latest LTS version recommended)
- A local server for the client (like `http-server`, `live-server`, or VS Code's Live Server extension)

## Installation

1. Clone the repository:
```bash
git clone [your-repository-url]
cd [repository-name]
```

2. Install server dependencies:
```bash
cd server
npm install
```

3. Install a local server globally (if you don't have one):
```bash
npm install -g http-server
# OR
npm install -g live-server
```

## Running the Game

1. Start the server:
```bash
cd server
node server.js
```
The server will run on port 8080 by default.

2. In a separate terminal, serve the client directory:
```bash
cd client
http-server -p 8000
# OR
live-server --port=8000
```

Alternatively, you can use VS Code's Live Server extension to serve the client directory on port 8000.

3. Open your browser and navigate to:
http://localhost:8000

## Game Controls

- **Move**: Arrow keys
- **Pick up blocks**: A key
- **Drop blocks**: W key
- **Transform shape**: T key
- **Break down blocks**: K key
- **Combine blocks**: Drag & drop one onto another

## Development

The project is structured into two main parts:
- `client/`: Contains the front-end game code using Three.js
- `server/`: Contains the Node.js server for multiplayer functionality

## Technologies Used

- Three.js for 3D rendering
- Socket.io for real-time multiplayer functionality
- Express.js for the server
- Node.js for the backend runtime