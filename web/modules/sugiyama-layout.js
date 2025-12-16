// Re-export from relocated module to preserve backward compatibility
export {
  assignNodesToLayers,
  calculateBarycenter,
  orderNodesInLayer,
  assignYCoordinates,
  computeSugiyamaLayout,
  convertPositionsToObject,
} from './layout/sugiyama-layout.js';
