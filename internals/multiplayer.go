package internals

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/adimail/fun-with-flags/internals/game"
	"github.com/gorilla/websocket"
)

var (
	rooms     = make(map[string]*game.Room)
	roomsLock sync.Mutex
)

func generateroomID() string {
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
		http.Error(w, "Invalid JSON format", http.StatusBadRequest)
		return
	}

	if err := ValidateCreateRoomRequest(&req.CreateRoomRequest); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.HostUsername == "" {
		http.Error(w, "Host username is required", http.StatusBadRequest)
		return
	}

	questions, err := generateQuestions(req.NumQuestions)
	if err != nil {
		http.Error(w, "Failed to generate questions: "+err.Error(), http.StatusInternalServerError)
		return
	}

	roomID := generateroomID()
	room := &game.Room{
		Code:      roomID,
		Hostname:  req.HostUsername,
		Players:   make(map[*websocket.Conn]*game.Player),
		Questions: make(map[string]*game.Question),
		Start:     false,
		TimeLimit: req.TimeLimit,
	}

	hostPlayer := &game.Player{Username: req.HostUsername, Score: 0}
	room.Players[nil] = hostPlayer

	for i, q := range questions {
		room.Questions[strconv.Itoa(i)] = &q
	}

	roomsLock.Lock()
	rooms[roomID] = room
	roomsLock.Unlock()

	response := map[string]interface{}{
		"code":         room.Code,
		"host":         room.Hostname,
		"players":      getSerializablePlayers(room),
		"start":        room.Start,
		"timeLimit":    room.TimeLimit,
		"numQuestions": len(questions),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func joinRoomHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Invalid method", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		Username string `json:"username"`
		RoomID   string `json:"roomID"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid JSON format"})
		return
	}

	if req.Username == "" || len(req.Username) < 4 || len(req.Username) > 10 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Username must be between 4 and 10 characters"})
		return
	}

	if req.RoomID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Room ID is required"})
		return
	}

	roomsLock.Lock()
	room, exists := rooms[req.RoomID]
	roomsLock.Unlock()

	if !exists {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Room not found"})
		return
	}

	for _, player := range room.Players {
		if player != nil && player.Username == req.Username {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(ErrorResponse{
				Error: fmt.Sprintf("Please choose another username, player '%s' exists in the room '%s'", req.Username, req.RoomID),
			})
			return
		}
	}

	player := &game.Player{Username: req.Username, Score: 0}
	room.Players[nil] = player

	response := map[string]interface{}{
		"code":         room.Code,
		"host":         room.Hostname,
		"players":      getSerializablePlayers(room),
		"timeLimit":    room.TimeLimit,
		"numQuestions": len(room.Questions),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
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
