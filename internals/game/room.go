package game

import (
	"sync"
	"time"
)

type Room struct {
	ID       string
	Players  map[string]*Player
	Duration time.Duration
	GameType string // "singleplayer" or "multiplayer"
	mu       sync.Mutex
}

func NewRoom(id string, duration time.Duration) *Room {
	return &Room{
		ID:       id,
		Players:  make(map[string]*Player),
		Duration: duration,
	}
}

func (r *Room) AddPlayer(player *Player) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.Players[player.ID] = player
}
