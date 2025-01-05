const elements = {
  joinRoomBtn: document.getElementById("join-room-btn"),
  errorMessage: document.getElementById("error-message"),
  joinRoomForm: document.getElementById("question-modal"),
  roomCode: document.getElementById("room-code"),
  username: document.getElementById("username"),
  roomCodeInput: document.getElementById("roomcode"),
};

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
    const roomcode = elements.roomCodeInput.value.trim();

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

    if (!roomcode) {
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
        roomcode: roomcode,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "An unknown error occurred.");
    }

    const data = await response.json();

    document.getElementById("room-code-value").textContent = data.code;
    document.getElementById("host-name-value").textContent = data.host;
    document.getElementById("num-players-value").textContent = Object.keys(
      data.players,
    ).length;

    elements.joinRoomForm.classList.add("hidden");
    elements.roomCode.classList.remove("hidden");

    populatePlayerList(data.players);
  } catch (error) {
    showError(error.message);
  }
}

function populatePlayerList(players) {
  const playerList = document.getElementById("player-list");
  playerList.innerHTML = "";

  Object.values(players).forEach((player) => {
    const li = document.createElement("li");
    li.textContent = player.Username;
    playerList.appendChild(li);
  });
}

elements.joinRoomBtn.addEventListener("click", joinRoom);
