
export interface ErrorDetail {
  incorrectPhrase: string;
  explanation: string;
}

export interface GeminiAnalysisResponse {
  correctedText: string;
  errorsFound: ErrorDetail[];
}

export enum AppState {
  Idle = "IDLE",
  Listening = "LISTENING",
  Processing = "PROCESSING",
  ShowingResult = "SHOWING_RESULT",
  Error = "ERROR"
}
