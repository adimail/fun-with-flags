const elements = {
  numQuestions: document.getElementById("num-questions"),
  timeLimit: document.getElementById("time-limit"),
  createRoomBtn: document.getElementById("create-room-btn"),
  errorMessage: document.getElementById("error-message"),
  roomCode: document.getElementById("room-code"),
  createRoomForm: document.getElementById("question-modal"),
  roomCodeValue: document.getElementById("room-code-value"),
  numQuestionsValue: document.getElementById("num-questions-value"),
  timeLimitValue: document.getElementById("time-limit-value"),
  rangeValueQ: document.getElementById("range-value-q"),
  rangeValueT: document.getElementById("range-value-t"),
  copyRoomCode: document.getElementById("copy-room-code"),
  hostUsername: document.getElementById("host-username"),
};

function handleRangeInput(event, displayElement) {
  displayElement.textContent = event.target.value;
}

elements.numQuestions.addEventListener("input", (e) =>
  handleRangeInput(e, elements.rangeValueQ),
);

elements.timeLimit.addEventListener("input", (e) =>
  handleRangeInput(e, elements.rangeValueT),
);

async function copyRoomCode(roomCode) {
  try {
    await navigator.clipboard.writeText(roomCode);
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

    elements.roomCodeValue.textContent = data.roomCode;
    elements.numQuestionsValue.textContent = numQuestions;
    elements.timeLimitValue.textContent = timeLimit;

    elements.createRoomForm.classList.add("hidden");
    elements.roomCode.classList.remove("hidden");

    elements.copyRoomCode.addEventListener("click", () =>
      copyRoomCode(data.roomCode),
    );
  } catch (error) {
    showError(error.message);
  }
}

elements.createRoomBtn.addEventListener("click", createRoom);
