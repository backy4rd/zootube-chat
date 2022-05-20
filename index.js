const jwt = require('jsonwebtoken');
const httpServer = require('http').createServer();
const io = require('socket.io')(httpServer);
const redis = require('redis');

const messageStore = require('./store');

const port = process.env.PORT || 80;
const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parseInt(process.env.REDIS_PORT) || 6379;

const redisClient = redis.createClient({
  host: redisHost,
  port: redisPort,
});

io.use((socket, next) => {
  // Kiểm tra ràng buộc đầu vào
  if (!socket.handshake.auth) next(new Error('invalid connection'));
  const { token, room } = socket.handshake.auth;
  if (!room) next(new Error('invalid connection'));
  if (!token) next();

  // Xác thực người dùng
  jwt.verify(token, process.env.JWT_SECRET, {}, (err, decoded) => {
    if (!err) {
      socket.handshake.auth.user = {
        id: decoded.id,
        username: decoded.username,
      };
    }
    next();
  });
});

io.on('connection', (socket) => {
  const { user, room } = socket.handshake.auth;
  socket.leave(socket.id); // Thoát khỏi phòng mặc đinh của Socket.IO quy định
  socket.join(room); // Tham gia phòng chat của livestream
  // Gửi về số lượng người đang tham gia
  socket.emit('live count', io.sockets.adapter.rooms.get(room).size); 

  // Gửi về những tin nhắn cũ
  if (messageStore.getMessages(room)) {
    socket.emit('old messages', messageStore.getMessages(room));
  }
  // Người dùng chưa đăng nhập không thể gửi tin nhắn
  if (!user) return;
  // Xử lý người dùng gửi tin nhắn
  socket.on('message', (msg) => {
    if (typeof msg !== 'string') return;
    // Tạo và định danh tin nhắn
    const message = { timestamp: Date.now(), user: user, message: msg };
    // Lưu tin nhắn vào bộ nhớ, nhằm hiển thị tin nhắn cũ
    messageStore.pushMessage(room, message);
    // Gửi tin nhắn tới tất cả những người khác trong phòng
    io.to(room).emit('new message', message);
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
