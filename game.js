(() => {
  "use strict";

  const canvas = document.querySelector("#gameCanvas");
  const ctx = canvas.getContext("2d");
  const gameArea = document.querySelector("#gameArea");
  const startOverlay = document.querySelector("#startOverlay");
  const resultOverlay = document.querySelector("#resultOverlay");
  const scoreEl = document.querySelector("#score");
  const livesEl = document.querySelector("#lives");
  const statusEl = document.querySelector("#statusText");
  const bestScoreEl = document.querySelector("#bestScore");
  const finalScoreEl = document.querySelector("#finalScore");
  const resultTitle = document.querySelector("#resultTitle");
  const resultText = document.querySelector("#resultText");
  const soundButton = document.querySelector("#soundButton");

  const W = canvas.width;
  const H = canvas.height;
  const state = {
    running: false,
    score: 0,
    lives: 3,
    elapsed: 0,
    spawnTimer: 0,
    lastFrame: 0,
    shake: 0,
    items: [],
    particles: [],
    popups: [],
    keys: { left: false, right: false },
    player: { x: W / 2, y: H - 82, width: 125, height: 70, targetX: W / 2 },
    sound: true,
    audio: null,
    best: Number(localStorage.getItem("apple-catch-best") || 0)
  };

  const clouds = [
    { x: 115, y: 85, s: 1 }, { x: 445, y: 55, s: .7 }, { x: 755, y: 115, s: 1.15 }
  ];

  function updateHud(message = "接住蘋果！") {
    scoreEl.textContent = String(state.score);
    bestScoreEl.textContent = String(state.best);
    livesEl.textContent = `${"♥ ".repeat(state.lives)}${"♡ ".repeat(3 - state.lives)}`.trim();
    livesEl.setAttribute("aria-label", `剩餘 ${state.lives} 顆愛心`);
    statusEl.textContent = message;
  }

  function initAudio() {
    if (!state.audio) state.audio = new (window.AudioContext || window.webkitAudioContext)();
    if (state.audio.state === "suspended") state.audio.resume();
  }

  function tone(freq, duration, type = "sine", volume = .035, delay = 0) {
    if (!state.sound) return;
    initAudio();
    const osc = state.audio.createOscillator();
    const gain = state.audio.createGain();
    const now = state.audio.currentTime + delay;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    osc.connect(gain).connect(state.audio.destination);
    osc.start(now);
    osc.stop(now + duration);
  }

  function startGame() {
    initAudio();
    Object.assign(state, {
      running: true,
      score: 0,
      lives: 3,
      elapsed: 0,
      spawnTimer: .8,
      lastFrame: performance.now(),
      shake: 0,
      items: [],
      particles: [],
      popups: []
    });
    state.player.x = W / 2;
    state.player.targetX = W / 2;
    startOverlay.classList.remove("is-visible");
    resultOverlay.classList.remove("is-visible");
    resultOverlay.setAttribute("aria-hidden", "true");
    updateHud();
    requestAnimationFrame(loop);
  }

  function endGame() {
    state.running = false;
    if (state.score > state.best) {
      state.best = state.score;
      localStorage.setItem("apple-catch-best", String(state.best));
      resultTitle.textContent = "新的最高分！";
      resultText.textContent = "今天的蘋果都快被你接光啦！";
      tone(520, .15); tone(700, .18, "sine", .035, .12); tone(880, .28, "sine", .035, .25);
    } else if (state.score >= 15) {
      resultTitle.textContent = "籃子裝得滿滿的！";
      resultText.textContent = "好厲害，再玩一次挑戰最高分吧。";
    } else {
      resultTitle.textContent = "差一點點！";
      resultText.textContent = "看準蘋果的位置，再來挑戰一次吧。";
    }
    finalScoreEl.textContent = String(state.score);
    resultOverlay.classList.add("is-visible");
    resultOverlay.setAttribute("aria-hidden", "false");
    updateHud("遊戲結束");
  }

  function loseHeart(reason, x, y) {
    state.lives -= 1;
    state.shake = .32;
    updateHud(reason);
    state.popups.push({ x, y, text: "-1 ♥", color: "#e84e49", life: .9 });
    burst(x, y, "#e84e49", 14);
    tone(130, .22, "sawtooth", .045);
    if (navigator.vibrate) navigator.vibrate(70);
    if (state.lives <= 0) endGame();
  }

  function spawnItem() {
    const chestnutChance = Math.min(.27, .16 + state.elapsed * .0025);
    const type = Math.random() < chestnutChance ? "chestnut" : "apple";
    state.items.push({
      type,
      x: 145 + Math.random() * (W - 280),
      y: 104,
      size: type === "apple" ? 24 : 27,
      speed: 135 + Math.random() * 45 + Math.min(120, state.elapsed * 2.4),
      vx: (Math.random() - .5) * 75,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - .5) * 3
    });
  }

  function burst(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = 35 + Math.random() * 95;
      state.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, life: .5 + Math.random() * .35, color, size: 2 + Math.random() * 3 });
    }
  }

  function update(dt) {
    state.elapsed += dt;
    state.shake = Math.max(0, state.shake - dt);

    const keyboardSpeed = 590;
    if (state.keys.left) state.player.targetX -= keyboardSpeed * dt;
    if (state.keys.right) state.player.targetX += keyboardSpeed * dt;
    const margin = state.player.width / 2 + 18;
    state.player.targetX = Math.max(margin, Math.min(W - margin, state.player.targetX));
    state.player.x += (state.player.targetX - state.player.x) * Math.min(1, dt * 15);

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnItem();
      state.spawnTimer = Math.max(.46, 1.02 - state.elapsed * .008) * (.82 + Math.random() * .36);
    }

    const left = state.player.x - state.player.width / 2;
    const right = state.player.x + state.player.width / 2;
    const basketTop = state.player.y - 23;

    for (let i = state.items.length - 1; i >= 0; i--) {
      const item = state.items[i];
      item.y += item.speed * dt;
      item.x += item.vx * dt;
      item.rotation += item.spin * dt;
      if (item.x < 45 || item.x > W - 45) item.vx *= -1;

      const caught = item.y + item.size * .6 > basketTop && item.y < state.player.y + 18 && item.x > left && item.x < right;
      if (caught) {
        state.items.splice(i, 1);
        if (item.type === "apple") {
          state.score += 1;
          updateHud("接到了！");
          state.popups.push({ x: item.x, y: item.y, text: "+1", color: "#fff7a6", life: .8 });
          burst(item.x, item.y, "#ffd64f", 12);
          tone(720, .12); tone(920, .14, "sine", .025, .06);
        } else {
          loseHeart("被栗子刺到！", item.x, item.y);
        }
      } else if (item.y - item.size > H) {
        state.items.splice(i, 1);
        if (item.type === "apple") loseHeart("蘋果掉了！", item.x, H - 24);
      }
    }

    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 150 * dt; p.life -= dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.popups.length - 1; i >= 0; i--) {
      const p = state.popups[i];
      p.y -= 35 * dt; p.life -= dt;
      if (p.life <= 0) state.popups.splice(i, 1);
    }
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  }

  function drawCloud(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.fillStyle = "rgba(255,255,255,.8)";
    ctx.beginPath(); ctx.arc(-32, 5, 24, 0, Math.PI * 2); ctx.arc(0, -8, 34, 0, Math.PI * 2); ctx.arc(38, 8, 26, 0, Math.PI * 2); ctx.rect(-34, 5, 75, 28); ctx.fill(); ctx.restore();
  }

  function drawTree() {
    ctx.fillStyle = "#805535"; roundedRect(-26, 98, 138, 390, 46); ctx.fill();
    ctx.fillStyle = "#986847"; roundedRect(32, 100, 35, 385, 17); ctx.fill();
    ctx.fillStyle = "#765032";
    ctx.beginPath(); ctx.moveTo(38, 205); ctx.quadraticCurveTo(190, 120, 324, 165); ctx.lineTo(310, 195); ctx.quadraticCurveTo(172, 160, 57, 259); ctx.fill();

    const blobs = [[40,84,96],[120,88,91],[204,80,105],[294,95,88],[375,72,106],[475,87,98],[585,77,114],[688,92,102],[790,82,112],[892,90,105],[956,84,85]];
    for (const [x,y,r] of blobs) {
      ctx.fillStyle = x % 3 === 0 ? "#4d944e" : x % 2 === 0 ? "#5ca557" : "#69af58";
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#73b95f";
    for (let x = 28; x < W; x += 73) { ctx.beginPath(); ctx.arc(x, 145 + Math.sin(x) * 15, 48, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawSquirrel(t) {
    const x = 215 + Math.sin(t * .0011) * 18;
    const y = 125;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * .002) * .04);
    ctx.fillStyle = "#c8793b";
    ctx.beginPath(); ctx.ellipse(-41, 5, 35, 49, -.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e39a55";
    ctx.beginPath(); ctx.ellipse(-46, 5, 22, 34, -.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#b96732";
    ctx.beginPath(); ctx.ellipse(4, 12, 31, 39, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -23, 27, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-9,-42); ctx.lineTo(-4,-67); ctx.lineTo(10,-45); ctx.fill();
    ctx.beginPath(); ctx.moveTo(19,-44); ctx.lineTo(31,-64); ctx.lineTo(35,-36); ctx.fill();
    ctx.fillStyle = "#f4c18c"; ctx.beginPath(); ctx.ellipse(12, -15, 16, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#3b2d26"; ctx.beginPath(); ctx.arc(16, -30, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(28, -16, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#3b2d26"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(15, -11, 8, .1, 1.15); ctx.stroke();
    ctx.restore();
  }

  function drawBackground(t) {
    const sky = ctx.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, "#9fddf1"); sky.addColorStop(.66, "#d9f3e5"); sky.addColorStop(1, "#c1de78"); ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    for (const c of clouds) drawCloud((c.x + t * .008 * c.s) % (W + 180) - 90, c.y, c.s);
    ctx.fillStyle = "#a5d261"; ctx.beginPath(); ctx.moveTo(0, 470); ctx.quadraticCurveTo(210, 405, 420, 470); ctx.quadraticCurveTo(710, 390, W, 460); ctx.lineTo(W,H); ctx.lineTo(0,H); ctx.fill();
    drawTree(); drawSquirrel(t);
    ctx.fillStyle = "rgba(255,255,255,.28)";
    for (let x = 130; x < W; x += 160) { ctx.beginPath(); ctx.ellipse(x, H - 18, 3, 16, .8, 0, Math.PI * 2); ctx.fill(); }
  }

  function drawApple(item) {
    ctx.save(); ctx.translate(item.x, item.y); ctx.rotate(item.rotation); ctx.shadowColor = "rgba(120,45,34,.22)"; ctx.shadowBlur = 8;
    ctx.fillStyle = "#ef5b50"; ctx.beginPath(); ctx.arc(-8, 2, 17, 0, Math.PI * 2); ctx.arc(8, 2, 17, 0, Math.PI * 2); ctx.quadraticCurveTo(0, 30, -17, 8); ctx.fill();
    ctx.strokeStyle = "#705137"; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(1,-12); ctx.quadraticCurveTo(0,-23,8,-28); ctx.stroke();
    ctx.fillStyle = "#4e9b50"; ctx.beginPath(); ctx.ellipse(13,-22,10,5,.4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.52)"; ctx.beginPath(); ctx.ellipse(-10,-4,5,8,.3,0,Math.PI*2); ctx.fill(); ctx.restore();
  }

  function drawChestnut(item) {
    ctx.save(); ctx.translate(item.x,item.y); ctx.rotate(item.rotation); ctx.strokeStyle="#7b6630"; ctx.lineWidth=3; ctx.fillStyle="#91a949";
    for(let i=0;i<16;i++){ const a=i*Math.PI/8; ctx.beginPath(); ctx.moveTo(Math.cos(a)*17,Math.sin(a)*17); ctx.lineTo(Math.cos(a)*32,Math.sin(a)*32); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0,0,21,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#a66532"; ctx.beginPath(); ctx.ellipse(0,3,12,15,0,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#e1b16d"; ctx.beginPath(); ctx.arc(0,14,8,0,Math.PI); ctx.fill(); ctx.restore();
  }

  function drawPlayer() {
    const p = state.player; ctx.save(); ctx.translate(p.x,p.y);
    ctx.fillStyle="rgba(69,91,42,.18)"; ctx.beginPath(); ctx.ellipse(0,62,74,13,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#efae38"; roundedRect(-28,-31,56,80,16); ctx.fill();
    ctx.fillStyle="#527bae"; roundedRect(-27,29,54,29,8); ctx.fill();
    ctx.fillStyle="#f5c79d"; ctx.beginPath(); ctx.arc(0,-58,23,0,Math.PI*2); ctx.fill();
    ctx.fillStyle="#5f3a29"; ctx.beginPath(); ctx.arc(-2,-66,24,Math.PI,Math.PI*2); ctx.lineTo(23,-52); ctx.quadraticCurveTo(8,-61,-26,-50); ctx.fill();
    ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(8,-58,3.2,0,Math.PI*2); ctx.fill(); ctx.fillStyle="#443024"; ctx.beginPath(); ctx.arc(9,-58,1.6,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle="#9f5a4f"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(8,-49,7,.25,1.25); ctx.stroke();
    ctx.strokeStyle="#f5c79d"; ctx.lineWidth=8; ctx.lineCap="round"; ctx.beginPath(); ctx.moveTo(-22,-18); ctx.quadraticCurveTo(-46,-6,-51,20); ctx.stroke(); ctx.beginPath(); ctx.moveTo(22,-18); ctx.quadraticCurveTo(46,-6,51,20); ctx.stroke();
    ctx.fillStyle="#b87940"; ctx.strokeStyle="#6f472a"; ctx.lineWidth=3; roundedRect(-p.width/2,-7,p.width,47,12); ctx.fill(); ctx.stroke();
    ctx.fillStyle="#d59b58"; for(let x=-48;x<=48;x+=16){ctx.fillRect(x,-5,3,42);} ctx.fillRect(-57,9,114,3); ctx.fillRect(-54,23,108,3);
    ctx.strokeStyle="#6f472a"; ctx.lineWidth=5; ctx.beginPath(); ctx.moveTo(-48,-5); ctx.quadraticCurveTo(0,-54,48,-5); ctx.stroke();
    ctx.restore();
  }

  function drawEffects() {
    for (const p of state.particles) { ctx.globalAlpha=Math.max(0,p.life/.85); ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.size,0,Math.PI*2); ctx.fill(); }
    ctx.globalAlpha=1;
    ctx.textAlign="center"; ctx.font="900 25px 'Kosugi Maru', sans-serif";
    for (const p of state.popups) { ctx.globalAlpha=Math.max(0,p.life/.9); ctx.fillStyle=p.color; ctx.strokeStyle="rgba(79,56,40,.35)"; ctx.lineWidth=4; ctx.strokeText(p.text,p.x,p.y); ctx.fillText(p.text,p.x,p.y); }
    ctx.globalAlpha=1;
  }

  function draw(t=performance.now()) {
    ctx.save(); if(state.shake>0) ctx.translate((Math.random()-.5)*12,(Math.random()-.5)*8);
    drawBackground(t); for(const item of state.items) item.type==="apple"?drawApple(item):drawChestnut(item); drawEffects(); drawPlayer(); ctx.restore();
  }

  function loop(timestamp) {
    if(!state.running){ draw(timestamp); return; }
    const dt=Math.min(.033,(timestamp-state.lastFrame)/1000); state.lastFrame=timestamp; update(dt); draw(timestamp); if(state.running) requestAnimationFrame(loop);
  }

  function pointerMove(event) {
    const rect=canvas.getBoundingClientRect(); const point=event.touches?event.touches[0]:event; state.player.targetX=((point.clientX-rect.left)/rect.width)*W;
  }

  document.querySelector("#startButton").addEventListener("click",startGame);
  document.querySelector("#restartButton").addEventListener("click",startGame);
  soundButton.addEventListener("click",()=>{ state.sound=!state.sound; soundButton.setAttribute("aria-pressed",String(state.sound)); soundButton.setAttribute("aria-label",state.sound?"關閉音效":"開啟音效"); soundButton.querySelector("span").textContent=state.sound?"♫":"×"; if(state.sound) tone(660,.13); });
  window.addEventListener("keydown",event=>{ if(["ArrowLeft","ArrowRight"," "].includes(event.key)) event.preventDefault(); if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a") state.keys.left=true; if(event.key==="ArrowRight"||event.key.toLowerCase()==="d") state.keys.right=true; if((event.key===" "||event.key==="Enter")&&!state.running) startGame(); });
  window.addEventListener("keyup",event=>{ if(event.key==="ArrowLeft"||event.key.toLowerCase()==="a") state.keys.left=false; if(event.key==="ArrowRight"||event.key.toLowerCase()==="d") state.keys.right=false; });
  gameArea.addEventListener("pointermove",pointerMove); gameArea.addEventListener("pointerdown",pointerMove); gameArea.addEventListener("touchmove",pointerMove,{passive:true});
  updateHud(); draw();
})();
