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

The game consists of a server component and a client interface. You need to start the server first, then access the client through a web browser.

### Starting the Server

1. Navigate to the server directory:
```
cd number-buddies-playground/server
```

2. Start the server:
```
node server.js
```

You should see a message indicating that the server is running on port 8080.

### Accessing the Game

1. Open a web browser and navigate to:
```
http://localhost:8080
```

The game should load automatically and you'll be greeted with the 3D environment and a controls guide.

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
