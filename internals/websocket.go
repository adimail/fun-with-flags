package internals

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/adimail/fun-with-flags/internals/game"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for simplicity
	},
}

// HandleWebSocket manages WebSocket connections for a multiplayer game room.
// It handles the initial connection setup, player registration, and ongoing
// communication between players in a room. The function supports various game
// events including player joins, answers, score updates, and departures.
//
// The function expects an initial message containing:
//   - Username: The display name of the connecting player
//   - RoomID: The unique identifier of the game room to join
//
// It enforces a maximum of 9 players per room and manages the following events:
//   - "leave": Handle explicit player departure
//   - "loadgame": Initialize game countdown and start
//   - "get_new_question": Send a new question to the requesting player
//   - "validate_answer": Validate a submitted answer and send the response to the player, broadcasting score updates if correct
//
// Parameters:
//   - w: The HTTP response writer
//   - r: The HTTP request containing the WebSocket upgrade request
//
// The connection is automatically closed when the function returns.
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

	if len(room.Players) >= 9 {
		room.Mutex.Unlock()
		conn.WriteJSON(map[string]string{"error": "Room is full, only 9 members can join in one room"})
		return
	}

	// Create a new player instance
	player := &game.Player{
		ID:       generatePlayerID(),
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
			"id":       player.ID,
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
			log.Printf("WebSocket connection closed for player %s: %v", player.Username, err)
			break
		}

		switch message.Event {
		case "leave":
			log.Printf("Player %s left the room", player.Username)
			removePlayerFromRoom(initialMessage.RoomID, room, conn, player)
			return

		case "loadgame":
			for i := 3; i >= 0; i-- {
				broadcastToRoom(room, map[string]interface{}{
					"event": "countdown",
					"data":  i,
				})
				time.Sleep(1 * time.Second)
			}

			room.Mutex.Lock()
			room.Start = true
			room.Mutex.Unlock()

			broadcastToRoom(room, map[string]interface{}{
				"event": "gameStarted",
			})

		case "get_new_question":
			var data struct {
				RoomID         string `json:"roomID"`
				PlayerID       string `json:"playerID"`
				QuestionNumber int    `json:"question_number"`
			}

			err := json.Unmarshal(message.Data.([]byte), &data)
			if err != nil {
				log.Println("Error unmarshaling data for get_new_question:", err)
				continue
			}

			question, err := getQuestion(room, data.QuestionNumber)
			if err != nil {
				log.Println("Failed to get question:", err)
				conn.WriteJSON(map[string]string{"error": "Failed to get question"})
				continue
			}

			if err := sendToPlayer(room, data.PlayerID, map[string]interface{}{"event": "new_question", "data": question}); err != nil {
				log.Println("Error sending question to player:", err)
				continue
			}

		case "validate_answer":
			var data struct {
				RoomID   string `json:"roomID"`
				Question string `json:"question"`
				Answer   string `json:"answer"`
				PlayerID string `json:"playerID"`
			}

			err := json.Unmarshal(message.Data.([]byte), &data)
			if err != nil {
				log.Println("Error unmarshaling data for validate_answer:", err)
				conn.WriteJSON(map[string]string{"error": "Error processing request"})
				continue
			}

			questionIndex := 1
			found := false
			for _, question := range room.Questions {
				if question.Answer == data.Question {
					questionIndex += 1
					found = true
					break
				}
			}

			if !found {
				conn.WriteJSON(map[string]string{"error": "Question not found"})
				continue
			}

			response, err := validateAnswer(room, questionIndex, data.Answer)
			if err != nil {
				log.Println("Error validating answer:", err)
				conn.WriteJSON(map[string]string{"error": "Error validating answer"})
				continue
			}

			message_response := map[string]interface{}{
				"event": "answer_result",
				"data": map[string]interface{}{
					"correct_answer": response["correct"],
					"chosen_answer":  response["answer"],
				},
			}

			if err := sendToPlayer(room, data.PlayerID, message_response); err != nil {
				log.Println("Error sending validation response to player:", err)
				continue
			}

			if response["answer"] == response["correct"] {
				player.Score++
				broadcastToRoom(room, map[string]interface{}{
					"event": "score",
					"data": map[string]interface{}{
						"username": player.Username,
					},
				})
			}
		}
	}

	removePlayerFromRoom(initialMessage.RoomID, room, conn, player)
}

// removePlayerFromRoom removes a player from a game room and performs necessary cleanup.
// It handles both explicit departures and implicit disconnections. If the room becomes
// empty after removal, it will also delete the room from the global rooms map.
//
// Parameters:
//   - roomID: The unique identifier of the room
//   - room: Pointer to the Room instance
//   - conn: The WebSocket connection to be removed
//   - player: The Player instance to be removed
//
// The function performs the following operations:
//   - Removes the player from the room's Players map
//   - Notifies remaining players about the departure
//   - Cleans up empty rooms
//   - Handles thread-safe access to shared resources
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
			"id":       player.ID,
		},
	})

	if remainingPlayers == 0 {
		// Remove the room if no players are left
		roomsLock.Lock()
		delete(rooms, roomID)
		roomsLock.Unlock()

		log.Printf("Room %s has been closed.", roomID)
	}
}

