package internals

import (
	"encoding/csv"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/adimail/fun-with-flags/internals/game"
)

func SinglePlayerHandler(w http.ResponseWriter, r *http.Request) {
	numQuestionsStr := r.Header.Get("X-Num-Questions")
	numQuestions, err := strconv.Atoi(numQuestionsStr)
	if err != nil || numQuestions <= 0 {
		http.Error(w, "Invalid number of questions", http.StatusBadRequest)
		return
	}

	gameType := r.Header.Get("game-type")

	file, err := os.Open("./data/countries.csv")
	if err != nil {
		http.Error(w, "Failed to read country data", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	rows, err := reader.ReadAll()
	if err != nil {
		http.Error(w, "Failed to parse country data", http.StatusInternalServerError)
		return
	}

	rng := newRandomGenerator()
	selectedCountries := selectRandomCountries(rows, numQuestions, rng)

	var questions []game.Question
	for i, row := range selectedCountries {
		countryName := row[0]
		countryCode := row[1]
		flagURL := filepath.Join("/static/svg", countryCode+".svg")

		question := game.Question{
			FlagURL: flagURL,
			Answer:  countryName,
		}

		if gameType != "MAP" {
			options := []string{countryName}
			for j := 0; j < 3; j++ {
				options = append(options, selectedCountries[(i+j+1)%len(selectedCountries)][0])
			}
			shuffleOptions(options, rng)
			question.Options = options
		}

		questions = append(questions, question)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(questions)
}
