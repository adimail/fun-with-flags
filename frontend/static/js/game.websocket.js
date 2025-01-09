class WebSocketFunWithFlags {
  constructor(roomID, username, controller) {
    this.roomID = roomID;
    this.username = username;
    this.controller = controller;
    this.socket = null;

    this.openWebSocketConnection();
  }

  handleWebSocketMessage(event) {
    const message = JSON.parse(event.data);
    switch (message.event) {
      case "playerJoined":
        this.controller.addPlayerToList(message.data.username);
        this.controller.updatePlayerCount();
        break;
      case "playerLeft":
        this.controller.removePlayerFromList(message.data.username);
        this.controller.updatePlayerCount();
        break;
      case "gameStarted":
        console.log("Game started!");
        break;
      default:
        console.warn("Unhandled WebSocket event:", message.event);
    }
  }

  openWebSocketConnection() {
    this.socket = new WebSocket("ws://localhost:8080/ws");

    this.socket.onopen = () => {
      this.socket.send(
        JSON.stringify({
          event: "joinRoom",
          username: this.username,
          roomID: this.roomID,
        }),
      );
    };

    this.socket.onmessage = this.handleWebSocketMessage.bind(this);

    this.socket.onerror = (error) => {
      this.controller.showErrorModal(
        "WebSocket error occurred. Please refresh the page.",
      );
      console.error("WebSocket error:", error);
    };

    this.socket.onclose = () => {
      console.log("WebSocket connection closed.");
    };
  }
}

export default WebSocketFunWithFlags;
