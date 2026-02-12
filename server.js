const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const users = {}; // socket.id -> { username, room }

function getRoomUsers(room) {
  return Object.values(users)
    .filter(user => user.room === room)
    .map(user => user.username);
}

io.on("connection", (socket) => {
  console.log("New user connected:", socket.id);

  socket.on("join-room", ({ username, room }) => {
  users[socket.id] = { username, room };

  socket.join(room);

  io.to(room).emit("system-message", `${username} joined ${room}`);

  //Send updated user list
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

    io.to(user.room).emit("chat-message", messageData);
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


server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
