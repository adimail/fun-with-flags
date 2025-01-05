document.getElementById("game").classList.add("hidden");

const elements = {
  rangeValue: document.getElementById("range-value"),
  numQuestions: document.getElementById("num-questions"),
  flag: document.getElementById("flag"),
  options: document.getElementById("options"),
  progress: document.getElementById("progress"),
  errorMessage: document.getElementById("error-message"),
  game: document.getElementById("game"),
  gameModal: document.getElementById("game-modal"),
  finalScore: document.getElementById("final-score"),
  questionModal: document.getElementById("question-modal"),
  startGameBtn: document.getElementById("start-game-btn"),
  endGame: document.getElementById("endgame"),
};

elements.numQuestions.addEventListener("input", function () {
  elements.rangeValue.textContent = this.value;
});

async function fetchQuestions(numQuestions) {
  const response = await fetch("/api/singleplayer", {
    method: "GET",
    headers: { "X-Num-Questions": numQuestions.toString() },
  });
  if (!response.ok) throw new Error("Failed to fetch questions.");
  return response.json();
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function updateElementText(element, text) {
  element.textContent = text;
}

function updateProgress(currentIndex, totalQuestions) {
  updateElementText(
    elements.progress,
    `Question ${currentIndex + 1} of ${totalQuestions}`,
  );
}

function loadQuestion(question, currentIndex, totalQuestions, callback) {
  elements.flag.src = question.flag_url;
  updateProgress(currentIndex, totalQuestions);

  const optionsArray = [...question.options];
  shuffleArray(optionsArray);

  elements.options.innerHTML = optionsArray
    .map((option) => `<button class="option">${option}</button>`)
    .join("");

  Array.from(elements.options.children).forEach((button) => {
    button.onclick = () =>
      handleAnswer(
        button,
        button.textContent === question.answer,
        question.answer,
        callback,
      );
  });
}

function handleAnswer(selectedButton, isCorrect, correctAnswer, callback) {
  const buttons = document.querySelectorAll(".option");
  buttons.forEach((button) => (button.disabled = true));

  if (isCorrect) {
    selectedButton.style.backgroundColor = "#a8d5a2";
    selectedButton.style.color = "#333";
  } else {
    selectedButton.style.backgroundColor = "#f5a9a9";
    selectedButton.style.color = "#333";
    const correctButton = Array.from(buttons).find(
      (button) => button.textContent === correctAnswer,
    );
    if (correctButton) {
      correctButton.style.backgroundColor = "#a8d5a2";
      correctButton.style.color = "#333";
    }
  }

  setTimeout(() => {
    buttons.forEach((button) => (button.disabled = false));
    callback(isCorrect);
  }, 2000);
}

function toggleVisibility(element, visible) {
  element.classList.toggle("hidden", !visible);
}

function showGameOverModal(score, totalQuestions) {
  updateElementText(
    elements.finalScore,
    `Your score: ${score}/${totalQuestions}`,
  );
  toggleVisibility(elements.gameModal, true);
}

function showErrorMessage(message) {
  updateElementText(elements.errorMessage, message);
  toggleVisibility(elements.errorMessage, true);
}

async function startGame() {
  const numQuestions = parseInt(elements.numQuestions.value);

  if (isNaN(numQuestions) || numQuestions <= 0) {
    showErrorMessage("Please enter a valid number of questions.");
    return;
  }

  try {
    toggleVisibility(elements.questionModal, false);
    toggleVisibility(elements.game, false);

    const questions = await fetchQuestions(numQuestions);
    toggleVisibility(elements.game, true);

    let currentIndex = 0,
      score = 0;

    function nextQuestion(correct) {
      if (correct) score++;
      if (++currentIndex < questions.length) {
        loadQuestion(
          questions[currentIndex],
          currentIndex,
          questions.length,
          nextQuestion,
        );
      } else {
        showGameOverModal(score, questions.length);
      }
    }

    loadQuestion(
      questions[currentIndex],
      currentIndex,
      questions.length,
      nextQuestion,
    );

    elements.endGame.onclick = () => showGameOverModal(score, questions.length);
  } catch {
    showErrorMessage("An error occurred while fetching the game data.");
  }
}

elements.startGameBtn.onclick = startGame;
