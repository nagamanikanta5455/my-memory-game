// Initialize the browser's native audio engine
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

export const playSmoothCorrect = () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;

  // Play a soft, happy two-note chord (C6 and E6) instead of a harsh single pitch
  const frequencies = [1046.50, 1318.51]; 
  
  frequencies.forEach(freq => {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine'; // Pure, smooth glass bell sound
    osc.frequency.value = freq;

    // THE FIX: Dropped volume to 8% (0.08) and gave it a very soft fade out
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.08, t + 0.02); 
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
};

export const playSmoothError = () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  // Keep it pure sine so there is ZERO harsh buzzing
  osc.type = 'sine'; 
  
  // THE PITCH FIX: Start at 400Hz (easily audible on any speaker)
  // and slide it quickly down to 200Hz to give it that "negative/drop" feeling
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.15);

  // THE VOLUME FIX: Bumped max volume up to 30% (0.3)
  // Shortened the whole sound to 0.2 seconds so it's a quick, clean "bloop"
  gainNode.gain.setValueAtTime(0, t);
  gainNode.gain.linearRampToValueAtTime(0.3, t + 0.015); // Quick, punchy attack
  gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.2); // Fast fade out

  osc.start(t);
  osc.stop(t + 0.2);
};

export const playSmoothFlip = () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  osc.type = 'sine';
  
  // Quick pleasant pop/click
  osc.frequency.setValueAtTime(600, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);

  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.1);
};

// THE NEW SHUFFLE: Simulates 6 cards being dealt rapidly onto a table
export const playShuffleSound = () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;

  for (let i = 0; i < 6; i++) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t + i * 0.08); // Slight stagger between ticks

    // Extremely quick, quiet "ticks" (5% volume)
    gainNode.gain.setValueAtTime(0, t + i * 0.08);
    gainNode.gain.linearRampToValueAtTime(0.05, t + i * 0.08 + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.05);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    osc.start(t + i * 0.08);
    osc.stop(t + i * 0.08 + 0.06);
  }
};
