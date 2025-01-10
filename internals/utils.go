package internals

import (
	"encoding/csv"
	"math/rand"
	"os"
	"path/filepath"
	"time"

	"github.com/adimail/fun-with-flags/internals/game"
)

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

func generateQuestions(numQuestions int, gameType string) ([]game.Question, error) {
	file, err := os.Open("./data/countries.csv")
	if err != nil {
		return nil, err
	}
	defer file.Close()

	reader := csv.NewReader(file)
	rows, err := reader.ReadAll()
	if err != nil {
		return nil, err
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
	return questions, nil
}

func getSerializablePlayers(room *game.Room) []map[string]interface{} {
	players := []map[string]interface{}{}
	room.Mutex.Lock()
	defer room.Mutex.Unlock()
	for _, playerConn := range room.Players {
		if playerConn != nil {
			players = append(players, map[string]interface{}{
				"username": playerConn.Username,
				"score":    playerConn.Score,
			})
		}
	}
	return players
}

func calculateScore(answers int, totalquestions int, submissiontime int, totaltime int) int {
	return answers * totalquestions * (submissiontime / totaltime)
}
