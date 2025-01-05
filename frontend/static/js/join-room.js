const elements = {
  joinRoomBtn: document.getElementById("join-room-btn"),
  errorMessage: document.getElementById("error-message"),
  joinRoomForm: document.getElementById("question-modal"),
  roomID: document.getElementById("room-code"),
  username: document.getElementById("username"),
  roomIDInput: document.getElementById("roomID"),
};

let socket;
let currentroomID = null;

function showError(message) {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
}

function hideError() {
  elements.errorMessage.textContent = "";
  elements.errorMessage.classList.add("hidden");
}

async function joinRoom() {
  try {
    const username = elements.username.value.trim();
    const roomID = elements.roomIDInput.value.trim();

    hideError();

    if (!username) {
      showError("Please enter your username.");
      return;
    }
    if (username.length < 4) {
      showError("Username must be at least 4 characters long.");
      return;
    }
    if (username.length > 10) {
      showError("Username must be less than 10 characters long.");
      return;
    }

    if (!roomID) {
      showError("Please enter the room code.");
      return;
    }

    const response = await fetch("/api/joinroom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: username,
        roomID: roomID,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "An unknown error occurred.");
    }

    const data = await response.json();

    // Update the room details
    currentroomID = data.code;
    document.getElementById("room-code-value").textContent = data.code;
    document.getElementById("host-name-value").textContent = data.host;
    document.getElementById("num-players-value").textContent = Object.keys(
      data.players,
    ).length;

    elements.joinRoomForm.classList.add("hidden");
    elements.roomID.classList.remove("hidden");

    populatePlayerList(data.players);

    // Establish WebSocket connection
    openWebSocketConnection(data.code, username);
  } catch (error) {
    showError(error.message);
  }
}

function populatePlayerList(players) {
  const playerList = document.getElementById("player-list");
  playerList.innerHTML = "";

  Object.values(players).forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player.Username || player.username;
    playerList.appendChild(li);
  });

  document.getElementById("num-players-value").textContent =
    Object.keys(players).length;
}

function openWebSocketConnection(roomID, username) {
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("[WebSocket] Connection established");

    const initialMessage = {
      event: "joinRoom",
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

      if (
        message.event === "playerJoined" &&
        message.roomID === currentroomID
      ) {
        console.log("[WebSocket] Player joined:", message.data.username);
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
  const playerList = document.getElementById("player-list");

  const existingPlayer = Array.from(playerList.children).some(
    (li) => li.textContent === newPlayerName,
  );

  if (!existingPlayer) {
    const li = document.createElement("li");
    li.textContent = newPlayerName;
    playerList.appendChild(li);

    const playerCountElement = document.getElementById("num-players-value");
    playerCountElement.textContent =
      parseInt(playerCountElement.textContent) + 1;
  }
}

elements.joinRoomBtn.addEventListener("click", joinRoom);
