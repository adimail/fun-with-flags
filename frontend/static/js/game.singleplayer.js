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
  gameMCQ: document.getElementById("game-mcq"),
  gameMap: document.getElementById("game-map"),
  flagMap: document.getElementById("flag-map"),
  mapContainer: document.querySelector(".map-container"),
};

elements.numQuestions.addEventListener("input", function () {
  elements.rangeValue.textContent = this.value;
});

let map;
let vectorSource;
let markerAddingDisabled = false;

function loadMapCSSAndJS(callback) {
  const cssLink = document.createElement("link");
  cssLink.rel = "stylesheet";
  cssLink.href = "https://openlayers.org/en/v4.6.5/css/ol.css";
  document.head.appendChild(cssLink);

  const jsScript = document.createElement("script");
  jsScript.src = "https://openlayers.org/en/v4.6.5/build/ol.js";
  jsScript.onload = callback;
  document.head.appendChild(jsScript);
}

function initializeMap() {
  vectorSource = new ol.source.Vector();
  const vectorLayer = new ol.layer.Vector({
    source: vectorSource,
    style: new ol.style.Style({
      image: new ol.style.Circle({
        radius: 6,
        fill: new ol.style.Fill({ color: "red" }),
      }),
    }),
  });

  var extent = ol.proj.transformExtent(
    [-180, -85, 180, 85],
    "EPSG:4326",
    "EPSG:3857",
  );

  map = new ol.Map({
    target: "map",
    layers: [
      new ol.layer.Tile({
        source: new ol.source.OSM(),
      }),
      vectorLayer,
    ],
    view: new ol.View({
      center: ol.proj.fromLonLat([0, 0]),
      zoom: 2,
      minZoom: 2,
      maxZoom: 2,
      extent: extent,
    }),
  });
}

function addMarker(coords) {
  const marker = new ol.Feature({
    geometry: new ol.geom.Point(coords),
  });
  vectorSource.addFeature(marker);
}

function clearMarkers() {
  vectorSource.clear();
}

function validateMapSelection(userCoords, correctCoords) {
  const tolerance = 200000;
  const distance = ol.sphere.getDistance(
    ol.proj.toLonLat(userCoords),
    ol.proj.toLonLat(correctCoords),
  );
  return distance <= tolerance;
}

function loadQuestion(
  question,
  currentIndex,
  totalQuestions,
  callback,
  gameType,
) {
  updateProgress(currentIndex, totalQuestions);

  if (gameType === "MCQ") {
    toggleVisibility(elements.gameMCQ, true);
    toggleVisibility(elements.gameMap, false);

    elements.flag.src = question.flag_url;
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
  } else if (gameType === "MAP") {
    toggleVisibility(elements.gameMCQ, false);
    toggleVisibility(elements.gameMap, true);

    elements.flagMap.src = question.flag_url;

    clearMarkers();

    map.once("click", (event) => {
      if (markerAddingDisabled) return;

      const userCoords = event.coordinate;
      const correctCoords = ol.proj.fromLonLat([
        question.coordinates.lon,
        question.coordinates.lat,
      ]);

      const isCorrect = validateMapSelection(userCoords, correctCoords);

      addMarker(userCoords);

      handleMapAnswer(isCorrect, correctCoords, callback);
    });
  }
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

function handleMapAnswer(isCorrect, correctCoords, callback) {
  markerAddingDisabled = true;

  if (isCorrect) {
    alert("Correct!");
  } else {
    alert(
      `Wrong! The correct location was near longitude: ${
        correctCoords[0]
      }, latitude: ${correctCoords[1]}`,
    );
  }

  setTimeout(() => {
    markerAddingDisabled = false;
    callback(isCorrect);
  }, 2000);
}

async function fetchQuestions(numQuestions, gameType) {
  const response = await fetch("/api/singleplayer", {
    method: "GET",
    headers: {
      "X-Num-Questions": numQuestions.toString(),
      "game-type": gameType,
    },
  });
  if (!response.ok) throw new Error("Failed to fetch questions.");
  return response.json();
}

function toggleVisibility(element, visible) {
  element.classList.toggle("hidden", !visible);
}

function updateProgress(currentIndex, totalQuestions) {
  elements.progress.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function showGameOverModal(score, totalQuestions) {
  elements.finalScore.textContent = `Your score: ${score}/${totalQuestions}`;
  toggleVisibility(elements.gameModal, true);
}

async function startGame() {
  const numQuestions = parseInt(elements.numQuestions.value);
  const gameType = document.getElementById("game-type").value;

  if (isNaN(numQuestions) || numQuestions <= 0) {
    elements.errorMessage.textContent =
      "Please enter a valid number of questions.";
    toggleVisibility(elements.errorMessage, true);
    return;
  }

  try {
    toggleVisibility(elements.questionModal, false);
    toggleVisibility(elements.game, false);

    const questions = await fetchQuestions(numQuestions, gameType);

    if (gameType === "MAP") {
      loadMapCSSAndJS(initializeMap);
    }

    toggleVisibility(elements.game, true);

    let currentIndex = 0;
    let score = 0;

    function nextQuestion(correct) {
      if (correct) score++;
      if (++currentIndex < questions.length) {
        loadQuestion(
          questions[currentIndex],
          currentIndex,
          questions.length,
          nextQuestion,
          gameType,
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
      gameType,
    );
  } catch {
    elements.errorMessage.textContent =
      "An error occurred while fetching the game data.";
    toggleVisibility(elements.errorMessage, true);
  }
}

elements.startGameBtn.onclick = startGame;
