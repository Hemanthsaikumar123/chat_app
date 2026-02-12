const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {}; // socket.id -> username

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("user-joined", (username) => {
    users[socket.id] = username;

    io.emit("system-message", `${username} joined the chat`);
  });

  socket.on("chat-message", (msg) => {
    const messageData = {
      user: users[socket.id],
      message: msg,
      time: new Date().toLocaleTimeString()
    };

    io.emit("chat-message", messageData);
  });

  socket.on("disconnect", () => {
    const username = users[socket.id];
    if (username) {
      io.emit("system-message", `${username} left the chat`);
      delete users[socket.id];
    }
  });
});

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
