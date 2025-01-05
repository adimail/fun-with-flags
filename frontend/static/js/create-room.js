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
  console.log("[RangeInput] Value:", event.target.value);
  displayElement.textContent = event.target.value;
};

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

const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    console.log("[Clipboard] Copied:", text);
    alert("Room code copied to clipboard!");
  } catch (err) {
    console.error("[Clipboard] Error:", err);
  }
};

const populatePlayerList = (players) => {
  console.log("[PlayerList] Populating with:", players);
  elements.playerList.innerHTML = "";
  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player.Username || player.username;
    elements.playerList.appendChild(li);
  });
  elements.numPlayersValue.textContent = players.length;
};

const openWebSocketConnection = (roomID, username) => {
  console.log("[WebSocket] Opening for room:", roomID);
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    console.log("[WebSocket] Connection established");
    socket.send(JSON.stringify({ username, roomID }));
  };

  socket.onmessage = (event) => {
    console.log("[WebSocket] Message:", event.data);
    try {
      const message = JSON.parse(event.data);
      if (message.roomID === roomID && message.event === "playerJoined") {
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

const createRoom = async () => {
  try {
    const timeLimit = elements.timeLimit.value;
    const numQuestions = elements.numQuestions.value;
    const host = elements.hostUsername.value.trim();

    hideError();

    if (!host || host.length < 4 || host.length > 10) {
      showError("Username must be between 4 and 10 characters.");
      return;
    }

    if (
      !timeLimit ||
      !numQuestions ||
      isNaN(timeLimit) ||
      isNaN(numQuestions)
    ) {
      showError("Invalid time limit or question count.");
      return;
    }

    const response = await fetch("/api/createroom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timeLimit: parseInt(timeLimit),
        numQuestions: parseInt(numQuestions),
        hostUsername: host,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Unknown error.");
    }

    const data = await response.json();
    console.log("[CreateRoom] Created:", data);

    elements.roomIDValue.textContent = data.code;
    elements.numQuestionsValue.textContent = data.numQuestions;
    elements.timeLimitValue.textContent = data.timeLimit / 60;
    document.getElementById("host-name-value").textContent = data.host;

    elements.createRoomForm.classList.add("hidden");
    elements.roomID.classList.remove("hidden");

    elements.copyroomID.addEventListener("click", () =>
      copyToClipboard(data.code),
    );

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
