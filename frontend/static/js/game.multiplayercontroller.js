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
    this.gamestarted = false;
    this.gameended = false;
    this.ishost = false;

    this.gamePlayers = {}; // Structure: { playerId: { name, score } }

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

      // Leaderboard
      leaderboardIcon: document.querySelector(".leaderboard-icon"),
      sidebar: document.querySelector(".sidebar"),
      closeSidebarBtn: document.querySelector(".close-sidebar"),
      leaderboardBody: document.getElementById("leaderboard-body"),
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

    this.elements.leaderboardIcon.addEventListener("click", () => {
      this.toggleSidebar();
    });
    this.elements.closeSidebarBtn.addEventListener("click", () => {
      this.toggleSidebar();
    });

    document.addEventListener("click", (e) => {
      if (
        !this.elements.sidebar.contains(e.target) &&
        !this.elements.leaderboardIcon.contains(e.target) &&
        this.elements.sidebar.classList.contains("active")
      ) {
        this.toggleSidebar();
      }
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
      this.totalquestions = data.numQuestions;
      this.elements.playername.textContent = this.username;
      this.gametype = data.gamemode;

      data.players.forEach((player) => {
        this.addPlayer(player.id, player.username);
      });

      this.updatePlayerCount();

      const isHost = this.username === data.host;
      const gameStartContainer = document.querySelector(".game-start");
      const button = gameStartContainer.querySelector("button");
      const message = gameStartContainer.querySelector("p");

      if (isHost) {
        this.ishost = true;
        button.classList.remove("hidden");
        message.classList.add("hidden");
        button.addEventListener("click", () => {
          this.loadgame();
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

  hidewaitingroom() {
    this.toggleVisibility(this.elements.waitingroom, false);
  }

  loadgame() {
    if (!this.ishost) {
      alert("Only the game host can start the game, you are not the host.");
      return;
    }

    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.error("WebSocket is not open. Cannot start the game.");
      return;
    }

    this.hidewaitingroom();

    console.log("Host started the game");
    this.gamestarted = true;

    this.socket.send(JSON.stringify({ event: "loadgame" }));
  }

  startGame() {
    try {
      if (this.gametype === "MAP") {
        this.funwithflags.loadMapCSSAndJS(() => {
          this.funwithflags.initializeMap("map");
        });
      }

      this.toggleVisibility(this.elements.game, true);
      console.log("Game rendered. You can play now...");
    } catch {
      this.showError("An error occurred while starting the game.");
    }
  }

  // send from websocketclient
  requestQuestion(questionNumber) {
    if (
      typeof questionNumber !== "number" ||
      questionNumber < 1 ||
      questionNumber > this.totalquestions
    ) {
      console.error("Invalid question number.");
      return;
    }
    this.socket.send(
      JSON.stringify({
        event: "get_new_question",
        data: {
          roomID: this.roomID,
          playerID: this.username,
          question_number: questionNumber,
        },
      }),
    );
  }

  // send from game controller
  validateAnswer(question, answer, playerid) {
    if (!question || typeof question !== "string") {
      console.error("Invalid question id.");
      return;
    }
    if (!answer || typeof answer !== "string") {
      console.error("Invalid Answer.");
      return;
    }

    this.socket.send(
      JSON.stringify({
        event: "validate_answer",
        data: {
          roomID: this.roomID,
          question: question,
          answer: answer,
          playerid: playerid,
        },
      }),
    );
  }

  //
  // UI event handlers
  //
  populatePlayerList(players) {
    this.elements.playerList.innerHTML = "";
    players.forEach((player) => {
      const li = document.createElement("li");
      li.textContent = `${player.username}`;
      li.setAttribute("data-id", player.id);
      this.elements.playerList.appendChild(li);
    });

    const leaderboardData = players
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .map((player, index) => ({
        rank: index + 1,
        name: player.username,
        score: player.score || 0,
      }));
    this.renderLeaderboard(leaderboardData);
  }

  syncUI() {
    const players = Object.entries(this.gamePlayers).map(([id, player]) => ({
      id,
      username: player.name,
      score: player.score,
    }));
    this.populatePlayerList(players);
  }

  toggleSidebar() {
    this.elements.sidebar.classList.toggle("active");
  }

  renderLeaderboard(data) {
    this.elements.leaderboardBody.innerHTML = data
      .map(
        (player) => `
      <tr>
        <td>${player.rank}</td>
        <td>${player.name}</td>
        <td>${player.score}</td>
      </tr>
    `,
      )
      .join("");
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
    this.elements.numPlayers.textContent = Object.keys(this.gamePlayers).length;
    this.elements.numQuestions.textContent = data.numQuestions;
    this.elements.timeLimit.textContent = data.timeLimit;
    this.elements.gamemode.textContent = data.gamemode;
  }

  //
  // Handle websocket events related to players and game state
  //
  addPlayer(playerId, playerName) {
    if (!this.gamePlayers[playerId]) {
      this.gamePlayers[playerId] = { name: playerName, score: 0 };
    }
    this.syncUI();
  }

  removePlayer(playerId, playerName) {
    if (this.gamePlayers[playerId]) {
      if (this.gamePlayers[playerId].name == playerName) {
        delete this.gamePlayers[playerId];
      }
    }
    this.syncUI();
  }

  updateScore(playerId, newScore) {
    if (this.gamePlayers[playerId]) {
      this.gamePlayers[playerId].score = newScore;
    }
    this.syncUI();
  }

  getPlayers() {
    return Object.entries(this.gamePlayers).map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score,
    }));
  }

  updatePlayerCount() {
    const playerCount = Object.keys(this.gamePlayers).length;
    this.elements.numPlayers.textContent = playerCount;
  }

  scoreUpdate(data) {
    const playerElement = Array.from(this.elements.playerList.children).find(
      (li) => li.textContent.includes(data.username),
    );

    if (playerElement) {
      const existingScore = playerElement.querySelector(".score");
      if (existingScore) {
        existingScore.textContent = parseInt(existingScore.textContent) + 1;
      } else {
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "score";
        scoreSpan.textContent = "1";
        playerElement.textContent += ` - `;
        playerElement.appendChild(scoreSpan);
      }
    }
  }
}

export default MultiplayerGameController;
