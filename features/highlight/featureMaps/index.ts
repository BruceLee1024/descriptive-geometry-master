import type { FeatureMapRegistry } from '../types';
import { GeometryType } from '../../../types';
import { cubeFeatureMap } from './cube';
import { cutBlockFeatureMap } from './cutBlock';
import { lShapeFeatureMap } from './lShape';
import { genericFeatureMap } from './generic';

export const featureMapRegistry: FeatureMapRegistry = {
  [GeometryType.CUBE]: cubeFeatureMap,
  [GeometryType.CUT_BLOCK]: cutBlockFeatureMap,
  [GeometryType.L_SHAPE]: lShapeFeatureMap,
  [GeometryType.CYLINDER]: genericFeatureMap,
  [GeometryType.CONE]: genericFeatureMap,
  [GeometryType.HEX_PRISM]: genericFeatureMap,
  [GeometryType.WEDGE]: genericFeatureMap,
  [GeometryType.T_SHAPE]: genericFeatureMap,
  [GeometryType.CROSS_SHAPE]: genericFeatureMap,
  [GeometryType.HOLLOW_CYLINDER]: genericFeatureMap,
  [GeometryType.STEPPED_BLOCK]: genericFeatureMap,
  [GeometryType.SPHERE]: genericFeatureMap,
  [GeometryType.TORUS]: genericFeatureMap,
  [GeometryType.PYRAMID]: genericFeatureMap,
  [GeometryType.CUT_CYLINDER]: genericFeatureMap,
  [GeometryType.SLOT_BLOCK]: genericFeatureMap,
  [GeometryType.INTERSECTING_PRISMS]: genericFeatureMap,
  [GeometryType.CUSTOM_PRISM]: genericFeatureMap,
  [GeometryType.CUSTOM_STEPPED]: genericFeatureMap,
  [GeometryType.CUSTOM_HOLE_BLOCK]: genericFeatureMap,
  [GeometryType.CUSTOM_DOUBLE_SLOT]: genericFeatureMap,
  [GeometryType.CSG_WORKSHOP]: genericFeatureMap,
};
