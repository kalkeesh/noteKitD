import { Platform } from 'react-native';

import { apiFormRequest, apiRequest } from '../../config/api';

async function appendAudio(formData, audio) {
  if (!audio?.uri) {
    return;
  }

  if (Platform.OS === 'web') {
    const response = await fetch(audio.uri);
    const blob = await response.blob();
    formData.append('audio', blob, audio.name || 'voice-command.webm');
    return;
  }

  formData.append('audio', {
    uri: audio.uri,
    name: audio.name || 'voice-command.m4a',
    type: audio.type || 'audio/m4a',
  });
}

export async function transcribeAssistantAudio({ audio, token }) {
  const formData = new FormData();
  await appendAudio(formData, audio);
  return apiFormRequest('/ai/transcribe', formData, token, 20000);
}

export async function submitAssistantCommand({ text, context, token }) {
  return apiRequest(
    '/ai/chat',
    'POST',
    {
      text: text?.trim() || '',
      context: context || null,
    },
    token
  );
}
