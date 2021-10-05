const maxMessageLength = parseInt(process.env.MAX_MESSAGES_LENGTH) || 30;

class MessageStore {
  constructor() {
    this.store = new Map();
  }

  pushMessage(roomId, message) {
    let messages = this.store.get(roomId);
    if (!messages) {
      messages = [];
      this.store.set(roomId, messages);
    }

    messages.push(message);
    if (messages.length > maxMessageLength) {
      messages.shift();
    }
  }

  getMessages(roomId) {
    return this.store.get(roomId);
  }

  removeRoomFromStore(roomId) {
    this.store.delete(roomId);
  }
}

module.exports = new MessageStore();
