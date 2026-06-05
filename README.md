# 🎮 Memory Match - Real-Time Multiplayer Game

<div align="center">

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-Fast-purple?logo=vite)
![Socket.io](https://img.shields.io/badge/Socket.io-Real--Time-black?logo=socketdotio)
![Node.js](https://img.shields.io/badge/Node.js-Backend-green?logo=node.js)

**A fast-paced multiplayer memory card matching game with real-time gameplay, private rooms, live score tracking, and synchronized turns.**

### 🚀 Live Demo

👉 https://memory-match-nmk.netlify.app/

</div>

---

## 📖 Overview

Memory Match is a real-time multiplayer card-matching game where two players compete to discover matching pairs before their opponent.

Players can instantly create private rooms, share room codes, and experience fully synchronized gameplay powered by WebSockets.

---

## ✨ Features

### 🎯 Real-Time Multiplayer

* Instant move synchronization between players
* Live game state updates using Socket.io
* No page refreshes required

### 🔐 Private Room System

* Generate unique room codes
* Invite friends instantly
* Secure room-based gameplay

### 🎮 Interactive Gameplay

* Real-time turn indicators
* Live score tracking
* Smooth card-flip animations
* Competitive player-vs-player experience

### 📡 Connection Monitoring

* Detects player disconnections
* Pauses gameplay when necessary
* Reconnection handling
* Prevents unfair game outcomes

### 💻 Responsive UI

* Optimized for desktop gaming
* Modern cinematic design
* Clean and intuitive interface

---

## 🛠️ Tech Stack

### Frontend

| Technology         | Purpose                   |
| ------------------ | ------------------------- |
| React + TypeScript | Component-based UI        |
| Vite               | Fast development & builds |
| Tailwind CSS       | Modern styling            |
| Socket.io Client   | Real-time communication   |

### Backend

| Technology | Purpose                      |
| ---------- | ---------------------------- |
| Node.js    | Runtime environment          |
| Express.js | API & server management      |
| Socket.io  | Real-time multiplayer engine |

---

## 🏗️ Project Architecture

```text
memory-match/
│
├── client/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── server/
│   ├── index.js
│   ├── socket/
│   └── package.json
│
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone Repository

```bash
git clone https://github.com/nagamanikanta5455/my-memory-game.git

cd my-memory-game
```

---

### 2️⃣ Start Backend Server

```bash
cd server

npm install

npm start
```

Backend will run on:

```text
http://localhost:3001
```

---

### 3️⃣ Start Frontend

Open a new terminal:

```bash
cd client

npm install

npm run dev
```

Frontend will run on:

```text
http://localhost:5173
```

---

## 🌐 Deployment

### Frontend

Hosted on **Netlify**

```bash
npm run build
```

Build output is deployed as a static site.

### Backend

Hosted on **Render**

Features:

* Persistent WebSocket server
* Dynamic CORS handling
* Room management
* Multiplayer synchronization

---

## 🎮 How to Play

1. Create a room
2. Share the room code with a friend
3. Wait for them to join
4. Take turns flipping cards
5. Match pairs to score points
6. Player with the highest score wins

---

## 📸 Screenshots

### Home Screen

```text
Add screenshot here
```

### Multiplayer Room

```text
Add screenshot here
```

### Gameplay

```text
Add screenshot here
```

---

## 🚀 Future Improvements

* Global leaderboard
* Match history
* User authentication
* Ranked matchmaking
* Sound effects
* Mobile optimization
* Spectator mode
* In-game chat

---

## 🤝 Contributing

Contributions are welcome.

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/new-feature
```

3. Commit your changes

```bash
git commit -m "Add new feature"
```

4. Push to GitHub

```bash
git push origin feature/new-feature
```

5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

**Nagamanikanta Konda**

GitHub:
https://github.com/nagamanikanta5455

---

<div align="center">

⭐ If you like this project, consider giving it a star!

</div>
