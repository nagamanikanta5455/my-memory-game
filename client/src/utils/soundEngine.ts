const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

// THE FIX: Added 'shuffle' to the type definition
export const playSound = (type: 'flip' | 'match' | 'mismatch' | 'win' | 'shuffle') => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;

  if (type === 'flip') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(500, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now); osc.stop(now + 0.1);
    if (navigator.vibrate) navigator.vibrate(20); 
  } 
  else if (type === 'match') {
    // THE FIX: A smooth, premium dual-tone glass chime (Major chord)
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc1.type = 'sine'; // The smoothest wave
    osc2.type = 'sine';

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(audioCtx.destination);

    // Play a C5 and E5 together for a pleasant harmony
    osc1.frequency.setValueAtTime(523.25, now);
    osc2.frequency.setValueAtTime(659.25, now);

    // Smooth attack and a long, premium fade-out (echo effect)
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.start(now); osc2.start(now);
    osc1.stop(now + 0.8); osc2.stop(now + 0.8);

    if (navigator.vibrate) navigator.vibrate([30, 50, 30]); 
  } 
  else if (type === 'mismatch') {
    // THE FIX: A smooth, premium two-tone drop ("uh-oh") instead of a harsh buzz
    osc.type = 'sine'; 
    
    // Start at a mid tone
    osc.frequency.setValueAtTime(350, now);
    // Instantly drop to a lower tone after 0.1 seconds
    osc.frequency.setValueAtTime(250, now + 0.1);
    
    // Smooth volume fade out
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
    
    osc.start(now); 
    osc.stop(now + 0.25);
    
    // A softer double-tap haptic vibration
    if (navigator.vibrate) navigator.vibrate([30, 40, 30]); 
  }
  else if (type === 'shuffle') {
    // THE FIX: Added a soft attack and release envelope to kill the crackling/popping
    osc.type = 'triangle'; 
    
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.4);
    
    // Starts at 0, ramps up quickly, then fades out smoothly
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05); 
    gain.gain.linearRampToValueAtTime(0, now + 0.4); 
    
    osc.start(now); 
    osc.stop(now + 0.4);
  }
};