"""
Pitch shifting utilities: generate escalating bird calls
"""

import numpy as np
import librosa
import soundfile as sf
from pathlib import Path


class PitchShifter:
    """Generates and caches pitch-shifted audio variants"""

    def __init__(self, base_audio_path: str, sr: int = 44100):
        self.sr = sr
        self.y_base, _ = librosa.load(base_audio_path, sr=sr, mono=True)
        self.y_base = librosa.util.normalize(self.y_base)
        self.cache: dict[int, np.ndarray] = {}

    def get_shifted(self, semitones: int) -> np.ndarray:
        """Return pitch-shifted audio, cached."""
        if semitones not in self.cache:
            if semitones == 0:
                self.cache[0] = self.y_base.copy()
            else:
                self.cache[semitones] = librosa.effects.pitch_shift(
                    self.y_base, sr=self.sr, n_steps=semitones
                )
        return self.cache[semitones]

    def pregenerate(self, shifts: list[int], output_dir: str, preroll_silence_sec: float = 0.0):
        """Pre-generate all variants as WAV files.

        preroll_silence_sec: seconds of silence prepended to each file to
        wake up Bluetooth / power-saving audio devices before the call starts.
        """
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        preroll = np.zeros(int(preroll_silence_sec * self.sr), dtype=np.float32)

        for idx, s in enumerate(shifts):
            y = self.get_shifted(s)
            y_padded = np.concatenate([preroll, y]) if preroll_silence_sec > 0 else y
            filepath = output_path / f"uwu_round_{idx + 1}.wav"
            sf.write(str(filepath), y_padded, self.sr)

        # Also save the processed base (no preroll — used for analysis only)
        sf.write(str(output_path / "uwu_base.wav"), self.y_base, self.sr)
