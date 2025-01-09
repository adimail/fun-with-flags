package game

import (
	"sync"

	"github.com/gorilla/websocket"
)

type Question struct {
	FlagURL string   `json:"flag_url"`
	Options []string `json:"options,omitempty"`
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
	Hostname  string
	Players   map[*websocket.Conn]*Player
	Questions map[string]*Question
	Start     bool
	TimeLimit int // in seconds
	GameMode  string
	Mutex     sync.Mutex
}

type CreateRoomRequest struct {
	TimeLimit    int    `json:"timeLimit"`
	NumQuestions int    `json:"numQuestions"`
	GameType     string `json:"gameType"`
}
