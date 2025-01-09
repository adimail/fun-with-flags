import GameLogic from "./game.js";

class MultiplayerGameController {
  constructor() {
    this.elements = this.cacheElements();
    this.username = localStorage.getItem("username");
    this.roomID = new URLSearchParams(window.location.search).get("id");
    this.socket = null;
    this.funwithflags = new GameLogic();
    this.currentquestionindex = 0;
    this.currentquestion = null;
    this.gametype = null;
    this.totalquestions = 0;

    this.initEventListeners();
    this.initializeRoom();
  }

  cacheElements() {
    return {
      // waiting room
      waitingroom: document.getElementById("waiting-room"),

      // room info table
      roomCode: document.getElementById("room-code-value"),
      hostName: document.getElementById("host-name-value"),
      numPlayers: document.getElementById("num-players-value"),
      numQuestions: document.getElementById("num-questions-value"),
      gamemode: document.getElementById("gamemode-value"),
      timeLimit: document.getElementById("time-limit-value"),
      playername: document.getElementById("username-value"),
      playerList: document.getElementById("player-list"),

      // modals and messages
      errorMessage: document.getElementById("error-message"),
      modal: document.getElementById("question-modal"),
      modalUsernameInput: document.getElementById("username"),
      modalJoinButton: document.getElementById("join-room-btn"),
      errorModal: document.getElementById("room-error-modal"),
      errorModalMessage: document.getElementById("room-error-message"),

      // Game elements
      flag: document.getElementById("flag"),
      options: document.getElementById("options"),
      progressMCQ: document.getElementById("progress-mcq"),
      progressMap: document.getElementById("progress-map"),
      game: document.getElementById("game"),
      gameModal: document.getElementById("game-modal"),
      finalScore: document.getElementById("final-score"),
      startGameBtn: document.getElementById("start-game-btn"),
      gameMCQ: document.getElementById("game-mcq"),
      gameMap: document.getElementById("game-map"),
      flagMap: document.getElementById("flag-map"),
      mapContainer: document.querySelector(".map-container"),
    };
  }

  initEventListeners() {
    this.elements.modalJoinButton.addEventListener("click", () => {
      const inputUsername = this.elements.modalUsernameInput.value.trim();
      if (
        !inputUsername ||
        inputUsername.length < 4 ||
        inputUsername.length > 20
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

  toggleVisibility(element, visible) {
    element.classList.toggle("hidden", !visible);
  }

  showErrorModal(message) {
    this.elements.waitingroom.classList.add("hidden");
    this.elements.errorModalMessage.textContent = message;
    this.elements.errorModal.classList.remove("hidden");
  }

  showError(message) {
    this.elements.errorMessage.textContent = message;
    this.toggleVisibility(this.elements.errorMessage, true);
  }

  hideError() {
    this.elements.errorMessage.textContent = "";
    this.toggleVisibility(this.elements.errorMessage, false);
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
    this.elements.gamemode.textContent = data.gamemode;
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
      this.totalquestions = data.numQuestions;
      this.elements.playername.textContent = this.username;
      this.gametype = data.gamemode;

      const isHost = this.username === data.host;
      const gameStartContainer = document.querySelector(".game-start");
      const button = gameStartContainer.querySelector("button");
      const message = gameStartContainer.querySelector("p");

      if (isHost) {
        button.classList.remove("hidden");
        message.classList.add("hidden");
        button.addEventListener("click", () => {
          this.startGame();
        });
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
    }
  }

  startGame() {
    this.toggleVisibility(this.elements.waitingroom, false);
    console.log("Host started the game");

    const countdownSection = document.createElement("section");
    countdownSection.className = "countdown-container";

    const textElement = document.createElement("p");
    textElement.textContent = "The game begins in";
    countdownSection.appendChild(textElement);

    const numberElement = document.createElement("h2");
    numberElement.className = "countdown-number";
    countdownSection.appendChild(numberElement);

    document.body.appendChild(countdownSection);

    // Countdown logic
    let count = 3;
    const countdownInterval = setInterval(() => {
      if (count > 0) {
        numberElement.textContent = count;
        count--;
      } else if (count === 0) {
        numberElement.textContent = "START!";
        count--;
      } else {
        clearInterval(countdownInterval);
        countdownSection.remove();
        console.log("Game began");
      }
    }, 1000);

    //try {
    //  this.toggleVisibility(this.elements.game, false);
    //
    //  if (this.gametype === "MAP") {
    //    this.funwithflags.loadMapCSSAndJS(() => {
    //      this.funwithflags.initializeMap("map");
    //    });
    //  }
    //
    //  this.toggleVisibility(this.elements.game, true);
    //} catch {
    //  this.showError("An error occurred while starting the game.");
    //}
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
