let sharedAudioContext = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  if (!sharedAudioContext || sharedAudioContext.state === "closed") {
    sharedAudioContext = new AudioContextConstructor();
  }
  return sharedAudioContext;
}

function resumeAudioContext(context) {
  if (context.state === "running") return Promise.resolve(true);
  try {
    return context.resume().then(() => context.state === "running").catch((error) => {
      console.debug("تعذر تفعيل صوت الإشعار:", error);
      return false;
    });
  } catch (error) {
    console.debug("تعذر تفعيل صوت الإشعار:", error);
    return Promise.resolve(false);
  }
}

export function unlockRealtimeNotifications() {
  try {
    const context = getAudioContext();
    return context ? resumeAudioContext(context) : Promise.resolve(false);
  } catch (error) {
    console.debug("تعذر تفعيل صوت الإشعار:", error);
    return Promise.resolve(false);
  }
}

export function playRealtimeNotification(kind = "order") {
  try {
    const context = getAudioContext();
    if (!context) return;

    const play = () => {
      if (context.state !== "running") return;
      const isWaiter = kind === "waiter";
      const notes = isWaiter ? [660, 880, 660, 988] : [880, 1046.5, 1318.5, 1568];
      const gain = context.createGain();
      const oscillator = context.createOscillator();

      oscillator.type = isWaiter ? "triangle" : "sine";
      oscillator.connect(gain);
      gain.connect(context.destination);

      const now = context.currentTime;
      gain.gain.setValueAtTime(0.0001, now);

      notes.forEach((frequency, index) => {
        const start = now + index * 0.13;
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.exponentialRampToValueAtTime(0.72, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11);
      });

      oscillator.start(now);
      oscillator.stop(now + 0.64);
    };

    if (context.state === "running") play();
    else void resumeAudioContext(context).then((ready) => { if (ready) play(); });
  } catch (error) {
    console.debug("تعذر تشغيل صوت الإشعار:", error);
  }
}
