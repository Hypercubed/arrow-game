import React, { useState, useEffect, useRef } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Heart, Trophy, Target, Clock, Zap } from 'lucide-react';

const DIRECTIONS = ['up', 'down', 'left', 'right'];

const Arrow = ({ direction, onClick, onMouseDown, onMouseEnter, onTouchStart, isBlocked, isFlying, flyDirection, shouldShake, arrowId, size = 'w-16 h-16', iconSize = 32 }) => {
  const ArrowIcon = {
    up: ArrowUp,
    down: ArrowDown,
    left: ArrowLeft,
    right: ArrowRight
  }[direction];

  const getFlyTransform = () => {
    switch (flyDirection) {
      case 'up': return 'translateY(-500px)';
      case 'down': return 'translateY(500px)';
      case 'left': return 'translateX(-500px)';
      case 'right': return 'translateX(500px)';
      default: return 'scale(0)';
    }
  };

  return (
    <div 
      className={`relative ${size}`}
      style={{
        animation: shouldShake ? 'shake 0.15s ease-in-out' : 'none'
      }}
    >
      <button
        onClick={onClick}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onTouchStart={onTouchStart}
        data-arrow-id={arrowId}
        className={`
          w-full h-full rounded-lg flex items-center justify-center
          ${isFlying ? 'opacity-0' : 'opacity-100'}
          ${isBlocked 
            ? 'bg-red-100 hover:bg-red-200 border-2 border-red-300' 
            : 'bg-blue-100 hover:bg-blue-200 border-2 border-blue-300'
          }
        `}
        style={{
          transform: isFlying ? getFlyTransform() : 'scale(1)',
          transition: isFlying ? 'all 0.5s ease-in' : 'none',
          userSelect: 'none',
          touchAction: 'none'
        }}
        disabled={isFlying}
      >
        <ArrowIcon 
          className={isBlocked ? 'text-red-600' : 'text-blue-600'} 
          size={iconSize}
        />
      </button>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25% { transform: translateX(-3px) rotate(-3deg); }
          75% { transform: translateX(3px) rotate(3deg); }
        }
      `}</style>
    </div>
  );
};

const ArrowGame = () => {
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(0);
  const [arrows, setArrows] = useState([]);
  const [flyingArrows, setFlyingArrows] = useState(new Map());
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState('');
  const [totalArrowsRemoved, setTotalArrowsRemoved] = useState(0);
  const [arrowsPerSecond, setArrowsPerSecond] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [processedArrows, setProcessedArrows] = useState(new Set());
  const [shakingArrowId, setShakingArrowId] = useState(null);
  
  const startTimeRef = useRef(null);
  const pausedTimeRef = useRef(0);
  const arrowRemovalTimesRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const shakeTimeoutRef = useRef(null);

  // Calculate grid size from arrow count
  const getGridSize = (arrowCount) => Math.ceil(Math.sqrt(arrowCount));

  // Get arrow sizing based on grid size
  const getArrowSizing = (gridSize) => {
    if (gridSize <= 3) return { size: 'w-16 h-16 sm:w-20 sm:h-20', icon: 36 };
    if (gridSize <= 4) return { size: 'w-14 h-14 sm:w-16 sm:h-16', icon: 32 };
    if (gridSize <= 5) return { size: 'w-12 h-12 sm:w-14 sm:h-14', icon: 28 };
    if (gridSize <= 6) return { size: 'w-10 h-10 sm:w-12 sm:h-12', icon: 24 };
    if (gridSize <= 7) return { size: 'w-9 h-9 sm:w-10 sm:h-10', icon: 20 };
    if (gridSize <= 8) return { size: 'w-8 h-8 sm:w-9 sm:h-9', icon: 18 };
    return { size: 'w-7 h-7 sm:w-8 sm:h-8', icon: 16 };
  };

  // Timer effect
  useEffect(() => {
    if (gameOver || !timerRunning) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }

    if (!startTimeRef.current) startTimeRef.current = Date.now();

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(pausedTimeRef.current + elapsed);
    }, 100);

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [gameOver, timerRunning]);

  // Calculate arrows per second
  useEffect(() => {
    const now = Date.now();
    arrowRemovalTimesRef.current = arrowRemovalTimesRef.current.filter(
      time => now - time < 10000
    );
    
    if (arrowRemovalTimesRef.current.length > 0) {
      const timeSpan = (now - arrowRemovalTimesRef.current[0]) / 1000;
      const rate = timeSpan > 0 ? arrowRemovalTimesRef.current.length / timeSpan : 0;
      setArrowsPerSecond(rate);
    } else {
      setArrowsPerSecond(0);
    }
  }, [totalArrowsRemoved]);

  // Update lives when crossing multiples of 5
  useEffect(() => {
    const newLives = Math.floor(level / 5);
    setLives(newLives);
  }, [level]);

  // Initialize level when it changes
  useEffect(() => {
    if (!gameOver) {
      generateLevel(level);
    }
  }, [level, gameOver]);

  const generateLevel = (levelNum) => {
    const arrowCount = levelNum;
    const gridSize = getGridSize(arrowCount);
    
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      const newArrows = createArrowConfiguration(arrowCount, gridSize);
      
      if (isSolvable(newArrows)) {
        setArrows(newArrows);
        setFlyingArrows(new Map());
        return;
      }
      
      attempts++;
    }
    
    // Fallback: guaranteed solvable
    setArrows(createGuaranteedSolvable(arrowCount, gridSize));
    setFlyingArrows(new Map());
  };

  const createArrowConfiguration = (count, gridSize) => {
    const newArrows = [];
    let id = 0;
    
    for (let row = 0; row < gridSize && id < count; row++) {
      for (let col = 0; col < gridSize && id < count; col++) {
        const direction = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
        newArrows.push({ id, row, col, direction });
        id++;
      }
    }
    
    return newArrows;
  };

  // Guaranteed solvable by reverse construction, then mutated for variety.
  // Cells are placed centre-first; each arrow points in a direction that
  // strictly increases its Chebyshev distance from the grid centre, so its
  // ray contains only not-yet-placed cells and it is unblocked when placed.
  // Forward play is placement order reversed: outside-in. The old
  // edge-outward version was NOT guaranteed: its random interior arrows
  // could face each other and deadlock (e.g. level 16, row 1).
  // Mutation (fallback only): random direction changes, kept only while
  // the board stays solvable, break the perfect outside-in layering.
  const createGuaranteedSolvable = (count, gridSize) => {
    const center = (gridSize - 1) / 2;
    const cells = [];
    let id = 0;
    for (let row = 0; row < gridSize && id < count; row++) {
      for (let col = 0; col < gridSize && id < count; col++) {
        cells.push({
          id,
          row,
          col,
          dist: Math.max(Math.abs(row - center), Math.abs(col - center)),
          key: Math.random(),
        });
        id++;
      }
    }
    cells.sort((a, b) => (a.dist !== b.dist ? a.dist - b.dist : a.key - b.key));
    const newArrows = cells.map((cell) => {
      const dr = cell.row - center;
      const dc = cell.col - center;
      const allowed = [];
      if (dr < 0 && Math.abs(dr) >= Math.abs(dc)) allowed.push('up');
      if (dr > 0 && Math.abs(dr) >= Math.abs(dc)) allowed.push('down');
      if (dc < 0 && Math.abs(dc) >= Math.abs(dr)) allowed.push('left');
      if (dc > 0 && Math.abs(dc) >= Math.abs(dr)) allowed.push('right');
      const choices = allowed.length === 0 ? DIRECTIONS : allowed;
      return { id: cell.id, row: cell.row, col: cell.col, direction: choices[Math.floor(Math.random() * choices.length)] };
    });
    const mutAttempts = Math.min(count * 20, 1000);
    for (let m = 0; m < mutAttempts; m++) {
      const idx = Math.floor(Math.random() * newArrows.length);
      const oldDirection = newArrows[idx].direction;
      const newDirection = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
      if (newDirection === oldDirection) continue;
      newArrows[idx].direction = newDirection;
      if (!isSolvable(newArrows)) newArrows[idx].direction = oldDirection;
    }
    // Restore the original row-major order (mutation/centre-out ordering
    // is internal; callers and rendering expect id order).
    return newArrows.sort((a, b) => a.id - b.id);
  };

  const isSolvable = (arrowsList) => {
    const remaining = [...arrowsList];
    const maxIterations = arrowsList.length * 2;
    let iterations = 0;
    
    while (remaining.length > 0 && iterations < maxIterations) {
      iterations++;
      
      const removable = remaining.filter(arrow => !isArrowBlockedInList(arrow, remaining));
      
      if (removable.length === 0) return false;
      
      const index = remaining.findIndex(a => a.id === removable[0].id);
      if (index !== -1) remaining.splice(index, 1);
    }
    
    return remaining.length === 0;
  };

  const isArrowBlockedInList = (arrow, list) => {
    const { row, col, direction } = arrow;
    return list.some(other => {
      if (other.id === arrow.id) return false;
      switch (direction) {
        case 'up': return other.col === col && other.row < row;
        case 'down': return other.col === col && other.row > row;
        case 'left': return other.row === row && other.col < col;
        case 'right': return other.row === row && other.col > col;
        default: return false;
      }
    });
  };

  const isArrowBlocked = (arrow) => {
    const activeArrows = arrows.filter(a => !flyingArrows.has(a.id));
    return isArrowBlockedInList(arrow, activeArrows);
  };

  const handleArrowClick = (arrow) => {
    if (flyingArrows.has(arrow.id) || processedArrows.has(arrow.id)) return;

    const blocked = isArrowBlocked(arrow);
    
    if (blocked) {
      const newLives = lives - 1;
      setLives(newLives);
      setMessage('❌ Arrow is blocked! -1 life');
      
      setTimerRunning(false);
      if (startTimeRef.current) {
        pausedTimeRef.current = pausedTimeRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000);
        startTimeRef.current = null;
      }
      
      if (newLives < 0) {
        const checkpoint = Math.floor(level / 5) * 5;
        if (checkpoint === 0) {
          setGameOver(true);
          setMessage(`Game Over! Final Level: ${level} | Arrows Removed: ${totalArrowsRemoved}`);
        } else {
          setMessage(`💔 Falling back to level ${checkpoint}...`);
          setTimeout(() => {
            setLevel(checkpoint);
            setLives(Math.floor(checkpoint / 5));
          }, 1500);
        }
      }
      
      setTimeout(() => setMessage(''), 1500);
    } else {
      if (!timerRunning) {
        setTimerRunning(true);
        startTimeRef.current = Date.now();
      }
      
      setProcessedArrows(prev => new Set([...prev, arrow.id]));
      setFlyingArrows(prev => new Map([...prev, [arrow.id, arrow.direction]]));
      setTotalArrowsRemoved(prev => prev + 1);
      arrowRemovalTimesRef.current.push(Date.now());
      
      setTimeout(() => {
        setArrows(prev => prev.filter(a => a.id !== arrow.id));
        setFlyingArrows(prev => {
          const next = new Map(prev);
          next.delete(arrow.id);
          return next;
        });
        
        const remainingArrows = arrows.filter(a => a.id !== arrow.id && !flyingArrows.has(a.id));
        if (remainingArrows.length === 0) {
          const nextLevel = level + 1;
          const willGainLife = nextLevel % 5 === 0;
          setMessage(willGainLife ? '✅ Level Complete! +1 life earned!' : '✅ Level Complete!');
          setLevel(nextLevel);
          setTimeout(() => setMessage(''), 1500);
        }
      }, 500);
    }
  };

  const handleMouseDown = (arrow, event) => {
    event.preventDefault();
    setShakingArrowId(arrow.id);
    setIsDragging(true);
    setProcessedArrows(new Set());
    handleArrowClick(arrow);
  };

  const handleMouseEnter = (arrow, event) => {
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    setShakingArrowId(arrow.id);
    shakeTimeoutRef.current = setTimeout(() => setShakingArrowId(null), 150);
    
    if (isDragging && event.buttons === 1) {
      handleArrowClick(arrow);
    }
  };

  const handleTouchStart = (arrow, event) => {
    event.preventDefault();
    setShakingArrowId(arrow.id);
    setIsDragging(true);
    setProcessedArrows(new Set());
    handleArrowClick(arrow);
  };

  const handleTouchMove = (event) => {
    if (!isDragging) return;
    
    const touch = event.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    let arrowElement = element;
    while (arrowElement && !arrowElement.dataset.arrowId) {
      arrowElement = arrowElement.parentElement;
    }
    
    if (arrowElement && arrowElement.dataset.arrowId) {
      const arrowId = parseInt(arrowElement.dataset.arrowId);
      const arrow = arrows.find(a => a.id === arrowId);
      
      if (arrow && !flyingArrows.has(arrow.id) && !processedArrows.has(arrow.id)) {
        setShakingArrowId(arrow.id);
        setTimeout(() => setShakingArrowId(null), 150);
        handleArrowClick(arrow);
      }
    }
  };

  const handleReset = () => {
    const newLives = lives - 1;
    setLives(newLives);
    setMessage('🔄 Board reset! -1 life');
    
    setTimerRunning(false);
    if (startTimeRef.current) {
      pausedTimeRef.current = pausedTimeRef.current + Math.floor((Date.now() - startTimeRef.current) / 1000);
      startTimeRef.current = null;
    }
    
    if (newLives < 0) {
      const checkpoint = Math.floor(level / 5) * 5;
      if (checkpoint === 0) {
        setGameOver(true);
        setMessage(`Game Over! Final Level: ${level} | Arrows Removed: ${totalArrowsRemoved}`);
      } else {
        setMessage(`💔 Falling back to level ${checkpoint}...`);
        setTimeout(() => {
          setLevel(checkpoint);
          setLives(Math.floor(checkpoint / 5));
        }, 1500);
      }
    } else {
      generateLevel(level);
    }
    
    setTimeout(() => setMessage(''), 1500);
  };

  const resetGame = () => {
    setLevel(1);
    setLives(0);
    setGameOver(false);
    setMessage('');
    setTotalArrowsRemoved(0);
    setElapsedTime(0);
    setArrowsPerSecond(0);
    setTimerRunning(false);
    arrowRemovalTimesRef.current = [];
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Global event listeners
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
      setProcessedArrows(new Set());
    };
    
    const handleKeyPress = (e) => {
      if ((e.key === 'n' || e.key === 'N') && !gameOver) {
        setLevel(prev => prev + 1);
        setMessage('⏭️ Skipped to next level');
        setTimeout(() => setMessage(''), 1000);
      }
    };
    
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    window.addEventListener('touchcancel', handleGlobalMouseUp);
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
      window.removeEventListener('touchcancel', handleGlobalMouseUp);
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [gameOver]);

  // Render grid
  const gridSize = getGridSize(level);
  const arrowSizing = getArrowSizing(gridSize);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-2 sm:p-8 flex flex-col items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-8 max-w-2xl w-full">
        {/* Stats Header */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 bg-yellow-50 p-2 sm:p-3 rounded-lg">
            <Trophy className="text-yellow-500" size={24} />
            <div>
              <div className="text-xs text-gray-500">Level</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{level}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3 bg-red-50 p-2 sm:p-3 rounded-lg">
            <Heart className="text-red-500" size={24} />
            <div>
              <div className="text-xs text-gray-500">Lives</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{lives}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 bg-blue-50 p-2 sm:p-3 rounded-lg">
            <Target className="text-blue-500" size={24} />
            <div>
              <div className="text-xs text-gray-500">Arrows</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{totalArrowsRemoved}</div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 bg-purple-50 p-2 sm:p-3 rounded-lg">
            <Clock className="text-purple-500" size={24} />
            <div>
              <div className="text-xs text-gray-500">Time</div>
              <div className="text-xl sm:text-2xl font-bold text-gray-800">{formatTime(elapsedTime)}</div>
            </div>
          </div>
        </div>

        {/* Speed meter */}
        <div className="mb-4 sm:mb-6 bg-green-50 p-2 sm:p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="text-green-500" size={20} />
            <span className="text-xs sm:text-sm font-semibold text-green-700">Speed</span>
          </div>
          <div className="text-lg sm:text-2xl font-bold text-green-700">
            {arrowsPerSecond.toFixed(2)} <span className="text-xs sm:text-sm">arr/sec</span>
          </div>
        </div>

        {/* Message */}
        <div className={`text-center mb-3 sm:mb-4 p-2 sm:p-3 rounded-lg text-sm sm:text-base font-semibold transition-opacity duration-200 ${
          message 
            ? message.includes('❌') || message.includes('💔') 
              ? 'bg-red-100 text-red-700 opacity-100' 
              : 'bg-green-100 text-green-700 opacity-100'
            : 'bg-gray-100 text-transparent opacity-0'
        }`}>
          {message || 'Placeholder'}
        </div>

        {/* Game Grid */}
        <div 
          className="mb-4 sm:mb-6 bg-gray-50 rounded-xl p-3 sm:p-6 flex items-center justify-center"
          onTouchMove={handleTouchMove}
        >
          <div className="grid gap-2 sm:gap-3" style={{ 
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`
          }}>
            {Array.from({ length: gridSize * gridSize }).map((_, index) => {
              const row = Math.floor(index / gridSize);
              const col = index % gridSize;
              const arrow = arrows.find(a => a.row === row && a.col === col);
              
              return (
                <div key={`${row}-${col}`} className="flex items-center justify-center">
                  {arrow ? (
                    <Arrow
                      direction={arrow.direction}
                      onClick={() => handleArrowClick(arrow)}
                      onMouseDown={(e) => handleMouseDown(arrow, e)}
                      onMouseEnter={(e) => handleMouseEnter(arrow, e)}
                      onTouchStart={(e) => handleTouchStart(arrow, e)}
                      isBlocked={isArrowBlocked(arrow)}
                      isFlying={flyingArrows.has(arrow.id)}
                      flyDirection={flyingArrows.get(arrow.id)}
                      shouldShake={shakingArrowId === arrow.id}
                      arrowId={arrow.id}
                      size={arrowSizing.size}
                      iconSize={arrowSizing.icon}
                    />
                  ) : (
                    <div className={arrowSizing.size} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4">
          <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">How to Play:</h3>
          <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
            <li>• Click/tap arrows that are <strong>not blocked</strong> (blue arrows)</li>
            <li>• Drag across multiple arrows to remove them quickly</li>
            <li>• Gain 1 life every 5 levels (levels 5, 10, 15...)</li>
            <li>• Lose all lives → fall back to last checkpoint</li>
            <li>• <strong>Reset Board:</strong> Generate new puzzle (costs 1 life)</li>
          </ul>
        </div>

        {/* Reset Board Button */}
        {!gameOver && (
          <button
            onClick={handleReset}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors mb-3 sm:mb-4 text-sm sm:text-base"
          >
            🔄 Reset Board (Costs 1 Life)
          </button>
        )}

        {/* Game Over */}
        {gameOver && (
          <button
            onClick={resetGame}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-3 px-4 sm:px-6 rounded-lg transition-colors text-sm sm:text-base"
          >
            Play Again
          </button>
        )}
      </div>
    </div>
  );
};

export default ArrowGame;