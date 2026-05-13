import React, { useEffect, useMemo, useState } from 'react';
import { useHighlightStore } from './store';
import { featureMapRegistry } from './featureMaps';
import type { FeatureDescriptor, CorrespondenceRule } from './types';
import { CORRESPONDENCE_COLORS } from './CorrespondenceLines';
import type { GeometryType, GeometryParams } from '../../types';

interface HoverLegendProps {
  geometryType: GeometryType;
  params: GeometryParams;
}

const RULE_DESC: Record<CorrespondenceRule, string> = {
  长对正: 'V ↔ H · 长对正（X 轴对齐）',
  高平齐: 'V ↔ W/R · 高平齐（Y 轴对齐）',
  宽相等: 'H ↔ W/R · 宽相等（Z 轴对齐）',
};

export const HoverLegend: React.FC<HoverLegendProps> = ({
  geometryType,
  params,
}) => {
  const hoveredId = useHighlightStore((s) => s.hoveredId);
  const enabled = useHighlightStore((s) => s.enabled);
  const [cursor, setCursor] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => setCursor({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [enabled]);

  const feature = useMemo<FeatureDescriptor | null>(() => {
    if (!hoveredId) return null;
    const map = featureMapRegistry[geometryType];
    if (!map) return null;
    const list = map({
      width: params.width,
      height: params.height,
      depth: params.depth,
      cutSize: params.cutSize,
    });
    return list.find((f) => f.id === hoveredId) ?? null;
  }, [hoveredId, geometryType, params.width, params.height, params.depth, params.cutSize]);

  if (!enabled || !feature) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: cursor.x + 16,
        top: cursor.y + 16,
        pointerEvents: 'none',
        zIndex: 9999,
        background: 'rgba(15, 23, 42, 0.92)',
        border: '1px solid rgba(250, 204, 21, 0.6)',
        borderRadius: 8,
        padding: '8px 12px',
        color: '#fef3c7',
        fontSize: 12,
        lineHeight: 1.5,
        maxWidth: 280,
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#facc15' }}>
        {feature.label}
      </div>
      <div style={{ fontSize: 11, color: '#cbd5e1', marginBottom: 6 }}>
        {feature.primitive === 'vertex' ? '顶点' : feature.primitive === 'face' ? '面' : '棱'}
        {' · '}出现在 {feature.presentIn.filter((p) => p !== '3d').join(' / ')} 视图
      </div>
      {feature.correspondence.map((rule) => (
        <div key={rule} style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: 2,
              background: CORRESPONDENCE_COLORS[rule],
              flexShrink: 0,
            }}
          />
          <span>{RULE_DESC[rule] ?? rule}</span>
        </div>
      ))}
    </div>
  );
};
