require("dotenv").config();
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));
app.use(express.json());

const SECRET = process.env.JWT_SECRET || "fallback_secret_key";
const PORT = process.env.PORT || 3000;

app.post("/login", (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: "Username required" });
  }

  const token = jwt.sign({ username }, SECRET, { expiresIn: "1h" });

  res.json({ token });
});


const users = {}; // socket.id -> { username, room }
const roomMessages = {}; // room -> messages[]

function getRoomUsers(room) {
  return Object.values(users)
    .filter(user => user.room === room)
    .map(user => user.username);
}
function getUserByUsername(username, room) {
  return Object.entries(users)
    .find(([id, user]) => user.username === username && user.room === room);
}


io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token) {
    return next(new Error("Authentication error"));
  }

  try {
    const decoded = jwt.verify(token, SECRET);
    socket.user = decoded; // attach user info
    next();
  } catch (err) {
    next(new Error("Authentication error"));
  }
});


io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", ({ room }) => {
  const username = socket.user.username;

  users[socket.id] = { username, room };

socket.join(room);

    if (!roomMessages[room]) {
      roomMessages[room] = [];
    }

    // Send old messages to newly joined user only
    socket.emit("chat-history", roomMessages[room]);

    io.to(room).emit("system-message", `${username} joined ${room}`);

    io.to(room).emit("room-users", getRoomUsers(room));
  });



  socket.on("chat-message", (msg) => {
    const user = users[socket.id];
    if (!user) return;

    const messageData = {
      user: user.username,
      message: msg,
      time: new Date().toLocaleTimeString()
    };

    // Save message in room history
    roomMessages[user.room].push(messageData);

    io.to(user.room).emit("chat-message", messageData);
  });


  socket.on("private-message", ({ to, message }) => {
    const sender = users[socket.id];
    if (!sender) return;

    const target = getUserByUsername(to, sender.room);
    if (!target) return;

    const [targetSocketId] = target;

    const messageData = {
      from: sender.username,
      message,
      time: new Date().toLocaleTimeString(),
      private: true
    };

    // Send to receiver
    io.to(targetSocketId).emit("private-message", messageData);

    // Send back to sender (so they see their own DM)
    socket.emit("private-message", messageData);
  });
  socket.on("typing", () => {
    const user = users[socket.id];
    if (!user) return;

    socket.to(user.room).emit("typing", user.username);
  });


  socket.on("disconnect", () => {
  const user = users[socket.id];
  if (user) {
    io.to(user.room).emit("system-message", `${user.username} left the room`);

    delete users[socket.id];

    // Update users after leaving
    io.to(user.room).emit("room-users", getRoomUsers(user.room));
  }
});

});


server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
