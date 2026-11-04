import dotenv from "dotenv";
dotenv.config();
import { app } from "./app.js";
import connectDB from "./src/db/index.js";
import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer(app);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN , 
    methods: ["GET", "POST"],
    credentials: true,
  },
  allowEIO3: true 
});


let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("⚡ New user connected! Socket ID:", socket.id);
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    console.log("👤 User joined personal room:", userData._id);
    socket.emit("connected");

    if (!onlineUsers.some((user) => user.userId === userData._id)) {
      onlineUsers.push({ userId: userData._id, socketId: socket.id });
    }
   
    io.emit(
      "get-online-users",
      onlineUsers.map((u) => u.userId),
    );
  });


  socket.on("join chat", (room) => {
    socket.join(room); // room = chatId
    console.log("👥 User joined Chat Room: " + room);
  });
  socket.on("typing", (room) => socket.in(room).emit("typing", room));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing", room));

  socket.on("message deleted", (deletedMessageInfo) => {
    var chat = deletedMessageInfo.chat;
    if (!chat.users)
      return console.log("⚠️ chat.users not defined in deleted message");

    chat.users.forEach((user) => {
      if (user._id === deletedMessageInfo.sender._id) return;
      socket.in(user._id).emit("message deleted", deletedMessageInfo);
    });
  });

  socket.on("message edited", (editedMessageInfo) => {
    var chat = editedMessageInfo.chat;
    if (!chat.users)
      return console.log("⚠️ chat.users not defined in edited message");

    chat.users.forEach((user) => {
      if (user._id === editedMessageInfo.sender._id) return;
      socket.in(user._id).emit("message edited", editedMessageInfo);
    });
  });

  socket.on("new message", (newMessageReceived) => {
    var chat = newMessageReceived.chat;

    if (!chat.users) return console.log("⚠️ chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id === newMessageReceived.sender._id) return;
      socket.in(user._id).emit("message received", newMessageReceived);
    });
  });
  socket.on("mark as read", ({ chatId, userId, readByArray }) => {
    socket.in(chatId).emit("messages read", { chatId, userId, readByArray });
  });
  socket.on("disconnect", () => {
    console.log("🔴 User disconnected:", socket.id);

    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    io.emit(
      "get-online-users",
      onlineUsers.map((u) => u.userId),
    );
  });
});

const PORT = process.env.PORT;

connectDB()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`\n🚀 Server is running on port: ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("\n❌ MongoDB connection failed!!! ", err);
  });