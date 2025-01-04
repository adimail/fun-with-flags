package internals

import (
	"encoding/csv"
	"encoding/json"
	"math/rand"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

type Question struct {
	FlagURL string   `json:"flag_url"`
	Options []string `json:"options"`
	Answer  string   `json:"answer"`
}

func newRandomGenerator() *rand.Rand {
	return rand.New(rand.NewSource(time.Now().UnixNano()))
}

func shuffleOptions(options []string, rng *rand.Rand) {
	rng.Shuffle(len(options), func(i, j int) {
		options[i], options[j] = options[j], options[i]
	})
}

func shuffleCountries(rows [][]string, rng *rand.Rand) {
	rng.Shuffle(len(rows), func(i, j int) {
		rows[i], rows[j] = rows[j], rows[i]
	})
}

func selectRandomCountries(rows [][]string, count int, rng *rand.Rand) [][]string {
	rng.Shuffle(len(rows), func(i, j int) {
		rows[i], rows[j] = rows[j], rows[i]
	})
	if len(rows) < count {
		return rows
	}
	return rows[:count]
}

func SinglePlayerHandler(w http.ResponseWriter, r *http.Request) {
	numQuestionsStr := r.Header.Get("X-Num-Questions")
	numQuestions, err := strconv.Atoi(numQuestionsStr)
	if err != nil || numQuestions <= 0 {
		http.Error(w, "Invalid number of questions", http.StatusBadRequest)
		return
	}

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

	var questions []Question
	for i, row := range selectedCountries {
		countryName := row[0]
		countryCode := row[1]
		flagURL := filepath.Join("/static/svg", countryCode+".svg")

		options := []string{countryName}
		for j := 0; j < 3; j++ {
			options = append(options, selectedCountries[(i+j+1)%len(selectedCountries)][0])
		}

		shuffleOptions(options, rng)

		questions = append(questions, Question{
			FlagURL: flagURL,
			Options: options,
			Answer:  countryName,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(questions)
}
