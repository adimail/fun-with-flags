const elements = {
  numQuestions: document.getElementById("num-questions"),
  timeLimit: document.getElementById("time-limit"),
  createRoomBtn: document.getElementById("create-room-btn"),
  errorMessage: document.getElementById("error-message"),
  roomID: document.getElementById("room-code"),
  createRoomForm: document.getElementById("question-modal"),
  roomIDValue: document.getElementById("room-code-value"),
  numQuestionsValue: document.getElementById("num-questions-value"),
  timeLimitValue: document.getElementById("time-limit-value"),
  rangeValueQ: document.getElementById("range-value-q"),
  rangeValueT: document.getElementById("range-value-t"),
  copyroomID: document.getElementById("copy-room-code"),
  hostUsername: document.getElementById("host-username"),
  playerList: document.getElementById("player-list"),
  numPlayersValue: document.getElementById("num-players-value"),
};

let socket;

const handleRangeInput = (event, displayElement) => {
  displayElement.textContent = event.target.value;
};

const showError = (message) => {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
};

const hideError = () => {
  elements.errorMessage.textContent = "";
  elements.errorMessage.classList.add("hidden");
};

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    alert("Room code copied to clipboard!");
  } catch (err) {
    console.error("Error copying to clipboard:", err);
  }
};

const populatePlayerList = (players) => {
  elements.playerList.innerHTML = "";
  players.forEach((player) => {
    if (player.username && player.score !== undefined) {
      const li = document.createElement("li");
      li.textContent = `${player.username}`;
      elements.playerList.appendChild(li);
    }
  });
  elements.numPlayersValue.textContent = players.length;
};

const handleWebSocketMessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.event) {
    case "playerJoined":
      updatePlayerList(message.data.username);
      break;
    case "playerLeft":
    case "playerDisconnected":
      removePlayer(message.data);
      break;
    case "scoreUpdated":
      updatePlayerScore(message.data.username);
      break;
    default:
      console.warn("Unhandled WebSocket event:", message.event);
  }
};

const openWebSocketConnection = (roomID, username) => {
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    socket.send(JSON.stringify({ username, roomID }));
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

const updatePlayerList = (username) => {
  const existingPlayers = Array.from(elements.playerList.children);
  const alreadyExists = existingPlayers.some((li) =>
    li.textContent.startsWith(username),
  );

  if (!alreadyExists) {
    const li = document.createElement("li");
    li.textContent = `${username}`;
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

const updatePlayerScore = (username) => {
  const playerItems = Array.from(elements.playerList.children);
  playerItems.forEach((li) => {
    if (li.textContent.startsWith(username)) {
      li.textContent = `${username}`;
    }
  });
};

const createRoom = async () => {
  try {
    const timeLimit = parseInt(elements.timeLimit.value, 10);
    const numQuestions = parseInt(elements.numQuestions.value, 10);
    const host = elements.hostUsername.value.trim();

    hideError();

    if (!host || host.length < 4 || host.length > 10) {
      showError("Username must be between 4 and 10 characters.");
      return;
    }

    const response = await fetch("/api/createroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeLimit, numQuestions, hostUsername: host }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Unknown error.");
    }

    const data = await response.json();
    elements.roomIDValue.textContent = data.code;
    elements.numQuestionsValue.textContent = data.numQuestions;
    elements.timeLimitValue.textContent = data.timeLimit;
    document.getElementById("host-name-value").textContent = data.host;

    elements.createRoomForm.classList.add("hidden");
    elements.roomID.classList.remove("hidden");

    populatePlayerList(data.players);
    openWebSocketConnection(data.code, host);
  } catch (error) {
    showError(error.message);
  }
};

elements.numQuestions.addEventListener("input", (e) =>
  handleRangeInput(e, elements.rangeValueQ),
);
elements.timeLimit.addEventListener("input", (e) =>
  handleRangeInput(e, elements.rangeValueT),
);
elements.createRoomBtn.addEventListener("click", createRoom);
