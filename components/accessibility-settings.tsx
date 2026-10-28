"use client";

import { useAccessibilityPreferences } from "@/components/accessibility-provider";

const scales = [100, 125, 150, 175] as const;

export function AccessibilitySettings() {
  const { preferences, updatePreferences } = useAccessibilityPreferences();

  function playVoiceSample() {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance("语音引导已开启。重要事项仍请以官方信息为准。");
    utterance.lang = "zh-CN";
    window.speechSynthesis.speak(utterance);
  }

  return (
    <div className="accessibility-settings">
      <section className="setting-row" aria-labelledby="font-size-label">
        <div>
          <h2 id="font-size-label">字体大小</h2>
          <p>设置会保存在此浏览器中。</p>
        </div>
        <div className="segmented-control" role="group" aria-labelledby="font-size-label">
          {scales.map((fontScale) => (
            <button
              aria-pressed={preferences.fontScale === fontScale}
              className="segment-button"
              key={fontScale}
              onClick={() => updatePreferences({ fontScale })}
              type="button"
            >
              {fontScale}%
            </button>
          ))}
        </div>
      </section>
      <label className="setting-row setting-toggle">
        <span>
          <strong>高对比度</strong>
          <small>提高文字、边框和焦点提示的对比度。</small>
        </span>
        <input
          checked={preferences.highContrast}
          onChange={(event) => updatePreferences({ highContrast: event.target.checked })}
          type="checkbox"
        />
      </label>
      <label className="setting-row setting-toggle">
        <span>
          <strong>语音引导</strong>
          <small>开启后可使用页面中的语音播报按钮。</small>
        </span>
        <input
          checked={preferences.voiceGuide}
          onChange={(event) => updatePreferences({ voiceGuide: event.target.checked })}
          type="checkbox"
        />
      </label>
      <button className="small-action" onClick={playVoiceSample} type="button">播放语音示例</button>
    </div>
  );
}
