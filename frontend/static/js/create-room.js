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
};

let socket;

function handleRangeInput(event, displayElement) {
  displayElement.textContent = event.target.value;
}

elements.numQuestions.addEventListener("input", (e) =>
  handleRangeInput(e, elements.rangeValueQ),
);

elements.timeLimit.addEventListener("input", (e) =>
  handleRangeInput(e, elements.rangeValueT),
);

async function copyroomID(roomID) {
  try {
    await navigator.clipboard.writeText(roomID);
    alert("Room code copied to clipboard!");
  } catch (err) {
    console.error("Could not copy room code:", err);
  }
}

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
}

function hideError() {
  elements.errorMessage.textContent = "";
  elements.errorMessage.classList.add("hidden");
}

async function createRoom() {
  try {
    const timeLimit = elements.timeLimit.value;
    const numQuestions = elements.numQuestions.value;
    const host = elements.hostUsername.value.trim();

    hideError();

    // Validate username
    if (!host) {
      showError("Please enter your username.");
      return;
    }
    if (host.length < 4) {
      showError("Username must be at least 4 characters long.");
      return;
    }
    if (host.length > 10) {
      showError("Username must be less than 10 characters long.");
      return;
    }

    // Validate other inputs
    if (
      !timeLimit ||
      !numQuestions ||
      isNaN(timeLimit) ||
      isNaN(numQuestions)
    ) {
      showError(
        "Please enter valid values for time limit and number of questions.",
      );
      return;
    }

    const response = await fetch("/api/createroom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeLimit: parseInt(timeLimit),
        numQuestions: parseInt(numQuestions),
        hostUsername: host,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "An unknown error occurred.");
    }

    const data = await response.json();

    elements.roomIDValue.textContent = data.code;
    elements.numQuestionsValue.textContent = data.numQuestions;
    elements.timeLimitValue.textContent = data.timeLimit / 60;
    document.getElementById("host-name-value").textContent = data.host;
    document.getElementById("num-players-value").textContent = Object.keys(
      data.players,
    ).length;

    elements.createRoomForm.classList.add("hidden");
    elements.roomID.classList.remove("hidden");

    elements.copyroomID.addEventListener("click", () => copyroomID(data.code));

    populatePlayerList(data.players);

    openWebSocketConnection(data.code, host);
  } catch (error) {
    showError(error.message);
  }
}

function populatePlayerList(players) {
  const playerList = document.getElementById("player-list");
  playerList.innerHTML = "";

  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player.Username || player.username;
    playerList.appendChild(li);
  });

  document.getElementById("num-players-value").textContent = players.length;
}

let currentroomID = null;

function openWebSocketConnection(roomID, username) {
  currentroomID = roomID;
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("[WebSocket] Connection established");

    const initialMessage = {
      username: username,
      roomID: roomID,
    };
    console.log("[WebSocket] Sending initial message:", initialMessage);
    socket.send(JSON.stringify(initialMessage));
  };

  socket.onmessage = (event) => {
    console.log("[WebSocket] Message received:", event.data);

    try {
      const message = JSON.parse(event.data);
      console.log("[WebSocket] Parsed message:", message);

      if (
        message.event === "playerJoined" &&
        message.roomID === currentroomID
      ) {
        console.log(
          "[WebSocket] Relevant playerJoined event for room:",
          currentroomID,
        );
        updatePlayerList(message.data.username);
      } else {
        console.warn("[WebSocket] Irrelevant message for this room:", message);
      }
    } catch (error) {
      console.error("[WebSocket] Error parsing message:", event.data, error);
    }
  };

  socket.onerror = (error) => {
    console.error("[WebSocket] Error:", error);
    showError("WebSocket connection error. Please try again.");
  };

  socket.onclose = () => {
    console.log("[WebSocket] Connection closed");
    currentroomID = null;
  };
}

function updatePlayerList(newPlayerName) {
  console.log("[UpdatePlayerList] Updating player list with:", newPlayerName);

  const playerList = document.getElementById("player-list");

  const existingPlayer = Array.from(playerList.children).some(
    (li) => li.textContent === newPlayerName,
  );

  if (!existingPlayer) {
    console.log(
      "[UpdatePlayerList] Player not in the list, adding:",
      newPlayerName,
    );
    const li = document.createElement("li");
    li.textContent = newPlayerName;
    playerList.appendChild(li);

    const playerCountElement = document.getElementById("num-players-value");
    playerCountElement.textContent =
      parseInt(playerCountElement.textContent) + 1;
    console.log(
      "[UpdatePlayerList] Player count updated to:",
      playerCountElement.textContent,
    );
  } else {
    console.log(
      "[UpdatePlayerList] Player already exists in the list:",
      newPlayerName,
    );
  }
}

elements.createRoomBtn.addEventListener("click", createRoom);
