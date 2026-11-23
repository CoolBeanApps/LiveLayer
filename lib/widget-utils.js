((root) => {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function numberFromText(value) {
    const match = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function progressInfo(current, target) {
    const currentNumber = numberFromText(current);
    const targetNumber = numberFromText(target);
    if (!Number.isFinite(currentNumber) || !Number.isFinite(targetNumber) || targetNumber <= 0) return null;
    const percentage = clamp(currentNumber / targetNumber * 100, 0, 100);
    return {
      currentNumber,
      targetNumber,
      percentage,
      roundedPercentage: Math.round(percentage),
      complete: currentNumber >= targetNumber
    };
  }

  function normalizeHex(value, fallback) {
    const text = String(value || "").trim();
    const short = /^#([0-9a-f]{3})$/i.exec(text);
    if (short) return `#${[...short[1]].map((part) => part + part).join("").toLowerCase()}`;
    return /^#[0-9a-f]{6}$/i.test(text) ? text.toLowerCase() : fallback;
  }

  function mixHex(left, right, amount) {
    const start = normalizeHex(left, "#ff4d5e");
    const end = normalizeHex(right, "#ffd54a");
    const ratio = clamp(Number(amount) || 0, 0, 1);
    const channel = (offset) => Math.round(
      parseInt(start.slice(offset, offset + 2), 16)
      + (parseInt(end.slice(offset, offset + 2), 16) - parseInt(start.slice(offset, offset + 2), 16)) * ratio
    ).toString(16).padStart(2, "0");
    return `#${channel(1)}${channel(3)}${channel(5)}`;
  }

  function conditionalColor({
    mode = "inherit",
    current,
    target,
    solidColor = "#ffffff",
    farColor = "#ff4d5e",
    nearColor = "#ffd54a",
    reachedColor = "#42df82"
  } = {}) {
    if (mode === "solid") return normalizeHex(solidColor, "#ffffff");
    if (mode === "inherit") return "";
    const progress = progressInfo(current, target);
    if (!progress) return "";
    if (progress.complete) return normalizeHex(reachedColor, "#42df82");
    if (mode === "threshold") return normalizeHex(farColor, "#ff4d5e");
    if (mode === "spectrum") return mixHex(farColor, nearColor, progress.percentage / 100);
    return "";
  }

  function normalizedWords(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function propTarget(value) {
    const text = String(value || "").replace(/,/g, " ");
    const patterns = [
      /(?:over|at least)\s+(\d+(?:\.\d+)?)/i,
      /(\d+(?:\.\d+)?)\s*\+\s*(?=passing|rushing|receiving|yards?|touchdowns?|tds?|receptions?|catches?|carries?|attempts?|completions?|tackles?|sacks?|points?|pts?|$)/i,
      /(\d+(?:\.\d+)?)\s*(?:or more|plus)\b/i,
      /(?:passing|rushing|receiving)\s+(?:yards?|touchdowns?|tds?)\s+(\d+(?:\.\d+)?)/i
    ];
    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (match) return match[1];
    }
    return "";
  }

  function propIntent(value, target = "") {
    const text = normalizedWords(value);
    const intent = {
      category: /pass(?:ing)?\b/.test(text) ? "passing"
        : /receiv|reception|catches?\b/.test(text) ? "receiving"
          : /rush|carries?\b/.test(text) ? "rushing"
            : /defen|tackles?|sacks?\b/.test(text) ? "defensive"
              : "",
      label: "",
      unit: ""
    };
    if (/yards?|yds?\b/.test(text)) { intent.label = "yards"; intent.unit = "yards"; }
    else if (/touchdowns?|\btds?\b/.test(text)) { intent.label = "td"; intent.unit = "TD"; }
    else if (/receptions?|catches?\b/.test(text)) { intent.label = "rec"; intent.unit = "receptions"; }
    else if (/carries?|rush attempts?\b/.test(text)) { intent.label = "car"; intent.unit = "carries"; }
    else if (/completions?\b/.test(text)) { intent.label = "cmp"; intent.unit = "completions"; }
    else if (/attempts?\b/.test(text)) { intent.label = "att"; intent.unit = "attempts"; }
    else if (/tackles?\b/.test(text)) { intent.label = "tot"; intent.unit = "tackles"; }
    else if (/sacks?\b/.test(text)) { intent.label = "sacks"; intent.unit = "sacks"; }
    else if (/points?|\bpts?\b/.test(text)) { intent.label = "pts"; intent.unit = "points"; }
    if (!intent.category && intent.label === "yards" && Number(target) >= 150) intent.category = "passing";
    return intent;
  }

  function matchingStatLabel(labels, intent) {
    const values = labels || [];
    if (!values.length) return "";
    const exact = {
      yards: [/^YDS$/i, /yards?/i],
      td: [/^TD$/i, /touchdowns?/i],
      rec: [/^REC$/i, /receptions?/i],
      car: [/^CAR$/i, /carries?/i],
      cmp: [/^CMP$/i, /completions?/i, /^C\/ATT$/i],
      att: [/^ATT$/i, /attempts?/i, /^C\/ATT$/i],
      tot: [/^TOT$/i, /total tackles?/i, /tackles?/i],
      sacks: [/^SACKS?$/i],
      pts: [/^PTS$/i, /points?/i]
    }[intent.label] || [];
    for (const pattern of exact) {
      const label = values.find((value) => pattern.test(String(value)));
      if (label) return label;
    }
    return values.find((value) => /YDS|YARDS|TOTAL|TACKLES|SACKS|PTS|POINTS/i.test(String(value))) || values[0];
  }

  function inferPlayerProp(value, candidates = []) {
    const text = normalizedWords(value);
    const target = propTarget(value);
    const intent = propIntent(value, target);
    const scored = candidates.map((candidate) => {
      const fullName = normalizedWords(candidate.athleteName);
      const nameParts = fullName.split(" ").filter((part) => part.length > 1 && !["jr", "sr", "ii", "iii", "iv"].includes(part));
      const lastName = nameParts.at(-1) || "";
      const firstName = nameParts[0] || "";
      let score = fullName && text.includes(fullName) ? 100 : 0;
      if (!score && lastName && text.includes(lastName) && (!firstName || text.includes(firstName[0]))) score = 58;
      const categoryText = normalizedWords(`${candidate.categoryKey || ""} ${candidate.categoryLabel || ""}`);
      if (intent.category && categoryText.includes(intent.category)) score += 45;
      else if (intent.category) score -= 18;
      if (!intent.category && intent.label === "yards" && Number(target) >= 150 && categoryText.includes("passing")) score += 12;
      const statLabel = matchingStatLabel(candidate.labels, intent);
      if (intent.label && statLabel) score += 8;
      return { candidate, score, statLabel };
    }).filter((entry) => entry.score >= 58).sort((left, right) => right.score - left.score);
    const best = scored[0];
    return {
      matched: Boolean(best),
      target,
      unit: intent.unit,
      statLabel: best?.statLabel || "",
      statPart: intent.label === "cmp" ? "first" : intent.label === "att" ? "second" : "",
      sourceId: best?.candidate?.sourceId || "",
      categoryKey: best?.candidate?.categoryKey || "",
      athleteId: best?.candidate?.athleteId || "",
      athleteName: best?.candidate?.athleteName || "",
      confidence: best ? Math.min(100, best.score) : 0
    };
  }

  function rectsOverlap(left, right, gap = 0) {
    return left.left < right.right + gap
      && left.right + gap > right.left
      && left.top < right.bottom + gap
      && left.bottom + gap > right.top;
  }

  function snap(value, size) {
    return Math.max(0, Math.round(value / size) * size);
  }

  function findOpenPlacement({
    viewportWidth,
    viewportHeight,
    width,
    height,
    occupied = [],
    gap = 14,
    gridSize = 32,
    margin = 24
  }) {
    const maxLeft = Math.max(margin, viewportWidth - width - margin);
    const maxTop = Math.max(margin, viewportHeight - height - margin);
    const fits = ({ left, top }) => {
      if (left < margin || top < margin || left > maxLeft || top > maxTop) return false;
      const candidate = { left, top, right: left + width, bottom: top + height };
      return !occupied.some((rect) => rectsOverlap(candidate, rect, gap));
    };
    const candidates = [];
    const last = occupied.at(-1);
    if (last) {
      candidates.push({ left: snap(last.right + gap, gridSize), top: snap(last.top, gridSize) });
      candidates.push({ left: snap(last.left, gridSize), top: snap(last.bottom + gap, gridSize) });
    }
    for (let top = margin; top <= maxTop; top += gridSize) {
      for (let left = margin; left <= maxLeft; left += gridSize) candidates.push({ left, top });
    }
    const open = candidates.find(fits);
    if (open) return open;

    const fallback = candidates.length ? candidates : [{ left: margin, top: margin }];
    return fallback.map((candidate) => {
      const left = clamp(candidate.left, margin, maxLeft);
      const top = clamp(candidate.top, margin, maxTop);
      const rect = { left, top, right: left + width, bottom: top + height };
      const overlapArea = occupied.reduce((total, other) => {
        const overlapWidth = Math.max(0, Math.min(rect.right, other.right) - Math.max(rect.left, other.left));
        const overlapHeight = Math.max(0, Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top));
        return total + overlapWidth * overlapHeight;
      }, 0);
      return { left, top, overlapArea };
    }).sort((a, b) => a.overlapArea - b.overlapArea)[0];
  }

  function toPercentPosition(left, top, viewportWidth, viewportHeight) {
    return {
      x: Math.round(clamp(left / Math.max(1, viewportWidth) * 100, 0, 96) * 100) / 100,
      y: Math.round(clamp(top / Math.max(1, viewportHeight) * 100, 0, 96) * 100) / 100
    };
  }

  root.LiveLayerWidgetUtils = {
    conditionalColor,
    findOpenPlacement,
    inferPlayerProp,
    mixHex,
    numberFromText,
    progressInfo,
    rectsOverlap,
    toPercentPosition
  };
})(globalThis);
