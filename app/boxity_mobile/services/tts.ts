import { Audio } from 'expo-av';

type VoiceFeedback = 'move_closer' | 'move_farther' | 'align_box' | 'hold_steady' | 'rotate_box' | 'ready';

const FEEDBACK_MESSAGES: Record<VoiceFeedback, string> = {
  move_closer: 'Move closer to the box',
  move_farther: 'Move farther from the box',
  align_box: 'Align the box within the frame',
  hold_steady: 'Hold steady',
  rotate_box: 'Rotate the box',
  ready: 'Ready to capture',
};

// React Native compatible ElevenLabs client
class ElevenLabsClient {
  private apiKey: string;
  private environment: string;

  constructor(config: { apiKey: string; environment?: string }) {
    this.apiKey = config.apiKey;
    this.environment = config.environment || 'https://api.elevenlabs.io/';
  }

  textToSpeech = {
    convert: async (
      voiceId: string,
      options: {
        text: string;
        modelId: string;
        outputFormat?: string;
      }
    ) => {
      const response = await fetch(`${this.environment}v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify({
          text: options.text,
          model_id: options.modelId,
          output_format: options.outputFormat || 'mp3_44100_128',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return response;
    },
  };
}

class TTSService {
  private sound: Audio.Sound | null = null;
  private lastFeedbackTime = 0;
  private readonly COOLDOWN_MS = 2500;
  private audioCache: Map<VoiceFeedback, string> = new Map();
  private isEnabled = true;
  private client: ElevenLabsClient | null = null;
  private readonly VOICE_ID = 'PIGsltMj3gFMR34aFDI3';

  async initialize() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });

      // Initialize ElevenLabs client
      const apiKey = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY;
      if (apiKey) {
        this.client = new ElevenLabsClient({
          apiKey,
          environment: 'https://api.elevenlabs.io/',
        });
        console.log('TTS: ElevenLabs client initialized');
      } else {
        console.warn('TTS: ElevenLabs API key not found');
      }

      console.log('TTS: Audio mode configured');
    } catch (error) {
      console.error('TTS: Failed to configure audio mode:', error);
    }
  }

  async playFeedback(feedback: VoiceFeedback) {
    if (!this.isEnabled) return;

    const now = Date.now();
    if (now - this.lastFeedbackTime < this.COOLDOWN_MS) {
      console.log('TTS: Cooldown active, skipping feedback');
      return;
    }

    this.lastFeedbackTime = now;

    try {
      if (this.sound) {
        await this.sound.unloadAsync();
        this.sound = null;
      }

      const message = FEEDBACK_MESSAGES[feedback];
      console.log('TTS: Playing feedback:', message);

      // Check if audio is already cached
      let audioUri = this.audioCache.get(feedback);
      
      if (audioUri) {
        console.log('TTS: Using cached audio');
      } else {
        // Generate audio only when needed
        console.log('TTS: Generating audio with ElevenLabs...');
        
        if (!this.client) {
          throw new Error('TTS: ElevenLabs client not initialized. Please check your API key.');
        }

        // Use client.textToSpeech.convert to generate audio
        const response = await this.client.textToSpeech.convert(this.VOICE_ID, {
          outputFormat: 'mp3_44100_128',
          text: message,
          modelId: 'eleven_multilingual_v2',
        });

        const charCost = response.headers.get('x-character-count');
        const requestId = response.headers.get('request-id');
        console.log('TTS: Character cost:', charCost, 'Request ID:', requestId);

        const audioBuffer = await response.arrayBuffer();
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
        audioUri = `data:audio/mpeg;base64,${base64Audio}`;

        // Cache the generated audio for future use
        this.audioCache.set(feedback, audioUri);
        console.log('TTS: Audio cached for future use');
      }

      // Play the audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true }
      );

      this.sound = sound;

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('TTS: Playback failed:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    console.log('TTS: Voice guidance', enabled ? 'enabled' : 'disabled');
  }

  async cleanup() {
    if (this.sound) {
      await this.sound.unloadAsync();
      this.sound = null;
    }
  }
}

export const ttsService = new TTSService();
