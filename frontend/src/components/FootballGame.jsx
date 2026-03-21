/* eslint-disable react-hooks/refs */
import React, { useEffect, useRef, useState } from 'react';

const PITCH_W = 1200;
const PITCH_H = 800;
const GOAL_H = 160;

const generateTeam = (teamId, color) => [
  { id: `${teamId}-GK`, role: 'GK', name: 'Keeper', num: 1, x: teamId === 'A' ? 50 : PITCH_W - 50, y: PITCH_H / 2, vx: 0, vy: 0, angle: teamId === 'A' ? 0 : Math.PI, stride: 0, color },
  { id: `${teamId}-DEF1`, role: 'DEF', name: 'Okocha', num: 10, x: teamId === 'A' ? 300 : PITCH_W - 300, y: PITCH_H / 2 - 150, vx: 0, vy: 0, angle: teamId === 'A' ? 0 : Math.PI, stride: 0, color },
  { id: `${teamId}-DEF2`, role: 'DEF', name: 'Kanu', num: 4, x: teamId === 'A' ? 300 : PITCH_W - 300, y: PITCH_H / 2 + 150, vx: 0, vy: 0, angle: teamId === 'A' ? 0 : Math.PI, stride: 0, color },
  { id: `${teamId}-MID`, role: 'MID', name: 'Mikel', num: 8, x: teamId === 'A' ? 500 : PITCH_W - 500, y: PITCH_H / 2, vx: 0, vy: 0, angle: teamId === 'A' ? 0 : Math.PI, stride: 0, color },
  { id: `${teamId}-FWD`, role: 'FWD', name: 'Osimhen', num: 9, x: teamId === 'A' ? 700 : PITCH_W - 700, y: PITCH_H / 2, vx: 0, vy: 0, angle: teamId === 'A' ? 0 : Math.PI, stride: 0, color },
];

