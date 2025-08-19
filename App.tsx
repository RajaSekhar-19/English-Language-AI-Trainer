
import React, { useState, useEffect, useCallback } from 'react';
import { AppState, ErrorDetail, GeminiAnalysisResponse } from './types';
import MicrophoneButton from './components/MicrophoneButton';
import ResultDisplay from './components/ResultDisplay';
import { SparklesIcon } from './components/icons';
import { startListening, speakText, ASR_SUPPORTED, TTS_SUPPORTED } from './services/speechService';
import { analyzeText } from './services/geminiService';
// Removed: import { API_KEY } from './env.js'; 

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.Idle);
  const [statusMessage, setStatusMessage] = useState<string>('Tap the microphone to start speaking.');
  const [transcript, setTranscript] = useState<string>('');
  const [correctedSentence, setCorrectedSentence] = useState<string>('');
  const [errors, setErrors] = useState<ErrorDetail[]>([]);
  const [isAudioPlaying, setIsAudioPlaying] = useState<boolean>(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState<boolean>(false);

  const [stopListeningCallback, setStopListeningCallback] = useState<(() => void) | null>(null);
  
  const resetState = () => {
    setTranscript('');
    setCorrectedSentence('');
    setErrors([]);
    if (!isApiKeyMissing) { 
        setStatusMessage('Tap the microphone to start speaking.');
    }
    setAppState(AppState.Idle);
    if (TTS_SUPPORTED && speechSynthesis.speaking) {
      speechSynthesis.cancel();
    }
    setIsAudioPlaying(false);
  };

  // API Key check early in the component lifecycle
  useEffect(() => {
    const apiKey = typeof process !== 'undefined' && process.env && process.env.API_KEY ? process.env.API_KEY : null;
    if (!apiKey || apiKey === "YOUR_GEMINI_API_KEY_HERE") {
        setStatusMessage("Configuration Error: Gemini API Key is missing or not set correctly in index.html. Please set 'window.process.env.API_KEY' in index.html and replace the placeholder value. Analysis features will be unavailable.");
        setAppState(AppState.Error);
        setIsApiKeyMissing(true);
    } else {
        setIsApiKeyMissing(false);
    }
  }, []);

  useEffect(() => {
    if (!ASR_SUPPORTED && !isApiKeyMissing) { 
      setStatusMessage("Speech recognition is not supported by your browser. Please try a different browser like Chrome or Edge.");
      setAppState(AppState.Error);
    }
    if (!TTS_SUPPORTED) {
      console.warn("Text-to-speech is not supported by your browser. Audio playback of corrections will not be available.");
    }
  }, [isApiKeyMissing]);

  const handlePlayCorrectedAudio = useCallback((textToPlayParam?: string) => {
    const textToPlay = textToPlayParam || correctedSentence; 
    
    if (isAudioPlaying) { 
        speechSynthesis.cancel();
        setIsAudioPlaying(false);
        if (textToPlayParam === correctedSentence || !textToPlayParam) return; 
    }

    if (textToPlay && TTS_SUPPORTED) {
      setIsAudioPlaying(true);
      speakText(textToPlay, 
        () => setIsAudioPlaying(false), 
        (errMsg) => { 
          setStatusMessage(`Audio Error: ${errMsg}`);
          setIsAudioPlaying(false);
        }
      );
    } else if (!TTS_SUPPORTED) {
        setStatusMessage("Text-to-speech is not supported in your browser.");
    }
  }, [correctedSentence, isAudioPlaying]);

  const handleTranscriptionResult = useCallback(async (text: string) => {
    setTranscript(text);
    if (isApiKeyMissing) {
        setStatusMessage("Cannot analyze: API Key is missing or incorrectly set in index.html.");
        setAppState(AppState.Error);
        return;
    }
    if (!text.trim()) {
      setStatusMessage('No speech detected. Please try again.');
      setAppState(AppState.Idle); 
      return;
    }
    setAppState(AppState.Processing);
    setStatusMessage('Analyzing your speech...');
    try {
      const analysis: GeminiAnalysisResponse = await analyzeText(text);
      setCorrectedSentence(analysis.correctedText);
      setErrors(analysis.errorsFound || []);
      setAppState(AppState.ShowingResult);
      setStatusMessage('Analysis complete!');
      if (analysis.correctedText) {
        handlePlayCorrectedAudio(analysis.correctedText);
      }
    } catch (error: any) {
      console.error("Error during analysis:", error);
      setStatusMessage(`Error: ${error.message || 'Failed to analyze text.'}`);
      setAppState(AppState.Error);
    }
  }, [isApiKeyMissing, handlePlayCorrectedAudio]);


  const handleMicClick = async () => {
    if (isApiKeyMissing) {
        setStatusMessage("Cannot start: API Key is missing or incorrectly set in index.html.");
        setAppState(AppState.Error);
        return;
    }
    if (!ASR_SUPPORTED) {
      setStatusMessage("Speech recognition not supported. Cannot start listening.");
      setAppState(AppState.Error);
      return;
    }

    if (appState === AppState.Listening) {
      if (stopListeningCallback) {
        stopListeningCallback(); 
      }
    } else {
      resetState(); 
      setAppState(AppState.Listening);
      setStatusMessage('Listening... Say something in English.');
      try {
        const stopCallback = await startListening(
          handleTranscriptionResult,
          (errorMsg) => {
            setStatusMessage(`Speech Error: ${errorMsg}`);
            setAppState(AppState.Error);
          },
          () => { 
            // Handled by onResult or onError
          }
        );
        setStopListeningCallback(() => stopCallback);
      } catch (error) {
        console.error("Could not start listener:", error);
        setStatusMessage(`Error: Could not start listener.`);
        setAppState(AppState.Error);
      }
    }
  };
  

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-sky-100 flex flex-col items-center justify-center p-4 pt-8 text-center font-sans">
      <header className="mb-8">
        <h1 className="text-4xl sm:text-5xl font-bold text-sky-700 flex items-center justify-center">
          <SparklesIcon className="w-10 h-10 sm:w-12 sm:h-12 mr-3 text-sky-500" />
          AI English Trainer
        </h1>
        <p className="text-slate-600 mt-3 text-lg px-2">{statusMessage}</p>
      </header>

      <main className="flex flex-col items-center w-full px-4">
        <MicrophoneButton 
            appState={appState} 
            onClick={handleMicClick} 
            disabled={!ASR_SUPPORTED || isApiKeyMissing || (appState === AppState.Listening && isApiKeyMissing)} 
        />

        {(appState === AppState.ShowingResult || (appState === AppState.Error && transcript)) && (transcript || correctedSentence || errors.length > 0) && !isApiKeyMissing && (
          <ResultDisplay
            originalText={transcript}
            correctedText={correctedSentence}
            errors={errors}
            onPlayCorrectedAudio={() => handlePlayCorrectedAudio()}
            isAudioPlaying={isAudioPlaying}
          />
        )}
        
        {!ASR_SUPPORTED && appState !== AppState.Error && !isApiKeyMissing && (
           <p className="mt-6 text-red-600 bg-red-100 p-3 rounded-md shadow">
            Speech recognition is not supported in your browser. Please use Chrome or Edge for the best experience.
          </p>
        )}
        {isApiKeyMissing && ( 
            <p className="mt-6 text-orange-700 bg-orange-100 p-3 rounded-md shadow max-w-md">
                Configuration Error: Your Gemini API Key is missing or not set correctly.
                Please open <code>index.html</code>, find the script tag that defines <code>window.process.env.API_KEY</code>,
                and replace <code>"YOUR_GEMINI_API_KEY_HERE"</code> with your actual API key.
                The app's analysis features are currently disabled.
            </p>
        )}
      </main>
      
      <footer className="mt-12 mb-6 text-sm text-slate-500">
        <p>&copy; {new Date().getFullYear()} AI English Language Trainer. Powered by Gemini.</p>
      </footer>
    </div>
  );
};

export default App;