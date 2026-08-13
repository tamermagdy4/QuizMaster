let context: AudioContext | null = null
let masterGain: GainNode | null = null
let oscillators: OscillatorNode[] = []
let musicTimer: number | null = null

function getContext() {
  if (typeof window === 'undefined') return null
  const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  context ??= new AudioCtor()
  masterGain ??= context.createGain()
  masterGain.connect(context.destination)
  return context
}

export function setMusicVolume(volume: number) {
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, volume))
}

export function startBackgroundMusic(volume = 0.25) {
  const audio = getContext()
  if (!audio || oscillators.length > 0) return
  setMusicVolume(volume)
  if (audio.state === 'suspended') void audio.resume()

  const frequencies = [146.83, 174.61]
  oscillators = frequencies.map((frequency) => {
    const oscillator = audio.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    oscillator.connect(masterGain!)
    oscillator.start()
    return oscillator
  })

  musicTimer = window.setInterval(() => {
    oscillators.forEach((oscillator, index) => {
      oscillator.frequency.setTargetAtTime(index === 0 ? 146.83 : 174.61, audio.currentTime, 1.2)
    })
  }, 3600)
}

export function stopBackgroundMusic() {
  if (musicTimer !== null) window.clearInterval(musicTimer)
  musicTimer = null
  oscillators.forEach((oscillator) => {
    try { oscillator.stop() } catch { /* already stopped */ }
    oscillator.disconnect()
  })
  oscillators = []
}
