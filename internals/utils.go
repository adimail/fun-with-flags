package internals

import (
	"math/rand"
	"time"
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
