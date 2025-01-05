package internals

import (
	"encoding/json"
	"errors"
	"log"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/adimail/fun-with-flags/internals/game"
	"github.com/gorilla/websocket"
)

var rooms = make(map[string]*game.Room)

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

	roomID := generateroomID()
	room := &game.Room{
		Code:      roomID,
		Host:      nil,
		Players:   make(map[*websocket.Conn]*game.Player),
		Questions: make(map[string]*game.Question),
		Start:     false,
		TimeLimit: req.TimeLimit * 60,
	}

	for i, q := range questions {
		room.Questions[strconv.Itoa(i)] = &q
	}

	rooms[roomID] = room

	response := map[string]interface{}{
		"code":         room.Code,
		"host":         req.HostUsername,
		"players":      []game.Player{{Username: req.HostUsername, Score: 0}},
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
		RoomID   string `json:"roomID"` // Change `roomID` to `RoomID` to make it exported
	}

	// Parse JSON request body
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Invalid JSON format"})
		return
	}

	// Validate input
	if req.Username == "" || len(req.Username) < 4 || len(req.Username) > 10 {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Username must be between 4 and 10 characters"})
		return
	}

	if req.RoomID == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Room ID is required"})
		return
	}

	// Check if the room exists
	room, exists := rooms[req.RoomID]
	if !exists {
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(ErrorResponse{Error: "Room not found"})
		return
	}

	// Print the room data when found
	log.Println("Room found:", room)
	log.Printf("Room Code: %s, Host: %s, Time Limit: %d, Number of Questions: %d", room.Code, room.Host, room.TimeLimit, len(room.Questions))

	// Create a new player and add to the room
	player := &game.Player{Username: req.Username, Score: 0}
	conn := &websocket.Conn{} // Placeholder, replace with the actual WebSocket connection
	room.Mutex.Lock()
	room.Players[conn] = player
	room.Mutex.Unlock()

	// Prepare response
	response := map[string]interface{}{
		"code":         room.Code,
		"host":         room.Host,                    // Return Host's Username
		"players":      getSerializablePlayers(room), // Get serializable player details
		"timeLimit":    room.TimeLimit / 60,          // Convert seconds to minutes
		"numQuestions": len(room.Questions),
	}

	// Ensure proper response encoding
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Println("Error encoding response:", err)
		http.Error(w, "Error encoding response", http.StatusInternalServerError)
	}
}

func getSerializablePlayers(room *game.Room) []map[string]interface{} {
	players := []map[string]interface{}{}
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	for _, playerConn := range room.Players {
		// Assuming we have access to player details via `*game.Player`
		players = append(players, map[string]interface{}{
			"username": playerConn.Username,
			"score":    playerConn.Score,
		})
	}
	return players
}
