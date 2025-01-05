package internals

import (
	"encoding/json"
	"errors"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/adimail/fun-with-flags/internals/game"
	"github.com/gorilla/websocket"
)

var rooms = make(map[string]*game.Room)

func generateRoomCode() string {
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	return strconv.Itoa(rng.Intn(10000))
}

// ErrorResponse represents a standardized error structure
type ErrorResponse struct {
	Error string `json:"error"`
}

// ValidateCreateRoomRequest validates the incoming request body
func ValidateCreateRoomRequest(req *game.CreateRoomRequest) error {
	if req.TimeLimit < 3 || req.TimeLimit > 10 {
		return errors.New("time limit must be between 3 and 10 minutes")
	}
	if req.NumQuestions < 10 || req.NumQuestions > 25 {
		return errors.New("number of questions must be between 10 and 25")
	}
	return nil
}

func createRoomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		game.CreateRoomRequest
		HostUsername string `json:"hostUsername"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid JSON format"})
		return
	}

	if err := ValidateCreateRoomRequest(&req.CreateRoomRequest); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: err.Error()})
		return
	}

	if req.HostUsername == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Host username is required"})
		return
	}

	questions, err := generateQuestions(req.NumQuestions)
	if err != nil {
		http.Error(w, "Failed to generate questions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	roomCode := generateRoomCode()
	room := &game.Room{
		Code:      roomCode,
		Host:      nil, // Placeholder, to be updated when WebSocket connection is established
		Players:   make(map[*websocket.Conn]bool),
		Questions: make(map[string]*game.Question),
		Start:     false,
		TimeLimit: req.TimeLimit * 60,
	}

	hostPlayer := &game.Player{
		Username: req.HostUsername,
	}

	// Simulate adding the host as a player (without WebSocket connection yet)
	room.Players[nil] = true // Placeholder for WebSocket connection

	for i, q := range questions {
		room.Questions[strconv.Itoa(i)] = &q
	}

	rooms[roomCode] = room

	response := map[string]interface{}{
		"code":    room.Code,
		"host":    hostPlayer.Username,
		"players": []game.Player{{Username: req.HostUsername, Score: 0}},
		// "questions":    questions,
		"start":        room.Start,
		"timeLimit":    room.TimeLimit,
		"numQuestions": len(questions),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
