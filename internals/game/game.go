package game

import (
	"sync"
	"time"
)

type GameState struct {
	Rooms map[string]*Room
	mu    sync.Mutex
}

func NewGameState() *GameState {
	return &GameState{
		Rooms: make(map[string]*Room),
	}
}

func (gs *GameState) CreateRoom(roomID string, duration time.Duration, gameType string) *Room {
	gs.mu.Lock()
	defer gs.mu.Unlock()
	room := &Room{
		ID:       roomID,
		Players:  make(map[string]*Player),
		Duration: duration,
		GameType: gameType,
	}
	gs.Rooms[roomID] = room
	return room
}
