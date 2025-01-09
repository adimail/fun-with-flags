class MultiplayerGameController {
  constructor() {
    this.elements = this.cacheElements();
    this.username = localStorage.getItem("username");
    this.roomID = new URLSearchParams(window.location.search).get("id");
    this.socket = null;

    this.initEventListeners();
    this.initializeRoom();
  }

  cacheElements() {
    return {
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
  }

  initEventListeners() {
    this.elements.modalJoinButton.addEventListener("click", () => {
      const inputUsername = this.elements.modalUsernameInput.value.trim();
      if (
        !inputUsername ||
        inputUsername.length < 4 ||
        inputUsername.length > 10
      ) {
        this.showError("Username must be between 4 and 10 characters.");
        return;
      }

      this.username = inputUsername;
      localStorage.setItem("username", this.username);
      this.closeModal();
      this.fetchRoomDetails();
    });
  }

  showErrorModal(message) {
    this.elements.roomInfoTable.classList.add("hidden");
    this.elements.errorModalMessage.textContent = message;
    this.elements.errorModal.classList.remove("hidden");
  }

  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.elements.errorMessage.classList.remove("hidden");
  }

  hideError() {
    this.elements.errorMessage.textContent = "";
    this.elements.errorMessage.classList.add("hidden");
  }

  askForUsername() {
    this.elements.modal.classList.remove("hidden");
  }

  closeModal() {
    this.elements.modal.classList.add("hidden");
  }

  populateRoomInfo(data) {
    this.elements.roomCode.textContent = data.code;
    this.elements.hostName.textContent = data.host;
    this.elements.numPlayers.textContent = data.players.length;
    this.elements.numQuestions.textContent = data.numQuestions;
    this.elements.timeLimit.textContent = data.timeLimit;
  }

  populatePlayerList(players) {
    this.elements.playerList.innerHTML = "";
    players.forEach((player) => {
      const li = document.createElement("li");
      li.textContent = `${player.username}`;
      this.elements.playerList.appendChild(li);
    });
  }

  fetchRoomDetails = async () => {
    try {
      const response = await fetch(`/api/room/${this.roomID}`);
      if (!response.ok) {
        if (response.status === 404) {
          this.showErrorModal("Room not found or has ended.");
        } else {
          throw new Error("Failed to fetch room details.");
        }
        return;
      }

      const data = await response.json();
      this.populateRoomInfo(data);
      this.populatePlayerList(data.players);

      const isHost = this.username === data.host;
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
      this.showErrorModal(error.message);
    }
  };

  initializeRoom() {
    if (!this.username) {
      this.askForUsername();
    } else {
      this.fetchRoomDetails();
      this.elements.playername.textContent = this.username;
    }
  }

  addPlayerToList(username) {
    const li = document.createElement("li");
    li.textContent = `${username}`;
    this.elements.playerList.appendChild(li);
  }

  removePlayerFromList(username) {
    const items = Array.from(this.elements.playerList.children);
    items.forEach((li) => {
      if (li.textContent === username) {
        li.remove();
      }
    });
  }

  updatePlayerCount() {
    this.elements.numPlayers.textContent =
      this.elements.playerList.children.length;
  }
}

export default MultiplayerGameController;
