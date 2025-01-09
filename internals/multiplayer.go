package internals

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/adimail/fun-with-flags/internals/game"
	"github.com/gorilla/mux"
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
	if req.GameType == "" {
		return errors.New("game type is required")
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
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Error: "Invalid JSON format",
		})
		return
	}

	if err := ValidateCreateRoomRequest(&req.CreateRoomRequest); err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	roomsLock.Lock()
	if len(rooms) >= 10 {
		roomsLock.Unlock()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		json.NewEncoder(w).Encode(ErrorResponse{
			Error: "Maximum number of rooms (10) reached. Cannot create more rooms.",
		})
		return
	}
	roomsLock.Unlock()

	if req.HostUsername == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{
			Error: "Host username is required",
		})
		return
	}

	questions, err := generateQuestions(req.NumQuestions, req.GameType)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(ErrorResponse{
			Error: "Failed to generate questions: " + err.Error(),
		})
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

	// Validate username
	if req.Username == "" || len(req.Username) < 4 || len(req.Username) > 10 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Username must be between 4 and 10 characters"})
		return
	}

	// Validate room ID
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

	// Check for existing username with room lock
	room.Mutex.Lock()
	if len(room.Players) >= 9 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Room is full, only 9 members can join in one room"})
		return
	}
	usernameExists := false
	for _, player := range room.Players {
		if player != nil && strings.EqualFold(player.Username, req.Username) {
			usernameExists = true
			break
		}
	}
	room.Mutex.Unlock()

	if usernameExists {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(ErrorResponse{
			Error: fmt.Sprintf("Username '%s' is already taken. Please choose another username.", req.Username),
		})
		return
	}

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

func getRoomHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	roomID := vars["id"]

	roomsLock.Lock()
	room, exists := rooms[roomID]
	roomsLock.Unlock()

	if !exists {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Room not found"})
		return
	}

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

func adminHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusMethodNotAllowed)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Method not allowed"})
		return
	}

	roomsLock.Lock()
	defer roomsLock.Unlock()

	if len(rooms) == 0 {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "No room found"})
		return
	}

	// Create a response structure to hold all room details
	var allRooms []map[string]interface{}
	for _, room := range rooms {
		roomDetails := map[string]interface{}{
			"code":         room.Code,
			"host":         room.Hostname,
			"timeLimit":    room.TimeLimit,
			"numQuestions": len(room.Questions),
			"gameStarted":  room.Start,
			"players":      getSerializablePlayers(room),
		}
		allRooms = append(allRooms, roomDetails)
	}

	// Respond with the JSON of all rooms
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"rooms": allRooms,
	})
}