// Removed 'game' and 'me' to satisfy the unused variables linter rule
export const NigerianFootballView = () => {
  const canvasRef = useRef(null);
  const [hasGamepad, setHasGamepad] = useState(false);
  const [score, setScore] = useState({ A: 0, B: 0 });
  
  const passSound = useRef(typeof Audio !== 'undefined' ? new Audio('/sounds/kick.mp3') : null);
  const scoreSound = useRef(typeof Audio !== 'undefined' ? new Audio('/sounds/goal.mp3') : null);
  const cheerSound = useRef(typeof Audio !== 'undefined' ? new Audio('/sounds/crowd.mp3') : null);

  // Initialize as null to prevent impure function calls during render
  const engine = useRef(null);

  useEffect(() => {
    const handleGamepadConnected = (e) => {
      console.log('Gamepad connected:', e.gamepad.id);
      setHasGamepad(true);
    };
    window.addEventListener('gamepadconnected', handleGamepadConnected);
    return () => window.removeEventListener('gamepadconnected', handleGamepadConnected);
  }, []);

  useEffect(() => {
    // Lazily initialize the engine state inside the effect (safe from render cycle)
    if (!engine.current) {
      engine.current = {
        ball: { x: PITCH_W / 2, y: PITCH_H / 2, vx: 0, vy: 0, z: 0, vz: 0 },
        players: [...generateTeam('A', '#16a34a'), ...generateTeam('B', '#dc2626')],
        controlledPlayerA: 'A-MID',
        controlledPlayerB: 'B-MID',
        camera: { x: PITCH_W / 2, y: PITCH_H / 2 },
        lastTime: performance.now(),
        celebrating: false,
      };
    } else {
      // If returning to the component, reset the timer to prevent massive delta-time jumps
      engine.current.lastTime = performance.now();
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const render = (time) => {
      const state = engine.current;
      const dt = (time - state.lastTime) / 1000;
      state.lastTime = time;

      // 1. GAMEPAD & PLAYER MOVEMENT
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad1 = gamepads[0];
      
      let p1Active = state.players.find(p => p.id === state.controlledPlayerA);
      
      if (pad1 && p1Active && !state.celebrating) {
        const deadzone = 0.2;
        let moveX = 0;
        let moveY = 0;

        if (Math.abs(pad1.axes[0]) > deadzone) moveX = pad1.axes[0];
        if (Math.abs(pad1.axes[1]) > deadzone) moveY = pad1.axes[1];

        p1Active.vx = moveX * 350;
        p1Active.vy = moveY * 350;
        
        p1Active.x += p1Active.vx * dt;
        p1Active.y += p1Active.vy * dt;

        if (Math.hypot(p1Active.vx, p1Active.vy) > 10) {
           p1Active.angle = Math.atan2(p1Active.vy, p1Active.vx);
           p1Active.stride += Math.hypot(p1Active.vx, p1Active.vy) * dt * 0.05; 
        } else {
           p1Active.stride = 0; 
        }

        if (pad1.buttons[0].pressed) {
           const dist = Math.hypot(state.ball.x - p1Active.x, state.ball.y - p1Active.y);
           if (dist < 35) {
             state.ball.vx = Math.cos(p1Active.angle) * 800;
             state.ball.vy = Math.sin(p1Active.angle) * 800;
             passSound.current?.play().catch(()=>{});
           }
        }
        
        if (pad1.buttons[2].pressed) {
           const dist = Math.hypot(state.ball.x - p1Active.x, state.ball.y - p1Active.y);
           if (dist < 35) {
             state.ball.vx = Math.cos(p1Active.angle) * 1400;
             state.ball.vy = Math.sin(p1Active.angle) * 1400;
             state.ball.vz = -400; 
             passSound.current?.play().catch(()=>{});
           }
        }
      }

      // 2. BALL PHYSICS
      if (!state.celebrating) {
        state.ball.x += state.ball.vx * dt;
        state.ball.y += state.ball.vy * dt;
        state.ball.z += state.ball.vz * dt;
        
        state.ball.vx *= 0.98;
        state.ball.vy *= 0.98;
        if (state.ball.z < 0) {
          state.ball.vz += 900 * dt; 
        } else {
          state.ball.z = 0;
          state.ball.vz *= -0.5; 
        }

        if (state.ball.x < 0 || state.ball.x > PITCH_W) state.ball.vx *= -1;
        if (state.ball.y < 0 || state.ball.y > PITCH_H) state.ball.vy *= -1;

        const isGoalY = state.ball.y > (PITCH_H / 2 - GOAL_H / 2) && state.ball.y < (PITCH_H / 2 + GOAL_H / 2);
        if (state.ball.x <= 10 && isGoalY) handleGoal('B');
        if (state.ball.x >= PITCH_W - 10 && isGoalY) handleGoal('A');
      }

      // 3. CAMERA TRACKING
      const targetCamX = state.ball.x;
      const targetCamY = state.ball.y;
      state.camera.x += (targetCamX - state.camera.x) * 5 * dt;
      state.camera.y += (targetCamY - state.camera.y) * 5 * dt;

      // 4. DRAW PITCH
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w/2 - state.camera.x, h/2 - state.camera.y);

      ctx.fillStyle = '#14532d';
      ctx.fillRect(0, 0, PITCH_W, PITCH_H);
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(0, 0, PITCH_W, PITCH_H); 
      ctx.beginPath();
      ctx.moveTo(PITCH_W/2, 0);
      ctx.lineTo(PITCH_W/2, PITCH_H); 
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(PITCH_W/2, PITCH_H/2, 80, 0, Math.PI * 2); 
      ctx.stroke();

      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-40, PITCH_H/2 - GOAL_H/2, 40, GOAL_H); 
      ctx.fillRect(PITCH_W, PITCH_H/2 - GOAL_H/2, 40, GOAL_H); 

      // 5. DRAW PLAYERS
      state.players.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        if (p.id === state.controlledPlayerA || p.id === state.controlledPlayerB) {
          ctx.beginPath();
          ctx.arc(0, 0, 24, 0, Math.PI * 2);
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 3;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.rotate(p.angle);

        const legSwing = Math.sin(p.stride) * 12; 
        const armSwing = Math.sin(p.stride + Math.PI) * 10; 
        const skinColor = '#8d5524'; 
        
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.roundRect(legSwing - 5, -12, 14, 8, 4); 
        ctx.roundRect(-legSwing - 5, 4, 14, 8, 4);  
        ctx.fill();

        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(armSwing, -16, 5, 0, Math.PI * 2); 
        ctx.arc(-armSwing, 16, 5, 0, Math.PI * 2); 
        ctx.fill();

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-12, -14, 24, 28, 8); 
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#000';
        ctx.stroke();

        ctx.fillStyle = skinColor;
        ctx.beginPath();
        ctx.arc(4, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(3, 0, 8.5, Math.PI / 2, Math.PI * 1.5); 
        ctx.fill();

        ctx.restore();

        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        ctx.fillText(p.num, p.x, p.y + 35);
        ctx.font = '10px Arial';
        ctx.fillText(p.name, p.x, p.y - 25);
        ctx.shadowBlur = 0; 
      });

      // 6. DRAW BALL
      const ballScale = 1 - (state.ball.z / 500);
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y + state.ball.z, 8 * ballScale, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(state.ball.x, state.ball.y + state.ball.z, 3 * ballScale, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    const handleGoal = (scoringTeam) => {
      if (engine.current.celebrating) return;
      engine.current.celebrating = true;
      scoreSound.current?.play().catch(()=>{});
      cheerSound.current?.play().catch(()=>{});
      
      setScore(prev => ({ ...prev, [scoringTeam]: prev[scoringTeam] + 1 }));

      setTimeout(() => {
        engine.current.ball = { x: PITCH_W/2, y: PITCH_H/2, vx: 0, vy: 0, z: 0, vz: 0 };
        engine.current.players = [...generateTeam('A', '#16a34a'), ...generateTeam('B', '#dc2626')];
        engine.current.celebrating = false;
      }, 4000);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center bg-gray-950 p-4">
      {/* HUD Scoreboard */}
      <div className="w-full max-w-4xl flex justify-between items-center bg-gray-900 border-b-4 border-yellow-500 p-4 rounded-t-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-green-600 border-2 border-white" />
          <span className="text-2xl font-bold">HOME</span>
          <span className="text-4xl font-black">{score.A}</span>
        </div>
        
        <div className="text-center">
          <span className="text-sm text-gray-400">Time</span>
          <div className="text-2xl font-mono text-yellow-400">45:00</div>
          {!hasGamepad && (
            <div className="text-xs text-red-400 animate-pulse mt-1">
              Connect PlayStation/Xbox Controller
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-4xl font-black">{score.B}</span>
          <span className="text-2xl font-bold">AWAY</span>
          <div className="w-8 h-8 rounded-full bg-red-600 border-2 border-white" />
        </div>
      </div>

      {/* Game Canvas */}
      <div className="w-full max-w-4xl aspect-[16/9] relative overflow-hidden rounded-b-xl border-4 border-gray-800 shadow-2xl">
        <canvas 
          ref={canvasRef} 
          width={1280} 
          height={720} 
          className="w-full h-full bg-black block"
        />
        {engine?.current?.celebrating && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-yellow-600 animate-bounce drop-shadow-2xl">
              GOAL!!!
            </h1>
          </div>
        )}
      </div>
      
      {/* Controls Helper */}
      <div className="text-gray-400 text-sm mt-4 flex gap-6">
        <span>🎮 <strong className="text-white">Left Stick:</strong> Run & Aim</span>
        <span>❌ <strong className="text-white">Cross/A:</strong> Ground Pass</span>
        <span>🟩 <strong className="text-white">Square/X:</strong> Lofted Shot</span>
      </div>
    </div>
  );
};