const jwt = require('jsonwebtoken');
const httpServer = require('http').createServer();
const io = require('socket.io')(httpServer);

const messageStore = require('./store');

const port = process.env.PORT || 80;

io.use((socket, next) => {
  if (!socket.handshake.auth) next(new Error('invalid connection'));
  const { token, room } = socket.handshake.auth;
  if (!room) next(new Error('invalid connection'));

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, (err, decoded) => {
      if (!err) {
        socket.handshake.auth.user = {
          id: decoded.id,
          username: decoded.username,
        };
      }
      next();
    });
  } else {
    next();
  }
});

io.on('connection', (socket) => {
  const { user, room } = socket.handshake.auth;
  socket.leave(socket.id); // leaving default room
  socket.join(room);
  socket.emit('live count', io.sockets.adapter.rooms.get(room).size);

  if (messageStore.getMessages(room)) {
    socket.emit('old messages', messageStore.getMessages(room));
  }
  if (!user) return;

  socket.on('message', (msg) => {
    if (typeof msg !== 'string') return;
    const message = { timestamp: Date.now(), user: user, message: msg };
    messageStore.pushMessage(room, message);
    io.to(room).emit('new message', message);
  });

  // socket.on('disconnecting', () => {
  //   // remove meessages when the last one left the room
  //   if (io.sockets.adapter.rooms.get(room).size === 1) {
  //     messageStore.removeRoomFromStore(room);
  //   }
  // });
});

httpServer.listen(port, (err) => {
  if (err) throw err;
  console.log('server listening on port ' + port);

  setInterval(() => {
    const rooms = [...io.sockets.adapter.rooms];
    for (room of rooms) {
      const [name, sockets] = room;
      io.to(name).emit('live count', sockets.size);
    }
  }, 20 * 1000);
});
