class WebSocketFunWithFlags {
  constructor(roomID, username, controller) {
    this.roomID = roomID;
    this.username = username;
    this.controller = controller;
    this.socket = null;

    this.controller.socket = this.openWebSocketConnection();
  }

  handleWebSocketMessage(event) {
    const message = JSON.parse(event.data);
    switch (message.event) {
      case "playerJoined":
        this.controller.addPlayer(message.data.id, message.data.username);
        this.controller.updatePlayerCount();
        break;
      case "playerLeft":
        this.controller.removePlayer(message.data.id, message.data.username);
        this.controller.updatePlayerCount();
        break;
      case "countdown":
        this.controller.hidewaitingroom();
        this.renderCountdown(message.data);
        break;
      case "gameStarted":
        console.log("Game started");
        this.controller.startGame();
        this.requestQuestion(1);
        break;
      case "new_question":
        this.controller.displayQuestion(message.data);
        break;
      case "answer_result":
        this.controller.handleAnswer(message.data);
        break;
      case "score":
        this.controller.scoreUpdate(message.data);
      default:
        console.warn("Unhandled WebSocket event:", message.event);
    }
  }

  renderCountdown(count) {
    const countdownSection =
      document.querySelector(".countdown-container") ||
      document.createElement("section");

    if (!document.body.contains(countdownSection)) {
      countdownSection.className = "countdown-container";
      const textElement = document.createElement("p");
      textElement.textContent = "The game begins in";
      countdownSection.appendChild(textElement);

      const numberElement = document.createElement("h2");
      numberElement.className = "countdown-number";
      countdownSection.appendChild(numberElement);

      document.body.appendChild(countdownSection);
    }

    const numberElement = countdownSection.querySelector(".countdown-number");
    if (count === 0) {
      numberElement.textContent = "START!";
      setTimeout(() => countdownSection.remove(), 1000);
    } else {
      numberElement.textContent = count;
    }
  }

  openWebSocketConnection() {
    const socket = new WebSocket("ws://localhost:8080/ws");

    socket.onopen = () => {
      console.log("WebSocket connection established.");
      socket.send(
        JSON.stringify({
          event: "joinRoom",
          username: this.username,
          roomID: this.roomID,
        }),
      );
    };

    socket.onmessage = this.handleWebSocketMessage.bind(this);

    socket.onerror = (error) => {
      this.controller.showErrorModal(
        "WebSocket error occurred. Please refresh the page.",
      );
      console.error("WebSocket error:", error);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed.");
    };

    return socket;
  }
}

export default WebSocketFunWithFlags;
