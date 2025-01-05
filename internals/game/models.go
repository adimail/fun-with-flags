package game

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Question struct {
	FlagURL string   `json:"flag_url"`
	Options []string `json:"options"`
	Answer  string   `json:"answer"`
}

type Player struct {
	Username string
	Score    int
	Conn     *websocket.Conn
}

type GameState struct {
	Rooms map[string]*Room
	mu    sync.Mutex
}

type Room struct {
	Code      string
	Host      *websocket.Conn
	Players   map[*websocket.Conn]*Player
	Questions map[string]*Question
	Start     bool
	TimeLimit int // in seconds
	Mutex     sync.Mutex
}

type CreateRoomRequest struct {
	TimeLimit    int `json:"timeLimit"`
	NumQuestions int `json:"numQuestions"`
}
