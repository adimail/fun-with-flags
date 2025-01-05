const elements = {
  joinRoomBtn: document.getElementById("join-room-btn"),
  errorMessage: document.getElementById("error-message"),
  joinRoomForm: document.getElementById("question-modal"),
  roomID: document.getElementById("room-code"),
  username: document.getElementById("username"),
  roomIDInput: document.getElementById("roomID"),
  playerList: document.getElementById("player-list"),
  numPlayersValue: document.getElementById("num-players-value"),
};

let socket;

const showError = (message) => {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
};

const hideError = () => {
  elements.errorMessage.textContent = "";
  elements.errorMessage.classList.add("hidden");
};

const populatePlayerList = (players) => {
  elements.playerList.innerHTML = ""; // Clear the list
  players.forEach((player) => {
    if (player.username && player.score !== undefined) {
      const li = document.createElement("li");
      li.textContent = `${player.username} (Score: ${player.score})`;
      elements.playerList.appendChild(li);
    }
  });
  elements.numPlayersValue.textContent = players.length;
};

const handleWebSocketMessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.event) {
    case "playerJoined":
      updatePlayerList(message.data.username, message.data.score);
      break;
    case "playerLeft":
      removePlayer(message.data);
      break;
    case "scoreUpdated":
      updatePlayerScore(message.data.username, message.data.score);
      break;
    default:
      console.warn("Unhandled WebSocket event:", message.event);
  }
};

const openWebSocketConnection = (roomID, username) => {
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    socket.send(JSON.stringify({ event: "joinRoom", username, roomID }));
  };

  socket.onmessage = handleWebSocketMessage;

  socket.onerror = (error) => {
    showError("WebSocket error occurred.");
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed.");
  };
};

const updatePlayerList = (username, score = 0) => {
  const existingPlayers = Array.from(elements.playerList.children);
  const alreadyExists = existingPlayers.some((li) =>
    li.textContent.startsWith(username),
  );

  if (!alreadyExists) {
    const li = document.createElement("li");
    li.textContent = `${username} (Score: ${score})`;
    elements.playerList.appendChild(li);
    elements.numPlayersValue.textContent =
      parseInt(elements.numPlayersValue.textContent, 10) + 1;
  }
};

const removePlayer = (username) => {
  const playerItems = Array.from(elements.playerList.children);
  playerItems.forEach((li) => {
    if (li.textContent.startsWith(username)) {
      elements.playerList.removeChild(li);
      elements.numPlayersValue.textContent =
        parseInt(elements.numPlayersValue.textContent, 10) - 1;
    }
  });
};

const updatePlayerScore = (username, score) => {
  const playerItems = Array.from(elements.playerList.children);
  playerItems.forEach((li) => {
    if (li.textContent.startsWith(username)) {
      li.textContent = `${username} (Score: ${score})`;
    }
  });
};

const joinRoom = async () => {
  try {
    const username = elements.username.value.trim();
    const roomID = elements.roomIDInput.value.trim();

    hideError();

    if (!username || username.length < 4 || username.length > 10) {
      showError("Username must be between 4 and 10 characters.");
      return;
    }

    const response = await fetch("/api/joinroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, roomID }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Unknown error.");
    }

    const data = await response.json();
    populatePlayerList(data.players);
    openWebSocketConnection(data.code, username);

    elements.joinRoomForm.classList.add("hidden");
    elements.roomID.classList.remove("hidden");
  } catch (error) {
    showError(error.message);
  }
};

elements.joinRoomBtn.addEventListener("click", joinRoom);
