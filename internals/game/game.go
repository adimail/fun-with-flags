package game

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
)

func NewGameState() *GameState {
	return &GameState{
		Rooms: make(map[string]*Room),
	}
}

func CreateRoomHandler(w http.ResponseWriter, r *http.Request) {
	roomMutex.Lock()
	defer roomMutex.Unlock()

	if len(rooms) >= 999 {
		http.Error(w, "Max rooms reached", http.StatusBadRequest)
		return
	}

	roomCode := generateRoomCode()
	for rooms[roomCode] != nil {
		roomCode = generateRoomCode()
	}
	timeLimitStr := r.Header.Get("X-Time-Limit")
	timeLimit, err := strconv.Atoi(timeLimitStr)
	if err != nil || timeLimit < 180 || timeLimit > 600 {
		http.Error(w, "Invalid time limit", http.StatusBadRequest)
		return
	}

	rooms[roomCode] = &Room{
		Code:      roomCode,
		Players:   make(map[*websocket.Conn]bool),
		Start:     false,
		TimeLimit: timeLimit,
	}

	response := map[string]string{
		"room_code": roomCode,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func JoinRoomHandler(w http.ResponseWriter, r *http.Request) {
	roomCode := r.Header.Get("X-Room-Code")
	roomMutex.Lock()
	room, exists := rooms[roomCode]
	roomMutex.Unlock()
	if !exists {
		http.Error(w, "Room not found", http.StatusNotFound)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket Upgrade error:", err)
		http.Error(w, "Could not open WebSocket connection", http.StatusInternalServerError)
		return
	}

	room.Mutex.Lock()
	room.Players[conn] = true
	room.Mutex.Unlock()

	defer func() {
		room.Mutex.Lock()
		delete(room.Players, conn)
		room.Mutex.Unlock()
		conn.Close()
	}()

	log.Printf("Player joined room %s", roomCode)

	// Handle WebSocket communication
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Println("WebSocket Read error:", err)
			break
		}
		log.Printf("Room %s received message: %s", roomCode, message)
	}
}
