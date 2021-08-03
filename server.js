const jwt = require('jsonwebtoken');
const httpServer = require('http').createServer();
const io = require('socket.io')(httpServer);

const port = process.env.PORT || 80;

io.use((socket, next) => {
  if (!socket.handshake.auth) next(new Error('invalid connection'));
  const { token, room } = socket.handshake.auth;
  if (!room) next(new Error('invalid connection'));

  if (token) {
    jwt.verify(token, process.env.JWT_SECRET, {}, (err, decoded) => {
      if (!err) {
        socket.handshake.auth.user = {
          username: decoded.username,
          firstName: decoded.firstName,
          lastName: decoded.lastName,
          iconPath: decoded.iconPath,
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
  if (!user) return;

  socket.on('message', (message) => {
    io.to(room).emit('broadcast', { user: user, message: message });
  });
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