// broadcastToRoom sends a message to all players in a specified room.
// It safely handles concurrent access to the room's player list and manages
// failed message deliveries by removing disconnected players.
//
// Parameters:
//   - room: Pointer to the Room instance
//   - message: The message to broadcast (will be JSON encoded)
//
// The function:
//   - Acquires the room mutex to ensure thread-safe access
//   - Attempts to send the message to each connected player
//   - Handles failed sends by closing connections and removing players
//   - Uses deferred mutex unlock to prevent deadlocks
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

// sendToPlayer sends a message to a specific player in a room.
// It provides targeted communication instead of broadcasting to all players.
// The function handles thread-safe access and connection cleanup if needed.
//
// Parameters:
//   - room: Pointer to the Room instance
//   - playerID: The unique identifier of the target player
//   - message: The message to send (will be JSON encoded)
//
// Returns:
//   - error: nil if successful, error if player not found or message send fails
//
// The function:
//   - Safely accesses the room's player list
//   - Locates the specific player by ID
//   - Handles message delivery failures
//   - Cleans up failed connections
//   - Provides detailed error information
func sendToPlayer(room *game.Room, playerID string, message interface{}) error {
	room.Mutex.Lock()
	defer room.Mutex.Unlock()

	var targetConn *websocket.Conn
	var targetPlayer *game.Player

	for conn, player := range room.Players {
		if player.ID == playerID {
			targetConn = conn
			targetPlayer = player
			break
		}
	}

	if targetConn == nil {
		return fmt.Errorf("player with ID %s not found in room", playerID)
	}

	if err := targetConn.WriteJSON(message); err != nil {
		log.Printf("Error sending message to player %s: %v", targetPlayer.Username, err)
		targetConn.Close()
		delete(room.Players, targetConn)
		return err
	}

	return nil
}

// getQuestion retrieves a specific question from a game room.
//
// It takes the following arguments:
//   - room: Pointer to the game.Room struct representing the game room
//   - questionNumber: The index of the question to retrieve (zero-based)
//
// The function returns a pointer to the requested question struct and an error if:
//   - The provided room pointer is nil
//   - The room has no questions
//   - The question number is negative
//   - The question number is out of range (greater than or equal to the total number of questions)
//   - The question with the specified number is not found in the room
func getQuestion(room *game.Room, questionNumber int) (*game.Question, error) {
	if room == nil {
		return nil, fmt.Errorf("room is nil")
	}

	if room.Questions == nil {
		return nil, fmt.Errorf("no questions found in the room")
	}

	if questionNumber < 0 {
		return nil, fmt.Errorf("question number must be non-negative")
	}

	if questionNumber >= len(room.Questions) {
		return nil, fmt.Errorf("question number %d is out of range; total questions available: %d", questionNumber, len(room.Questions))
	}

	questionKey := strconv.Itoa(questionNumber)

	if question, exists := room.Questions[questionKey]; exists {
		return question, nil
	}

	return nil, fmt.Errorf("question with number %d not found", questionNumber)
}

// validateAnswer checks if a user's answer to a question is correct.
//
// It takes the following arguments:
//   - room: Pointer to the game.Room struct representing the game room
//   - questionIndex: The index of the question the answer is for (zero-based)
//   - userAnswer: The answer submitted by the user
//
// The function returns a map containing the user's answer and the correct answer, and an error if:
//   - The provided room pointer is nil
//   - The room has no questions
//   - The question index is negative
//   - The question index is out of range (greater than or equal to the total number of questions)
//   - The question with the specified index is not found in the room
func validateAnswer(room *game.Room, questionIndex int, userAnswer string) (map[string]interface{}, error) {
	if room == nil {
		return nil, fmt.Errorf("room is nil")
	}

	if room.Questions == nil {
		return nil, fmt.Errorf("no questions found in the room")
	}

	if questionIndex < 0 {
		return nil, fmt.Errorf("question index must be non-negative")
	}

	if questionIndex >= len(room.Questions) {
		return nil, fmt.Errorf("question index %d is out of range; total questions available: %d", questionIndex, len(room.Questions))
	}

	questionKey := strconv.Itoa(questionIndex)
	question, exists := room.Questions[questionKey]
	if !exists {
		return nil, fmt.Errorf("question with index %d not found", questionIndex)
	}

	response := map[string]interface{}{
		"answer":  userAnswer,
		"correct": question.Answer,
	}

	return response, nil
}
