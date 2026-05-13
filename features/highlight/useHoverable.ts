import { useCallback } from 'react';
import { useHighlightStore, useIsHovered } from './store';
import type { FeatureId } from './types';

// R3F 事件接入：给任意 mesh/line 绑悬停行为
// 使用：const { onPointerOver, onPointerOut, highlighted } = useHoverable(featureId)
export const useHoverable = (id: FeatureId) => {
  const setHovered = useHighlightStore((s) => s.setHovered);
  const enabled = useHighlightStore((s) => s.enabled);
  const highlighted = useIsHovered(id);

  const onPointerOver = useCallback(
    (e: { stopPropagation?: () => void }) => {
      if (!enabled) return;
      e.stopPropagation?.();
      setHovered(id);
    },
    [enabled, id, setHovered]
  );

  const onPointerOut = useCallback(
    (e: { stopPropagation?: () => void }) => {
      if (!enabled) return;
      e.stopPropagation?.();
      setHovered(null);
    },
    [enabled, setHovered]
  );

  return { onPointerOver, onPointerOut, highlighted, enabled };
};
