class GameLogic {
  constructor() {
    this.map = null;
    this.vectorSource = null;
    this.markerAddingDisabled = false;
  }

  loadMapCSSAndJS(callback) {
    const cssLink = document.createElement("link");
    cssLink.rel = "stylesheet";
    cssLink.href = "https://openlayers.org/en/v4.6.5/css/ol.css";
    document.head.appendChild(cssLink);

    const jsScript = document.createElement("script");
    jsScript.src = "https://openlayers.org/en/v4.6.5/build/ol.js";
    jsScript.onload = callback;
    document.head.appendChild(jsScript);
  }

  initializeMap(targetId) {
    this.vectorSource = new ol.source.Vector();
    const vectorLayer = new ol.layer.Vector({
      source: this.vectorSource,
      style: new ol.style.Style({
        image: new ol.style.Circle({
          radius: 6,
          fill: new ol.style.Fill({ color: "red" }),
        }),
      }),
    });

    const extent = ol.proj.transformExtent(
      [-180, -85, 180, 85],
      "EPSG:4326",
      "EPSG:3857",
    );

    this.map = new ol.Map({
      target: targetId,
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

  addMarker(coords) {
    const marker = new ol.Feature({
      geometry: new ol.geom.Point(coords),
    });
    this.vectorSource.addFeature(marker);
  }

  clearMarkers() {
    this.vectorSource.clear();
  }

  validateMapSelection(userCoords, correctCoords) {
    const tolerance = 200000;
    const distance = ol.sphere.getDistance(
      ol.proj.toLonLat(userCoords),
      ol.proj.toLonLat(correctCoords),
    );
    return distance <= tolerance;
  }

  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  markAnswer(button, isCorrect) {
    button.style.backgroundColor = isCorrect ? "#a8d5a2" : "#f5a9a9";
    button.style.color = "#333";
  }

  updateProgress(progressElement, currentIndex, totalQuestions) {
    progressElement.textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;
  }

  handleAnswer(selectedButton, isCorrect, correctAnswer, callback) {
    const buttons = document.querySelectorAll(".option");
    buttons.forEach((button) => (button.disabled = true));

    this.markAnswer(selectedButton, isCorrect);

    if (!isCorrect) {
      const correctButton = Array.from(buttons).find(
        (button) => button.textContent === correctAnswer,
      );
      if (correctButton) this.markAnswer(correctButton, true);
    }

    setTimeout(() => {
      buttons.forEach((button) => (button.disabled = false));
      callback(isCorrect);
    }, 2000);
  }

  handleMapAnswer(isCorrect, correctCoords, callback) {
    this.markerAddingDisabled = true;

    alert(
      isCorrect
        ? "Correct!"
        : `Wrong! The correct location was near longitude: ${
            correctCoords[0]
          }, latitude: ${correctCoords[1]}`,
    );

    setTimeout(() => {
      this.markerAddingDisabled = false;
      callback(isCorrect);
    }, 2000);
  }

  loadMapQuestion(mapElement, flagElement, question, callback) {
    mapElement.classList.remove("hidden");
    flagElement.src = question.flag_url;

    this.clearMarkers();

    this.map.once("click", (event) => {
      if (this.markerAddingDisabled) return;

      const userCoords = event.coordinate;
      const correctCoords = ol.proj.fromLonLat([
        question.coordinates.lon,
        question.coordinates.lat,
      ]);

      const isCorrect = this.validateMapSelection(userCoords, correctCoords);

      this.addMarker(userCoords);

      this.handleMapAnswer(isCorrect, correctCoords, callback);
    });
  }

  loadMCQQuestion(flagElement, optionsElement, question, callback) {
    flagElement.src = question.flag_url;
    const optionsArray = [...question.options];
    this.shuffleArray(optionsArray);

    optionsElement.innerHTML = optionsArray
      .map((option) => `<button class="option">${option}</button>`)
      .join("");

    Array.from(optionsElement.children).forEach((button) => {
      button.onclick = () =>
        this.handleAnswer(
          button,
          button.textContent === question.answer,
          question.answer,
          callback,
        );
    });
  }
}

export default GameLogic;
