"""
Audio processing utilities: pitch detection, contour extraction, normalization
"""

import numpy as np
import librosa
import io


class AudioProcessor:
    """Handles raw audio → pitch contour extraction"""

    def __init__(self, sr: int = 44100):
        self.sr = sr
        self.fmin = librosa.note_to_hz("C3")  # ~130 Hz
        self.fmax = librosa.note_to_hz("C7")  # ~2093 Hz
        self.hop_length = 512

    def load_audio(self, audio_bytes: bytes) -> np.ndarray:
        """Load audio from WAV bytes, convert to mono float."""
        y, _ = librosa.load(io.BytesIO(audio_bytes), sr=self.sr, mono=True)
        return y

    def extract_contour(self, y: np.ndarray) -> dict:
        """
        Extract pitch contour from audio signal.

        Returns:
            {
                "f0": np.ndarray (Hz, NaN for unvoiced),
                "contour_semitones": np.ndarray (relative to median),
                "median_hz": float,
                "voiced_ratio": float (0-1, proportion of voiced frames)
            }
        """
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y,
            fmin=self.fmin,
            fmax=self.fmax,
            sr=self.sr,
            hop_length=self.hop_length,
        )

        voiced_ratio = np.sum(~np.isnan(f0)) / len(f0)
        median_hz = float(np.nanmedian(f0)) if voiced_ratio > 0.1 else 0.0

        if median_hz > 0:
            contour_semitones = 12 * np.log2(f0 / median_hz)
            # Smooth: rolling mean, window=5
            kernel = np.ones(5) / 5
            contour_smooth = np.convolve(
                np.nan_to_num(contour_semitones, nan=0.0), kernel, mode="same"
            )
        else:
            contour_smooth = np.zeros_like(f0)

        return {
            "f0": f0,
            "contour_semitones": contour_smooth,
            "median_hz": median_hz,
            "voiced_ratio": voiced_ratio,
        }
