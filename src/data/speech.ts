import * as Speech from 'expo-speech';

/** Read German text aloud with the device's own German voice (free, works offline on most devices). */
export function speak(text: string) {
  Speech.stop();
  Speech.speak(text, { language: 'de-DE', rate: 0.9 });
}
