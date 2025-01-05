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
let currentroomID = null;

const showError = (message) => {
  console.log("[Error] Show:", message);
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
};

const hideError = () => {
  console.log("[Error] Hide");
  elements.errorMessage.textContent = "";
  elements.errorMessage.classList.add("hidden");
};

const populatePlayerList = (players) => {
  console.log("[PlayerList] Populating with:", players);
  elements.playerList.innerHTML = "";
  Object.values(players).forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player.Username || player.username;
    elements.playerList.appendChild(li);
  });
  elements.numPlayersValue.textContent = Object.keys(players).length;
};

const openWebSocketConnection = (roomID, username) => {
  console.log("[WebSocket] Opening for room:", roomID);
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("[WebSocket] Connection established");
    socket.send(JSON.stringify({ event: "joinRoom", username, roomID }));
  };

  socket.onmessage = (event) => {
    console.log("[WebSocket] Message:", event.data);
    try {
      const message = JSON.parse(event.data);
      if (
        message.roomID === currentroomID &&
        message.event === "playerJoined"
      ) {
        console.log("[WebSocket] Player joined:", message.data.username);
        updatePlayerList(message.data.username);
      }
    } catch (error) {
      console.error("[WebSocket] Parse error:", error);
    }
  };

  socket.onerror = (error) => {
    console.error("[WebSocket] Error:", error);
    showError("WebSocket error.");
  };

  socket.onclose = () => {
    console.log("[WebSocket] Closed");
  };
};

const updatePlayerList = (newPlayerName) => {
  console.log("[PlayerList] Adding:", newPlayerName);
  const existingPlayer = Array.from(elements.playerList.children).some(
    (li) => li.textContent === newPlayerName,
  );

  if (!existingPlayer) {
    const li = document.createElement("li");
    li.textContent = newPlayerName;
    elements.playerList.appendChild(li);
    elements.numPlayersValue.textContent =
      parseInt(elements.numPlayersValue.textContent) + 1;
  }
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

    if (!roomID) {
      showError("Please enter the room code.");
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
    console.log("[JoinRoom] Joined:", data);

    currentroomID = data.code;
    document.getElementById("room-code-value").textContent = data.code;
    document.getElementById("host-name-value").textContent = data.host;

    elements.joinRoomForm.classList.add("hidden");
    elements.roomID.classList.remove("hidden");

    populatePlayerList(data.players);
    openWebSocketConnection(data.code, username);
  } catch (error) {
    showError(error.message);
  }
};

elements.joinRoomBtn.addEventListener("click", joinRoom);
