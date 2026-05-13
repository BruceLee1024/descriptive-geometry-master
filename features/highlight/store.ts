import { create } from 'zustand';
import type { FeatureId } from './types';

interface HighlightState {
  enabled: boolean;
  correspondenceLinesEnabled: boolean;
  hoveredId: FeatureId | null;
  setEnabled: (v: boolean) => void;
  setCorrespondenceLinesEnabled: (v: boolean) => void;
  setHovered: (id: FeatureId | null) => void;
}

export const useHighlightStore = create<HighlightState>((set) => ({
  enabled: true,
  correspondenceLinesEnabled: true,
  hoveredId: null,
  setEnabled: (v) => set({ enabled: v, hoveredId: v ? null : null }),
  setCorrespondenceLinesEnabled: (v) => set({ correspondenceLinesEnabled: v }),
  setHovered: (id) => set((s) => (s.hoveredId === id ? s : { hoveredId: id })),
}));

// 选择器：仅订阅「是否是我」这一位，避免其他元素 re-render
export const useIsHovered = (id: FeatureId) =>
  useHighlightStore((s) => s.enabled && s.hoveredId === id);

export const useHighlightEnabled = () => useHighlightStore((s) => s.enabled);
export const useHoveredId = () => useHighlightStore((s) => s.hoveredId);
