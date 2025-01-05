package game

import (
	"sync"
)

var (
	rooms     = make(map[string]*Room)
	roomMutex sync.Mutex
)
