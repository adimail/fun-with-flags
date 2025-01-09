const urlParams = new URLSearchParams(window.location.search);
const roomID = urlParams.get("id");

let username = localStorage.getItem("username");
let socket;

const elements = {
  roomInfoTable: document.getElementById("room-details"),
  playername: document.getElementById("username-value"),
  playerList: document.getElementById("player-list"),
  errorMessage: document.getElementById("error-message"),
  roomCode: document.getElementById("room-code-value"),
  hostName: document.getElementById("host-name-value"),
  numPlayers: document.getElementById("num-players-value"),
  numQuestions: document.getElementById("num-questions-value"),
  timeLimit: document.getElementById("time-limit-value"),
  modal: document.getElementById("question-modal"),
  modalUsernameInput: document.getElementById("username"),
  modalJoinButton: document.getElementById("join-room-btn"),
  errorModal: document.getElementById("room-error-modal"),
  errorModalMessage: document.getElementById("room-error-message"),
};

const showErrorModal = (message) => {
  elements.roomInfoTable.classList.add("hidden");
  elements.errorModalMessage.textContent = message;
  elements.errorModal.classList.remove("hidden");
};

const showError = (message) => {
  elements.errorMessage.textContent = message;
  elements.errorMessage.classList.remove("hidden");
};

const hideError = () => {
  elements.errorMessage.textContent = "";
  elements.errorMessage.classList.add("hidden");
};

const askForUsername = () => {
  elements.modal.classList.remove("hidden");
};

const closeModal = () => {
  elements.modal.classList.add("hidden");
};

const populateRoomInfo = (data) => {
  elements.roomCode.textContent = data.code;
  elements.hostName.textContent = data.host;
  elements.numPlayers.textContent = data.players.length;
  elements.numQuestions.textContent = data.numQuestions;
  elements.timeLimit.textContent = data.timeLimit;
};

const populatePlayerList = (players) => {
  elements.playerList.innerHTML = "";
  players.forEach((player) => {
    const li = document.createElement("li");
    li.textContent = `${player.username}`;
    elements.playerList.appendChild(li);
  });
};

const handleWebSocketMessage = (event) => {
  const message = JSON.parse(event.data);
  switch (message.event) {
    case "playerJoined":
      addPlayerToList(message.data.username);
      updatePlayerCount();
      break;
    case "playerLeft":
      removePlayerFromList(message.data.username);
      updatePlayerCount();
      break;
    case "gameStarted":
      console.log("Game started!");
      break;
    default:
      console.warn("Unhandled WebSocket event:", message.event);
  }
};

const openWebSocketConnection = () => {
  socket = new WebSocket("ws://localhost:8080/ws");

  socket.onopen = () => {
    socket.send(JSON.stringify({ event: "joinRoom", username, roomID }));
  };

  socket.onmessage = handleWebSocketMessage;

  socket.onerror = (error) => {
    showErrorModal("WebSocket error occurred. Please refresh the page.");
    console.error("WebSocket error:", error);
  };

  socket.onclose = () => {
    console.log("WebSocket connection closed.");
  };
};

const addPlayerToList = (username) => {
  const li = document.createElement("li");
  li.textContent = `${username}`;
  elements.playerList.appendChild(li);
};

const removePlayerFromList = (username) => {
  const items = Array.from(elements.playerList.children);
  items.forEach((li) => {
    if (li.textContent === username) {
      li.remove();
    }
  });
};

const updatePlayerCount = () => {
  elements.numPlayers.textContent = elements.playerList.children.length;
};

const fetchRoomDetails = async () => {
  try {
    const response = await fetch(`/api/room/${roomID}`);
    if (!response.ok) {
      if (response.status === 404) {
        showErrorModal("Room not found or has ended.");
      } else {
        throw new Error("Failed to fetch room details.");
      }
      return;
    }

    const data = await response.json();
    populateRoomInfo(data);
    populatePlayerList(data.players);
    openWebSocketConnection();

    const isHost = username === data.host;

    const gameStartContainer = document.querySelector(".game-start");
    const button = gameStartContainer.querySelector("button");
    const message = gameStartContainer.querySelector("p");

    if (isHost) {
      button.classList.remove("hidden");
      message.classList.add("hidden");
    } else {
      button.classList.add("hidden");
      message.classList.remove("hidden");
    }
  } catch (error) {
    showErrorModal(error.message);
  }
};

const initializeRoom = () => {
  if (!username) {
    askForUsername();
  } else {
    fetchRoomDetails();
    elements.playername.textContent = username;
  }
};

elements.modalJoinButton.addEventListener("click", () => {
  const inputUsername = elements.modalUsernameInput.value.trim();
  if (!inputUsername || inputUsername.length < 4 || inputUsername.length > 10) {
    showError("Username must be between 4 and 10 characters.");
    return;
  }

  username = inputUsername;
  localStorage.setItem("username", username);
  closeModal();
  fetchRoomDetails();
});

initializeRoom();
