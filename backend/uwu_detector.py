"""
UWU detection logic using Dynamic Time Warping
"""

import numpy as np
from dtw import dtw


class UWUDetector:
    """The core matching algorithm using Dynamic Time Warping"""

    def __init__(self, template_contour: np.ndarray, config: dict):
        """
        Args:
            template_contour: Reference uwu pitch contour in semitones
            config: Detection thresholds
        """
        self.template = template_contour
        self.dtw_threshold = config["dtw_threshold"]
        self.min_voiced_ratio = config["min_voiced_ratio"]
        self.pitch_tolerance_semitones = config["pitch_tolerance"]
        self.dtw_window_frames = config.get("dtw_window_frames")  # None = unconstrained

    def analyze(self, player_contour: dict, target_pitch_hz: float) -> dict:
        """
        Analyze player's audio against the uwu template.

        Args:
            player_contour: Output from AudioProcessor.extract_contour()
            target_pitch_hz: Minimum pitch the player must reach for this round

        Returns:
            {
                "contour_match": bool,
                "contour_score": float (0-1, normalized),
                "pitch_match": bool,
                "player_median_hz": float,
                "target_min_hz": float,
                "dtw_distance": float,
                "passed": bool,
                "failure_reason": str | None,
                "performance_score": int (0-10000)
            }
        """
        result = {
            "contour_match": False,
            "contour_score": 0.0,
            "pitch_match": False,
            "player_median_hz": player_contour["median_hz"],
            "target_min_hz": target_pitch_hz,
            "dtw_distance": float("inf"),
            "passed": False,
            "failure_reason": None,
            "performance_score": 0,
            "template_trimmed_st": None,
            "user_resampled_st": None,
        }

        # Check 1: Was there enough voiced audio?
        if player_contour["voiced_ratio"] < self.min_voiced_ratio:
            result["failure_reason"] = "Not enough sound detected. Speak louder!"
            return result

        # Check 2: Contour shape match via DTW
        player_semitones = player_contour["contour_semitones"]

        # Remove zero-padding (unvoiced regions) from edges
        nonzero = np.nonzero(player_semitones)[0]
        if len(nonzero) < 5:
            result["failure_reason"] = "Call too short. Give us a proper uwu!"
            return result

        player_trimmed = player_semitones[nonzero[0] : nonzero[-1] + 1]

        # Trim template to voiced edges so unvoiced zero-regions don't inflate cost.
        template_nonzero = np.nonzero(self.template)[0]
        template_trimmed = (self.template[template_nonzero[0] : template_nonzero[-1] + 1]
                            if len(template_nonzero) >= 5 else self.template)

        # DTW alignment (optionally constrained by a Sakoe-Chiba window).
        # The window must be at least |len(x) - len(y)| or no path can exist.
        dtw_kwargs = {"keep_internals": True}
        if self.dtw_window_frames is not None:
            min_window = abs(len(player_trimmed) - len(template_trimmed))
            actual_window = max(self.dtw_window_frames, min_window)
            dtw_kwargs["window_type"] = "sakoechiba"
            dtw_kwargs["window_args"] = {"window_size": actual_window}
        alignment = dtw(player_trimmed, template_trimmed, **dtw_kwargs)

        raw_distance = alignment.distance
        # Normalize by path length for consistent scoring
        normalized_distance = raw_distance / alignment.jmin

        # Convert to 0-1 score (lower distance = higher score)
        # Using a sigmoid-style mapping
        contour_score = max(0.0, 1.0 - (normalized_distance / self.dtw_threshold))
        result["dtw_distance"] = float(normalized_distance)
        result["contour_score"] = round(contour_score, 3)
        result["contour_match"] = bool(contour_score > 0.35)  # ~35% similarity minimum

        # Expose trimmed contours for chart generation downstream.
        # user_resampled: user contour linearly time-normalised to template duration.
        user_resampled = np.interp(
            np.linspace(0, 1, len(template_trimmed)),
            np.linspace(0, 1, len(player_trimmed)),
            player_trimmed,
        )
        result["template_trimmed_st"] = template_trimmed.tolist()
        result["user_resampled_st"] = user_resampled.tolist()

        # Check 3: Pitch level
        player_hz = player_contour["median_hz"]
        # Player must be at or above the target pitch (controlled by pitch_tolerance)
        semitone_diff = (
            12 * np.log2(player_hz / target_pitch_hz) if player_hz > 0 else -999
        )
        result["pitch_match"] = bool(
            semitone_diff >= -self.pitch_tolerance_semitones
        )

        if not result["contour_match"]:
            result[
                "failure_reason"
            ] = "That didn't sound like uwu! Try matching the bird's call."
        elif not result["pitch_match"]:
            result[
                "failure_reason"
            ] = "Not high enough! The bird needs to feel threatened."

        result["passed"] = bool(result["contour_match"] and result["pitch_match"])

        # Performance score (0–10000): combines contour quality and pitch level.
        # Only meaningful for passing rounds, but computed regardless.
        # Pitch score: 1.0 at or above target, scales linearly to 0.0 at min_hz.
        if self.pitch_tolerance_semitones > 0:
            pitch_score = float(np.clip(1.0 + semitone_diff / self.pitch_tolerance_semitones, 0.0, 1.0))
        else:
            pitch_score = 1.0 if semitone_diff >= 0 else 0.0
        combined = 0.65 * contour_score + 0.35 * pitch_score
        result["performance_score"] = int(round(combined * 10000))

        return result
