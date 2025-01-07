package internals

import (
	"log"
	"net/http"

	"github.com/adimail/fun-with-flags/internals/game"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity
	},
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket Upgrade error:", err)
		http.Error(w, "Could not open WebSocket connection", http.StatusInternalServerError)
		return
	}

	defer conn.Close()

	var initialMessage struct {
		Username string `json:"username"`
		RoomID   string `json:"roomID"`
	}
	if err := conn.ReadJSON(&initialMessage); err != nil {
		log.Println("Failed to read initial message:", err)
		conn.WriteJSON(map[string]string{"error": "Invalid initial message"})
		return
	}

	roomsLock.Lock()
	room, exists := rooms[initialMessage.RoomID]
	roomsLock.Unlock()

	if !exists {
		conn.WriteJSON(map[string]string{"error": "Room not found"})
		return
	}

	// Create a new player instance
	player := &game.Player{
		Username: initialMessage.Username,
		Score:    0,
		Conn:     conn,
	}

	// Add the player to the room's Players map
	room.Mutex.Lock()
	room.Players[conn] = player
	room.Mutex.Unlock()

	// Notify all players about the new player
	broadcastToRoom(room, map[string]interface{}{
		"event": "playerJoined",
		"data": map[string]interface{}{
			"username": player.Username,
			"score":    player.Score,
		},
	})

	// WebSocket communication loop
	for {
		var message struct {
			Event string      `json:"event"`
			Data  interface{} `json:"data"`
		}

		err := conn.ReadJSON(&message)
		if err != nil {
			// Log player disconnection as an info message
			log.Printf("WebSocket connection closed for player %s: %v", player.Username, err)
			break
		}

		switch message.Event {
		case "answer":
			// Handle answer submission
			handleAnswer(room, player, message.Data)

		case "leave":
			// Handle player leaving explicitly
			log.Printf("Player %s left the room", player.Username)
			removePlayerFromRoom(initialMessage.RoomID, room, conn, player)
			return // End WebSocket loop for this player

		case "updateScore":
			// Update player's score
			newScore, ok := message.Data.(float64)
			if !ok {
				log.Println("Invalid score format")
				continue
			}
			room.Mutex.Lock()
			player.Score = int(newScore)
			room.Mutex.Unlock()

			// Notify all players of the score update
			broadcastToRoom(room, map[string]interface{}{
				"event": "scoreUpdated",
				"data": map[string]interface{}{
					"username": player.Username,
					"score":    player.Score,
				},
			})
		}
	}

	// Handle implicit player leaving due to WebSocket disconnection
	removePlayerFromRoom(initialMessage.RoomID, room, conn, player)
}

func removePlayerFromRoom(roomID string, room *game.Room, conn *websocket.Conn, player *game.Player) {
	room.Mutex.Lock()
	delete(room.Players, conn)
	remainingPlayers := len(room.Players)
	room.Mutex.Unlock()

	// Notify remaining players
	broadcastToRoom(room, map[string]interface{}{
		"event": "playerLeft",
		"data": map[string]interface{}{
			"username": player.Username,
		},
	})

	if remainingPlayers == 0 {
		// Remove the room if no players are left
		roomsLock.Lock()
		delete(rooms, roomID)
		roomsLock.Unlock()

		log.Printf("Room %s is empty and has been closed.", roomID)
	}
}

func broadcastToRoom(room *game.Room, message interface{}) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	for conn, player := range room.Players {
		if err := conn.WriteJSON(message); err != nil {
			log.Printf("Error broadcasting message to player %s: %v", player.Username, err)
			conn.Close()
			delete(room.Players, conn)
		}
	}
}

func handleAnswer(room *game.Room, player *game.Player, data interface{}) {
	log.Printf("Player %s from room %s submitted an answer: %v", player.Username, room.Code, data)
	// Logic to handle and evaluate the answer
}
