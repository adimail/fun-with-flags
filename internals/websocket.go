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

	room, exists := rooms[initialMessage.RoomID]
	if !exists {
		conn.WriteJSON(map[string]string{"error": "Room not found"})
		return
	}

	// Create a new player instance
	player := &game.Player{Username: initialMessage.Username, Score: 0}

	// Add the player to the room's Players map with the WebSocket connection as key
	room.Mutex.Lock()
	room.Players[conn] = player
	room.Mutex.Unlock()

	// Notify other players about the new player joining
	for playerConn := range room.Players {
		if playerConn == conn {
			continue
		}
		playerConn.WriteJSON(map[string]interface{}{
			"event": "playerJoined",
			"data":  player,
		})
	}

	for {
		var message struct {
			Event string      `json:"event"`
			Data  interface{} `json:"data"`
		}
		err := conn.ReadJSON(&message)
		if err != nil {
			log.Printf("WebSocket read error for player %s: %v", player.Username, err)
			break
		}

		switch message.Event {
		case "answer":
			log.Printf("Player %s answered: %v", player.Username, message.Data)
		case "leave":
			log.Printf("Player %s left the room", player.Username)
			delete(room.Players, conn)
		}
	}

	// Cleanup when the connection is closed
	room.Mutex.Lock()
	delete(room.Players, conn)
	room.Mutex.Unlock()
}

func broadcastToRoom(room *game.Room, message interface{}) {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	for conn := range room.Players {
		if err := conn.WriteJSON(message); err != nil {
			log.Printf("Error broadcasting message: %v", err)
		}
	}
}
