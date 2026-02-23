"""
Configuration and tuning parameters for FIGHT UWU BIRD
"""

CONFIG = {
    # Pitch shift per round (in semitones)
    # Start low, gradually increase difficulty
    "round_shifts": [-9, -6, -3],

    # Base pitch of the original bird call (Hz) — set after loading asset
    # Will be computed at startup from the actual sample
    "base_pitch_hz": None,

    # Target pitch per round = base_pitch_hz * 2^(shift/12)
    # Player must be at or above this pitch to pass

    # UWU Detection thresholds
    "dtw_threshold": 5.5,            # DTW normalization ceiling (lower = stricter shape match)
    "min_voiced_ratio": 0.05,         # Minimum fraction of frames that must have detected pitch
    "pitch_tolerance": 5.0,          # Max semitones BELOW target to allow (0 = must be higher or equal)

    # Sakoe-Chiba DTW window — limits how much the warping path can deviate from the diagonal.
    # Expressed in frames (1 frame = hop_length / sample_rate seconds ≈ 11.6 ms at defaults).
    # None = unconstrained (original behaviour).
    # Lower values prevent a bad recording from passing by stretching/compressing time arbitrarily.
    # Suggested starting point: 30 frames ≈ 0.35 s.  Tighten toward 15 for stricter timing.
    "dtw_window_frames": 30,

    # Recording
    "recording_duration_sec": 3,   # How long to record player input
    "silence_threshold_db": -40,     # Below this = silence

    # Audio
    "preroll_silence_sec": 0.4,      # Silence prepended to each bird call (wakes Bluetooth/sleeping audio devices)
    "sample_rate": 44100,
    "hop_length": 512,
}
