document.getElementById("game").classList.add("hidden");
document.getElementById("num-questions").addEventListener("input", function () {
  const numQuestions = this.value;
  document.getElementById("range-value").textContent = numQuestions;
});

async function fetchQuestions(numQuestions) {
  const response = await fetch("/api/singleplayer", {
    method: "GET",
    headers: {
      "X-Num-Questions": numQuestions.toString(),
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch questions.");
  }
  return response.json();
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function updateProgress(currentIndex, totalQuestions) {
  const progressElement = document.getElementById("progress");
  progressElement.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
}

function loadQuestion(question, currentIndex, totalQuestions, callback) {
  document.getElementById("flag").src = question.flag_url;

  updateProgress(currentIndex, totalQuestions);

  const optionsArray = [...question.options];
  shuffleArray(optionsArray);

  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = "";

  optionsArray.forEach((option) => {
    const button = document.createElement("button");
    button.textContent = option;
    button.className = "option";
    button.onclick = () =>
      handleAnswer(
        button,
        option === question.answer,
        question.answer,
        callback,
      );
    optionsContainer.appendChild(button);
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

function showGameOverModal(score, totalQuestions) {
  const modal = document.getElementById("game-modal");
  const finalScoreElement = document.getElementById("final-score");

  finalScoreElement.textContent = `Your score: ${score}/${totalQuestions}`;
  modal.classList.remove("hidden");
}

function hideQuestionModal() {
  const modal = document.getElementById("question-modal");
  modal.classList.add("hidden");
}

function showErrorMessage(message) {
  const errorMessageElement = document.getElementById("error-message");
  errorMessageElement.textContent = message;
  errorMessageElement.classList.remove("hidden");
}

async function startGame() {
  const numQuestions = parseInt(document.getElementById("num-questions").value);

  if (isNaN(numQuestions) || numQuestions <= 0) {
    showErrorMessage("Please enter a valid number of questions.");
    return;
  }

  try {
    hideQuestionModal();
    document.getElementById("game").classList.add("hidden");

    const questions = await fetchQuestions(numQuestions);
    document.getElementById("game").classList.remove("hidden");
    document.getElementById("game").classList.remove("hidden");

    let currentIndex = 0;
    let score = 0;

    function nextQuestion(correct) {
      if (correct) score++;
      console.log(`Current Score: ${score}`);
      currentIndex++;
      if (currentIndex < questions.length) {
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

    document.getElementById("endgame").onclick = () => {
      showGameOverModal(score, questions.length);
    };
  } catch (error) {
    showErrorMessage("An error occurred while fetching the game data.");
  }
}

document.getElementById("start-game-btn").onclick = startGame;
